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
    <article className="flex h-full min-w-0 flex-col gap-2" aria-label={title}>
      <Link
        href={(entry.kind === "movie" ? "/movies/" : "/tv/") + entry.id}
        className="group block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral-strong)]"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[var(--surface-1)] ring-1 ring-[var(--surface-border)] transition-[box-shadow] duration-150 group-hover:ring-[var(--brand-coral)] motion-reduce:transition-none">
          <Image
            src={
              tmdbImage(entry.summary?.poster_path, "w500") ||
              "/placeholder-poster.svg"
            }
            alt=""
            fill
            sizes="(max-width: 639px) 50vw, (max-width: 767px) 33vw, (max-width: 1023px) 25vw, (max-width: 1279px) 20vw, 190px"
            className="object-cover"
          />
          <span
            className="absolute left-2 top-0 grid h-9 w-7 place-items-center rounded-b-md bg-[var(--brand-coral)] text-[var(--surface-0)]"
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
        </div>
        <h3 className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-[var(--ink)] group-hover:underline">
          {title}
        </h3>
        <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
          {entry.kind === "movie" ? "Movie" : "Series"} ·{" "}
          {date ? date.slice(0, 4) : "Year unavailable"}
        </p>
      </Link>
      {!entry.summary && (
        <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
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
        className="mt-auto inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--surface-border)] px-3 text-sm font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-coral)] hover:bg-[var(--surface-1)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)] disabled:cursor-wait"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {busy ? "Removing…" : kind === "watchlist" ? "Remove" : "Unlike"}
      </button>
    </article>
  );
}
