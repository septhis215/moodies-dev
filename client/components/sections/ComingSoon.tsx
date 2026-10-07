import { tmdbImage } from "@/lib/tmdb";
import { ChevronDown, Bookmark, BookmarkCheck, Sparkles } from "lucide-react";
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
const MOBILE_WEEK_ITEMS = 3;

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
  const [mobileExpandedWeeks, setMobileExpandedWeeks] = useState<
    Record<string, number>
  >({});
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
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
          <div className="min-w-0 flex-1 basis-64">
            <p className="ui-kicker">Release radar</p>
            <h2 className="mt-2 text-balance text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">
              {title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
              {type === "tv"
                ? "Upcoming series premieres, organised by week. Save a show for later."
                : "Upcoming movie releases, organised by week. Save a film for later."}
            </p>
          </div>
          <p className="shrink-0 text-sm text-[var(--ink-muted)]">
            <span className="font-semibold text-[var(--ink)]">
              {totalReleases}
            </span>{" "}
            upcoming {type === "tv" ? "shows" : "films"}
          </p>
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
                    aria-expanded={openMonth === monthYear}
                    className="flex min-h-14 w-full items-center justify-between gap-3 text-left focus-visible:outline-2 focus-visible:outline-[var(--brand-coral)] px-4 py-3 sm:gap-4 sm:px-5 sm:py-3.5
                         bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors
                         border-b border-[var(--surface-border)] group cursor-pointer"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4">
                      <h3 className="w-full text-base font-bold text-[var(--ink)] sm:w-auto sm:text-xl">
                        {monthYear}
                      </h3>
                      <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-3">
                        <span className="rounded bg-white/[0.06] px-2 py-1 text-xs font-medium text-[var(--ink-muted)] sm:text-sm">
                          {groupedItems.length} showing
                        </span>
                        <span className="text-[var(--ink-muted)] hidden sm:inline">
                          • {Object.keys(weeks).length}{" "}
                          {Object.keys(weeks).length === 1 ? "week" : "weeks"}
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 group-hover:text-[var(--ink-muted)] transition-all duration-300 ${
                        openMonth === monthYear ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {openMonth === monthYear && (
                    <div className="space-y-4 p-3 sm:p-5">
                      {topPicks.length > 0 && (
                        <div className="border-b border-[var(--surface-border)] pb-4 sm:rounded-md sm:border sm:bg-[var(--surface-2)] sm:p-3">
                          <div className="mb-2.5 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-[#ff7a66]" />
                            <h4 className="text-sm font-bold text-white">
                              Most anticipated this month
                            </h4>
                          </div>
                          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:pb-0 lg:grid-cols-6">
                            {topPicks.map((item) => {
                              const releaseDate = new Date(
                                getReleaseDate(item) ?? "",
                              );

                              return (
                                <Link
                                  key={`top-${item.id}`}
                                  href={`/${type}/${item.id}`}
                                  className="group flex w-[calc((100%-1rem)/3)] min-w-0 shrink-0 snap-start flex-col gap-2 py-1 outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--brand-coral)] sm:w-auto sm:flex-row"
                                >
                                  <div className="relative aspect-[2/3] w-full shrink-0 overflow-hidden rounded-md bg-[var(--surface-1)] sm:aspect-auto sm:h-14 sm:w-10 sm:rounded-sm">
                                    <Image
                                      src={posterGetter(item)}
                                      alt={getTitle(item)}
                                      fill
                                      sizes="(max-width: 640px) 30vw, 44px"
                                      className="object-cover"
                                    />
                                  </div>
                                  <div className="min-w-0 py-0.5">
                                    <div className="line-clamp-2 text-xs font-semibold leading-4 text-[var(--ink)] sm:font-bold sm:leading-snug sm:group-hover:text-[#ff8b78]">
                                      {getTitle(item)}
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-2">
                                      <span className="text-xs font-medium text-[var(--ink-muted)]">
                                        {releaseDate.toLocaleDateString(
                                          "en-US",
                                          {
                                            month: "short",
                                            day: "numeric",
                                          },
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {Object.entries(weeks).map(
                        ([range, weekItems], index) => {
                          const weekKey = `${monthYear}-${range}`;
                          const visibleCount =
                            expandedWeeks[weekKey] ?? INITIAL_WEEK_ITEMS;
                          const mobileVisibleCount =
                            mobileExpandedWeeks[weekKey] ?? MOBILE_WEEK_ITEMS;
                          const visibleWeekItems = weekItems.slice(
                            0,
                            Math.max(visibleCount, mobileVisibleCount),
                          );
                          const hiddenCount = Math.max(
                            0,
                            weekItems.length - visibleCount,
                          );
                          const mobileHiddenCount = Math.max(
                            0,
                            weekItems.length - mobileVisibleCount,
                          );

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
                              <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 py-3 marker:hidden focus-visible:outline-2 focus-visible:outline-[var(--brand-coral)]">
                                <div>
                                  <span className="text-xs font-semibold text-[var(--ink)] sm:text-sm">
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

                              <div className="grid grid-cols-1 gap-3 pb-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                {visibleWeekItems.map((item, itemIndex) => {
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
                                      className={`group relative min-w-0 items-start gap-3 border-b border-[var(--surface-border)] pb-3 pr-14 last:border-b-0 sm:border-0 sm:pb-0 sm:pr-0 ${itemIndex < mobileVisibleCount ? "flex" : "hidden"} ${itemIndex < visibleCount ? "sm:block" : "sm:hidden"}`}
                                    >
                                      <div className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-md border border-[var(--surface-border)] bg-[var(--surface-2)] transition-colors group-hover:border-[var(--brand-coral)] sm:w-auto">
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
                                            sizes="(max-width: 640px) 64px, (max-width: 1024px) 33vw, 20vw"
                                            className="object-cover"
                                          />
                                        </Link>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={(event) =>
                                          handleWatchlistToggle(item, event)
                                        }
                                        disabled={isLoading}
                                        className={`absolute right-0 top-0 z-20 grid h-11 w-11 sm:left-2 sm:right-auto sm:top-2 place-items-center rounded-sm border border-white/25 shadow-[0_6px_18px_rgba(0,0,0,0.35)] transition-colors disabled:opacity-60 ${
                                          inWatchlist
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
                                      <Link
                                        href={`/${type}/${item.id}`}
                                        className="min-w-0 flex-1 py-0.5 sm:block sm:pt-2.5 sm:pb-0"
                                      >
                                        <h4 className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)] transition-colors group-hover:text-[var(--brand-coral-strong)]">
                                          {getTitle(item)}
                                        </h4>
                                        <div className="mt-1 flex flex-col items-start gap-y-0.5 text-xs leading-5 text-[var(--ink-muted)] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1">
                                          <time
                                            dateTime={
                                              getReleaseDate(item) ?? undefined
                                            }
                                          >
                                            {releaseDate.toLocaleDateString(
                                              "en-US",
                                              {
                                                weekday: "short",
                                                month: "short",
                                                day: "numeric",
                                              },
                                            )}
                                          </time>
                                          <span className="font-semibold text-[var(--ink)]">
                                            {daysUntil > 0
                                              ? `In ${daysUntil} ${daysUntil === 1 ? "day" : "days"}`
                                              : daysUntil === 0
                                                ? "Today"
                                                : "Released"}
                                          </span>
                                        </div>
                                      </Link>
                                    </article>
                                  );
                                })}
                              </div>
                              {mobileHiddenCount > 0 && (
                                <div className="pb-3 sm:hidden">
                                  <button
                                    onClick={() =>
                                      setMobileExpandedWeeks((prev) => ({
                                        ...prev,
                                        [weekKey]:
                                          mobileVisibleCount +
                                          MOBILE_WEEK_ITEMS,
                                      }))
                                    }
                                    className="min-h-11 w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral)]"
                                  >
                                    Show{" "}
                                    {Math.min(
                                      mobileHiddenCount,
                                      MOBILE_WEEK_ITEMS,
                                    )}{" "}
                                    more
                                  </button>
                                </div>
                              )}
                              {hiddenCount > 0 && (
                                <div className="hidden justify-center pb-3 sm:flex">
                                  <button
                                    onClick={() =>
                                      setExpandedWeeks((prev) => ({
                                        ...prev,
                                        [weekKey]:
                                          visibleCount + INITIAL_WEEK_ITEMS,
                                      }))
                                    }
                                    className="min-h-11 w-full cursor-pointer rounded-md border border-[var(--surface-border)] bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brand-coral)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral)] sm:w-auto"
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
