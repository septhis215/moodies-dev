import styles from "./LoadingMascot.module.css";
import type { CSSProperties } from "react";

const posterMoods = [
  ["inspirational", "western", "funny", "thrilling", "documentary"],
  ["whimsy", "mind-bending", "nostalgic", "romantic", "bittersweet"],
  ["sci-fi", "chaos", "epic", "horror", "dark", "gritty"],
  ["serenity", "happy", "chill", "cozy", "sad"],
];

/** Full-screen visual; the loading provider owns announcements and dismissal. */
export default function LoadingMascot() {
  return (
    <div aria-hidden="true" className={styles.screen} data-loading-screen>
      <div className={styles.ambient} />
      <div className={styles.stage} data-loading-mascot>
        <div className={styles.header}>
          <span className={styles.loadingTitle}>Loading</span>
        </div>
        <div className={styles.scene}>
          <div className={styles.gallery}>
            {posterMoods.map((moods) => (
              <div key={moods[0]} className={styles.poster}>
                <div className={styles.posterArt} style={Object.fromEntries(
                  Array.from({ length: 6 }, (_, index) => [
                    `--poster-${index}`, `url("/images/moods/${moods[index % moods.length]}.png")`,
                  ]),
                ) as CSSProperties} />
                <div className={styles.posterLines}><span /><span /></div>
              </div>
            ))}
          </div>
          <div className={styles.icons}>
            <svg viewBox="0 0 24 24" className={styles.film}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4" /></svg>
            <svg viewBox="0 0 24 24" className={styles.star}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" /></svg>
            <svg viewBox="0 0 24 24" className={styles.moon}><path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z" /></svg>
            <svg viewBox="0 0 24 24" className={styles.play}><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4Z" /></svg>
          </div>
          <div className={styles.glow} />
          <div className={styles.track} />
          <div className={styles.journey}>
            <div className={styles.traveler}>
              <div className={styles.shadow} />
              <div className={styles.gait}>
                <span className={`${styles.part} ${styles.leftArm}`} />
                <span className={`${styles.part} ${styles.rightArm}`} />
                <span className={`${styles.part} ${styles.leftLeg}`} />
                <span className={`${styles.part} ${styles.rightLeg}`} />
                <span className={`${styles.part} ${styles.body}`} />
              </div>
            </div>
          </div>
        </div>
        <p className={styles.title}>Your next story is on its way</p>
        <div className={styles.footer}>
          <span>Finding something for your mood</span>
          <span className={styles.dots}>
            <i />
            <i />
            <i />
          </span>
        </div>
      </div>
    </div>
  );
}
