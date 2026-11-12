"use client";

import { useId, useState } from "react";
import { TmdbImage } from "@/components/ui/TmdbImage";
import { audienceMoodImage, audienceMoodLabel, getAudienceMoodSummary, type MoodVote } from "./AudienceMood";
import styles from "./AudienceMoodPoster.module.css";

export function AudienceMoodPoster({ poster, title, moods, totalVotes }: {
  poster: string;
  title: string;
  moods: MoodVote[];
  totalVotes?: number;
}) {
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const expanded = phase === "open";
  const captionId = useId();
  const summary = getAudienceMoodSummary(moods, totalVotes);
  const artwork = (
    <span className={styles.artwork}>
      <TmdbImage
        src={poster}
        alt={`${title} poster`}
        fill
        sizes="(min-width: 1280px) 18rem, (min-width: 1024px) 16rem, (min-width: 640px) 8rem, 6rem"
        priority
        className="object-cover"
      />
    </span>
  );

  if (!summary) return <div className={styles.scene}>{artwork}</div>;
  const label = audienceMoodLabel(summary.leaders[0].emoji);
  const closeReveal = () => {
    if (!expanded) return;
    setPhase(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "closed" : "closing");
  };

  return (
    <button
      type="button"
      className={`${styles.scene} ${styles.reveal}`}
      data-expanded={expanded}
      data-closing={phase === "closing"}
      aria-label={`Audience mood: ${label}, ${summary.percent}% of ${summary.total.toLocaleString()} votes`}
      aria-expanded={expanded}
      aria-controls={captionId}
      onBlur={closeReveal}
      onClick={() => { if (expanded) closeReveal(); else setPhase("open"); }}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeReveal(); } }}
    >
      <span className={styles.mascot} aria-hidden="true" onAnimationEnd={() => { if (phase === "closing") setPhase("closed"); }}>
        <TmdbImage
          src={audienceMoodImage(summary.leaders[0].emoji)}
          alt=""
          width={208}
          height={208}
          sizes="(min-width: 1024px) 208px, 112px"
          className={styles.mascotImage}
        />
      </span>
      {artwork}
      <span className={styles.hint} aria-hidden="true">
        <TmdbImage src={audienceMoodImage(summary.leaders[0].emoji)} alt="" width={40} height={40} className={styles.hintImage} />
        <span className={styles.hintLabel}>Audience mood</span>
        <span>{summary.percent}%</span>
      </span>
      <span id={captionId} className={styles.caption} aria-hidden={!expanded}>
        <strong>{label}!</strong>
      </span>
    </button>
  );
}
