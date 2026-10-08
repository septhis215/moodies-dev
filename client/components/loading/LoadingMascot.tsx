import styles from "./LoadingMascot.module.css";

/** Decorative companion to the page skeleton's single live loading announcement. */
export default function LoadingMascot() {
  return (
    <div aria-hidden="true" className={styles.card} data-loading-mascot>
      <div className={styles.header}>
        <span className={styles.brand}>Moodies</span>
        <span className={styles.badge}>Loading</span>
      </div>
      <div className={styles.scene}>
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
        <span className={styles.dots}><i /><i /><i /></span>
      </div>
    </div>
  );
}
