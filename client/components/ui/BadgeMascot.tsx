"use client";

import Image from "next/image";
import { useId, useState } from "react";
import type { BadgeMascotName } from "@/lib/badge-mascots";
import styles from "./BadgeMascot.module.css";

/** Transparent original artwork with optional, user-triggered animation. */
export function BadgeMascot({ name, alt = "", className = "", sizes = "128px", reaction, priority = false }: {
  name: BadgeMascotName;
  alt?: string;
  className?: string;
  sizes?: string;
  reaction?: string;
  priority?: boolean;
}) {
  const [greetings, setGreetings] = useState(0);
  const captionId = useId();
  const artwork = <Image key={greetings} src={`/images/badges/${name}.png`} alt={reaction ? "" : alt}
    width={256} height={256} sizes={sizes} priority={priority}
    className={`${styles.art} ${greetings ? styles.greet : ""}`} />;

  if (!reaction) return <span className={`${styles.mascot} ${className}`}>{artwork}</span>;

  return <span className={`${styles.mascot} ${className}`}>
    <button type="button" className={styles.button} onClick={() => setGreetings(value => value + 1)}
      aria-label={`Say hello to ${alt || "the Moodies mascot"}`} aria-describedby={captionId}
      title="Tap to say hello">
      {artwork}
      <span aria-hidden="true" className={styles.sparkle}>✦</span>
    </button>
    <span id={captionId} className={greetings ? styles.caption : "sr-only"} role="status" aria-live="polite">
      {greetings ? reaction : "Tap to say hello"}
    </span>
  </span>;
}
