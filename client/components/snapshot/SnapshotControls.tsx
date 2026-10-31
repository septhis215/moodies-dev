"use client";

import { useId, type CSSProperties } from 'react';
import type { SnapshotOptions, SnapshotPayload } from '@/lib/snapshot/snapshot-types';
import styles from './SnapshotShareModal.module.css';

export const SNAPSHOT_DESIGNS = [
  { value: 'premiere', label: 'Premiere', detail: 'A cinematic cover' },
  { value: 'ticket', label: 'The ticket', detail: 'Keep the moment' },
  { value: 'editorial', label: 'Editorial', detail: 'A print-inspired story' },
  { value: 'cinematic', label: 'Full bleed', detail: 'Let the artwork speak' },
] as const;

export function SnapshotControls({ options, update, payload }: {
  options: SnapshotOptions; update: <K extends keyof SnapshotOptions>(key: K, value: SnapshotOptions[K]) => void; payload: SnapshotPayload | null;
}) {
  const id = useId();
  return <div className={styles.controlPanel}>
    <fieldset><legend className={styles.fieldLabel}>Choose a template</legend><div className={styles.templates}>
      {SNAPSHOT_DESIGNS.map((design) => <label className={styles.template} key={design.value}>
        <input type="radio" name={`${id}-template`} checked={options.layout === design.value} onChange={() => update('layout', design.value)} aria-label={design.label} />
        <span className={styles.mini} data-layout={design.value} aria-hidden="true">
          {payload?.content.posterUrl ? <img src={payload.content.posterUrl} alt="" /> : <span className={styles.miniArt} />}
          <span className={styles.miniType}><i /><i /><b /></span>
        </span>
        <span className={styles.templateName}>{design.label}<span className={styles.templateDot} /></span>
      </label>)}
    </div></fieldset>
    <fieldset><legend className={styles.fieldLabel}>Accent color</legend><div className={styles.swatches}>
      {(['coral', 'gold', 'ivory', 'custom'] as const).map((accent) => <label key={accent} className={styles.swatch} style={{ '--swatch': accent === 'coral' ? '#ff765f' : accent === 'gold' ? '#e7bc72' : accent === 'ivory' ? '#f0e7dc' : options.customAccent } as CSSProperties}>
        <input type="radio" name={`${id}-accent`} checked={options.accent === accent} onChange={() => update('accent', accent)} aria-label={`${accent} accent`} /><span aria-hidden="true" />
      </label>)}
      <input className={styles.colorPicker} type="color" aria-label="Custom accent color" value={options.customAccent} onChange={(event) => { update('customAccent', event.target.value); update('accent', 'custom'); }} />
    </div></fieldset>
    <fieldset><legend className={styles.fieldLabel}>Background</legend><div className={styles.segmented}>
      {(['midnight', 'warm', 'paper'] as const).map((tone) => <label key={tone}><input type="radio" name={`${id}-tone`} checked={options.tone === tone} onChange={() => update('tone', tone)} aria-label={`${tone} surface`} />{tone === 'midnight' ? 'Midnight' : tone === 'warm' ? 'Warm' : 'Paper'}</label>)}
    </div></fieldset>
    <p className={styles.hint}>Your title, artwork and review stay true to the original. Pick a look and share it.</p>
  </div>;
}
