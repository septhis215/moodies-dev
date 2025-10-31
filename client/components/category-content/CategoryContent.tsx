"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
} from "lucide-react";

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
}

export function CategoryContent({
  data,
  currentPage,
  totalPages,
  title,
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
    path ? `https://image.tmdb.org/t/p/original${path}` : "/coming-soon.png";

  const getPosterUrl = (path?: string) =>
    path ? `https://image.tmdb.org/t/p/w500${path}` : "/coming-soon.png";

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
          {monthShort}{" "}
          <span>{year}</span>
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

  const topThree = data.slice(0, 3);
  const restItems = data.slice(3);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-12 mt-18">
        {/* Page Info */}
        {/* <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black mb-2">Trending Now</h1>
            <p className="text-gray-400">
              Showing {data.length} of {total} items • Page {currentPage} of{" "}
              {totalPages}
            </p>
          </div>
        </div> */}

        {/* Loading Overlay */}
        {isPending && (
          <div
            className="fixed top-0 left-0 w-screen h-screen z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md overflow-hidden"
            style={{ inset: 0, position: "fixed" }}
          >
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 p-8 rounded-2xl shadow-2xl ring-1 ring-white/10 flex flex-col items-center gap-4">
              <Loader2 className="w-18 h-18 text-cyan-400 animate-spin" />
            </div>
          </div>
        )}

        {/* Content with opacity when loading */}
        <div
          className={`transition-opacity duration-300 ${
            isPending ? "opacity-50 pointer-events-none" : "opacity-100"
          }`}
        >
          {/* Top 3 Featured Section */}
          {topThree.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center gap-3 mb-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 blur-xl opacity-50" />
                  <Crown className="relative w-10 h-10 text-amber-400" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  {title}
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {topThree.map((item, idx) => (
                  <div
                    key={item.id}
                    className="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 ring-1 ring-white/10 shadow-2xl hover:ring-amber-500/50 transition-all duration-500"
                  >
                    {/* Rank Badge */}
                    <div className="absolute top-4 left-4 z-20 w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-2xl ring-4 ring-white/20">
                      <span className="text-2xl font-black text-white">
                        #{idx + 1}
                      </span>
                    </div>

                    {/* Backdrop Image */}
                    <div className="relative aspect-video">
                      <img
                        src={getImageUrl(item.backdrop_path)}
                        alt={getTitle(item)}
                        onError={() => handleImageError(item.id)}
                        className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ${
                          imageErrors.has(item.id) ? "opacity-50" : ""
                        }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

                      {/* Type Badge */}
                      <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/90 backdrop-blur-sm rounded-lg text-xs font-bold uppercase ring-1 ring-white/20">
                        {item.type === "movie" ? "🎬 Movie" : "📺 TV Series"}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                      <h3 className="text-2xl font-black line-clamp-2 group-hover:text-amber-400 transition-colors">
                        {getTitle(item)}
                      </h3>

                      <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed">
                        {item.overview || "No description available"}
                      </p>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 backdrop-blur-sm rounded-full ring-1 ring-amber-500/30">
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          <span className="text-sm font-bold">
                            {item.vote_average > 0
                              ? item.vote_average.toFixed(1)
                              : "New"}
                          </span>
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

                      {/* Genres */}
                      {item.genres && item.genres.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {item.genres.slice(0, 3).map((genre, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-white/5 rounded-lg text-xs font-medium text-gray-300"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-2">
                        <button className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-105">
                          <Play className="w-4 h-4" />
                          Watch Now
                        </button>
                        <button className="px-4 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl font-bold transition-all flex items-center justify-center gap-2 hover:scale-105">
                          <Info className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Rest of Items Grid */}
          {restItems.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-cyan-400" />
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  All Trending
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                {restItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative rounded-xl overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-xl ring-1 ring-white/5 hover:ring-cyan-500/50 transition-all duration-300 cursor-pointer"
                  >
                    {/* Poster */}
                    <div className="relative aspect-[2/3]">
                      <img
                        src={getPosterUrl(item.poster_path)}
                        alt={getTitle(item)}
                        onError={() => handleImageError(item.id)}
                        className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ${
                          imageErrors.has(item.id) ? "opacity-50" : ""
                        }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                      {/* Rating Badge */}
                      <div className="absolute top-2 right-2 bg-black/90 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg ring-1 ring-white/10">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-bold">
                          {item.vote_average > 0
                            ? item.vote_average.toFixed(1)
                            : "New"}
                        </span>
                      </div>

                      {/* Content Type Badge - Bottom Left (hidden on hover) */}
                      <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 z-40 opacity-100 group-hover:opacity-0 transition-opacity duration-300">
                        <div
                          className={`
                            flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg font-medium text-[10px] sm:text-xs shadow-lg backdrop-blur-md border
                            ${
                              item.type === "tv"
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
                      <h4 className="font-bold text-sm line-clamp-2 mb-2 group-hover:text-cyan-400 transition-colors">
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
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Pagination Controls */}
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
              {/* First page */}
              {currentPage > 3 && (
                <>
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={isPending}
                    className="w-10 h-10 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition-all"
                  >
                    1
                  </button>
                  {currentPage > 4 && (
                    <span className="text-gray-500">...</span>
                  )}
                </>
              )}

              {/* Page numbers around current page */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  return (
                    page === currentPage ||
                    page === currentPage - 1 ||
                    page === currentPage + 1 ||
                    page === currentPage - 2 ||
                    page === currentPage + 2
                  );
                })
                .map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    disabled={isPending}
                    className={`w-10 h-10 rounded-lg font-bold transition-all disabled:cursor-not-allowed ${
                      page === currentPage
                        ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
                        : "bg-white/10 hover:bg-white/20"
                    } ${isPending ? "opacity-50" : ""}`}
                  >
                    {page}
                  </button>
                ))}

              {/* Last page */}
              {currentPage < totalPages - 2 && (
                <>
                  {currentPage < totalPages - 3 && (
                    <span className="text-gray-500">...</span>
                  )}
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={isPending}
                    className="w-10 h-10 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition-all"
                  >
                    {totalPages}
                  </button>
                </>
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
    </div>
  );
}
