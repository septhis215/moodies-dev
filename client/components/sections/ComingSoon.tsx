import { tmdbImage } from "@/lib/tmdb";
import {
  Calendar,
  ChevronDown,
  Bookmark,
  BookmarkCheck,
  Sparkles,
} from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import React, {
  useCallback,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import { useWatchlist } from "@/hooks/useWatchlist";
import { RatingBadge } from "@/components/ui/rating-badge";

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

const INITIAL_WEEK_ITEMS = 6;

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
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});
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
      ? tmdbImage(item.poster_path, "w500")
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
      className="relative mx-auto w-full max-w-7xl border-t border-[var(--surface-border)] py-6 sm:py-7"
    >
      <div>
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[var(--surface-border)] text-[var(--brand-coral-strong)] sm:h-12 sm:w-12">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ff8b78]">
                Release radar
              </p>
              <h2 className="text-2xl font-bold leading-none text-[var(--ink)] sm:text-[28px]">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                Curated by date and audience signal so busy months stay easy to
                scan.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-1)] px-3 py-2">
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
                  className="scroll-mt-24 overflow-hidden rounded-md border border-[var(--surface-border)] bg-[var(--surface-1)]"
                >
                  <button
                    onClick={() => handleMonthToggle(monthYear)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-3.5
                         bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors
                         border-b border-[var(--surface-border)] group cursor-pointer"
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
                      className={`w-5 h-5 text-slate-400 group-hover:text-slate-300 transition-all duration-300 ${openMonth === monthYear ? "rotate-180" : ""
                        }`}
                    />
                  </button>

                  {openMonth === monthYear && (
                    <div className="space-y-4 p-4 sm:p-5">
                      {topPicks.length > 0 && (
                        <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-2)] p-3">
                          <div className="mb-2.5 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-[#ff7a66]" />
                            <h4 className="text-sm font-bold text-white">
                              Most anticipated this month
                            </h4>
                          </div>
                          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 scroll-smooth sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 lg:grid-cols-6">
                            {topPicks.map((item) => {
                              const releaseDate = new Date(
                                getReleaseDate(item) ?? "",
                              );

                              return (
                                <Link
                                  key={`top-${item.id}`}
                                  href={`/${type}/${item.id}`}
                                  className="group flex w-[72vw] max-w-[270px] shrink-0 snap-start gap-3 border-l border-[var(--surface-border)] py-1 pl-3 transition-colors hover:border-[var(--brand-coral)] sm:w-auto sm:max-w-none"
                                >
                                  <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-sm bg-white/[0.06]">
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
                                    <div className="mt-1.5 flex items-center gap-2">
                                      <span className="rounded border border-[var(--brand-coral)]/50 bg-[var(--brand-coral)]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--brand-coral-strong)]">
                                        Premieres
                                      </span>
                                      <span className="text-[10px] font-medium text-gray-400">
                                        {releaseDate.toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                        })}
                                      </span>
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
                            <details
                              key={range}
                              className="group/week border-b border-[var(--surface-border)] last:border-b-0"
                              open={openWeeks[weekKey] ?? index === 0}
                              onToggle={(event) => {
                                const isOpen = event.currentTarget.open;
                                setOpenWeeks((current) => ({
                                  ...current,
                                  [weekKey]: isOpen,
                                }));
                              }}
                            >
                              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 py-2.5 marker:hidden">
                                <div>
                                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-coral-strong)] sm:text-sm">
                                    Week {index + 1}
                                  </span>
                                </div>
                                <div className="text-xs font-medium text-[var(--ink-muted)] sm:text-sm">
                                  {range}
                                </div>
                                <div className="text-xs text-[var(--ink-muted)]">
                                  {weekItems.length}{" "}
                                  {weekItems.length === 1 ? "title" : "titles"}
                                </div>
                                <ChevronDown className="ml-auto h-4 w-4 text-[var(--ink-muted)] transition-transform group-open/week:rotate-180" />
                              </summary>

                              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 scroll-smooth sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
                                    <article
                                      key={item.id}
                                      className="group w-[42vw] min-w-[145px] max-w-[176px] shrink-0 snap-start sm:w-auto sm:min-w-0 sm:max-w-none"
                                    >
                                      <div className="relative aspect-[2/3] overflow-hidden rounded-md border border-[var(--surface-border)] bg-[var(--surface-2)] transition-colors group-hover:border-[var(--brand-coral)]">
                                        <Link
                                          href={`/${type}/${item.id}`}
                                          className="block h-full w-full"
                                        >
                                          <Image
                                            src={
                                              item.poster_path
                                                ? tmdbImage(
                                                  item.poster_path,
                                                  "w500",
                                                )
                                                : "/placeholder-poster.svg"
                                            }
                                            alt={item.title || item.name || ""}
                                            fill
                                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                            className="object-cover"
                                          />
                                        </Link>

                                        <div className="absolute inset-x-2 bottom-2 z-10 flex items-center justify-between gap-2 rounded-md border border-[var(--brand-coral)]/60 bg-[#0b0909]/85 px-2.5 py-2 shadow-[0_10px_25px_rgba(0,0,0,0.2)] backdrop-blur-[2px]">
                                          <div className="min-w-0">
                                            <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--brand-coral-strong)]">
                                              Premieres
                                            </div>
                                            <div className="mt-0.5 text-[11px] font-bold text-white sm:text-xs">
                                              {releaseDate.toLocaleDateString(
                                                "en-US",
                                                {
                                                  month: "short",
                                                  day: "numeric",
                                                },
                                              )}
                                            </div>
                                          </div>
                                          <div className="shrink-0 rounded border border-[var(--brand-coral)]/40 bg-[var(--brand-coral)]/10 px-1.5 py-1 text-[9px] font-bold text-[var(--brand-coral-strong)] sm:text-[10px]">
                                            {daysUntil > 0
                                              ? `${daysUntil}d`
                                              : daysUntil === 0
                                                ? "Today"
                                                : "Now"}
                                          </div>
                                        </div>

                                        <RatingBadge
                                          rating={item.vote_average ?? 0}
                                          variant="colored"
                                          size="sm"
                                          className="absolute right-2 top-2 z-10"
                                        />
                                        <button
                                          type="button"
                                          onClick={(event) =>
                                            handleWatchlistToggle(item, event)
                                          }
                                          disabled={isLoading}
                                          className={`absolute left-2 top-2 z-20 grid h-9 w-9 place-items-center rounded-sm border border-white/25 shadow-[0_6px_18px_rgba(0,0,0,0.35)] transition-colors disabled:opacity-60 ${inWatchlist
                                              ? "bg-[var(--brand-coral)] text-white"
                                              : "bg-[#0b0909]/90 text-white hover:bg-white hover:text-black"
                                            }`}
                                          aria-label={
                                            inWatchlist
                                              ? `Remove ${getTitle(item)} from My List`
                                              : `Add ${getTitle(item)} to My List`
                                          }
                                        >
                                          {isLoading ? (
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
                                          ) : inWatchlist ? (
                                            <BookmarkCheck className="h-4 w-4" />
                                          ) : (
                                            <Bookmark className="h-4 w-4" />
                                          )}
                                        </button>
                                      </div>
                                      <Link
                                        href={`/${type}/${item.id}`}
                                        className="block pt-2.5"
                                      >
                                        <h4 className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)] transition-colors group-hover:text-[var(--brand-coral-strong)]">
                                          {getTitle(item)}
                                        </h4>
                                        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                                          {releaseDate.toLocaleDateString(
                                            "en-US",
                                            {
                                              weekday: "short",
                                              month: "short",
                                              day: "numeric",
                                            },
                                          )}
                                        </p>
                                      </Link>
                                    </article>
                                  );
                                })}
                                <div
                                  className="w-1 shrink-0 sm:hidden"
                                  aria-hidden="true"
                                />
                              </div>
                              {hiddenCount > 0 && (
                                <div className="flex justify-center pb-3">
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
                            </details>
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
