"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Recovery links reload the document so they also work when the root layout or client router has failed. */

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Home, RefreshCw, Sparkles, Ticket } from "lucide-react";
import { supportMailtoHref } from "@/lib/app-config";
import styles from "./MoodiesErrorPage.module.css";

const scenes = {
  403: {
    label: "Access restricted", title: "This screening is invite-only.",
    note: "You don’t have permission to open this page. Try signing in with an account that has access, or find another story to enjoy.",
    moods: [
      { image: "western", name: "Western", line: "Even the sheriff checks tickets." },
      { image: "gritty", name: "Gritty", line: "A tough crowd. A softer landing." },
      { image: "thrilling", name: "Thrilling", line: "A little suspense at the door." },
    ],
  },
  404: {
    label: "Page not found", title: "A plot twist. A missing page.",
    note: "This page may have moved, or the link took a wrong turn. Your next great watch is still out there.",
    moods: [
      { image: "mind-bending", name: "Mind-Bending", line: "Even our mascot lost the plot." },
      { image: "whimsy", name: "Whimsy", line: "A little lost. Still full of wonder." },
      { image: "sci-fi", name: "Sci-Fi", line: "Wrong universe. Let’s head home." },
    ],
  },
  500: {
    label: "Unexpected intermission", title: "A little chaos behind the scenes.",
    note: "We couldn’t finish loading this view. Give it another try, or head home while we get the show back on track.",
    moods: [
      { image: "chaos", name: "Chaos", line: "The popcorn is handling it better than we are." },
      { image: "bittersweet", name: "Bittersweet", line: "A small setback in a bigger story." },
      { image: "chill", name: "Chill", line: "Take a breath. We’ll try another take." },
    ],
  },
} as const;

export default function MoodiesErrorPage({ status, onRetry, title, note, standalone = false }: {
  status: keyof typeof scenes; onRetry?: () => void; title?: string; note?: string; standalone?: boolean;
}) {
  const scene = scenes[status];
  const [moodIndex, setMoodIndex] = useState(0);
  const mood = scene.moods[moodIndex % scene.moods.length];
  return <section className={`${styles.page} ${standalone ? styles.standalone : ""}`} aria-labelledby="moodies-error-title" data-error-status={status}>
    <div className={styles.ambient} aria-hidden="true" />
    <div className={styles.shell}>
      <div className={styles.scene}>
        <span className={styles.code} data-display aria-hidden="true">{status}</span>
        <div className={styles.orbit} aria-hidden="true" />
        <Sparkles className={styles.sparkle} aria-hidden="true" />
        <Ticket className={styles.ticket} aria-hidden="true" />
        <button type="button" className={styles.mascotButton} onClick={() => setMoodIndex(value => value + 1)} aria-label="Change the mascot mood" aria-describedby="mascot-hint">
          <span className={styles.float}><Image key={mood.image} src={`/images/moods/${mood.image}.png`} alt={`${mood.name} mood mascot`} width={320} height={320} priority unoptimized className={styles.mascot} /></span>
        </button>
        <p id="mascot-hint" className={styles.hint}><RefreshCw size={13} aria-hidden="true" />Tap for a change of mood</p>
        <p className={styles.caption} role="status" aria-live="polite" aria-atomic="true">{mood.line}</p>
      </div>
      <div className={styles.copy}>
        <p className={styles.kicker}>Moodies <span aria-hidden="true">/</span> {status}</p>
        <p className={styles.label}>{scene.label}</p>
        <h1 id="moodies-error-title" className={styles.title}>{title ?? scene.title}</h1>
        <p className={styles.note}>{note ?? scene.note}</p>
        <div className={styles.actions}>
          {status === 500 ? <button type="button" onClick={() => onRetry ? onRetry() : window.location.reload()} className={styles.primary}><RefreshCw size={17} aria-hidden="true" />Try again</button>
            : status === 403 ? <a href="/auth/login" className={styles.primary}><Ticket size={17} aria-hidden="true" />Sign in</a>
              : <a href="/" className={styles.primary}><Home size={17} aria-hidden="true" />Back to home</a>}
          <a href={status === 404 ? "/moods" : "/"} className={styles.secondary}>{status === 404 ? "Explore by mood" : "Back to home"}<ArrowRight size={17} aria-hidden="true" /></a>
        </div>
        <div className={styles.support}><span>Still stuck? We’re here to help.</span><a href={supportMailtoHref(`Moodies ${status} page help`)}>Contact support<ArrowRight size={14} aria-hidden="true" /></a></div>
      </div>
    </div>
  </section>;
}
