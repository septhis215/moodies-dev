"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowDownToLine, Check, Copy, Loader2, RefreshCw, RotateCcw, X } from 'lucide-react';
import { appToast } from '@/lib/toast';
import { requestContentSnapshot, requestReviewSnapshot } from '@/lib/snapshot/snapshot-api';
import { renderSnapshotToDataUrl, snapshotDimensions } from '@/lib/snapshot/render-snapshot';
import { DEFAULT_SNAPSHOT_OPTIONS, type SnapshotOptions, type SnapshotPayload, type SnapshotSource } from '@/lib/snapshot/snapshot-types';
import { SNAPSHOT_DESIGNS, SnapshotControls } from './SnapshotControls';
import styles from './SnapshotShareModal.module.css';

export function SnapshotShareModal({ open, onClose, source }: { open: boolean; onClose: () => void; source: SnapshotSource | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [payload, setPayload] = useState<SnapshotPayload | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [options, setOptions] = useState<SnapshotOptions>(DEFAULT_SNAPSHOT_OPTIONS);
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderedKey, setRenderedKey] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const sourceType = source?.type;
  const sourceId = source?.type === 'review' ? source.reviewId : source?.tmdbId;
  const mediaType = source?.type === 'content' ? source.mediaType : undefined;
  const renderKey = JSON.stringify(options);

  useEffect(() => {
    if (!open) { dialog.current?.close(); return; }
    const node = dialog.current; if (!node) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; node.showModal();
    const viewport = () => {
      const view = window.visualViewport;
      node.style.setProperty('--studio-height', `${view?.height ?? window.innerHeight}px`);
      node.style.setProperty('--studio-bottom', `${Math.max(0, innerHeight - (view?.height ?? innerHeight) - (view?.offsetTop ?? 0))}px`);
    };
    viewport(); window.visualViewport?.addEventListener('resize', viewport);
    return () => { node.close(); document.body.style.overflow = overflow; previousFocus?.focus(); window.visualViewport?.removeEventListener('resize', viewport); };
  }, [open]);

  useEffect(() => {
    if (!open || !sourceType || sourceId === undefined) return;
    let cancelled = false;
    setLoading(true); setPayload(null); setDataUrl(null); setError(''); setEditing(false);
    const request = sourceType === 'review' ? requestReviewSnapshot(String(sourceId)) : requestContentSnapshot({ mediaType: mediaType!, tmdbId: sourceId });
    request.then((next) => { if (!cancelled) setPayload(next); })
      .catch((failure: unknown) => { if (!cancelled) setError(failure instanceof Error ? failure.message : 'Could not create this snapshot.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, sourceType, sourceId, mediaType, retry]);

  useEffect(() => {
    if (!open || !payload) return;
    let cancelled = false;
    setRendering(true); setError('');
    const timer = window.setTimeout(() => {
      void renderSnapshotToDataUrl(payload, options).then((url) => {
        if (!cancelled) { setDataUrl(url); setRenderedKey(JSON.stringify(options)); }
      }).catch((failure: unknown) => {
        if (!cancelled) { setDataUrl(null); setError(failure instanceof Error ? failure.message : 'Could not render this snapshot.'); }
      }).finally(() => { if (!cancelled) setRendering(false); });
    }, 120);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, payload, options]);

  function update<K extends keyof SnapshotOptions>(key: K, value: SnapshotOptions[K]) { setOptions((current) => ({ ...current, [key]: value })); }
  const busy = loading || rendering;
  const ready = Boolean(dataUrl && payload && !busy && !error && renderedKey === renderKey);
  const dimensions = snapshotDimensions(options.format);
  const design = SNAPSHOT_DESIGNS.find((item) => item.value === options.layout)!;

  function download() {
    if (!ready || !dataUrl || !payload) return;
    const link = document.createElement('a'); link.href = dataUrl;
    link.download = `${payload.content.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'moodies'}-${options.layout}-${options.format}.${options.fileType === 'jpeg' ? 'jpg' : 'png'}`;
    link.click(); appToast.success('Snapshot downloaded.');
  }

  async function copy() {
    if (!ready || !dataUrl || !payload) return;
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const blob = (async () => {
          const png = options.fileType === 'png' ? dataUrl : await renderSnapshotToDataUrl(payload, { ...options, fileType: 'png' });
          return (await fetch(png)).blob();
        })();
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); appToast.success('Snapshot copied.');
      } else {
        await navigator.clipboard.writeText(`${window.location.origin}/${payload.content.mediaType === 'TV' ? 'tv' : 'movies'}/${payload.content.tmdbId}`);
        appToast.info('Your browser supports copying the title link. Link copied.');
      }
    } catch { appToast.error('Could not copy. Download the image to share it.'); }
  }

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={headingId} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.editor}>
      <header className={styles.header}>
        <div><p className="ui-kicker">Made on Moodies</p><h2 id={headingId} className="mt-1.5 text-3xl font-bold leading-none">Snapshot studio</h2></div>
        <button type="button" onClick={onClose} className={styles.close} aria-label="Close snapshot"><X size={20} aria-hidden="true" /></button>
      </header>
      <div className={styles.mobileMode} aria-label="Studio view">
        <button type="button" aria-pressed={!editing} onClick={() => setEditing(false)}>Preview</button><button type="button" aria-pressed={editing} onClick={() => setEditing(true)}>Customize</button>
      </div>
      <div className={`${styles.workspace} ${editing ? styles.editing : ''}`}>
        <section className={styles.stage} aria-label="Snapshot preview" aria-busy={busy}>
          <div className={styles.stageHeading}><span>{design.label}</span><span className={styles.live}>{busy ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}{busy ? 'Updating' : 'Live preview'}</span></div>
          <div className={styles.artboard}>
            {dataUrl && !error ? <img src={dataUrl} alt={`Snapshot of ${payload?.content.title ?? 'this title'}`} className={busy ? styles.updating : ''} /> : null}
            {loading || (rendering && !dataUrl) ? <div className={styles.loading} role="status"><Loader2 size={24} className="animate-spin" aria-hidden="true" /><p>Preparing your canvas…</p></div> : null}
            {error ? <div className={styles.loading} role="alert"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="ui-secondary-action"><RefreshCw size={16} aria-hidden="true" />Try again</button></div> : null}
          </div>
          <div className={styles.canvasMeta}><span>{dimensions.width} × {dimensions.height}</span><span>{options.format === 'story' ? 'Made for stories' : options.format === 'landscape' ? 'The wider view' : 'Ready for your feed'}</span></div>
        </section>
        <aside className={styles.settings} aria-label="Customize snapshot">
          <SnapshotControls options={options} update={update} payload={payload} />
          <div className={styles.settingsFooter}><span>Make every detail yours.</span><button type="button" onClick={() => setOptions(DEFAULT_SNAPSHOT_OPTIONS)}><RotateCcw size={14} aria-hidden="true" />Reset</button></div>
        </aside>
      </div>
      {payload?.review?.isPrivate ? <p className={styles.privacy}>This image includes your private review. Sharing it makes that text visible to others.</p> : null}
      <footer className={styles.footer}>
        <label className={styles.exportFormat}><span className="sr-only">Export file type</span><select aria-label="Export file type" value={options.fileType} onChange={(event) => update('fileType', event.target.value as SnapshotOptions['fileType'])}><option value="png">PNG</option><option value="jpeg">JPG</option></select></label>
        <span className={styles.exportNote}>Your design. Full resolution.</span>
        <div className={styles.actions}><button type="button" onClick={() => void copy()} disabled={!ready} className="ui-secondary-action"><Copy size={16} aria-hidden="true" /><span>Copy</span></button><button type="button" onClick={download} disabled={!ready} className="ui-primary-action"><ArrowDownToLine size={16} aria-hidden="true" />Download</button></div>
      </footer>
    </div>
  </dialog>;
}
