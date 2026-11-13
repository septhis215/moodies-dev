"use client";

import { useId, useState } from "react";
import { useCarouselScroll } from "@/hooks/useCarouselScroll";
import Link from "next/link";
import SectionHeader from "@/components/ui/SectionHeader";
import {
  Calendar,
  Film,
  Heart,
  Info,
  Tv,
} from "lucide-react";
import { tmdbImage } from "@/lib/tmdb";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { PosterSaveButton } from "@/components/ui/PosterSaveButton";
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
  embedded?: boolean;
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
  embedded = false,
  getPoster,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  isInWatchlist,
}: CardCarouselProps<T>) {
  const railId = useId();
  const { containerRef, canScrollLeft, canScrollRight, scroll } =
    useCarouselScroll(items.length);
  const [loadingId, setLoadingId] = useState<string | number | null>(null);
  const router = useRouter();
  const watchlist = useWatchlist();

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

  const Container = embedded ? "div" : "section";
  return (
    <Container
      id={sectionId}
      className={
        embedded
          ? "min-w-0"
          : "ui-shell scroll-mt-24 border-b border-[var(--surface-border)] py-8 sm:py-10"
      }
      aria-labelledby={embedded ? undefined : `${sectionId || "media"}-heading`}
    >
      {!embedded && (
        <SectionHeader
          id={`${sectionId || "media"}-heading`}
          title={title}
          titleHref={titleLink}
          description={subtitle}
          className="mb-5"
        />
      )}

      {items.length ? (
        <div className="relative">
          {(canScrollLeft || canScrollRight) && (
            <div role="group" aria-label={`${title} navigation`}>
              <CarouselNavButton
                direction="previous"
                onClick={() => scroll(-1)}
                disabled={!canScrollLeft}
                aria-controls={railId}
                aria-label={`Scroll ${title} left`}
                className="absolute -left-5 top-[42%] z-30 -translate-y-1/2 xl:-left-6"
              />
              <CarouselNavButton
                direction="next"
                onClick={() => scroll(1)}
                disabled={!canScrollRight}
                aria-controls={railId}
                aria-label={`Scroll ${title} right`}
                className="absolute -right-5 top-[42%] z-30 -translate-y-1/2 xl:-right-6"
              />
            </div>
          )}
          <div
            id={railId}
            ref={containerRef}
            className={`mobile-native-scroll -mx-4 flex snap-x snap-proximity scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:scroll-px-0 sm:gap-5 sm:px-0`}
          >
            {items.map((item) => {
              const type = mediaType(item);
              const href = `/${type === "tv" ? "tv" : "movies"}/${item.id}`;
              const titleText = itemTitle(item);
              const rating = item.vote_average ?? (item.rating == null ? null : Number(item.rating));
              const runtime = itemRuntime(item);
              const saved = isSaved(item);
              const loading = loadingId === item.id;

              return (
                <article
                  key={`${type}-${item.id}`}
                  className="group w-[43%] min-w-0 shrink-0 snap-start sm:w-[31vw] sm:min-w-[204px] sm:max-w-[220px] md:w-[25vw] lg:w-[20vw] xl:max-w-[228px]"
                >
                  <div className="ui-media-artwork ui-poster">
                    <Link
                      href={href}
                      aria-label={`Explore ${titleText}`}
                      className="ui-card-link block h-full w-full focus-visible:-outline-offset-2"
                    >
                      <Image
                        src={itemPoster(item)}
                        alt={titleText}
                        fill
                        sizes="(max-width: 640px) 44vw, (max-width: 1024px) 31vw, 228px"
                        className="object-cover"
                      />
                    </Link>
                    <div className="pointer-events-none absolute inset-0 z-10 hidden grid-rows-[3rem_minmax(0,1fr)] bg-[#0b0909]/96 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 sm:grid">
                      <div
                        className="border-b border-white/10"
                        aria-hidden="true"
                      />
                      <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto px-3 py-2 [&>*]:shrink-0">
                        <div className="mt-auto">
                          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-coral-strong)]">
                            {type === "tv" ? (
                              <Tv className="h-3 w-3" />
                            ) : (
                              <Film className="h-3 w-3" />
                            )}
                            {type === "tv" ? "Series" : "Movie"}
                          </p>
                          <Link href={href}>
                            <h4 className="mt-1 line-clamp-2 text-[17px] font-bold leading-[1.15] wrap-anywhere text-[var(--ink)] transition-colors hover:text-[var(--brand-coral-strong)]">
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
                              <span key={genre} className="ui-label px-1.5 py-0 text-[10px] leading-4">
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
                          <div className="border-t border-white/12 pt-1.5">
                            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/75">
                              <Heart className="h-3 w-3 text-[var(--brand-coral-strong)]" />
                              You might also like
                            </p>
                            <TooltipProvider delayDuration={180}>
                              <div className="flex gap-1.5">
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
                                          className="relative aspect-[2/3] w-8 overflow-hidden rounded-sm border border-white/15 bg-[var(--surface-2)] transition-colors hover:border-[var(--brand-coral)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--brand-coral)]"
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
                                            sizes="32px"
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
                    <RatingBadge rating={rating} placement="poster" />
                    <PosterSaveButton
                      title={titleText}
                      saved={saved}
                      saving={loading}
                      onClick={() => toggleSaved(item)}
                    />
                  </div>
                  <Link href={href} className="ui-card-link block">
                    <h3 className="ui-poster-title">
                      {titleText}
                    </h3>
                    <p className="ui-poster-meta">
                      {type === "tv" ? "Series" : "Movie"} · {itemYear(item) || "Date TBA"}
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
    </Container>
  );
}
