"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Star,
} from "lucide-react";
import { TmdbImage } from "@/components/ui/TmdbImage";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { All } from "@/types/all";
import styles from "./CuratedShelf.module.css";

function mediaType(item: All): "movie" | "tv" {
  return item.type === "tv" || item.first_air_date ? "tv" : "movie";
}

function CuratedCard({
  item,
  onSaved,
  featured = false,
}: {
  item: All;
  onSaved: () => void;
  featured?: boolean;
}) {
  const { ready, isInWatchlist, add, remove } = useWatchlist();
  const [busy, setBusy] = useState(false);
  const type = mediaType(item);
  const watchType = type === "tv" ? "series" : "movie";
  const saved = isInWatchlist(item.id, watchType);
  const title = item.title || item.name || "Untitled";
  const year = (
    item.release_date ||
    item.first_air_date ||
    item.year ||
    ""
  ).slice(0, 4);
  const poster = item.poster_path
    ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
    : null;

  async function toggleSave() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await (saved ? remove : add)(item.id, watchType, {
        title,
        posterUrl: poster,
      });
      if (!saved) onSaved();
    } catch {
      // The watchlist hook restores the previous state and reports the error.
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`${styles.card} ${featured ? styles.featured : ""}`}>
      <Link
        href={`/${type}/${item.id}`}
        aria-label={`Explore ${title}`}
        className={styles.poster}
      >
        {poster ? (
          <TmdbImage
            src={poster}
            alt=""
            fill
            sizes={featured ? "(max-width: 639px) 34vw, 220px" : "90px"}
            className="object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-full items-center justify-center text-xs text-[var(--ink-muted)]"
          >
            {type === "tv" ? "Series" : "Movie"}
          </span>
        )}
        {Number.isFinite(item.vote_average) && (item.vote_average ?? 0) > 0 && (
          <span
            className={styles.rating}
            aria-label={`Rating ${item.vote_average?.toFixed(1)} out of 10`}
          >
            <Star size={12} fill="currentColor" aria-hidden="true" />{" "}
            {item.vote_average?.toFixed(1)}
          </span>
        )}
      </Link>
      <div className={styles.copy}>
        {featured && <p className="ui-kicker mb-3">Start here</p>}
        <p className="mb-2 text-xs font-semibold text-[var(--brand-coral-strong)]">
          {type === "tv" ? "Series" : "Movie"}
          {year ? ` · ${year}` : ""}
        </p>
        <Link href={`/${type}/${item.id}`} className={styles.title}>
          {title}
        </Link>
        {featured && (
          <p className={`${styles.genre} mt-2 mb-3`}>
            {item.genres?.slice(0, 2).join(" · ") || "In your personal mix"}
          </p>
        )}
        {featured && (
          <p className={styles.overview}>
            {item.overview ||
              "Take a closer look at this pick from your personal mix."}
          </p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.save}
            disabled={!ready || busy}
            aria-pressed={saved}
            aria-busy={busy}
            aria-label={`${saved ? "Remove" : "Add"} ${title} ${saved ? "from" : "to"} My List`}
            onClick={() => void toggleSave()}
          >
            {saved ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <Bookmark size={15} aria-hidden="true" />
            )}
            {busy
              ? "Saving…"
              : saved
                ? "Saved"
                : featured
                  ? "Save pick"
                  : "Save"}
          </button>
          {featured && (
            <Link href={`/${type}/${item.id}`} className={styles.details}>
              View details
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function CuratedShelf({
  items,
  onSaved,
}: {
  items: All[];
  onSaved?: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "movie" | "tv">("all");
  const railRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const filtered = items.filter(
    (item) => filter === "all" || mediaType(item) === filter,
  );

  function syncEdges() {
    const rail = railRef.current;
    if (rail)
      setEdges({
        start: rail.scrollLeft <= 1,
        end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1,
      });
  }

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const observer = new ResizeObserver(syncEdges);
    observer.observe(rail);
    syncEdges();
    return () => observer.disconnect();
  }, [filter, filtered.length]);
  useEffect(() => {
    if (railRef.current) railRef.current.scrollLeft = 0;
  }, [filter]);

  function scroll(direction: number) {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector("article");
    if (!card) return;
    const stride =
      card.getBoundingClientRect().width +
      parseFloat(getComputedStyle(rail).columnGap || "0");
    const visibleCards = Math.max(1, Math.round(rail.clientWidth / stride));
    rail.scrollBy({
      left: direction * stride * visibleCards,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3">
        <div
          role="group"
          aria-label="Filter your curated picks"
          className="flex min-w-0 flex-wrap gap-1"
        >
          {(
            [
              { value: "all", label: "All picks" },
              { value: "movie", label: "Movies" },
              { value: "tv", label: "Series" },
            ] as const
          ).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`min-h-11 rounded-md px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)] ${filter === value ? "bg-[var(--surface-2)] text-[var(--ink)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <span
            className="sr-only text-xs text-[var(--ink-muted)] sm:not-sr-only"
            aria-live="polite"
            aria-atomic="true"
          >
            {filtered.length} {filtered.length === 1 ? "pick" : "picks"}
          </span>
          <Link
            href="/watchlist"
            aria-label="Your watchlist"
            className="mr-auto inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)] sm:mr-0"
          >
            <Bookmark className="h-4 w-4" aria-hidden="true" />
            <span>Your watchlist</span>
          </Link>
          <button
            type="button"
            aria-label="Previous curated picks"
            disabled={edges.start}
            onClick={() => scroll(-1)}
            aria-controls="curated-picks-rail"
            className={styles.arrow}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Next curated picks"
            disabled={edges.end}
            onClick={() => scroll(1)}
            aria-controls="curated-picks-rail"
            className={styles.arrow}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className={styles.frame}>
        <div
          id="curated-picks-rail"
          key={filter}
          ref={railRef}
          tabIndex={-1}
          aria-label="Your curated picks"
          onScroll={syncEdges}
          className={styles.rail}
          data-curated-rail
        >
          {filtered.map((item, index) => (
            <CuratedCard
              key={`${mediaType(item)}-${item.id}`}
              item={item}
              featured={index === 0}
              onSaved={() => {
                if (document.activeElement === document.body)
                  railRef.current?.focus({ preventScroll: true });
                onSaved?.();
              }}
            />
          ))}
        </div>

        {filtered.length > 1 && (
          <p className={styles.swipe}>Swipe to explore →</p>
        )}
      </div>
      {!filtered.length && (
        <p className="py-6 text-sm text-[var(--ink-muted)]">
          No {filter === "tv" ? "series" : "movies"} in this mix yet. Try All
          picks or adjust your taste.
        </p>
      )}
    </div>
  );
}

export function CuratedShelfSkeleton() {
  return (
    <div role="status" aria-label="Loading your curated picks">
      <span className="sr-only">Finding your picks…</span>
      <div
        aria-hidden="true"
        className="mb-2 flex h-11 items-center gap-3 moodies-skeleton"
      >
        <div className="h-7 w-20 rounded bg-[var(--surface-2)]" />
        <div className="h-3 w-12 rounded bg-[var(--surface-2)]" />
        <div className="h-3 w-12 rounded bg-[var(--surface-2)]" />
      </div>
      <div className={styles.frame} aria-hidden="true">
        <div className={styles.rail}>
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className={`${styles.card} ${index === 0 ? styles.featured : ""} moodies-skeleton`}
            >
              <div className={styles.poster} />
              <div className={styles.copy}>
                <div className="mt-1 h-3 w-1/2 rounded bg-[var(--surface-2)]" />
                <div className="mt-3 h-4 w-4/5 rounded bg-[var(--surface-2)]" />
                <div className="mt-3 h-3 w-2/3 rounded bg-[var(--surface-2)]" />
                <div className="mt-4 h-4 w-1/3 rounded bg-[var(--surface-2)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
