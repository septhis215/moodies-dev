"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Play,
  Check,
  Bookmark,
  BookmarkCheck,
  Star,
  Calendar,
  Users,
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
  year?: number | 0;
  type?: "movies" | "tv" | "movie" | null;
  media_type?: "movie" | "tv";
  genres?: string[];
  vote_count?: number;
  popularity?: number;
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
      if (w < 640) setItemsPerView(1.5);
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
        140,
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
      setCanScrollRight(sLeft < Math.max(0, el.scrollWidth - el.clientWidth - 5));
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
  const cardBasisCss = `calc((100% - ${(Math.max(0, itemsPerView - 1) * GAP_PX)}px) / ${itemsPerView})`;

  const getContentType = (item: MovieLike): "movie" | "tv" => {
    if (item.media_type) return item.media_type;
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

  function posterGetter(item: MovieLike): string {
    return item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : item.poster ?? "/placeholder.jpg";
  }

  useEffect(() => {
    if (isInWatchlist) {
      const states: Record<string | number, boolean> = {};
      items.forEach((item) => {
        states[item.id] = isInWatchlist(item);
      });
      setWatchlistStates(states);
    }
  }, [items, isInWatchlist]);

  const handleWatchlistToggle = async (item: T, event: React.MouseEvent) => {
    event.stopPropagation();

    const itemId = item.id;
    const isCurrentlyInWatchlist = isInWatchlist
      ? isInWatchlist(item)
      : watchlistStates[itemId];

    setLoadingStates((prev) => ({ ...prev, [itemId]: true }));

    try {
      if (isCurrentlyInWatchlist) {
        if (onRemoveFromWatchlist) {
          await onRemoveFromWatchlist(item);
        }
        setWatchlistStates((prev) => ({ ...prev, [itemId]: false }));
      } else {
        if (onAddToWatchlist) {
          await onAddToWatchlist(item);
        }
        setWatchlistStates((prev) => ({ ...prev, [itemId]: true }));
      }
    } catch (error) {
      console.error("Error updating watchlist:", error);
      setWatchlistStates((prev) => ({
        ...prev,
        [itemId]: isCurrentlyInWatchlist,
      }));
    } finally {
      setLoadingStates((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const formatVoteCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count?.toString() || "0";
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


  return (
    <>
      <style jsx>{scrollbarStyles}</style>
      <section className="relative w-full px-4 sm:px-6 py-8 sm:py-12 max-w-7xl mx-auto">
        {/* Section header */}
        <div className="mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              {title}
            </h2>
            {subtitle && (
              <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
            )}
          </div>
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
            className="flex gap-3 sm:gap-4 overflow-x-auto scroll-smooth scrollbar-hide pb-3"
            style={{ WebkitOverflowScrolling: "touch" }}
          >            {items.length ? (
            items.map((movie) => {
              const inWatchlist = isInWatchlist
                ? isInWatchlist(movie)
                : watchlistStates[movie.id];
              const isLoading = loadingStates[movie.id];
              const contentType = getContentType(movie);
              const movieTitle = getTitle(movie);
              const year = getYear(movie);
              const runtime = formatRuntime(movie);

              return (
                <motion.div
                  key={movie.id}
                  whileHover={{ scale: 1.03 }}
                  className="movie-card relative flex-shrink-0 group"
                  style={{
                    flex: `0 0 ${cardBasisCss}`,
                    minWidth: `${itemWidthPx}px`,
                    maxWidth: `${Math.max(itemWidthPx, 220)}px`,
                  }}
                >
                  {/* Main Card Container */}
                  <div
                    className="relative w-full aspect-[2/3] rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 bg-gray-900 cursor-pointer"
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
                      sizes="(max-width: 640px) 128px, (max-width: 768px) 160px, (max-width: 1024px) 192px, (max-width: 1280px) 224px, 256px"
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                      placeholder="blur"
                      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                    />

                    {/* Top Action Bar - Always Visible */}
                    <div className="absolute top-3 left-3 right-3 z-40 flex justify-between items-start">
                      {/* Watchlist Button */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <motion.button
                              onClick={(e) => handleWatchlistToggle(movie, e)}
                              disabled={isLoading}
                              className={`
                                  p-2 rounded-full shadow-lg backdrop-blur-md border transition-all duration-200
                                  ${inWatchlist
                                  ? "bg-green-500/90 border-green-400/50 text-white hover:bg-green-600/90"
                                  : "bg-black/50 border-white/30 text-white hover:bg-black/70 hover:border-white/50"
                                }
                                  ${isLoading
                                  ? "opacity-70 cursor-not-allowed"
                                  : "hover:scale-110"
                                }
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
                                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                                />
                              ) : inWatchlist ? (
                                <BookmarkCheck size={16} />
                              ) : (
                                <Bookmark size={16} />
                              )}
                            </motion.button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="bottom"
                            sideOffset={8}
                            className="rounded-lg bg-black/90 backdrop-blur-md px-3 py-2 shadow-xl border border-white/20"
                          >
                            <div className="text-sm font-medium text-white">
                              {isLoading
                                ? "Updating..."
                                : inWatchlist
                                  ? "Remove from Watchlist"
                                  : "Add to Watchlist"}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {/* Rating Badge */}
                      {movie.vote_average && (
                        <div
                          className={`
                              flex items-center gap-1 px-2 py-1 rounded-lg font-bold text-xs shadow-lg backdrop-blur-md border
                              ${movie.vote_average >= 7.5
                              ? "bg-green-500/90 text-white border-green-400/50"
                              : movie.vote_average >= 6
                                ? "bg-yellow-500/90 text-black border-yellow-400/50"
                                : "bg-red-500/90 text-white border-red-400/50"
                            }
                            `}
                        >
                          <Star size={12} fill="currentColor" />
                          {movie.vote_average.toFixed(1)}
                        </div>
                      )}
                    </div>

                    {/* Content Type Badge - Bottom Left */}
                    <div className="absolute bottom-3 left-3 z-40">
                      <div
                        className={`
                          flex items-center gap-1 px-2 py-1 rounded-lg font-medium text-xs shadow-lg backdrop-blur-md border group-hover:opacity-0 transition-opacity duration-300
                          ${contentType === "tv"
                            ? "bg-blue-500/90 text-white border-blue-400/50"
                            : "bg-purple-500/90 text-white border-purple-400/50"
                          }
                        `}
                      >
                        {contentType === "tv" ? (
                          <Tv size={12} />
                        ) : (
                          <Film size={12} />
                        )}
                        {contentType === "tv" ? "Series" : "Movie"}
                      </div>
                    </div>

                    {/* Hover Overlay - Better positioned and scrollable */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      whileHover={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0 z-30 opacity-0 group-hover:opacity-100"
                    >
                      {/* Top safe zone to avoid collision with action bar */}
                      <div className="h-16 bg-gradient-to-b from-black/60 to-transparent" />

                      {/* Scrollable content area */}
                      <div className="absolute inset-x-0 bottom-0 top-16 bg-gradient-to-t from-black/95 via-black/80 to-black/40 backdrop-blur-md">
                        <div className="h-full overflow-y-auto scrollbar-hide p-2 sm:p-3">
                          <div className="flex flex-col h-full justify-end min-h-full">
                            {/* Title & Info Section */}
                            <div className="space-y-2 bg-gradient-to-t from-black/80 via-black/60 to-transparent rounded-md p-2 backdrop-blur-sm">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="text-sm sm:text-base font-bold text-white line-clamp-2 leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] flex-1">
                                  {movieTitle}
                                </h3>

                                {/* Info button */}
                                <button
                                  className="shrink-0 rounded-full bg-white/20 hover:bg-white/30 text-white transition cursor-pointer p-1"
                                  aria-label="More info"
                                >
                                  <Info size={14} />
                                </button>
                              </div>

                              <div className="flex items-center gap-2 text-xs text-gray-200 flex-wrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                {year && (
                                  <div className="flex items-center gap-1">
                                    <Calendar size={11} />
                                    <span>{year}</span>
                                  </div>
                                )}
                                {movie.vote_count && (
                                  <div className="flex items-center gap-1">
                                    <Users size={11} />
                                    <span>
                                      {formatVoteCount(movie.vote_count)}
                                    </span>
                                  </div>
                                )}
                                {runtime && (
                                  <div className="flex items-center gap-1">
                                    {contentType === "tv" ? (
                                      <Tv size={11} />
                                    ) : (
                                      <Film size={11} />
                                    )}
                                    <span>{runtime}</span>
                                  </div>
                                )}
                                {movie.origin_country?.length ? (
                                  <span className="text-orange-400 font-semibold">
                                    {movie.origin_country[0]}
                                  </span>
                                ) : (
                                  <span className="text-orange-400 font-semibold">
                                    KR
                                  </span>
                                )}
                                <div
                                  className={`
                          flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-xs shadow-lg backdrop-blur-md  
                         
                        `}
                                >
                                  {contentType === "tv" ? (
                                    <Tv size={12} />
                                  ) : (
                                    <Film size={12} />
                                  )}
                                  {contentType === "tv" ? "Series" : "Movie"}
                                </div>
                              </div>

                              {/* Compact genres - only show top 2 */}
                              {movie.genres?.length ? (
                                <div className="flex flex-wrap gap-1">
                                  {movie.genres
                                    .slice(0, 2)
                                    .map((genre, i) => (
                                      <span
                                        key={i}
                                        className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500/70 to-pink-500/70 text-white font-medium border border-white/20"
                                      >
                                        {genre}
                                      </span>
                                    ))}
                                  {movie.genres.length > 2 && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-600/50 text-gray-300 font-medium">
                                      +{movie.genres.length - 2}
                                    </span>
                                  )}
                                </div>
                              ) : null}

                              {/* Watchlist status - compact */}
                              {inWatchlist && (
                                <div className="flex items-center gap-1 text-green-400 text-xs">
                                  <Check size={10} />
                                  <span className="font-medium">
                                    In Watchlist
                                  </span>
                                </div>
                              )}

                              {/* Overview - Optional, only if space allows */}
                              {movie.overview && (
                                <div className="pt-1">
                                  <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed opacity-90">
                                    {movie.overview}
                                  </p>
                                </div>
                              )}

                              {/* Enhanced Recommendations Section */}
                              {movie.recommendations?.length ? (
                                <div className="pt-3 border-t border-white/20">
                                  <div className="flex items-center gap-1 mb-2">
                                    <Heart
                                      size={12}
                                      className="text-pink-400"
                                    />
                                    <p className="text-gray-400 text-xs font-medium">
                                      You might also like
                                    </p>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    {movie.recommendations
                                      .slice(0, 3)
                                      .map((rec) => (
                                        <TooltipProvider key={rec.id}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <motion.div
                                                whileHover={{ scale: 1.1 }}
                                                className="relative aspect-[2/3] rounded-md overflow-hidden cursor-pointer shadow-md hover:shadow-lg transition-all"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleCardClick(rec);
                                                }}
                                              >
                                                <Image
                                                  src={posterGetter(rec)}
                                                  alt={getTitle(rec)}
                                                  fill
                                                  sizes="60px"
                                                  className="object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/20 hover:bg-black/0 transition-colors" />
                                              </motion.div>
                                            </TooltipTrigger>
                                            <TooltipContent
                                              side="bottom"
                                              sideOffset={8}
                                              className="rounded-lg bg-black/90 backdrop-blur-md px-3 py-2 shadow-xl border border-white/20 max-w-[180px]"
                                            >
                                              <div className="text-xs font-medium text-white">
                                                {getTitle(rec)}
                                                {rec.vote_average && (
                                                  <div className="flex items-center gap-1 mt-1 text-gray-300">
                                                    <Star
                                                      size={10}
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