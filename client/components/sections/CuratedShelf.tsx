"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark } from "lucide-react";
import { TmdbImage } from "@/components/ui/TmdbImage";
import { CarouselNavButton } from "@/components/ui/CarouselNavButton";
import { useCarouselScroll } from "@/hooks/useCarouselScroll";
import { useWatchlist } from "@/hooks/useWatchlist";
import { tmdbImage } from "@/lib/tmdb";
import type { All } from "@/types/all";

const filters = [
  { value: "all", label: "All picks" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "Series" },
] as const;

const mediaType = (item: All) => item.type === "tv" || item.first_air_date ? "tv" : "movie";
const pickKey = (item: All) => `${mediaType(item)}:${item.id}`;
const pickTitle = (item: All) => item.title || item.name || "Untitled";
const posterUrl = (item: All) => item.poster_path
  ? tmdbImage(item.poster_path, "w342")
  : "/placeholder-poster.svg";

const featureClass = "relative isolate flex min-h-60 items-end overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] sm:min-h-72 lg:min-h-80";
const railClass = "mobile-native-scroll scrollbar-hide flex min-w-0 snap-x snap-proximity scroll-px-1 gap-3 overflow-x-auto p-1 pb-2";
const pickClass = "relative w-[4.75rem] shrink-0 snap-start sm:w-24";

export function CuratedShelf({
  items,
  onSaved,
}: {
  items: All[];
  onSaved?: () => void;
}) {
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all");
  const [selection, setSelection] = useState<{ key: string; index: number }>();
  const [savingKey, setSavingKey] = useState<string>();
  const railId = useId();
  const detailsRef = useRef<HTMLAnchorElement>(null);
  const filterRef = useRef<HTMLButtonElement>(null);
  const { ready, add } = useWatchlist();
  const picks = items.filter((item) => filter === "all" || mediaType(item) === filter);
  const selected = picks.find((item) => pickKey(item) === selection?.key)
    ?? picks[Math.min(selection?.index ?? 0, picks.length - 1)];
  const { containerRef, canScrollLeft, canScrollRight, scroll } =
    useCarouselScroll(picks.length);

  useEffect(() => {
    containerRef.current?.scrollTo({ left: 0, behavior: "instant" });
  }, [containerRef, filter]);

  async function savePick(item: All, trigger: HTMLButtonElement) {
    if (!ready || savingKey) return;
    const hadFocus = document.activeElement === trigger;
    const tasteLink = trigger.closest("section")?.querySelector<HTMLAnchorElement>("header a");
    setSavingKey(pickKey(item));
    try {
      await add(item.id, mediaType(item) === "tv" ? "series" : "movie", {
        title: pickTitle(item),
        posterUrl: posterUrl(item),
      });
      onSaved?.();
      requestAnimationFrame(() => {
        if (hadFocus && !trigger.isConnected && document.activeElement === document.body) {
          (filterRef.current ?? tasteLink)?.focus();
        }
      });
    } catch {
      // The watchlist hook reports the failure and reconciles the saved state.
    } finally {
      setSavingKey(undefined);
    }
  }

  const year = (selected?.release_date || selected?.first_air_date || selected?.year)?.slice(0, 4);
  const label = selected && [mediaType(selected) === "tv" ? "Series" : "Movie", year, selected.genres?.[0]]
    .filter(Boolean).join(" · ");
  const savingSelected = selected && savingKey === pickKey(selected);

  return (
    <div className="min-w-0">
      {selected ? (
        <article className={featureClass}>
          <div key={pickKey(selected)} className="ui-overlay-enter pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
            <TmdbImage
              src={selected.backdrop_path ? tmdbImage(selected.backdrop_path, "w1280") : posterUrl(selected)}
              alt=""
              fill
              sizes="(max-width: 1280px) 100vw, 1216px"
              className={selected.backdrop_path ? "object-cover object-center sm:object-[center_35%]" : "object-cover object-center opacity-65 sm:object-right"}
            />
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-t from-black via-black/60 to-black/5 sm:bg-linear-to-r sm:from-black/95 sm:via-black/65 sm:to-transparent" />
          <div className="w-full max-w-2xl p-4 sm:p-8">
            <p className="text-xs font-medium text-white/80 sm:text-sm">{label}</p>
            <h3 aria-live="polite" data-display className="mt-1 line-clamp-2 text-3xl font-bold leading-none text-white [overflow-wrap:anywhere] sm:text-5xl">
              {pickTitle(selected)}
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link ref={detailsRef} href={`/${mediaType(selected) === "tv" ? "tv" : "movies"}/${selected.id}`} aria-label={`Details for ${pickTitle(selected)}`} className="ui-primary-action">
                Details <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <button
                type="button"
                aria-label={`Save ${pickTitle(selected)} to watchlist`}
                aria-busy={savingSelected}
                disabled={!ready}
                aria-disabled={Boolean(savingKey) || !ready}
                onClick={(event) => void savePick(selected, event.currentTarget)}
                className="ui-secondary-action disabled:cursor-default disabled:opacity-60"
              >
                <Bookmark className="size-4" aria-hidden="true" />
                {savingSelected ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </article>
      ) : (
        <div className="flex min-h-60 items-center justify-center ui-panel p-5 text-sm text-[var(--ink-muted)] sm:min-h-72 lg:min-h-80" role="status">
          {filter === "tv" ? "No series in this mix." : "No movies in this mix."}
        </div>
      )}

      <div className="mb-1 mt-2 flex items-center justify-between gap-3">
        <div role="group" aria-label="Filter your curated picks" className="flex min-w-0 flex-wrap gap-1">
          {filters.map(({ value, label }) => (
            <button
              key={value}
              ref={filter === value ? filterRef : undefined}
              type="button"
              aria-pressed={filter === value}
              onClick={() => {
                if (filter === value) return;
                setSelection(undefined);
                setFilter(value);
              }}
              className="ui-filter-chip"
            >
              {label}
            </button>
          ))}
        </div>
        {(canScrollLeft || canScrollRight) && (
          <div className="flex gap-1" role="group" aria-label="Curated pick navigation">
            <CarouselNavButton direction="previous" aria-label="Previous curated picks" aria-controls={railId} disabled={!canScrollLeft} onClick={() => scroll(-1)} />
            <CarouselNavButton direction="next" aria-label="Next curated picks" aria-controls={railId} disabled={!canScrollRight} onClick={() => scroll(1)} />
          </div>
        )}
      </div>
      <div id={railId} ref={containerRef} aria-label="Your curated picks" className={railClass} data-curated-rail>
        {picks.map((item, index) => {
          const key = pickKey(item);
          const title = pickTitle(item);
          return (
            <button
              key={key}
              type="button"
              aria-label={`Preview ${title}`}
              aria-pressed={selected === item}
              onClick={(event) => {
                setSelection({ key, index });
                if (event.detail === 0) {
                  requestAnimationFrame(() => detailsRef.current?.focus());
                }
              }}
              className={`${pickClass} group text-left text-[var(--ink-muted)] hover:text-[var(--ink)] focus-visible:outline-none aria-pressed:text-[var(--ink)]`}
            >
              <span className="relative block aspect-[2/3] overflow-hidden rounded-md border-2 border-transparent bg-[var(--surface-2)] transition-colors group-hover:border-[var(--ink-muted)] group-focus-visible:border-[var(--brand-coral-strong)] group-aria-pressed:border-[var(--brand-coral-strong)]">
                <TmdbImage src={tmdbImage(item.poster_path, "posterSmall") || "/placeholder-poster.svg"} alt="" fill sizes="(max-width: 639px) 76px, 96px" className="object-cover" />
              </span>
              <span className="mt-1 block truncate text-xs font-semibold">{title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CuratedShelfSkeleton() {
  return (
    <div role="status" aria-label="Loading your curated picks">
      <div aria-hidden="true" className={`${featureClass} moodies-skeleton`} />
      <div aria-hidden="true" className="my-2 h-11 w-44 rounded-md bg-[var(--surface-2)] moodies-skeleton" />
      <div aria-hidden="true" className={`${railClass} overflow-hidden`}>
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className={`${pickClass} moodies-skeleton`}>
            <div className="aspect-[2/3] rounded-md bg-[var(--surface-2)]" />
            <div className="mt-1 h-4 w-4/5 rounded bg-[var(--surface-2)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
