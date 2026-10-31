"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowDownToLine, Check, Copy, Loader2, RefreshCw, X } from 'lucide-react';
import { appToast } from '@/lib/toast';
import { isAppError } from '@/lib/errors/app-error';
import { requestContentSnapshot, requestReviewSnapshot } from '@/lib/snapshot/snapshot-api';
import { renderSnapshotToDataUrl, SNAPSHOT_DIMENSIONS } from '@/lib/snapshot/render-snapshot';
import { useTurnstileGate } from '@/hooks/useTurnstileGate';
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
  const { action: securityAction } = useTurnstileGate();
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
    const controller = new AbortController();
    setLoading(true); setPayload(null); setDataUrl(null); setError('');
    const request = sourceType === 'review' ? requestReviewSnapshot(String(sourceId), controller.signal) : requestContentSnapshot({ mediaType: mediaType!, tmdbId: sourceId, signal: controller.signal });
    request.then((next) => { if (!cancelled) setPayload(next); })
      .catch((failure: unknown) => { if (!cancelled) setError(isAppError(failure) ? failure.userMessage : failure instanceof Error ? failure.message : 'Could not create this snapshot.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
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
  const design = SNAPSHOT_DESIGNS.find((item) => item.value === options.layout)!;

  function download() {
    if (!ready || !dataUrl || !payload) return;
    const link = document.createElement('a'); link.href = dataUrl;
    link.download = `${payload.content.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'moodies'}-${options.layout}.png`;
    link.click(); appToast.success('Snapshot downloaded.');
  }

  async function copy() {
    if (!ready || !dataUrl || !payload) return;
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const blob = fetch(dataUrl).then((response) => response.blob());
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
      <div className={styles.workspace}>
        <section className={styles.stage} aria-label="Snapshot preview" aria-busy={busy}>
          <div className={styles.stageHeading}><span>{design.label}</span><span className={styles.live}>{busy ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}{busy ? 'Updating' : 'Live preview'}</span></div>
          <div className={styles.artboard}>
            {dataUrl && !error ? <img src={dataUrl} alt={`Snapshot of ${payload?.content.title ?? 'this title'}`} className={busy ? styles.updating : ''} /> : null}
            {loading || (rendering && !dataUrl) ? <div className={styles.loading} role="status"><Loader2 size={24} className="animate-spin" aria-hidden="true" /><p>{securityAction === 'snapshot' ? 'Waiting for the security check…' : loading ? 'Loading your title…' : 'Preparing your canvas…'}</p></div> : null}
            {error ? <div className={styles.loading} role="alert"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="ui-secondary-action"><RefreshCw size={16} aria-hidden="true" />Try again</button></div> : null}
          </div>
          <div className={styles.canvasMeta}><span>{SNAPSHOT_DIMENSIONS.width} × {SNAPSHOT_DIMENSIONS.height}</span><span>PNG · Ready to share</span></div>
        </section>
        <aside className={styles.settings} aria-label="Customize snapshot">
          <SnapshotControls options={options} update={update} payload={payload} />
        </aside>
      </div>
      {payload?.review?.isPrivate ? <p className={styles.privacy}>This image includes your private review. Sharing it makes that text visible to others.</p> : null}
      <footer className={styles.footer}>
        <span className={styles.exportNote}>Full resolution. Ready to share.</span>
        <div className={styles.actions}><button type="button" onClick={() => void copy()} disabled={!ready} className="ui-secondary-action"><Copy size={16} aria-hidden="true" /><span>Copy</span></button><button type="button" onClick={download} disabled={!ready} className="ui-primary-action"><ArrowDownToLine size={16} aria-hidden="true" />Download</button></div>
      </footer>
    </div>
  </dialog>;
}
