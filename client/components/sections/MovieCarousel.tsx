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
  name?: string; // For TV shows
  poster?: string | null;
  poster_path?: string | null;
  rating?: string | number;
  vote_average?: number;
  overview?: string | null;
  release_date?: string | null;
  first_air_date?: string | null; // For TV shows
  year?: number | 0;
  type?: "movies" | "tv" | "movie" | null;
  media_type?: "movie" | "tv"; // Alternative type field
  genres?: string[];
  vote_count?: number;
  popularity?: number;
  origin_country?: string[];
  recommendations?: MovieLike[];
  number_of_seasons?: number; // For TV shows
  number_of_episodes?: number; // For TV shows
  episode_run_time?: number[]; // For TV shows
  runtime?: number; // For movies
};

interface MovieCarouselProps<T extends MovieLike> {
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

// Add custom scrollbar styles
const scrollbarStyles = `
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
`;

export default function MovieCarousel<T extends MovieLike>({
  title,
  subtitle,
  items,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  isInWatchlist,
}: MovieCarouselProps<T>) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [watchlistStates, setWatchlistStates] = useState<
    Record<string | number, boolean>
  >({});
  const [loadingStates, setLoadingStates] = useState<
    Record<string | number, boolean>
  >({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const router = useRouter();

  // Helper functions to determine content type and get appropriate data
  const getContentType = (item: MovieLike): "movie" | "tv" => {
    // Check various type fields
    if (item.media_type) return item.media_type;
    if (item.type === "movies" || item.type === "movie") return "movie";
    if (item.type === "tv") return "tv";

    // Fallback: check for TV-specific fields
    if (item.number_of_seasons || item.first_air_date || item.name) return "tv";

    // Default to movie
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

  // Initialize watchlist states
  useEffect(() => {
    if (isInWatchlist) {
      const states: Record<string | number, boolean> = {};
      items.forEach((item) => {
        states[item.id] = isInWatchlist(item);
      });
      setWatchlistStates(states);
    }
  }, [items, isInWatchlist]);

  // Handle watchlist toggle
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

  // Detect card + container width dynamically
  useEffect(() => {
    const updateSizes = () => {
      if (containerRef.current) {
        const firstCard =
          containerRef.current.querySelector<HTMLDivElement>(".movie-card");
        if (firstCard) {
          setCardWidth(firstCard.offsetWidth + 16); // include gap
        }
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateSizes();
    window.addEventListener("resize", updateSizes);
    return () => window.removeEventListener("resize", updateSizes);
  }, [items]);

  const cardsPerView = cardWidth ? Math.floor(containerWidth / cardWidth) : 1;
  const maxIndex = cardWidth ? Math.max(0, items.length - cardsPerView) : 0;

  const handlePrev = () =>
    setCurrentIndex((prev) =>
      prev === 0 ? maxIndex : Math.max(0, prev - cardsPerView)
    );

  const handleNext = () =>
    setCurrentIndex((prev) =>
      prev >= maxIndex ? 0 : Math.min(maxIndex, prev + cardsPerView)
    );

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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              {title}
            </h2>
            {subtitle && (
              <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrev}
              className="p-2 sm:p-3 rounded-full bg-gray-800/80 backdrop-blur-sm text-white hover:bg-gray-700/80 transition-all duration-200 border border-gray-700/50 hover:border-gray-600/50"
              disabled={items.length <= cardsPerView}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={handleNext}
              className="p-2 sm:p-3 rounded-full bg-gray-800/80 backdrop-blur-sm text-white hover:bg-gray-700/80 transition-all duration-200 border border-gray-700/50 hover:border-gray-600/50"
              disabled={items.length <= cardsPerView}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Carousel container */}
        <div className="overflow-hidden relative" ref={containerRef}>
          <motion.div
            className="flex gap-3 sm:gap-4"
            animate={{ x: -currentIndex * cardWidth }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {items?.length ? (
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
                    className="movie-card relative w-32 sm:w-40 md:w-48 lg:w-56 xl:w-64 flex-shrink-0 cursor-pointer group"
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
                        <div className={`
                          flex items-center gap-1 px-2 py-1 rounded-lg font-medium text-xs shadow-lg backdrop-blur-md border group-hover:opacity-0 transition-opacity duration-300
                          ${contentType === "tv"
                            ? "bg-blue-500/90 text-white border-blue-400/50"
                            : "bg-purple-500/90 text-white border-purple-400/50"
                          }
                        `}>
                          {contentType === "tv" ? <Tv size={12} /> : <Film size={12} />}
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
                                      <span>{formatVoteCount(movie.vote_count)}</span>
                                    </div>
                                  )}
                                  {runtime && (
                                    <div className="flex items-center gap-1">
                                      {contentType === "tv" ? <Tv size={11} /> : <Film size={11} />}
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
                                  <div className={`
                          flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-xs shadow-lg backdrop-blur-md  
                         
                        `}>
                                    {contentType === "tv" ? <Tv size={12} /> : <Film size={12} />}
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
                                                  onClick={(e) => { e.stopPropagation(); handleCardClick(rec) }}
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
                                                      {rec.vote_average.toFixed(1)}
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
          </motion.div>
        </div>
      </section>
    </>
  );
}