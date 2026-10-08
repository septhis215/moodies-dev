"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { TmdbImage } from "@/components/ui/TmdbImage";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { All } from "@/types/all";
import styles from "./CuratedShelf.module.css";

function mediaType(item: All): "movie" | "tv" {
  return item.type === "tv" || item.first_air_date ? "tv" : "movie";
}

function CuratedCard({ item }: { item: All }) {
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
    ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
    : null;

  async function toggleSave() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await (saved ? remove : add)(item.id, watchType, {
        title,
        posterUrl: poster,
      });
    } catch {
      // The watchlist hook restores the previous state and reports the error.
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={styles.card}>
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
            sizes="72px"
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
      </Link>
      <div className={styles.copy}>
        <p className="mb-1 text-xs text-[var(--ink-muted)]">
          {type === "tv" ? "Series" : "Movie"}
          {year ? ` · ${year}` : ""}
        </p>
        <Link href={`/${type}/${item.id}`} className={styles.title}>
          {title}
        </Link>
        <p className={`${styles.genre} mt-1`}>
          {item.genres?.slice(0, 2).join(" · ") || "In your personal mix"}
        </p>
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
          {busy ? "Updating…" : saved ? "Saved" : "Save"}
        </button>
      </div>
    </article>
  );
}

export function CuratedShelf({ items }: { items: All[] }) {
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
    rail.scrollLeft = 0;
    const observer = new ResizeObserver(syncEdges);
    observer.observe(rail);
    syncEdges();
    return () => observer.disconnect();
  }, [filter, items]);

  function scroll(direction: number) {
    const rail = railRef.current;
    rail?.scrollBy({
      left: direction * rail.clientWidth,
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
        <div className="flex items-center gap-2">
          <span
            className="text-xs text-[var(--ink-muted)]"
            aria-live="polite"
            aria-atomic="true"
          >
            {filtered.length} {filtered.length === 1 ? "pick" : "picks"}
          </span>
          <div className="hidden sm:flex">
            <button
              type="button"
              aria-label="Previous curated picks"
              disabled={edges.start}
              onClick={() => scroll(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--ink)] disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Next curated picks"
              disabled={edges.end}
              onClick={() => scroll(1)}
              className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--ink)] disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
      <div
        id="curated-picks-rail"
        key={filter}
        ref={railRef}
        onScroll={syncEdges}
        className={styles.rail}
        data-curated-rail
      >
        {filtered.map((item) => (
          <CuratedCard key={`${mediaType(item)}-${item.id}`} item={item} />
        ))}
      </div>
      {!filtered.length && (
        <p className="py-6 text-sm text-[var(--ink-muted)]">
          No {filter === "tv" ? "series" : "movies"} in this mix yet. Try All
          picks or adjust your taste.
        </p>
      )}
      {filtered.length > 1 && (
        <p className="mt-1 text-xs text-[var(--ink-muted)] sm:hidden">
          Swipe to explore your mix →
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
      <div className={styles.rail} aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className={`${styles.card} moodies-skeleton`}>
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
      <div
        aria-hidden="true"
        className="mt-1 h-4 w-40 rounded bg-[var(--surface-2)] moodies-skeleton sm:hidden"
      />
      <div
        aria-hidden="true"
        className="mt-1 flex h-11 items-center moodies-skeleton"
      >
        <div className="h-3 w-28 rounded bg-[var(--surface-2)]" />
      </div>
    </div>
  );
}
