"use client";

import { useId, useState } from 'react';
import { Star } from 'lucide-react';
import styles from './StarRating.module.css';

const guidance = (rating: number | null) => rating === null ? 'Choose your score' : rating >= 9 ? 'A standout watch' : rating >= 7 ? 'Worth your time' : rating >= 5 ? 'A mixed experience' : rating >= 3 ? 'Not quite for you' : 'A miss this time';

/** Ten native radio choices keep half-star ratings operable by touch and keyboard. */
export function StarRating({ value, onChange, disabled = false }: {
  value: number | null; onChange: (value: number) => void; disabled?: boolean;
}) {
  const name = useId();
  const [preview, setPreview] = useState<number | null>(null);
  const display = preview ?? value;
  return (
    <fieldset className={styles.field} disabled={disabled} onPointerLeave={() => setPreview(null)}>
      <legend className={styles.legend}>Your rating <span>Half stars welcome</span></legend>
      <div className={styles.line}>
        <div className={styles.stars}>
          {[0, 1, 2, 3, 4].map((index) => {
            const fill = Math.max(0, Math.min(1, ((display ?? 0) - index * 2) / 2));
            return <span key={index} className={styles.star}>
              <span className={styles.glyph} aria-hidden="true"><Star className={styles.outline} />
                <span className={styles.fill} style={{ width: `${fill * 100}%` }}><Star /></span></span>
              {[1, 2].map((half) => {
                const score = index * 2 + half;
                return <input key={half} type="radio" name={name} value={score} checked={value === score}
                  aria-label={`${score / 2} out of 5 stars`} onChange={() => onChange(score)} onFocus={() => setPreview(null)}
                  onPointerEnter={(event) => { if (event.pointerType === 'mouse') setPreview(score); }}
                  className={half === 1 ? styles.firstHalf : styles.secondHalf} />;
              })}
            </span>;
          })}
        </div>
        <span className={styles.score} aria-hidden="true">{display ? (display / 2).toFixed(1) : '—'}<small>/ 5</small></span>
      </div>
      <p className={styles.guidance}>{guidance(display)}</p>
    </fieldset>
  );
}
