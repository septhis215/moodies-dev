"use client";

import Link from "next/link";
import { BookmarkCheck, Heart, Trash2 } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { RatingBadge } from "@/components/ui/rating-badge";
import { tmdbImage } from "@/lib/tmdb";
import {
  entryDate,
  entryTitle,
  type LibraryEntry,
  type LibraryKind,
} from "./library-state";

export function LibraryCard({
  entry,
  kind,
  busy,
  onRemove,
}: {
  entry: LibraryEntry;
  kind: LibraryKind;
  busy: boolean;
  onRemove: () => void;
}) {
  const title = entryTitle(entry);
  const date = entryDate(entry);
  const StatusIcon = kind === "watchlist" ? BookmarkCheck : Heart;
  return (
    <article
      className="group/card flex h-full min-w-0 flex-col rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-2 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_18px_42px_rgba(0,0,0,0.28)] motion-reduce:transition-none"
      aria-label={title}
    >
      <Link
        href={(entry.kind === "movie" ? "/movies/" : "/tv/") + entry.id}
        className="group block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)]"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[var(--surface-2)] ring-1 ring-white/5 transition-[box-shadow] duration-150 group-hover:ring-[var(--brand-coral)] motion-reduce:transition-none">
          <Image
            src={
              tmdbImage(entry.summary?.poster_path, "w500") ||
              "/placeholder-poster.svg"
            }
            alt=""
            fill
            sizes="(max-width: 639px) 50vw, (max-width: 767px) 33vw, (max-width: 1023px) 25vw, (max-width: 1279px) 20vw, 190px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.035] motion-reduce:transition-none"
          />
          <span
            className="absolute left-2 top-2 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-[var(--brand-coral)] text-white shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
            aria-label={kind === "watchlist" ? "Saved" : "Liked"}
          >
            <StatusIcon
              className="h-4 w-4"
              fill={kind === "liked" ? "currentColor" : "none"}
              aria-hidden="true"
            />
          </span>
          {entry.summary && (
            <div className="absolute right-2 top-2">
              <RatingBadge
                rating={
                  entry.summary.vote_average > 0
                    ? entry.summary.vote_average
                    : undefined
                }
                variant="colored"
                size="sm"
              />
            </div>
          )}
          <span className="absolute bottom-2 left-2 rounded-md border border-white/15 bg-black/75 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/88 backdrop-blur-sm">
            {entry.kind === "movie" ? "Movie" : "Series"}
          </span>
        </div>
        <h3 className="mt-3 line-clamp-2 min-h-10 px-1 text-sm font-semibold leading-5 text-[var(--ink)] transition-colors group-hover:text-[var(--brand-coral-strong)]">
          {title}
        </h3>
        <p className="mt-1 px-1 text-xs leading-5 text-[var(--ink-muted)]">
          {date ? date.slice(0, 4) : "Year unavailable"}
        </p>
      </Link>
      {!entry.summary && (
        <p className="mt-1 px-1 text-xs leading-5 text-[var(--ink-muted)]">
          Details unavailable
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={onRemove}
        aria-label={
          kind === "watchlist"
            ? "Remove " + title + " from watchlist"
            : "Unlike " + title
        }
        className="mt-2 inline-flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-transparent bg-[var(--surface-2)] px-3 text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-coral)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)] disabled:cursor-wait disabled:opacity-60"
      >
        <span>
          {busy
            ? "Removing…"
            : kind === "watchlist"
              ? "Remove from list"
              : "Remove like"}
        </span>
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </article>
  );
}
