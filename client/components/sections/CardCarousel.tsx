"use client";

import { tmdbImage } from "@/lib/tmdb";
import { useState, useRef, useEffect } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Check,
  Bookmark,
  BookmarkCheck,
  Star,
  Calendar,
  Heart,
  Tv,
  Film,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWatchlist } from "@/hooks/useWatchlist";
import { RatingBadge } from "@/components/ui/rating-badge";

type MovieLike = {
  id: string | number;
  title: string;
  name?: string;
  poster?: string | null;
  poster_path?: string | null;
  rating?: string | number;
  vote_average?: number;
  overview?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  year?: number | string | null;
  type?: "movies" | "tv" | "movie" | "person" | null;
  media_type?: "movie" | "tv" | "person";
  genres?: string[];
  vote_count?: number | null;
  popularity?: number | null;
  origin_country?: string[];
  recommendations?: MovieLike[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
  runtime?: number;
};

interface CardCarouselProps<T extends MovieLike> {
  title: string;
  subtitle?: string;
  items: T[];
  sectionId?: string;
  titleLink?: string;
  getPoster?: (item: T) => string;
  onAddToWatchlist?: (item: T) => void;
  onRemoveFromWatchlist?: (item: T) => void;
  isInWatchlist?: (item: T) => boolean;
  onViewDetails?: (item: T) => void;
  onPlay?: (item: T) => void;
}

const scrollbarStyles = `
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
`;

export default function CardCarousel<T extends MovieLike>({
  title,
  subtitle,
  items,
  sectionId = "",
  titleLink,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  isInWatchlist,
}: CardCarouselProps<T>) {
  const [watchlistStates, setWatchlistStates] = useState<
    Record<string | number, boolean>
  >({});
  const [loadingStates, setLoadingStates] = useState<
    Record<string | number, boolean>
  >({});
  const [itemsPerView, setItemsPerView] = useState(4.5);
  const router = useRouter();

  const { isInWatchlist: hookIsIn, add, remove, ready } = useWatchlist();

  // use parent-provided handlers if present; otherwise use the hook
  const _isInWatchlist = (item: T) =>
    isInWatchlist
      ? isInWatchlist(item)
      : hookIsIn(String(item.id), toWatchType(item));

  const _addToWatchlist = async (item: T) => {
    if (onAddToWatchlist) return onAddToWatchlist(item);
    if (!ready) {
      router.push("/auth/login");
      return;
    }

    const title = getTitle(item) ?? null;
    const posterUrl = posterGetter(item) ?? null;

    await add(String(item.id), toWatchType(item), {
      title,
      posterUrl,
      variant: "info",
      duration: 3500,
    });
  };

  const _removeFromWatchlist = async (item: T) => {
    if (onRemoveFromWatchlist) return onRemoveFromWatchlist(item);
    if (!ready) {
      router.push("/auth/login");
      return;
    }

    const title = getTitle(item) ?? null;
    const posterUrl = posterGetter(item) ?? null;

    await remove(String(item.id), toWatchType(item), {
      title,
      posterUrl,
      variant: "info",
      duration: 3500,
    });
  };

  // DOM ref for scroll container
  const containerRef = useRef<HTMLDivElement | null>(null);

  // gap in px — tailwind 'gap-3 sm:gap-4' we'll assume 12px (gap-3) or 16px (gap-4)
  // your markup uses gap-3 sm:gap-4 - use the larger (sm) on wider screens,
  // but for simplicity pick 16px as approximate gap. you can tune if needed.
  const GAP_PX = 16;

  // measured item width for scroll math (px)
  const [itemWidthPx, setItemWidthPx] = useState<number>(220); // fallback
  const [maxScrollLeft, setMaxScrollLeft] = useState<number>(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // responsive itemsPerView
  useEffect(() => {
    const updateLayout = () => {
      const w = window.innerWidth;
      if (w < 640) setItemsPerView(2.35);
      else if (w < 768) setItemsPerView(2.5);
      else if (w < 1024) setItemsPerView(3.5);
      else setItemsPerView(4.5);
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  // compute sizes & scroll limits using the actual DOM measurements
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const compute = () => {
      const containerWidth = el.clientWidth || 0;
      // compute card width (px) from container width and gaps; clamp with a sensible min
      const computed = Math.max(
        124,
        (containerWidth - Math.max(0, itemsPerView - 1) * GAP_PX) / itemsPerView
      );
      setItemWidthPx(Math.round(computed));

      // compute max scroll from DOM (accurate once children measured)
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      setMaxScrollLeft(maxScroll);

      const sLeft = el.scrollLeft || 0;
      setCanScrollLeft(sLeft > 5);
      setCanScrollRight(sLeft < Math.max(0, maxScroll - 5));
    };

    compute();

    const ro = new ResizeObserver(() => compute());
    ro.observe(el);

    const t = setTimeout(() => compute(), 120);

    const onScroll = () => {
      const sLeft = el.scrollLeft || 0;
      setCanScrollLeft(sLeft > 5);
      setCanScrollRight(
        sLeft < Math.max(0, el.scrollWidth - el.clientWidth - 5)
      );
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      ro.disconnect();
      clearTimeout(t);
      el.removeEventListener("scroll", onScroll);
    };
  }, [items.length, itemsPerView]);

  // step in items (brings the peek into full view), use floor(itemsPerView - 1) but at least 1
  const stepCount = Math.max(1, Math.floor(itemsPerView - 1));
  const stepPx = Math.round(stepCount * (itemWidthPx + GAP_PX));

  const scrollLeft = () => {
    const el = containerRef.current;
    if (!el) return;
    const next = Math.max(0, el.scrollLeft - stepPx);
    el.scrollTo({ left: next, behavior: "smooth" });
  };

  const scrollRight = () => {
    const el = containerRef.current;
    if (!el) return;
    const desired = el.scrollLeft + stepPx;
    const next = Math.min(maxScrollLeft, desired);
    el.scrollTo({ left: next, behavior: "smooth" });
  };

  // CSS flex-basis calc (percentage + gaps) so initial render has correct layout even before JS measurement
  const cardBasisCss = `calc((100% - ${Math.max(0, itemsPerView - 1) * GAP_PX
    }px) / ${itemsPerView})`;

  const getContentType = (item: MovieLike): "movie" | "tv" => {
    if (item.media_type === "movie" || item.media_type === "tv") {
      return item.media_type;
    }
    if (item.type === "movies" || item.type === "movie") return "movie";
    if (item.type === "tv") return "tv";
    if (item.number_of_seasons || item.first_air_date || item.name) return "tv";
    return "movie";
  };

  const getTitle = (item: MovieLike): string => {
    return item.name || item.title;
  };

  const getReleaseDate = (item: MovieLike): string | null => {
    return item.first_air_date || item.release_date || null;
  };

  const getYear = (item: MovieLike): string => {
    if (item.year) return item.year.toString();
    const date = getReleaseDate(item);
    return date ? date.slice(0, 4) : "";
  };

  function posterGetter(item: MovieLike, size: "w342" | "w500" | "w780" = "w500"): string {
    return item.poster_path
      ? tmdbImage(item.poster_path, size)
      : item.poster ?? "/placeholder-poster.svg";
  }

  useEffect(() => {
    if (isInWatchlist) {
      const states: Record<string | number, boolean> = {};
      items.forEach((item) => {
        states[item.id] = isInWatchlist(item);
      });
      setWatchlistStates(states);
    }
  }, [items, isInWatchlist, hookIsIn, ready]);

  const handleWatchlistToggle = async (item: T, event: React.MouseEvent) => {
    event.stopPropagation();

    const itemId = item.id;
    const isCurrentlyInWatchlist = _isInWatchlist(item);

    setLoadingStates((prev) => ({ ...prev, [itemId]: true }));

    try {
      if (isCurrentlyInWatchlist) {
        await _removeFromWatchlist(item);
        setWatchlistStates((prev) => ({ ...prev, [itemId]: false }));
      } else {
        await _addToWatchlist(item);
        setWatchlistStates((prev) => ({ ...prev, [itemId]: true }));
      }
    } catch (error) {
      console.error("Error updating watchlist:", error);
      // rollback
      setWatchlistStates((prev) => ({
        ...prev,
        [itemId]: isCurrentlyInWatchlist,
      }));
    } finally {
      setLoadingStates((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handleCardClick = (movie: MovieLike) => {
    const contentType = getContentType(movie);
    const routePath = contentType === "tv" ? "tv" : "movies";
    const href = `/${routePath}/${movie.id}`;
    router.push(href);
  };

  const formatRuntime = (item: MovieLike): string => {
    const contentType = getContentType(item);

    if (contentType === "tv") {
      if (item.number_of_seasons) {
        const seasons = item.number_of_seasons;
        const episodes = item.number_of_episodes || 0;
        return `${seasons}S${episodes > 0 ? ` • ${episodes}E` : ""}`;
      }
      if (item.episode_run_time?.[0]) {
        return `~${item.episode_run_time[0]}min/ep`;
      }
    } else {
      if (item.runtime) {
        const hours = Math.floor(item.runtime / 60);
        const mins = item.runtime % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      }
    }

    return "";
  };

  const toWatchType = (item: MovieLike): "movie" | "series" =>
    (item.media_type ?? item.type) === "tv" || getContentType(item) === "tv"
      ? "series"
      : "movie";

  return (
    <>
      <style jsx>{scrollbarStyles}</style>
      <section
        id={sectionId}
        className="relative mx-auto w-full max-w-7xl scroll-mt-24 px-4 py-9 sm:px-6 sm:py-16 lg:px-8"
      >
        <div className="mb-4 sm:mb-8">
          {titleLink ? (
            // link to trending page
            <Link href={titleLink} className="inline-block group">
              <h2
                className="bg-clip-text text-[1.35rem] font-bold leading-tight tracking-tight text-transparent sm:text-2xl lg:text-3xl"
                style={{
                  backgroundImage: "linear-gradient(to right, #e94f37, #ff6b58)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {title}
              </h2>
            </Link>
          ) : (
            <h2
              className="bg-clip-text text-[1.35rem] font-bold leading-tight tracking-tight text-transparent sm:text-2xl lg:text-3xl"
              style={{
                backgroundImage: "linear-gradient(to right, #e94f37, #ff6b58)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {title}
            </h2>
          )}

          {subtitle && (
            <p className="mt-1.5 line-clamp-2 max-w-[34ch] text-[13px] leading-5 text-gray-400 sm:mt-2 sm:max-w-none sm:text-sm">{subtitle}</p>
          )}
        </div>

        {/* Carousel container */}
        <div className="relative group/carousel">
          {canScrollLeft && (
            <button
              onClick={scrollLeft}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-50 w-12 h-12 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 shadow-2xl ring-2 ring-white/10"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {canScrollRight && (
            <button
              onClick={scrollRight}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-50 w-12 h-12 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 shadow-2xl ring-2 ring-white/10"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          <div
            ref={containerRef}
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-3 scrollbar-hide sm:gap-4"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {" "}
            {items.length ? (
              items.map((movie) => {
                const inWatchlist =
                  _isInWatchlist(movie) ?? watchlistStates[movie.id];
                const isLoading = loadingStates[movie.id];
                const contentType = getContentType(movie);
                const movieTitle = getTitle(movie);
                const year = getYear(movie);
                const runtime = formatRuntime(movie);

                return (
                  <motion.div
                    key={movie.id}
                    whileHover={{ scale: 1.03 }}
                    className="movie-card group relative flex-shrink-0 snap-start"
                    style={{
                      flex: `0 0 ${cardBasisCss}`,
                      minWidth: `${itemWidthPx}px`,
                      maxWidth: `${Math.max(itemWidthPx, 220)}px`,
                    }}
                  >
                    {/* Main Card Container */}
                    <div
                      className="relative aspect-[2/3] w-full cursor-pointer overflow-hidden rounded-xl bg-gray-900 shadow-lg transition-all duration-300 hover:shadow-2xl"
                      onClick={() => handleCardClick(movie)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleCardClick(movie);
                        }
                      }}
                    >
                      {/* Poster Image */}
                      <Image
                        src={posterGetter(movie)}
                        alt={movieTitle}
                        fill
                        sizes="(max-width: 640px) 42vw, (max-width: 768px) 38vw, (max-width: 1024px) 28vw, (max-width: 1280px) 22vw, 256px"
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                      />

                      {/* Top Action Bar - Always Visible */}
                      <div className="absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3 z-40 flex justify-between items-start">
                        {/* Watchlist Button */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <motion.button
                                onClick={(e) => handleWatchlistToggle(movie, e)}
                                disabled={isLoading}
                                className={`
              flex min-h-9 min-w-9 items-center justify-center rounded-full border p-2 shadow-lg backdrop-blur-md transition-all duration-200 sm:min-h-8 sm:min-w-8 sm:p-2
              ${inWatchlist
                                    ? "bg-green-500/90 border-green-400/50 text-white hover:bg-green-600/90"
                                    : "bg-black/50 border-white/30 text-white hover:bg-black/70 hover:border-white/50"
                                  }
              ${isLoading ? "opacity-70 cursor-not-allowed" : "hover:scale-110"}
            `}
                                whileTap={{ scale: 0.9 }}
                              >
                                {isLoading ? (
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{
                                      duration: 1,
                                      repeat: Infinity,
                                      ease: "linear",
                                    }}
                                    className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"
                                  />
                                ) : inWatchlist ? (
                                  <BookmarkCheck
                                    size={16}
                                    className="h-4 w-4"
                                  />
                                ) : (
                                  <Bookmark
                                    size={16}
                                    className="h-4 w-4"
                                  />
                                )}
                              </motion.button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="bottom"
                              sideOffset={8}
                              className="rounded-lg bg-black/90 backdrop-blur-md px-3 py-2 shadow-xl border border-white/20"
                            >
                              <div className="text-xs sm:text-sm font-medium text-white">
                                {isLoading
                                  ? "Updating..."
                                  : inWatchlist
                                    ? "Remove from My List"
                                    : "Add to My List"}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {/* Rating Badge */}
                        <RatingBadge
                          rating={movie.vote_average}
                          variant="colored"
                          size="sm"
                        />
                      </div>

                      {/* Content Type Badge - Bottom Left (hidden on hover) */}
                      <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 z-40 opacity-100 group-hover:opacity-0 transition-opacity duration-300">
                        <div
                          className={`
        flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[9px] font-medium shadow-lg backdrop-blur-md sm:px-2 sm:py-1 sm:text-xs
        ${contentType === "tv"
                              ? "bg-blue-500/90 text-white border-blue-400/50"
                              : "bg-purple-500/90 text-white border-purple-400/50"
                            }
      `}
                        >
                          {contentType === "tv" ? (
                            <Tv size={10} className="sm:w-3 sm:h-3" />
                          ) : (
                            <Film size={10} className="sm:w-3 sm:h-3" />
                          )}
                          {contentType === "tv" ? "Series" : "Movie"}
                        </div>
                      </div>

                      {/* Hover Overlay - Fixed positioning with no overflow */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 z-30 overflow-hidden opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
                      >
                        {/* Gradient Background */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-black/20 backdrop-blur-[2px]" />
                        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black via-black/75 to-transparent" />

                        {/* Safe Content Area - Avoids top action bar */}
                        <div className="absolute inset-0 flex flex-col">
                          {/* Top spacer to avoid collision with action bar */}
                          <div className="h-12 sm:h-14 shrink-0" />

                          {/* Compact Content Container */}
                          <div className="flex-1 overflow-hidden px-3 pb-3 pt-4 sm:px-3.5 sm:pb-3.5">
                            <div className="flex h-full flex-col justify-end gap-2">
                              {/* Title & Info Button */}
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-lg backdrop-blur-md ${contentType === "tv"
                                      ? "bg-blue-500/85 text-white"
                                      : "bg-purple-500/85 text-white"
                                      }`}
                                  >
                                    {contentType === "tv" ? (
                                      <Tv size={10} />
                                    ) : (
                                      <Film size={10} />
                                    )}
                                    {contentType === "tv" ? "Series" : "Movie"}
                                  </span>
                                  {inWatchlist && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold text-green-300 ring-1 ring-green-400/30">
                                      <Check size={10} />
                                      Saved
                                    </span>
                                  )}
                                </div>
                                <h3 className="line-clamp-2 text-sm font-bold leading-tight text-white sm:text-base">
                                  {movieTitle}
                                </h3>
                              </div>

                              {/* Metadata Row */}
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-gray-200 sm:text-xs">
                                {year && (
                                  <div className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 ring-1 ring-white/10">
                                    <Calendar size={10} />
                                    <span>{year}</span>
                                  </div>
                                )}

                                {runtime && (
                                  <span className="rounded-full bg-white/10 px-2 py-0.5 ring-1 ring-white/10">
                                    {runtime}
                                  </span>
                                )}

                                {movie.origin_country?.length ? (
                                  <span className="rounded-full bg-orange-400/15 px-2 py-0.5 font-semibold text-orange-300 ring-1 ring-orange-300/20">
                                    {movie.origin_country?.[0]}
                                  </span>
                                ) : null}
                              </div>

                              {/* Genres - Compact */}
                              {movie.genres?.length ? (
                                <div className="flex flex-wrap gap-1">
                                  {movie.genres.slice(0, 3).map((genre, i) => (
                                    <span
                                      key={i}
                                      className="rounded border border-white/15 bg-white/10 px-1.5 py-px text-[9px] font-medium leading-4 text-white"
                                    >
                                      {genre}
                                    </span>
                                  ))}
                                  {movie.genres.length > 3 && (
                                    <span className="rounded bg-white/5 px-1.5 py-px text-[9px] font-medium leading-4 text-gray-300">
                                      +{movie.genres.length - 3}
                                    </span>
                                  )}
                                </div>
                              ) : null}

                              <button
                                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[11px] font-bold leading-4 text-gray-950 shadow-md shadow-black/20 transition hover:bg-gray-100 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCardClick(movie);
                                }}
                              >
                                <Info size={13} />
                                View details
                              </button>

                              {/* Recommendations Section */}
                              {movie.recommendations?.length ? (
                                <div className="pt-1.5 border-t border-white/10">
                                  <div className="mb-1.5 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <Heart
                                        size={10}
                                        className="sm:w-3 sm:h-3 text-pink-400"
                                      />
                                      <p className="text-gray-300 text-[10px] sm:text-xs font-semibold">
                                        You might also like
                                      </p>
                                    </div>
                                    <span className="h-px flex-1 bg-white/10" />
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    {movie.recommendations
                                      .slice(0, 3)
                                      .map((rec) => (
                                        <TooltipProvider key={rec.id}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <motion.div
                                                whileHover={{ y: -2, scale: 1.04 }}
                                                className="group/rec relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-white/5 cursor-pointer shadow-lg shadow-black/30 transition-all hover:border-white/30 hover:shadow-xl"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleCardClick(rec);
                                                }}
                                              >
                                                <Image
                                                  src={posterGetter(rec, "w342")}
                                                  alt={getTitle(rec)}
                                                  fill
                                                  sizes="(max-width: 640px) 64px, (max-width: 768px) 72px, (max-width: 1024px) 80px, 96px"
                                                  quality={90}
                                                  className="object-cover transition-transform duration-500 group-hover/rec:scale-105"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-70 transition-opacity group-hover/rec:opacity-35" />
                                                {rec.vote_average ? (
                                                  <div className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-full bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
                                                    <Star
                                                      size={8}
                                                      fill="currentColor"
                                                      className="text-yellow-300"
                                                    />
                                                    {rec.vote_average.toFixed(1)}
                                                  </div>
                                                ) : null}
                                              </motion.div>
                                            </TooltipTrigger>
                                            <TooltipContent
                                              side="bottom"
                                              sideOffset={8}
                                              className="rounded-lg bg-black/90 backdrop-blur-md px-2 sm:px-3 py-1.5 sm:py-2 shadow-xl border border-white/20 max-w-[140px] sm:max-w-[180px]"
                                            >
                                              <div className="text-[10px] sm:text-xs font-medium text-white">
                                                {getTitle(rec)}
                                                {rec.vote_average && (
                                                  <div className="flex items-center gap-1 mt-0.5 text-gray-300">
                                                    <Star
                                                      size={8}
                                                      className="sm:w-2.5 sm:h-2.5"
                                                      fill="currentColor"
                                                    />
                                                    {rec.vote_average.toFixed(
                                                      1
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="flex items-center justify-center w-full h-64 text-gray-500">
                <p>No items to display.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
