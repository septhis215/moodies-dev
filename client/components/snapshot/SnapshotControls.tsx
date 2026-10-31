"use client";

import { useId, useState } from 'react';
import type { SnapshotOptions, SnapshotPayload } from '@/lib/snapshot/snapshot-types';
import styles from './SnapshotShareModal.module.css';

export const SNAPSHOT_DESIGNS = [
  { value: 'premiere', label: 'Premiere', detail: 'A cinematic cover' },
  { value: 'ticket', label: 'The ticket', detail: 'Keep the moment' },
  { value: 'editorial', label: 'Editorial', detail: 'A print-inspired story' },
  { value: 'cinematic', label: 'Full bleed', detail: 'Let the artwork speak' },
] as const;
const TABS = ['Design', 'Content', 'Image', 'Finish'] as const;

export function SnapshotControls({ options, update, payload }: {
  options: SnapshotOptions; update: <K extends keyof SnapshotOptions>(key: K, value: SnapshotOptions[K]) => void; payload: SnapshotPayload | null;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Design');
  const id = useId();
  function slider(key: 'imagePosition' | 'imageZoom' | 'overlay' | 'titleScale', label: string, min: number, max: number, suffix = '%') {
    return <label className={styles.slider}><span>{label}<output>{options[key]}{suffix}</output></span><input aria-label={label} type="range" min={min} max={max} value={options[key]} onChange={(event) => update(key, Number(event.target.value))} /></label>;
  }
  function toggle(key: 'showDetails' | 'showRating' | 'showCredit' | 'showQuote' | 'texture' | 'border', label: string) {
    return <label className={styles.toggle}><span>{label}</span><input type="checkbox" checked={options[key]} onChange={(event) => update(key, event.target.checked)} /><span className={styles.switch} aria-hidden="true" /></label>;
  }
  return <>
    <div className={styles.tabs} role="tablist" aria-label="Snapshot customization">
      {TABS.map((name, index) => <button type="button" key={name} role="tab" id={`${id}-${name}`} aria-controls={`${id}-panel`} aria-selected={tab === name} tabIndex={tab === name ? 0 : -1}
        onClick={() => setTab(name)} onKeyDown={(event) => {
          const next = event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : undefined;
          if (next !== undefined) { event.preventDefault(); setTab(TABS[next]); event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next].focus(); }
        }}>{name}</button>)}
    </div>
    <div className={styles.controlPanel} role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`}>
      {tab === 'Design' ? <>
        <fieldset><legend className={styles.fieldLabel}>Choose your composition</legend><div className={styles.templates}>
          {SNAPSHOT_DESIGNS.map((design) => <label className={styles.template} key={design.value}>
            <input type="radio" name={`${id}-template`} checked={options.layout === design.value} onChange={() => update('layout', design.value)} aria-label={design.label} />
            <span className={styles.mini} data-layout={design.value} aria-hidden="true">
              {payload?.content.posterUrl ? <img src={payload.content.posterUrl} alt="" /> : <span className={styles.miniArt} />}
              <span className={styles.miniType}><i /><i /><b /></span>
            </span>
            <span className={styles.templateName}>{design.label}<span className={styles.templateDot} /></span>
          </label>)}
        </div></fieldset>
        <label className={styles.fieldLabel}>Canvas format<select aria-label="Format" className={styles.select} value={options.format} onChange={(event) => update('format', event.target.value as SnapshotOptions['format'])}>
          <option value="square">Square · 1:1</option><option value="portrait">Portrait · 4:5</option><option value="story">Story · 9:16</option><option value="landscape">Wide · 16:9</option>
        </select></label>
        <p className={styles.hint}>{SNAPSHOT_DESIGNS.find((design) => design.value === options.layout)?.detail}. Designed for your feed, story, or collection.</p>
      </> : null}
      {tab === 'Content' ? <>
        <label className={styles.fieldLabel}>Display title<input className={styles.select} maxLength={100} value={options.displayTitle} onChange={(event) => update('displayTitle', event.target.value)} placeholder={payload?.content.title || 'Use original title'} /></label>
        {payload?.review ? <div className={styles.quoteNotice}><p>From your review</p><blockquote>{payload.review.content}</blockquote></div> : <label className={styles.fieldLabel}>Your note<textarea aria-label="Your note" className={styles.note} rows={2} maxLength={180} value={options.caption} onChange={(event) => update('caption', event.target.value)} placeholder="A thought worth sharing…" /></label>}
        <div className={styles.toggleGrid}>
          {toggle('showDetails', 'Title details')}{toggle('showRating', 'Rating')}{toggle('showCredit', 'Creator credit')}{toggle('showQuote', payload?.review ? 'Review quote' : 'Personal note')}
        </div>
      </> : null}
      {tab === 'Image' ? <>
        <label className={styles.fieldLabel}>Artwork<select aria-label="Artwork" className={styles.select} value={options.artwork} onChange={(event) => update('artwork', event.target.value as SnapshotOptions['artwork'])}>
          <option value="auto">Best available</option><option value="poster">Original poster</option><option value="backdrop">Backdrop</option><option value="none">Typography only</option>
        </select></label>
        {slider('imagePosition', 'Vertical position', 0, 100)}{slider('imageZoom', 'Image zoom', 100, 160)}{slider('overlay', 'Image contrast', 45, 90)}
        <p className={styles.hint}>Position and zoom change the crop. Contrast controls the shade over full-frame artwork.</p>
      </> : null}
      {tab === 'Finish' ? <>
        <fieldset><legend className={styles.fieldLabel}>Accent color</legend><div className={styles.swatches}>
          {(['coral', 'gold', 'ivory', 'custom'] as const).map((accent) => <label key={accent} className={styles.swatch} style={{ '--swatch': accent === 'coral' ? '#ff765f' : accent === 'gold' ? '#e7bc72' : accent === 'ivory' ? '#f0e7dc' : options.customAccent } as React.CSSProperties}>
            <input type="radio" name={`${id}-accent`} checked={options.accent === accent} onChange={() => update('accent', accent)} aria-label={`${accent} accent`} /><span aria-hidden="true" />
          </label>)}
          <input className={styles.colorPicker} type="color" aria-label="Custom accent color" value={options.customAccent} onChange={(event) => { update('customAccent', event.target.value); update('accent', 'custom'); }} />
        </div></fieldset>
        <fieldset><legend className={styles.fieldLabel}>Surface</legend><div className={styles.segmented}>{(['midnight', 'warm', 'paper'] as const).map((tone) => <label key={tone}><input type="radio" name={`${id}-tone`} checked={options.tone === tone} onChange={() => update('tone', tone)} aria-label={`${tone} surface`} />{tone === 'midnight' ? 'Midnight' : tone === 'warm' ? 'Warm' : 'Paper'}</label>)}</div></fieldset>
        {slider('titleScale', 'Title size', 80, 120)}
        <fieldset><legend className={styles.fieldLabel}>Text alignment</legend><div className={styles.segmented}>{(['left', 'center'] as const).map((align) => <label key={align}><input type="radio" name={`${id}-align`} checked={options.align === align} onChange={() => update('align', align)} aria-label={`${align} alignment`} />{align === 'left' ? 'Left aligned' : 'Centered'}</label>)}</div></fieldset>
        <div className={styles.toggleGrid}>{toggle('texture', 'Film grain')}{toggle('border', 'Fine border')}</div>
      </> : null}
    </div>
  </>;
}
