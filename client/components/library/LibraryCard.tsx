"use client";

import Link from "next/link";
import { BookmarkCheck, Heart, Trash2 } from "lucide-react";
import { TmdbImage } from "@/components/ui/TmdbImage";
import { RatingBadge } from "@/components/ui/rating-badge";
import { tmdbImage } from "@/lib/tmdb";
import {
  entryDate,
  entryTitle,
  type LibraryEntry,
  type LibraryKind,
} from "./library-state";
import styles from "./LibraryPage.module.css";

export function LibraryCard({
  entry,
  kind,
  busy,
  onRemove,
  view = "cards",
}: {
  entry: LibraryEntry;
  kind: LibraryKind;
  busy: boolean;
  onRemove: () => void;
  view?: "cards" | "posters";
}) {
  const title = entryTitle(entry);
  const date = entryDate(entry);
  const href = (entry.kind === "movie" ? "/movies/" : "/tv/") + entry.id;
  const StatusIcon = kind === "watchlist" ? BookmarkCheck : Heart;
  const removeLabel =
    kind === "watchlist"
      ? "Remove " + title + " from watchlist"
      : "Unlike " + title;
  return (
    <article
      className={`${styles.card} ${view === "posters" ? styles.posterCard : ""}`}
      aria-label={title}
    >
      <Link
        href={href}
        className={styles.poster}
        aria-label={"Explore " + title}
      >
        <TmdbImage
          src={
            tmdbImage(entry.summary?.poster_path, "w342") ||
            "/placeholder-poster.svg"
          }
          alt=""
          fill
          sizes={
            view === "posters"
              ? "(max-width: 639px) 45vw, (max-width: 767px) 30vw, 176px"
              : "(max-width: 767px) 30vw, (max-width: 1279px) 16vw, 140px"
          }
        />
      </Link>
      <div className={styles.copy}>
        <div className={styles.meta}>
          <span>
            {entry.kind === "movie" ? "Movie" : "Series"}
            {date ? " · " + date.slice(0, 4) : ""}
          </span>
          {!!entry.summary?.vote_average && (
            <RatingBadge rating={entry.summary.vote_average} size="sm" />
          )}
        </div>
        <h3 className={styles.title}>
          <Link href={href}>{title}</Link>
        </h3>
        <p className={styles.overview}>
          {!entry.summary
            ? "Details unavailable"
            : entry.summary.overview ||
              entry.summary.genres?.slice(0, 2).join(" · ") ||
              "Explore this title to find out more."}
        </p>
        <div className={styles.footer}>
          <span className={styles.status}>
            <StatusIcon
              size={14}
              fill={kind === "liked" ? "currentColor" : "none"}
              aria-hidden="true"
            />
            {kind === "watchlist" ? "On your list" : "Liked by you"}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            aria-label={removeLabel}
            aria-busy={busy}
            title={removeLabel}
            className={styles.remove}
          >
            <Trash2 size={16} aria-hidden="true" />
            <span className="sr-only">{busy ? "Removing…" : removeLabel}</span>
          </button>
        </div>
        {view === "posters" && !entry.summary && (
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Details unavailable
          </p>
        )}
      </div>
    </article>
  );
}
