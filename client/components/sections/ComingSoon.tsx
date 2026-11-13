"use client";

import SectionHeader from "@/components/ui/SectionHeader";
import { tmdbImage } from "@/lib/tmdb";
import { LoadingRegion, SkeletonGrid } from "@/components/loading/PageSkeleton";
import { ArrowRight, ChevronDown, Bookmark, BookmarkCheck } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import {
  useCallback,
  useState,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { useWatchlist } from "@/hooks/useWatchlist";

type MovieLike = {
  id: string | number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
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
const showMoreClass = "mx-auto mb-3 min-h-11 cursor-pointer rounded-sm px-4 text-sm font-semibold text-[var(--ink-muted)] decoration-1 underline-offset-4 hover:text-[var(--brand-coral-strong)] hover:underline focus-visible:text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)] motion-safe:transition-colors motion-safe:duration-200";

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
  isLoading = false,
  error,
  onRetry,
}: {
  title: string;
  items: MovieLike[];
  type: "movies" | "tv";
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const router = useRouter();
  const { isInWatchlist: hookIsIn, add, remove, ready } = useWatchlist();

  const [loadingStates, setLoadingStates] = useState<
    Record<string | number, boolean>
  >({});
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, number>>(
    {},
  );
  const [mobileExpandedWeeks, setMobileExpandedWeeks] = useState<
    Record<string, number>
  >({});
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});

  type GroupedMovieLike = MovieLike & { _parsedDate: Date };

  const groupByMonth = useCallback((items: MovieLike[]) => {
    const grouped: Record<string, GroupedMovieLike[]> = {};

    items.forEach((item) => {
      const rawDate = getReleaseDate(item);
      if (!rawDate) return;

      const date = new Date(rawDate);
      if (Number.isNaN(date.getTime())) return;
      const monthYear = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
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
      start.setUTCDate(date.getUTCDate() - date.getUTCDay());
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);

      const range = `${start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })}–${end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
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

  const watchType = type === "tv" ? "series" : "movie";

  const handleWatchlistToggle = async (item: MovieLike) => {
    if (!ready) {
      router.push("/auth/login");
      return;
    }

    const itemId = item.id;
    const toggle = hookIsIn(String(itemId), watchType) ? remove : add;
    setLoadingStates((current) => ({ ...current, [itemId]: true }));

    try {
      await toggle(String(itemId), watchType, {
        title: getTitle(item),
        posterUrl: posterGetter(item),
        variant: "info",
        duration: 3500,
      });
    } catch (error) {
      console.error("Error updating watchlist:", error);
    } finally {
      setLoadingStates((current) => ({ ...current, [itemId]: false }));
    }
  };

  const grouped = useMemo(() => groupByMonth(items), [groupByMonth, items]);
  const months = Object.keys(grouped).sort(
    (a, b) => grouped[a][0]._parsedDate.getTime() - grouped[b][0]._parsedDate.getTime(),
  );
  const month = selectedMonth && grouped[selectedMonth] ? selectedMonth : months[0];
  const releases = grouped[month] ?? [];
  const weeks = groupByWeek(sortReleases(releases));
  const featured = [...releases]
    .sort((a, b) => getInterestScore(b) - getInterestScore(a))
    .slice(0, 3);

  return (
    <section
      id="upcoming"
      aria-labelledby="upcoming-release-heading"
      className="relative mx-auto w-full max-w-7xl py-6 sm:py-8"
      aria-busy={isLoading}
    >
      <SectionHeader
        id="upcoming-release-heading"
        title={title}
        description={type === "tv" ? "Find your next series premiere." : "See what’s opening and when."}
        className="mb-5"
      />

      {isLoading ? (
        <LoadingRegion label="Loading upcoming releases"><SkeletonGrid count={6} /></LoadingRegion>
      ) : error ? (
        <div className="rounded-xl bg-[var(--surface-1)] p-6 text-sm text-[var(--ink-muted)]">
          <p>{error}</p>
          {onRetry && <button type="button" onClick={onRetry} className="ui-secondary-action mt-3">Try again</button>}
        </div>
      ) : !month ? (
        <p className="rounded-xl bg-[var(--surface-1)] p-6 text-sm text-[var(--ink-muted)]">
          No upcoming releases are available right now.
        </p>
      ) : (
        <>
          <div
            role="group"
            aria-label="Release month"
            className="flex min-w-0 items-center gap-x-6 overflow-x-auto overscroll-x-contain sm:gap-x-8"
          >
            {months.map((monthYear) => (
              <button
                key={monthYear}
                type="button"
                aria-pressed={month === monthYear}
                aria-controls="upcoming-month"
                onClick={() => setSelectedMonth(monthYear)}
                className="min-h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-sm px-1 text-sm font-semibold text-[var(--ink-muted)] decoration-2 underline-offset-8 hover:text-[var(--ink)] aria-pressed:text-[var(--brand-coral-strong)] aria-pressed:underline focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)] motion-safe:transition-colors motion-safe:duration-200 sm:text-base"
              >
                {monthYear}
              </button>
            ))}
          </div>

          <div id="upcoming-month" className="mt-6 space-y-7 sm:mt-8 sm:space-y-9">
            <div>
              <h3 className="mb-3 text-lg font-bold text-[var(--ink)]">Featured releases</h3>
              <div
                key={month}
                className="mobile-native-scroll flex snap-x snap-proximity gap-2.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:gap-3"
              >
                {featured.map((item, index) => {
                  const isLead = index === 0;
                  const placement = [
                    isLead ? (featured.length === 1 ? "w-full" : "w-[86%]") : "w-[70%]",
                    featured.length === 1 && "sm:col-span-2 sm:aspect-[3/1]",
                    featured.length === 3 && (isLead
                      ? "sm:col-span-2 lg:col-span-1 lg:row-span-2 lg:aspect-auto"
                      : "lg:col-start-2 lg:aspect-[3/1]"),
                  ].filter(Boolean).join(" ");
                  return (
                    <Link
                      key={item.id}
                      href={"/" + type + "/" + item.id}
                      className={"group relative isolate flex aspect-video min-w-0 shrink-0 snap-start items-end overflow-hidden rounded-lg bg-[var(--surface-2)] ring-1 ring-inset ring-white/10 focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--brand-coral)] sm:w-auto " + placement}
                    >
                      {(item.backdrop_path || item.poster_path) && (
                        <Image
                          src={tmdbImage(item.backdrop_path, isLead ? "backdropHero" : "backdropCard") ?? posterGetter(item)}
                          alt=""
                          fill
                          sizes={isLead ? "(max-width: 639px) 86vw, (max-width: 1023px) 100vw, 50vw" : "(max-width: 639px) 70vw, 50vw"}
                          className="-z-20 object-cover object-[center_30%] motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
                        />
                      )}
                      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-black/95 via-black/40 to-transparent" />
                      <div className={"flex w-full min-w-0 items-end justify-between gap-3 " + (isLead ? "p-4 sm:p-6" : "p-3.5 sm:p-4")}>
                        <div className="min-w-0">
                          <time
                            dateTime={getReleaseDate(item) ?? undefined}
                            className="text-xs font-bold uppercase tracking-wider text-[var(--brand-coral-strong)]"
                          >
                            {item._parsedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                          </time>
                          <p className={"line-clamp-2 leading-none text-white [font-family:var(--font-display)] " + (isLead ? "text-3xl font-bold sm:text-5xl" : "text-xl font-semibold sm:text-2xl")}>
                            {getTitle(item)}
                          </p>
                        </div>
                        <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-white/80 transition-colors group-hover:text-white" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl bg-[var(--surface-1)] px-4 pb-1 pt-4 sm:px-6 sm:pt-5">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-lg font-bold text-[var(--ink)]">Release schedule</h3>
                <p role="status" className="text-sm text-[var(--ink-muted)]">
                  {month} · {releases.length} {releases.length === 1 ? "release" : "releases"}
                </p>
              </div>
              {Object.entries(weeks).map(([range, weekItems], index) => {
                const weekKey = month + "-" + range;
                const visibleCount = expandedWeeks[weekKey] ?? INITIAL_WEEK_ITEMS;
                const mobileCount = mobileExpandedWeeks[weekKey] ?? MOBILE_WEEK_ITEMS;
                const hiddenCount = weekItems.length - visibleCount;
                const mobileHiddenCount = weekItems.length - mobileCount;

                return (
                  <details
                    key={weekKey}
                    className="group/week border-t border-[var(--surface-border)]"
                    open={openWeeks[weekKey] ?? index === 0}
                    onToggle={(event) => {
                      const isOpen = event.currentTarget.open;
                      setOpenWeeks((current) => ({ ...current, [weekKey]: isOpen }));
                    }}
                  >
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2 marker:hidden focus-visible:outline-2 focus-visible:outline-[var(--brand-coral)]">
                      <span className="font-semibold text-[var(--ink)]">{range}</span>
                      <span className="flex shrink-0 items-center gap-2 text-sm text-[var(--ink-muted)]">
                        {weekItems.length} {weekItems.length === 1 ? "title" : "titles"}
                        <ChevronDown aria-hidden="true" className="size-4 motion-safe:transition-transform group-open/week:rotate-180" />
                      </span>
                    </summary>

                    <div className="grid gap-2.5 pb-4 md:grid-cols-2 xl:grid-cols-3">
                      {weekItems.slice(0, Math.max(visibleCount, mobileCount)).map((item, itemIndex) => {
                        const inWatchlist = hookIsIn(String(item.id), watchType);
                        const saving = loadingStates[item.id];
                        return (
                          <article
                            key={item.id}
                            className={"min-w-0 items-center gap-2 rounded-lg bg-[var(--surface-2)] p-2 " + (itemIndex < mobileCount ? "flex" : "hidden") + " " + (itemIndex < visibleCount ? "sm:flex" : "sm:hidden")}
                          >
                            <Link
                              href={"/" + type + "/" + item.id}
                              className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-[var(--brand-coral)]"
                            >
                              <span className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded bg-[var(--surface-1)]">
                                <Image src={posterGetter(item)} alt="" fill sizes="40px" className="object-cover" />
                              </span>
                              <span className="min-w-0">
                                <time dateTime={getReleaseDate(item) ?? undefined} className="block text-xs font-semibold text-[var(--ink-muted)]">
                                  {item._parsedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
                                </time>
                                <span className="line-clamp-2 text-sm font-semibold leading-tight text-[var(--ink)] group-hover:text-[var(--brand-coral-strong)]">
                                  {getTitle(item)}
                                </span>
                              </span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleWatchlistToggle(item)}
                              disabled={saving}
                              aria-label={inWatchlist ? "Remove " + getTitle(item) + " from My List" : "Add " + getTitle(item) + " to My List"}
                              className={"grid size-11 shrink-0 cursor-pointer place-items-center rounded-md transition-colors hover:text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral)] disabled:opacity-60 " + (inWatchlist ? "text-[var(--brand-coral-strong)]" : "text-[var(--ink)]")}
                            >
                              {saving ? (
                                <span className="size-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />
                              ) : inWatchlist ? (
                                <BookmarkCheck aria-hidden="true" className="size-5" />
                              ) : (
                                <Bookmark aria-hidden="true" className="size-5" />
                              )}
                            </button>
                          </article>
                        );
                      })}
                    </div>
                    {mobileHiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setMobileExpandedWeeks((prev) => ({ ...prev, [weekKey]: mobileCount + MOBILE_WEEK_ITEMS }))}
                        className={`${showMoreClass} block sm:hidden`}
                      >
                        Show {Math.min(mobileHiddenCount, MOBILE_WEEK_ITEMS)} more
                      </button>
                    )}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedWeeks((prev) => ({ ...prev, [weekKey]: visibleCount + INITIAL_WEEK_ITEMS }))}
                        className={`${showMoreClass} hidden sm:block`}
                      >
                        Show {Math.min(hiddenCount, INITIAL_WEEK_ITEMS)} more
                      </button>
                    )}
                  </details>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
