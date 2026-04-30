"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Star,
  Calendar,
  Play,
  Info,
  TrendingUp,
  Crown,
  Award,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Tv,
  Film,
  Rat,
} from "lucide-react";
import RatingBadge from "../ui/rating-badge";

// Unified interface for both movies and TV series
interface MediaItem {
  id: number;
  title?: string; // For movies
  name?: string; // For TV series
  overview: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string; // For movies
  first_air_date?: string; // For TV series
  vote_average: number;
  vote_count: number;
  popularity: number;
  origin_country: string[];
  genres: string[];
  type: "movie" | "tv";
  number_of_seasons?: number; // For TV series
}

interface CategoryContentProps {
  data: MediaItem[];
  currentPage: number;
  totalPages: number;
  total: number;
  title: string;
  subtitle?: string;
}

export function CategoryContent({
  data,
  currentPage,
  totalPages,
  title,
  subtitle,
}: CategoryContentProps) {
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      params.set("page", newPage.toString());
      router.push(`?${params.toString()}`);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Sort by release date in descending order
  const sortedList = useMemo(() => {
    return [...data].sort((a, b) => {
      const dateA = a.release_date || a.first_air_date || "";
      const dateB = b.release_date || b.first_air_date || "";
      return dateB.localeCompare(dateA);
    });
  }, [data]);

  const getImageUrl = (path?: string) =>
    path ? `https://image.tmdb.org/t/p/original${path}` : "/placeholder-backdrop.svg";

  const getPosterUrl = (path?: string) =>
    path ? `https://image.tmdb.org/t/p/w500${path}` : "/placeholder-poster.svg";

  const getTitle = (item: MediaItem) => item.title || item.name || "Untitled";

  // returns JSX like: "Oct 21st" where "st" is small
  const getReleaseDate = (item: MediaItem): React.ReactNode => {
    const dateStr = item.release_date || item.first_air_date;
    if (!dateStr) return "TBA";

    // Expecting YYYY-MM-DD. Parse with UTC to avoid timezone rollovers.
    const parts = dateStr.split("-").map((p) => Number(p));
    if (parts.length < 3) return "TBA";
    const [year, month, day] = parts;
    if (!year || !month || !day) return "TBA";

    const date = new Date(Date.UTC(year, month - 1, day));

    const monthShort = date.toLocaleString("en-US", {
      month: "short",
      timeZone: "UTC",
    });

    const ordinal = (n: number) => {
      const v = n % 100;
      if (v >= 11 && v <= 13) return "th";
      switch (n % 10) {
        case 1:
          return "st";
        case 2:
          return "nd";
        case 3:
          return "rd";
        default:
          return "th";
      }
    };

    const suf = ordinal(day);

    return (
      <span className="whitespace-nowrap">
        {day}
        <sup className="ml-0.5 mt-1 text-[0.65em]" aria-hidden>
          {suf}{" "}
        </sup>
        <span className="font-semibold">
          {monthShort} <span>{year}</span>
        </span>
      </span>
    );
  };

  const getReleaseYear = (item: MediaItem) => {
    const date = item.release_date || item.first_air_date;
    return date ? date.split("-")[0] : "TBA";
  };

  const handleImageError = (id: number) => {
    setImageErrors((prev) => new Set([...prev, id]));
  };

  const getDetailUrl = (item: MediaItem) =>
    item.type === "movie" ? `/movies/${item.id}` : `/tv/${item.id}`;

  const topThree = data.slice(0, 3);
  const restItems = data.slice(3);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-12 py-16">
        {isPending && (
          <div
            className="fixed top-0 left-0 w-screen h-screen z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md overflow-hidden"
            style={{ inset: 0, position: "fixed" }}
          >
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 p-8 rounded-2xl shadow-2xl ring-1 ring-white/10 flex flex-col items-center gap-4">
              <Loader2 className="w-18 h-18 text-[#ff6b58] animate-spin" />
            </div>
          </div>
        )}
        {/* Content with opacity when loading */}
        <div
          className={`transition-opacity duration-300 ${isPending ? "opacity-50 pointer-events-none" : "opacity-100"
            }`}
        >
          {/* Top 3 Featured Section */}
          {topThree.length > 0 && (
            <section className="space-y-6">
              <section className="space-y-6">
                {/* Header — matches watchlist/liked style */}
                <div className="mt-10 mb-12 relative overflow-hidden">
                  {/* Ghost watermark */}
                  <span className="absolute -top-4 left-0 text-[5rem] sm:text-[8rem] font-black text-white/[0.03] leading-none select-none pointer-events-none tracking-tight whitespace-nowrap">
                    {title.toUpperCase()}
                  </span>

                  <div className="relative">
                    <div className="mb-2">
                      <div className="w-8 h-0.5 bg-[rgb(233,79,55)] mb-2" />
                      <span className="text-[0.62rem] font-bold tracking-[0.2em] uppercase text-white/30">
                        Featured Collection
                      </span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-none">
                      {title}
                    </h1>
                    {subtitle && (
                      <p className="mt-3 text-sm text-white/40 font-medium tracking-wide">
                        {subtitle}
                      </p>
                    )}
                  </div>

                  {/* Gradient rule */}
                  <div className="mt-8 h-px bg-gradient-to-r from-[rgb(233,79,55)]/30 via-white/[0.06] to-transparent" />
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {topThree.map((item, idx) => (
                  <Link
                    key={item.id}
                    href={getDetailUrl(item)}
                    className="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 ring-1 ring-white/10 shadow-2xl hover:ring-[#e94f37]/60 transition-all duration-500 flex flex-col"
                  >
                    {/* Rank Badge */}
                    <div className="absolute top-3 left-3 z-20">
                      <div
                        className="
                          px-3 py-1 
                          rounded-md 
                          bg-gradient-to-br from-neutral-900/80 to-neutral-800/60 
                          border border-neutral-700/50 
                        "
                      >
                        <span className="text-sm font-bold text-white tracking-wide">
                          #{idx + 1}
                        </span>
                      </div>
                    </div>

                    {/* Backdrop Image */}
                    <div className="relative aspect-video overflow-hidden">
                      <img
                        src={getImageUrl(item.backdrop_path)}
                        alt={getTitle(item)}
                        onError={() => handleImageError(item.id)}
                        className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ${imageErrors.has(item.id) ? "opacity-50" : ""
                          }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

                      {/* Type Badge */}
                      <div className="absolute top-2 sm:top-3 right-2 sm:right-3 z-40 opacity-100 group-hover:opacity-0 transition-opacity duration-300">
                        <div
                          className={`
                            flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg font-medium text-[10px] sm:text-xs shadow-lg backdrop-blur-md border
                            ${item.type === "tv"
                              ? "bg-blue-500/90 text-white border-blue-400/50"
                              : "bg-purple-500/90 text-white border-purple-400/50"
                            }
                          `}
                        >
                          {item.type === "tv" ? (
                            <Tv size={10} className="sm:w-3 sm:h-3" />
                          ) : (
                            <Film size={10} className="sm:w-3 sm:h-3" />
                          )}
                          {item.type === "tv" ? "Series" : "Movie"}
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 flex flex-col">
                      {/* Title - Fixed height with line clamp */}
                      <h3 className="text-2xl font-black line-clamp-2 min-h-[2.5rem] group-hover:text-[#ff6b58] transition-colors">
                        {getTitle(item)}
                      </h3>

                      {/* Description - Fixed height with line clamp */}
                      <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed min-h-[4.5rem] mt-3">
                        {item.overview || "No description available"}
                      </p>

                      {/* Metadata section - Consistent spacing */}
                      <div className="space-y-3 mt-4">
                        {/* Rating and Date */}
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1.5 ">
                            <RatingBadge rating={item.vote_average} variant="colored" size="md" />
                          </div>

                          <div className="flex items-center gap-1.5 text-sm text-gray-400">
                            <Calendar className="w-4 h-4" />
                            <span className="font-semibold">
                              {getReleaseDate(item)}
                            </span>
                          </div>

                          {item.number_of_seasons && (
                            <span className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-bold">
                              {item.number_of_seasons} Season
                              {item.number_of_seasons > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        {/* Genres - Fixed height */}
                        <div className="flex flex-wrap gap-2 min-h-[1.75rem] items-start">
                          {item.genres && item.genres.length > 0 ? (
                            item.genres.slice(0, 3).map((genre, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 bg-white/5 rounded-lg text-xs font-medium text-gray-300"
                              >
                                {genre}
                              </span>
                            ))
                          ) : (
                            <span className="h-0 w-0 invisible">-</span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        {/* <div className="flex gap-3 pt-1">
                          <Link
                            href={getDetailUrl(item)}
                            className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-105"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Info className="w-4 h-4" />
                            More Info
                          </Link>

                        </div> */}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Rest of Items Grid */}
          {restItems.length > 0 && (
            <section className="space-y-6 mt-10">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                {restItems.map((item) => (
                  <Link
                    key={item.id}
                    href={getDetailUrl(item)}
                    className="group relative rounded-xl overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-xl ring-1 ring-white/5 hover:ring-[#ff6b58]/50 transition-all duration-300 cursor-pointer"
                  >
                    {/* Poster */}
                    <div className="relative aspect-[2/3] overflow-hidden">
                      <img
                        src={getPosterUrl(item.poster_path)}
                        alt={getTitle(item)}
                        onError={() => handleImageError(item.id)}
                        className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ${imageErrors.has(item.id) ? "opacity-50" : ""
                          }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                      {/* Rating Badge */}
                      <div className="absolute top-2 right-2 ">
                        <RatingBadge rating={item.vote_average} variant="colored" />
                      </div>

                      {/* Content Type Badge - Bottom Left (hidden on hover) */}
                      <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 z-40 opacity-100 group-hover:opacity-0 transition-opacity duration-300">
                        <div
                          className={`
                            flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg font-medium text-[10px] sm:text-xs shadow-lg backdrop-blur-md border
                            ${item.type === "tv"
                              ? "bg-blue-500/90 text-white border-blue-400/50"
                              : "bg-purple-500/90 text-white border-purple-400/50"
                            }
                          `}
                        >
                          {item.type === "tv" ? (
                            <Tv size={10} className="sm:w-3 sm:h-3" />
                          ) : (
                            <Film size={10} className="sm:w-3 sm:h-3" />
                          )}
                          {item.type === "tv" ? "Series" : "Movie"}
                        </div>
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-2xl">
                          <Play className="w-5 h-5 text-black ml-0.5" />
                        </button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h4 className="font-bold text-sm line-clamp-2 mb-2 group-hover:text-[#ff6b58] transition-colors">
                        {getTitle(item)}
                      </h4>

                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span className="font-semibold">
                          {getReleaseYear(item)}
                        </span>
                        {item.number_of_seasons && (
                          <span className="font-semibold">
                            {item.number_of_seasons}S
                          </span>
                        )}
                      </div>

                      {item.genres && item.genres.length > 0 && (
                        <div className="mt-2 text-[10px] text-gray-500 line-clamp-1">
                          {item.genres.slice(0, 2).join(" • ")}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Pagination Controls - Simplified Version */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 py-8">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isPending}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition-all flex items-center gap-2"
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>

            <div className="flex items-center gap-2">
              {/* Show first 3 pages or pages around current page */}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                // Calculate which page number to show
                let pageNum;
                if (currentPage <= 3) {
                  // If we're at the start, show pages 1-5
                  pageNum = i + 1;
                } else {
                  // Otherwise, show current page and 2 before/after
                  pageNum = currentPage - 2 + i;
                }

                // Don't show if page number exceeds total pages
                if (pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    disabled={isPending}
                    className={`w-10 h-10 rounded-lg font-bold transition-all disabled:cursor-not-allowed ${pageNum === currentPage
                      ? "bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white"
                      : "bg-white/10 hover:bg-white/20"
                      } ${isPending ? "opacity-50" : ""}`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Show ellipsis if there are more pages */}
              {currentPage + 2 < totalPages && (
                <span className="text-gray-500">...</span>
              )}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || isPending}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition-all flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Empty State */}
        {sortedList.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-full flex items-center justify-center mb-4">
              <Award className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-400 mb-2">
              No Content Available
            </h3>
            <p className="text-gray-500">
              Check back later for trending movies and TV shows
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
