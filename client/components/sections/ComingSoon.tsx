import {
  Calendar,
  ChevronDown,
  Info,
  Star,
  Bookmark,
  BookmarkCheck,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, {
  useCallback,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";
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
  popularity?: number | null;
  origin_country?: string[];
  _parsedDate?: Date;
};

const INITIAL_WEEK_ITEMS = 10;

const getReleaseDate = (item: MovieLike) =>
  item.release_date || item.first_air_date || null;

const getInterestScore = (item: MovieLike) => {
  const popularity = item.popularity ?? 0;
  const rating = item.vote_average ?? 0;
  const posterBoost = item.poster_path ? 2 : 0;
  const overviewBoost = item.overview ? 1 : 0;

  return popularity + rating * 4 + posterBoost + overviewBoost;
};

export function ComingSoonSection({
  title,
  items,
  type,
}: {
  title: string;
  items: MovieLike[];
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
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, number>>(
    {},
  );
  const hasAutoOpenedMonth = useRef(false);
  const monthRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingScrollMonth = useRef<string | null>(null);

  type GroupedMovieLike = MovieLike & { _parsedDate: Date };

  const groupByMonthAndWeek = useCallback((items: MovieLike[]) => {
    const grouped: Record<string, GroupedMovieLike[]> = {};

    items.forEach((item) => {
      const rawDate = getReleaseDate(item);
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
  }, []);

  const groupByWeek = useCallback((movies: GroupedMovieLike[]) => {
    const weeks: Record<string, GroupedMovieLike[]> = {};
    movies.forEach((movie) => {
      const date = movie._parsedDate;
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
  }, []);

  const sortReleases = useCallback((releaseItems: GroupedMovieLike[]) => {
    return [...releaseItems].sort((a, b) => {
      const dateDiff = a._parsedDate.getTime() - b._parsedDate.getTime();
      if (dateDiff !== 0) return dateDiff;
      return getInterestScore(b) - getInterestScore(a);
    });
  }, []);

  const getTitle = (item: MovieLike): string => {
    return item.name || item.title || "";
  };

  const posterGetter = (item: MovieLike): string => {
    return item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "/placeholder-poster.svg";
  };

  const toWatchType = useCallback((): "movie" | "series" => {
    return type === "tv" ? "series" : "movie";
  }, [type]);

  const _isInWatchlist = useCallback(
    (item: MovieLike) => {
      return hookIsIn(String(item.id), toWatchType());
    },
    [hookIsIn, toWatchType],
  );

  const _addToWatchlist = async (item: MovieLike) => {
    if (!ready) {
      router.push("/auth/login");
      return;
    }

    const title = getTitle(item) ?? null;
    const posterUrl = posterGetter(item) ?? null;

    await add(String(item.id), toWatchType(), {
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

    await remove(String(item.id), toWatchType(), {
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
  }, [items, _isInWatchlist, ready]);

  const handleWatchlistToggle = async (
    item: MovieLike,
    event: React.MouseEvent,
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

  const handleMonthToggle = useCallback((monthYear: string) => {
    pendingScrollMonth.current = monthYear;
    setOpenMonth((currentMonth) =>
      currentMonth === monthYear ? null : monthYear,
    );
  }, []);

  const validItems = useMemo(
    () => items.filter((item) => Boolean(getReleaseDate(item))),
    [items],
  );

  const grouped = useMemo(
    () => groupByMonthAndWeek(validItems),
    [groupByMonthAndWeek, validItems],
  );
  const totalVisible = Object.values(grouped).flat().length;
  const totalReleases = validItems.length;
  const todayMs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
  }, []);

  useEffect(() => {
    const firstMonth = Object.keys(grouped)[0];
    if (!hasAutoOpenedMonth.current && firstMonth) {
      setOpenMonth(firstMonth);
      hasAutoOpenedMonth.current = true;
    }
  }, [grouped]);

  useEffect(() => {
    const monthYear = pendingScrollMonth.current;
    if (!monthYear) return;

    const frameId = window.requestAnimationFrame(() => {
      monthRefs.current[monthYear]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      pendingScrollMonth.current = null;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [openMonth]);

  return (
    <section
      id="upcoming"
      className="relative mx-auto w-full max-w-7xl py-8 sm:py-12 lg:py-16"
    >
      <div className="rounded-3xl border border-white/10 bg-neutral-950/70 p-4 shadow-2xl shadow-black/30 sm:p-6">
        <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-[#ff7a66] ring-1 ring-white/10 shadow-lg">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ff8b78]">
                Release radar
              </p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white">
                {title}
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 mt-1 font-medium leading-5 sm:leading-6">
                Curated by date and audience signal so busy months stay easy to
                scan.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <div className="text-xl font-bold leading-none text-white">
                {totalReleases}
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                Total
              </div>
            </div>
          </div>
        </div>

        {totalVisible === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center">
            <p className="text-sm font-semibold text-white">
              No upcoming releases are available right now.
            </p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            {Object.entries(grouped).map(([monthYear, groupedItems]) => {
              const sorted = sortReleases(groupedItems);
              const weeks = groupByWeek(sorted);
              const topPicks = [...groupedItems]
                .sort((a, b) => getInterestScore(b) - getInterestScore(a))
                .slice(0, 6);

              return (
                <div
                  key={monthYear}
                  ref={(element) => {
                    monthRefs.current[monthYear] = element;
                  }}
                  className="scroll-mt-24 overflow-hidden rounded-2xl border border-white/10 bg-black/35 shadow-xl shadow-black/20 backdrop-blur-sm"
                >
                  <button
                    onClick={() => handleMonthToggle(monthYear)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5
                         bg-white/[0.035] hover:bg-white/[0.06] transition-all duration-300
                         border-b border-white/10 group cursor-pointer"
                  >
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                      <div className="w-2 h-2 shrink-0 rounded-full bg-[#e94f37] transition-colors" />
                      <h3 className="truncate text-base font-bold text-white sm:text-xl">
                        {monthYear}
                      </h3>
                      <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-3">
                        <span className="rounded bg-white/[0.06] px-2 py-1 text-xs font-medium text-slate-300 sm:text-sm">
                          {groupedItems.length} showing
                        </span>
                        <span className="text-gray-500 hidden sm:inline">
                          • {Object.keys(weeks).length}{" "}
                          {Object.keys(weeks).length === 1 ? "week" : "weeks"}
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 group-hover:text-slate-300 transition-all duration-300 ${
                        openMonth === monthYear ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {openMonth === monthYear && (
                    <div className="space-y-6 p-4 sm:space-y-8 sm:p-6 lg:p-8">
                      {topPicks.length > 0 && (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                          <div className="mb-4 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-[#ff7a66]" />
                            <h4 className="text-sm font-bold text-white">
                              Most anticipated this month
                            </h4>
                          </div>
                          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scroll-smooth sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-6">
                            {topPicks.map((item) => {
                              const releaseDate = new Date(
                                getReleaseDate(item) ?? "",
                              );

                              return (
                                <Link
                                  key={`top-${item.id}`}
                                  href={`/${type}/${item.id}`}
                                  className="group flex w-[72vw] max-w-[270px] shrink-0 snap-start gap-3 rounded-xl bg-black/35 p-2 ring-1 ring-white/10 transition hover:bg-white/[0.06] sm:w-auto sm:max-w-none"
                                >
                                  <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-white/[0.06]">
                                    <Image
                                      src={posterGetter(item)}
                                      alt={getTitle(item)}
                                      fill
                                      sizes="44px"
                                      className="object-cover"
                                    />
                                  </div>
                                  <div className="min-w-0 py-0.5">
                                    <div className="line-clamp-2 text-xs font-bold leading-snug text-white group-hover:text-[#ff8b78]">
                                      {getTitle(item)}
                                    </div>
                                    <div className="mt-1 text-[10px] font-medium text-gray-500">
                                      {releaseDate.toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </div>
                                  </div>
                                </Link>
                              );
                            })}
                            <div
                              className="w-1 shrink-0 sm:hidden"
                              aria-hidden="true"
                            />
                          </div>
                        </div>
                      )}

                      {Object.entries(weeks).map(
                        ([range, weekItems], index) => {
                          const weekKey = `${monthYear}-${range}`;
                          const visibleCount =
                            expandedWeeks[weekKey] ?? INITIAL_WEEK_ITEMS;
                          const visibleWeekItems = weekItems.slice(
                            0,
                            visibleCount,
                          );
                          const hiddenCount =
                            weekItems.length - visibleWeekItems.length;

                          return (
                            <div key={range} className="space-y-4 sm:space-y-5">
                              <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-6 sm:gap-3">
                                <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white/[0.05] border border-white/10 rounded-lg">
                                  <span className="text-xs sm:text-sm font-bold text-slate-300">
                                    Week {index + 1}
                                  </span>
                                </div>
                                <div className="text-xs sm:text-sm text-gray-400 font-medium">
                                  {range}
                                </div>
                                <div className="px-2 py-1 bg-white/[0.04] rounded text-xs text-slate-400">
                                  {weekItems.length}{" "}
                                  {weekItems.length === 1 ? "title" : "titles"}
                                </div>
                                <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                              </div>

                              <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scroll-smooth sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-5">
                                {visibleWeekItems.map((item) => {
                                  const releaseDate = new Date(
                                    getReleaseDate(item) ?? "",
                                  );
                                  const daysUntil = Math.ceil(
                                    (releaseDate.getTime() - todayMs) /
                                      (1000 * 60 * 60 * 24),
                                  );
                                  const inWatchlist =
                                    _isInWatchlist(item) ??
                                    watchlistStates[item.id];
                                  const isLoading = loadingStates[item.id];

                                  return (
                                    <Link
                                      key={item.id}
                                      href={`/${type}/${item.id}`}
                                      className="w-[42vw] min-w-[145px] max-w-[176px] shrink-0 snap-start sm:w-auto sm:min-w-0 sm:max-w-none"
                                    >
                                      <div className="group relative rounded-xl sm:rounded-2xl border border-white/10 bg-neutral-950 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 transition-all duration-300 overflow-hidden">
                                        <div className="relative w-full aspect-[2/3]">
                                          <Image
                                            src={
                                              item.poster_path
                                                ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                                                : "/placeholder-poster.svg"
                                            }
                                            alt={item.title || item.name || ""}
                                            fill
                                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                                          />
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                                          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-black/70 backdrop-blur-sm px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg shadow-lg ring-1 ring-white/10 z-10 transition-opacity duration-300 group-hover:opacity-0">
                                            <div className="text-[10px] sm:text-xs font-bold text-white">
                                              {releaseDate.toLocaleDateString(
                                                "en-US",
                                                {
                                                  month: "short",
                                                  day: "numeric",
                                                },
                                              )}
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
                                                {item.vote_average &&
                                                item.vote_average > 0
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
                                                <div className="px-2 py-0.5 bg-white/[0.06] backdrop-blur-sm rounded text-[9px] sm:text-[10px] text-slate-200 font-medium border border-white/10">
                                                  {releaseDate.toLocaleDateString(
                                                    "en-US",
                                                    { weekday: "short" },
                                                  )}{" "}
                                                  •{" "}
                                                  {releaseDate.toLocaleDateString(
                                                    "en-US",
                                                    {
                                                      month: "short",
                                                      day: "numeric",
                                                    },
                                                  )}
                                                </div>
                                                {daysUntil > 0 && (
                                                  <div className="px-2 py-0.5 bg-white/[0.06] backdrop-blur-sm rounded text-[9px] sm:text-[10px] text-slate-200 font-medium border border-white/10">
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
                                                          handleWatchlistToggle(
                                                            item,
                                                            e,
                                                          )
                                                        }
                                                        disabled={isLoading}
                                                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-xl cursor-pointer ${
                                                          inWatchlist
                                                            ? "bg-[#e94f37] text-white"
                                                            : "bg-white/95 hover:bg-white"
                                                        } ${
                                                          isLoading
                                                            ? "opacity-70 cursor-not-allowed"
                                                            : ""
                                                        }`}
                                                        whileTap={{
                                                          scale: 0.9,
                                                        }}
                                                      >
                                                        {isLoading ? (
                                                          <motion.div
                                                            animate={{
                                                              rotate: 360,
                                                            }}
                                                            transition={{
                                                              duration: 1,
                                                              repeat: Infinity,
                                                              ease: "linear",
                                                            }}
                                                            className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-black border-t-transparent rounded-full"
                                                          />
                                                        ) : inWatchlist ? (
                                                          <BookmarkCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
                                                            ? "Remove from My List"
                                                            : "Add to My List"}
                                                      </div>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>

                                                <TooltipProvider>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <button
                                                        onClick={(event) =>
                                                          event.stopPropagation()
                                                        }
                                                        className="w-8 h-8 sm:w-9 sm:h-9 bg-white/95 rounded-full flex items-center justify-center hover:bg-white hover:scale-110 transition-all shadow-xl cursor-pointer"
                                                      >
                                                        <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" />
                                                      </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                      side="bottom"
                                                      sideOffset={8}
                                                      className="rounded-lg bg-black/90 backdrop-blur-md px-3 py-2 shadow-xl border border-white/20"
                                                    >
                                                      <div className="text-xs sm:text-sm font-medium text-white">
                                                        More Info
                                                      </div>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </Link>
                                  );
                                })}
                                <div
                                  className="w-1 shrink-0 sm:hidden"
                                  aria-hidden="true"
                                />
                              </div>
                              {hiddenCount > 0 && (
                                <div className="flex justify-center">
                                  <button
                                    onClick={() =>
                                      setExpandedWeeks((prev) => ({
                                        ...prev,
                                        [weekKey]:
                                          visibleCount + INITIAL_WEEK_ITEMS,
                                      }))
                                    }
                                    className="cursor-pointer rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold text-gray-200 transition hover:bg-white/[0.1]"
                                  >
                                    Show{" "}
                                    {Math.min(hiddenCount, INITIAL_WEEK_ITEMS)}{" "}
                                    more
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
