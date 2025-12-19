import {
  Calendar,
  ChevronDown,
  Film,
  Info,
  Plus,
  Share2,
  Star,
  Check,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWatchlist } from "@/hooks/useWatchlist";

type MovieLike = {
  id: string | number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  vote_average?: number;
  overview?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  genre_ids?: number[];
  media_type?: "movie" | "tv";
  _parsedDate?: Date;
};

export function ComingSoonSection({
  title,
  items,
  type,
}: {
  title: string;
  items: any[];
  type: "movies" | "tv";
}) {
  const router = useRouter();
  const { isInWatchlist: hookIsIn, add, remove, ready } = useWatchlist();

  const [watchlistStates, setWatchlistStates] = useState<
    Record<string | number, boolean>
  >({});
  const [loadingStates, setLoadingStates] = useState<
    Record<string | number, boolean>
  >({});
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  function groupByMonthAndWeek(items: any[], type: "movies" | "tv") {
    const grouped: Record<string, any[]> = {};

    items.forEach((item) => {
      const rawDate = item.release_date || item.first_air_date;
      if (!rawDate) return;

      const date = new Date(rawDate);
      const monthYear = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      if (!grouped[monthYear]) grouped[monthYear] = [];
      grouped[monthYear].push({ ...item, _parsedDate: date });
    });

    return grouped;
  }

  function groupByWeek(movies: any[]) {
    const weeks: Record<string, any[]> = {};
    movies.forEach((movie) => {
      const date =
        movie._parsedDate ||
        new Date(movie.release_date || movie.first_air_date);
      const start = new Date(date);
      start.setDate(date.getDate() - date.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const range = `${start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} - ${end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`;

      if (!weeks[range]) weeks[range] = [];
      weeks[range].push(movie);
    });
    return weeks;
  }

  const getTitle = (item: MovieLike): string => {
    return item.name || item.title || "";
  };

  const posterGetter = (item: MovieLike): string => {
    return item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "/coming-soon.png";
  };

  const toWatchType = (item: MovieLike): "movie" | "series" => {
    return type === "tv" ? "series" : "movie";
  };

  const _isInWatchlist = (item: MovieLike) => {
    return hookIsIn(String(item.id), toWatchType(item));
  };

  const _addToWatchlist = async (item: MovieLike) => {
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

  const _removeFromWatchlist = async (item: MovieLike) => {
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

  useEffect(() => {
    const states: Record<string | number, boolean> = {};
    items.forEach((item) => {
      states[item.id] = _isInWatchlist(item);
    });
    setWatchlistStates(states);
  }, [items, hookIsIn, ready]);

  const handleWatchlistToggle = async (
    item: MovieLike,
    event: React.MouseEvent
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const itemId = item.id;
    const isCurrentlyInWatchlist =
      _isInWatchlist(item) ?? watchlistStates[itemId];

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
      setWatchlistStates((prev) => ({
        ...prev,
        [itemId]: isCurrentlyInWatchlist,
      }));
    } finally {
      setLoadingStates((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const grouped = groupByMonthAndWeek(items, type);

  return (
    <section id="upcoming" className="relative max-w-7xl w-full mx-auto py-22">
      <div className="flex items-center justify-between gap-3 sm:gap-4 mb-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-slate-500 blur-lg opacity-40" />
            <div className="relative w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl flex items-center justify-center ring-1 ring-slate-600/50 shadow-lg">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-slate-300" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white">
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1 font-medium">
              Coming soon to You
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <span className="text-2xl font-bold text-white">
            {Object.values(grouped).flat().length}
          </span>
          <span className="text-sm text-gray-400">
            {type === "movies" ? "movies" : "shows"}
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([monthYear, groupedItems]) => {
          const sorted = groupedItems.sort(
            (a, b) => a._parsedDate.getTime() - b._parsedDate.getTime()
          );
          const weeks = groupByWeek(sorted);

          return (
            <div
              key={monthYear}
              className="border border-slate-800 rounded-2xl bg-slate-900/50 backdrop-blur-sm overflow-hidden shadow-xl ring-1 ring-white/5"
            >
              <button
                onClick={() =>
                  setOpenMonth(openMonth === monthYear ? null : monthYear)
                }
                className="w-full flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5
                         bg-gradient-to-r from-slate-800/80 to-slate-900/80
                         hover:from-slate-800 hover:to-slate-900 transition-all duration-300
                         border-b border-slate-700/50 group"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-2 h-2 rounded-full bg-slate-400 group-hover:bg-slate-300 transition-colors" />
                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    {monthYear}
                  </h3>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="px-2 py-1 bg-slate-700/50 rounded text-slate-300 font-medium">
                      {groupedItems.length} releases
                    </span>
                    <span className="text-gray-500 hidden sm:inline">
                      • {Object.keys(weeks).length}{" "}
                      {Object.keys(weeks).length === 1 ? "week" : "weeks"}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 group-hover:text-slate-300 transition-all duration-300 ${openMonth === monthYear ? "rotate-180" : ""
                    }`}
                />
              </button>

              {openMonth === monthYear && (
                <div className="p-5 sm:p-6 lg:p-8 space-y-8 sm:space-y-10">
                  {Object.entries(weeks).map(([range, weekItems], index) => (
                    <div key={range} className="space-y-5">
                      <div className="flex flex-wrap items-center gap-3 mb-5 sm:mb-6">
                        <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-800/60 border border-slate-700/50 rounded-lg">
                          <span className="text-xs sm:text-sm font-bold text-slate-300">
                            Week {index + 1}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm text-gray-400 font-medium">
                          {range}
                        </div>
                        <div className="px-2 py-1 bg-slate-800/40 rounded text-xs text-slate-400">
                          {weekItems.length}{" "}
                          {weekItems.length === 1 ? "title" : "titles"}
                        </div>
                        <div className="flex-1 h-px bg-gradient-to-r from-slate-700 to-transparent" />
                      </div>

                      <div className="grid gap-4 sm:gap-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {weekItems.map((item) => {
                          const releaseDate = new Date(
                            item.release_date || item.first_air_date
                          );
                          const daysUntil = Math.ceil(
                            (releaseDate.getTime() - Date.now()) /
                            (1000 * 60 * 60 * 24)
                          );
                          const inWatchlist =
                            _isInWatchlist(item) ?? watchlistStates[item.id];
                          const isLoading = loadingStates[item.id];

                          return (
                            <Link key={item.id} href={`/${type}/${item.id}`}>
                              <div className="group relative rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900 hover:border-slate-600 hover:shadow-xl hover:shadow-slate-900/50 transition-all duration-300 overflow-hidden">
                                <div className="relative w-full aspect-[2/3]">
                                  {item.poster_path ? (
                                    <Image
                                      src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                                      alt={item.title || item.name || ""}
                                      fill
                                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                      <Film className="w-12 h-12 text-slate-600" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                                  <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-slate-800/90 backdrop-blur-sm px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg shadow-lg ring-1 ring-slate-700/50 z-10 transition-opacity duration-300 group-hover:opacity-0">
                                    <div className="text-[10px] sm:text-xs font-bold text-white">
                                      {releaseDate.toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </div>
                                    {daysUntil > 0 && (
                                      <div className="text-[9px] sm:text-[10px] text-slate-400 font-medium">
                                        {daysUntil}d away
                                      </div>
                                    )}
                                  </div>

                                  {item.vote_average &&
                                    item.vote_average > 0 && (
                                      <div className="absolute top-3 right-3 bg-black/80 backdrop-blur text-white px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ring-1 ring-white/10">
                                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                        {item.vote_average && item.vote_average > 0
                                          ? item.vote_average.toFixed(1)
                                          : "New"}
                                      </div>
                                    )}

                                  <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 z-10 transition-opacity duration-300 group-hover:opacity-0">
                                    <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-2 drop-shadow-lg mb-1">
                                      {item.title || item.name}
                                    </h4>
                                    {item.genre_ids &&
                                      item.genre_ids.length > 0 && (
                                        <div className="text-[10px] text-slate-400 font-medium">
                                          Upcoming Release
                                        </div>
                                      )}
                                  </div>
                                </div>

                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/95 to-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 shadow-2xl">
                                  <div className="absolute inset-0 p-3 sm:p-4 flex flex-col justify-between">
                                    <div>
                                      <h4 className="text-md sm:text-lg font-bold text-white line-clamp-3 mb-2">
                                        {item.title || item.name}
                                      </h4>
                                      <div className="flex flex-wrap gap-1.5 mb-3">
                                        <div className="px-2 py-0.5 bg-slate-800/90 backdrop-blur-sm rounded text-[9px] sm:text-[10px] text-slate-200 font-medium border border-slate-700/50">
                                          {releaseDate.toLocaleDateString(
                                            "en-US",
                                            { weekday: "short" }
                                          )}{" "}
                                          •{" "}
                                          {releaseDate.toLocaleDateString(
                                            "en-US",
                                            {
                                              month: "short",
                                              day: "numeric",
                                            }
                                          )}
                                        </div>
                                        {daysUntil > 0 && (
                                          <div className="px-2 py-0.5 bg-slate-800/90 backdrop-blur-sm rounded text-[9px] sm:text-[10px] text-slate-200 font-medium border border-slate-700/50">
                                            {daysUntil} days away
                                          </div>
                                        )}
                                      </div>
                                      {item.overview && (
                                        <p className="text-[10px] sm:text-xs text-gray-300 line-clamp-4 leading-relaxed">
                                          {item.overview}
                                        </p>
                                      )}
                                    </div>

                                    <div>
                                      <div className="flex justify-center gap-2">
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <motion.button
                                                onClick={(e) =>
                                                  handleWatchlistToggle(item, e)
                                                }
                                                disabled={isLoading}
                                                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-xl ${inWatchlist
                                                  ? "bg-green-500/90 hover:bg-green-600"
                                                  : "bg-white/95 hover:bg-white"
                                                  } ${isLoading
                                                    ? "opacity-70 cursor-not-allowed"
                                                    : ""
                                                  }`}
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
                                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-black border-t-transparent rounded-full"
                                                  />
                                                ) : inWatchlist ? (
                                                  <BookmarkCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                                                ) : (
                                                  <Bookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" />
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
                                                    ? "Remove from Watchlist"
                                                    : "Add to Watchlist"}
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>

                                        <button
                                          className="w-8 h-8 sm:w-9 sm:h-9 bg-white/95 rounded-full flex items-center justify-center hover:bg-white hover:scale-110 transition-all shadow-xl"
                                          title="More Info"
                                        >
                                          <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" />
                                        </button>

                                        <button
                                          onClick={(e) => {
                                            e.preventDefault();
                                          }}
                                          className="w-8 h-8 sm:w-9 sm:h-9 bg-white/95 rounded-full flex items-center justify-center hover:bg-white hover:scale-110 transition-all shadow-xl"
                                          title="Share"
                                        >
                                          <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
