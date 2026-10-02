"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  Calendar,
  Film,
  Heart,
  Info,
  Tv,
} from "lucide-react";
import { tmdbImage } from "@/lib/tmdb";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { RatingBadge } from "@/components/ui/rating-badge";
import { useRouter } from "next/navigation";
import { useWatchlist } from "@/hooks/useWatchlist";
import { CarouselNavButton } from "@/components/ui/CarouselNavButton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type MediaItem = {
  id: string | number;
  title?: string | null;
  name?: string | null;
  poster?: string | null;
  poster_path?: string | null;
  rating?: string | number | null;
  vote_average?: number | null;
  release_date?: string | null;
  first_air_date?: string | null;
  year?: number | string | null;
  overview?: string | null;
  genres?: string[];
  origin_country?: string[];
  type?: "movies" | "tv" | "movie" | "person" | null;
  media_type?: "movie" | "tv" | "person" | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  episode_run_time?: number[] | null;
  runtime?: number | null;
  recommendations?: MediaItem[];
};

interface CardCarouselProps<T extends MediaItem> {
  title: string;
  subtitle?: string;
  items: T[];
  sectionId?: string;
  titleLink?: string;
  getPoster?: (item: T) => string;
  onAddToWatchlist?: (item: T) => void | Promise<void>;
  onRemoveFromWatchlist?: (item: T) => void | Promise<void>;
  isInWatchlist?: (item: T) => boolean;
  onViewDetails?: (item: T) => void;
  onPlay?: (item: T) => void;
}

export default function CardCarousel<T extends MediaItem>({
  title,
  subtitle,
  items,
  sectionId = "",
  titleLink,
  getPoster,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  isInWatchlist,
}: CardCarouselProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [loadingId, setLoadingId] = useState<string | number | null>(null);
  const router = useRouter();
  const watchlist = useWatchlist();

  const updateScrollState = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    setCanScrollLeft(element.scrollLeft > 4);
    setCanScrollRight(
      element.scrollLeft < element.scrollWidth - element.clientWidth - 4,
    );
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    updateScrollState();
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(element);
    element.addEventListener("scroll", updateScrollState, { passive: true });
    return () => {
      resizeObserver.disconnect();
      element.removeEventListener("scroll", updateScrollState);
    };
  }, [items.length, updateScrollState]);

  const mediaType = (item: MediaItem): "movie" | "tv" => {
    if (item.media_type === "tv" || item.type === "tv") return "tv";
    if (item.first_air_date || item.name || item.number_of_seasons) return "tv";
    return "movie";
  };

  const watchType = (item: MediaItem): "movie" | "series" =>
    mediaType(item) === "tv" ? "series" : "movie";

  const itemTitle = (item: MediaItem) => item.title || item.name || "Untitled";

  const itemPoster = (item: T) => {
    if (getPoster) return getPoster(item);
    if (item.poster_path) return tmdbImage(item.poster_path, "w500");
    return item.poster || "/placeholder-poster.svg";
  };

  const itemYear = (item: MediaItem) => {
    if (item.year) return String(item.year);
    return (item.release_date || item.first_air_date || "").slice(0, 4);
  };

  const itemRuntime = (item: MediaItem) => {
    if (mediaType(item) === "tv") {
      if (item.number_of_seasons) {
        const episodes = item.number_of_episodes
          ? ` · ${item.number_of_episodes}E`
          : "";
        return `${item.number_of_seasons}S${episodes}`;
      }
      if (item.episode_run_time?.[0]) {
        return `${item.episode_run_time[0]} min/ep`;
      }
      return "";
    }

    if (!item.runtime) return "";
    const hours = Math.floor(item.runtime / 60);
    const minutes = item.runtime % 60;
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const isSaved = (item: T) =>
    isInWatchlist
      ? isInWatchlist(item)
      : watchlist.isInWatchlist(String(item.id), watchType(item));

  const toggleSaved = async (item: T) => {
    if (!watchlist.ready && !isInWatchlist) {
      router.push("/auth/login");
      return;
    }

    setLoadingId(item.id);
    try {
      if (isSaved(item)) {
        if (onRemoveFromWatchlist) {
          await onRemoveFromWatchlist(item);
        } else {
          await watchlist.remove(String(item.id), watchType(item), {
            title: itemTitle(item),
            posterUrl: itemPoster(item),
          });
        }
      } else if (onAddToWatchlist) {
        await onAddToWatchlist(item);
      } else {
        await watchlist.add(String(item.id), watchType(item), {
          title: itemTitle(item),
          posterUrl: itemPoster(item),
        });
      }
    } finally {
      setLoadingId(null);
    }
  };

  const scroll = (direction: -1 | 1) => {
    const element = containerRef.current;
    if (!element) return;
    element.scrollBy({
      left: direction * Math.max(320, element.clientWidth * 0.72),
      behavior: "smooth",
    });
  };

  return (
    <section
      id={sectionId}
      className="ui-shell scroll-mt-24 border-b border-[var(--surface-border)] py-8 sm:py-10"
      aria-labelledby={`${sectionId || "media"}-heading`}
    >
      <div className="mb-5">
        <div>
          {titleLink ? (
            <Link href={titleLink} className="group inline-block">
              <h2
                id={`${sectionId || "media"}-heading`}
                className="text-3xl font-bold leading-none text-[var(--ink)] transition-colors group-hover:text-[var(--brand-coral-strong)] sm:text-4xl"
              >
                {title}
              </h2>
            </Link>
          ) : (
            <h2
              id={`${sectionId || "media"}-heading`}
              className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
            >
              {title}
            </h2>
          )}
          {subtitle ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {items.length ? (
        <div className="group/carousel relative">
          <CarouselNavButton
            direction="previous"
            onClick={() => scroll(-1)}
            disabled={!canScrollLeft}
            className="absolute -left-5 top-[42%] z-30 hidden -translate-y-1/2 sm:grid"
            aria-label={`Scroll ${title} left`}
          />
          <CarouselNavButton
            direction="next"
            onClick={() => scroll(1)}
            disabled={!canScrollRight}
            className="absolute -right-5 top-[42%] z-30 hidden -translate-y-1/2 sm:grid"
            aria-label={`Scroll ${title} right`}
          />

          <div
            ref={containerRef}
            className="mobile-native-scroll -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:gap-5 sm:px-0"
          >
            {items.map((item) => {
              const type = mediaType(item);
              const href = `/${type === "tv" ? "tv" : "movies"}/${item.id}`;
              const titleText = itemTitle(item);
              const rating = Number(item.vote_average ?? item.rating ?? 0);
              const runtime = itemRuntime(item);
              const saved = isSaved(item);
              const loading = loadingId === item.id;

              return (
                <article
                  key={`${type}-${item.id}`}
                  className="group w-[44vw] min-w-[158px] max-w-[184px] shrink-0 snap-start sm:w-[31vw] sm:min-w-[204px] sm:max-w-[220px] md:w-[25vw] lg:w-[20vw] xl:max-w-[228px]"
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-md border border-[var(--surface-border)] bg-[var(--surface-2)] transition-colors group-hover:border-white/25 group-focus-within:border-white/25">
                    <Link href={href} className="block h-full w-full">
                      <Image
                        src={itemPoster(item)}
                        alt={titleText}
                        fill
                        sizes="(max-width: 640px) 44vw, (max-width: 1024px) 31vw, 228px"
                        className="object-cover"
                      />
                    </Link>
                    <div className="pointer-events-none absolute inset-0 z-10 hidden grid-rows-[3.25rem_minmax(0,1fr)] bg-[#0b0909]/96 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 sm:grid">
                      <div
                        className="border-b border-white/10"
                        aria-hidden="true"
                      />
                      <div className="flex min-h-0 flex-col justify-end gap-2.5 overflow-hidden px-3.5 pb-3.5 pt-3">
                        <div>
                          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-coral-strong)]">
                            {type === "tv" ? (
                              <Tv className="h-3 w-3" />
                            ) : (
                              <Film className="h-3 w-3" />
                            )}
                            {type === "tv" ? "Series" : "Movie"}
                          </p>
                          <Link href={href}>
                            <h4 className="mt-1 line-clamp-2 text-[17px] font-bold leading-[1.15] text-[var(--ink)] transition-colors hover:text-[var(--brand-coral-strong)]">
                              {titleText}
                            </h4>
                          </Link>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[var(--ink-muted)]">
                          {itemYear(item) ? (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {itemYear(item)}
                            </span>
                          ) : null}
                          {runtime ? <span>{runtime}</span> : null}
                          {item.origin_country?.[0] ? (
                            <span>{item.origin_country[0]}</span>
                          ) : null}
                        </div>

                        {item.genres?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {item.genres.slice(0, 3).map((genre) => (
                              <span
                                key={genre}
                                className="border border-white/15 px-1.5 py-0.5 text-[9px] font-medium text-white/80"
                              >
                                {genre}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {!item.recommendations?.length && item.overview ? (
                          <p className="line-clamp-3 text-[11px] leading-[1.45] text-[var(--ink-muted)]">
                            {item.overview}
                          </p>
                        ) : null}

                        <Link
                          href={href}
                          className="inline-flex min-h-8 w-full items-center justify-center gap-1.5 rounded-sm bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#0b0909] transition-colors hover:bg-[#f0e9e7]"
                        >
                          <Info className="h-3.5 w-3.5" />
                          View details
                        </Link>

                        {item.recommendations?.length ? (
                          <div className="border-t border-white/12 pt-2.5">
                            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/75">
                              <Heart className="h-3 w-3 text-[var(--brand-coral-strong)]" />
                              You might also like
                            </p>
                            <TooltipProvider delayDuration={180}>
                              <div className="grid grid-cols-3 gap-2">
                                {item.recommendations.slice(0, 3).map((rec) => {
                                  const recType = mediaType(rec);
                                  const recHref = `/${recType === "tv" ? "tv" : "movies"}/${rec.id}`;
                                  const recRating = Number(
                                    rec.vote_average ?? rec.rating ?? 0,
                                  );
                                  return (
                                    <Tooltip key={`${recType}-${rec.id}`}>
                                      <TooltipTrigger asChild>
                                        <Link
                                          href={recHref}
                                          className="group/rec relative aspect-[2/3] overflow-hidden rounded-sm border border-white/15 bg-[var(--surface-2)] transition-colors hover:border-[var(--brand-coral)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--brand-coral)]"
                                          aria-label={`View ${itemTitle(rec)}`}
                                        >
                                          <Image
                                            src={
                                              rec.poster_path
                                                ? tmdbImage(
                                                    rec.poster_path,
                                                    "w342",
                                                  )
                                                : rec.poster ||
                                                  "/placeholder-poster.svg"
                                            }
                                            alt={itemTitle(rec)}
                                            fill
                                            sizes="72px"
                                            className="object-cover"
                                          />
                                        </Link>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="bottom"
                                        sideOffset={8}
                                        className="max-w-48 border border-white/15 bg-[#0b0909] px-3 py-2 text-white shadow-xl"
                                      >
                                        <p className="line-clamp-2 text-xs font-semibold leading-4">
                                          {itemTitle(rec)}
                                        </p>
                                        <p className="mt-1 text-[10px] text-white/60">
                                          {recType === "tv"
                                            ? "Series"
                                            : "Movie"}
                                          {itemYear(rec)
                                            ? ` · ${itemYear(rec)}`
                                            : ""}
                                          {recRating > 0
                                            ? ` · ${recRating.toFixed(1)}/10`
                                            : ""}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                              </div>
                            </TooltipProvider>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <RatingBadge
                      rating={rating}
                      variant="colored"
                      size="sm"
                      className="absolute right-2 top-2 z-20"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSaved(item)}
                      disabled={loading}
                      className={`absolute left-2 top-2 z-20 grid h-9 w-9 place-items-center rounded-sm border border-white/25 shadow-[0_6px_18px_rgba(0,0,0,0.35)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60 ${
                        saved
                          ? "bg-[var(--brand-coral)] text-white"
                          : "bg-[#0b0909]/90 text-white hover:bg-[var(--ink)] hover:text-[var(--surface-0)]"
                      }`}
                      aria-label={
                        saved
                          ? `Remove ${titleText} from My List`
                          : `Add ${titleText} to My List`
                      }
                    >
                      {loading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
                      ) : saved ? (
                        <BookmarkCheck className="h-4 w-4" />
                      ) : (
                        <Bookmark className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <Link href={href} className="block">
                    <h3 className="mt-3 line-clamp-2 text-[15px] font-semibold leading-5 text-[var(--ink)] transition-colors group-hover:text-[var(--brand-coral-strong)]">
                      {titleText}
                    </h3>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-[var(--ink-muted)]">
                      <span>{type === "tv" ? "Series" : "Movie"}</span>
                      {itemYear(item) ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{itemYear(item)}</span>
                        </>
                      ) : null}
                    </p>
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="py-16 text-center text-sm text-[var(--ink-muted)]">
          No titles available.
        </p>
      )}
    </section>
  );
}
