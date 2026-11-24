"use client";

import Link from "next/link";
import { BookmarkCheck, Heart, Trash2 } from "lucide-react";
import { TmdbImage } from "@/components/ui/TmdbImage";
import { RatingBadge } from "@/components/ui/rating-badge";
import { PosterActions } from "@/components/ui/PosterActions";
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
      className={`ui-panel ${styles.card} ${view === "posters" ? styles.posterCard : ""}`}
      aria-label={title}
    >
      <div
        className={`${styles.poster} ${view === "posters" ? "ui-media-artwork ui-poster" : ""}`}
      >
        <Link href={href} className="absolute inset-0" aria-label={"Explore " + title}>
        <TmdbImage
          src={
            tmdbImage(entry.summary?.poster_path, "w342") ||
            "/placeholder-poster.svg"
          }
          alt=""
          fill
          sizes={
            view === "posters"
              ? "(max-width: 639px) 45vw, (max-width: 767px) 30vw, 208px"
              : "(max-width: 767px) 30vw, (max-width: 1279px) 16vw, 140px"
          }
        />
        </Link>
      </div>
      <div className={styles.copy}>
        {view === "cards" && <div className={styles.meta}>
          <span>
            {view === "cards" ? `${entry.kind === "movie" ? "Movie" : "Series"}${date ? " · " + date.slice(0, 4) : ""}` : date.slice(0, 4)}
          </span>
          {view === "cards" && (
            <RatingBadge rating={entry.summary?.vote_average} variant="minimal" />
          )}
        </div>}
        <div className={view === "posters" ? "ui-poster-caption" : undefined}>
        <h3 className={view === "posters" ? "ui-poster-title" : styles.title} title={title}>
          <Link href={href}>{title}</Link>
        </h3>
        {view === "posters" && date && <p className="ui-poster-meta">{date.slice(0, 4)}</p>}
        </div>
        <p className={styles.overview}>
          {!entry.summary
            ? "Details unavailable"
            : entry.summary.overview ||
              entry.summary.genres?.slice(0, 2).join(" · ") ||
              "Explore this title to find out more."}
        </p>
        {view === "cards" && <div className={styles.footer}>
          <span className={styles.status}>
            <StatusIcon
              size={14}
              fill={kind === "liked" ? "currentColor" : "none"}
              aria-hidden="true"
            />
            {kind === "watchlist" ? "On your list" : "Liked by you"}
          </span>
          {view === "cards" && <button
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
          </button>}
        </div>}
        {view === "posters" && !entry.summary && (
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Details unavailable
          </p>
        )}
        {view === "posters" && (
          <PosterActions
            id={entry.id}
            type={entry.kind}
            title={title}
            rating={entry.summary?.vote_average}
            releaseDate={entry.kind === "tv" ? entry.summary?.first_air_date || entry.summary?.release_date : entry.summary?.release_date}
            status={entry.summary?.status}
            posterUrl={tmdbImage(entry.summary?.poster_path, "w154")}
            {...(kind === "watchlist"
              ? { saved: true, saving: busy, onToggleSave: onRemove }
              : { liked: true, liking: busy, onToggleLike: onRemove })}
          />
        )}
      </div>
    </article>
  );
}
