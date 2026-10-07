"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
  useTransition,
  type MouseEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Award,
  Bookmark,
  BookmarkCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Film,
  Tv,
} from "lucide-react";
import { tmdbImage } from "@/lib/tmdb";
import { useWatchlist } from "@/hooks/useWatchlist";
import RatingBadge from "../ui/rating-badge";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  origin_country: string[];
  genres: string[];
  type: "movie" | "tv";
  number_of_seasons?: number;
}

interface CategoryContentProps {
  data: MediaItem[];
  currentPage: number;
  totalPages: number;
  total: number;
  title: string;
  subtitle?: string;
}

const PAGE_WINDOW = 5;

export function CategoryContent({
  data,
  currentPage,
  totalPages,
  total,
  title,
  subtitle,
}: CategoryContentProps) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { add, remove, isInWatchlist, ready } = useWatchlist();

  // Category endpoints return items in their intended editorial order. Keeping that
  // order ensures every displayed position matches the API result position.
  const leadItem = data[0];
  const supportingItems = data.slice(1, 3);
  const restItems = data.slice(3);

  const visiblePages = useMemo(() => {
    const pageCount = Math.min(totalPages, PAGE_WINDOW);
    const lastStart = Math.max(1, totalPages - pageCount + 1);
    const start = Math.min(Math.max(1, currentPage - 2), lastStart);
    return Array.from({ length: pageCount }, (_, index) => start + index);
  }, [currentPage, totalPages]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;

    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      params.set("page", newPage.toString());
      router.push(`?${params.toString()}`);
    });

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const getTitle = (item: MediaItem) => item.title || item.name || "Untitled";
  const getDetailUrl = (item: MediaItem) =>
    item.type === "movie" ? `/movies/${item.id}` : `/tv/${item.id}`;
  const getReleaseYear = (item: MediaItem) =>
    (item.release_date || item.first_air_date || "").slice(0, 4) || "Date TBA";
  const getReleaseLabel = (item: MediaItem) => {
    const dateValue = item.release_date || item.first_air_date;
    if (!dateValue) return "Date TBA";

    const [year, month, day] = dateValue.split("-").map(Number);
    if (!year || !month || !day) return "Date TBA";

    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
  };

  const imageKey = (item: MediaItem, kind: "backdrop" | "poster") =>
    `${item.type}:${item.id}:${kind}`;
  const markImageError = (item: MediaItem, kind: "backdrop" | "poster") => {
    const key = imageKey(item, kind);
    setImageErrors((previous) => new Set(previous).add(key));
  };
  const getBackdropUrl = (item: MediaItem) =>
    item.backdrop_path && !imageErrors.has(imageKey(item, "backdrop"))
      ? tmdbImage(item.backdrop_path, "original")
      : "/placeholder-backdrop.svg";
  const getPosterUrl = (item: MediaItem) =>
    item.poster_path && !imageErrors.has(imageKey(item, "poster"))
      ? tmdbImage(item.poster_path, "w500")
      : "/placeholder-poster.svg";

  const mediaLabel = (item: MediaItem) =>
    item.type === "tv" ? "Series" : "Movie";
  const getWatchType = (item: MediaItem) =>
    item.type === "tv" ? "series" : "movie";
  const getItemKey = (item: MediaItem) => `${item.type}:${item.id}`;
  const isSaved = (item: MediaItem) =>
    isInWatchlist(item.id, getWatchType(item));

  const toggleSaved = async (
    event: MouseEvent<HTMLButtonElement>,
    item: MediaItem,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (!ready) {
      router.push("/auth/login");
      return;
    }

    const key = getItemKey(item);
    setLoadingIds((previous) => new Set(previous).add(key));

    try {
      if (isSaved(item)) {
        await remove(item.id, getWatchType(item), {
          title: getTitle(item),
          posterUrl: getPosterUrl(item),
        });
      } else {
        await add(item.id, getWatchType(item), {
          title: getTitle(item),
          posterUrl: getPosterUrl(item),
        });
      }
    } finally {
      setLoadingIds((previous) => {
        const next = new Set(previous);
        next.delete(key);
        return next;
      });
    }
  };

  const MediaTypeIcon = ({ item }: { item: MediaItem }) =>
    item.type === "tv" ? (
      <Tv className="h-3.5 w-3.5" aria-hidden="true" />
    ) : (
      <Film className="h-3.5 w-3.5" aria-hidden="true" />
    );

  const BookmarkToggle = ({ item }: { item: MediaItem }) => {
    const saved = isSaved(item);
    const loading = loadingIds.has(getItemKey(item));

    return (
      <button
        type="button"
        onClick={(event) => toggleSaved(event, item)}
        disabled={loading}
        aria-label={
          saved ? `Remove ${getTitle(item)} from My List` : `Add ${getTitle(item)} to My List`
        }
        className={`absolute left-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-sm border border-white/20 shadow-[0_6px_18px_rgba(0,0,0,0.35)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60 ${saved
            ? "bg-[var(--brand-coral)] text-white"
            : "bg-[#0b0909]/90 text-white hover:bg-[var(--ink)] hover:text-[var(--surface-0)]"
          }`}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
        ) : saved ? (
          <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Bookmark className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    );
  };

  return (
    <main className="min-h-screen bg-[var(--surface-0)] text-[var(--ink)]">
      {isPending ? (
        <div
          className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-[var(--surface-border)]"
          role="status"
          aria-live="polite"
        >
          <span className="block h-full w-2/3 animate-pulse bg-[var(--brand-coral)] motion-reduce:animate-none" />
          <span className="sr-only">Loading the next page</span>
        </div>
      ) : null}

      <div className="ui-shell pb-16 pt-24 sm:pt-32">
        <header className="max-w-3xl">
          <p className="ui-kicker">Featured collection</p>
          <h1 className="mt-2 text-balance text-4xl font-bold leading-none text-[var(--ink)] sm:text-5xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
              {subtitle}
            </p>
          ) : null}
          {total > 0 ? (
            <p className="mt-3 text-xs font-semibold text-[var(--ink-muted)]">
              {total.toLocaleString()} {total === 1 ? "title" : "titles"}
            </p>
          ) : null}
        </header>

        <div className="mt-8 border-t border-[var(--surface-border)] pt-6 sm:mt-10 sm:pt-8">
          <div
            aria-busy={isPending}
            className={isPending ? "opacity-70" : undefined}
          >
            {leadItem ? (
              <section aria-labelledby="category-highlights-heading">
                <h2 id="category-highlights-heading" className="sr-only">
                  Collection highlights
                </h2>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.85fr)] lg:gap-4">
                  <div className="group relative min-h-[19rem] overflow-hidden rounded-lg border border-[var(--surface-border)] bg-[var(--surface-1)] transition-[border-color,box-shadow] duration-200 ease-out hover:border-[var(--brand-coral)] hover:shadow-[0_18px_45px_rgba(0,0,0,0.34)] focus-within:border-[var(--brand-coral)] motion-reduce:transition-none sm:min-h-[26rem] lg:min-h-[28rem]">
                    <BookmarkToggle item={leadItem} />
                    <Link
                      href={getDetailUrl(leadItem)}
                      className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
                      aria-label={`1. ${getTitle(leadItem)}, ${mediaLabel(leadItem)}`}
                    >
                      <div className="relative h-full min-h-[19rem] sm:min-h-[26rem] lg:min-h-[28rem]">
                        <img
                          src={getBackdropUrl(leadItem)}
                          alt=""
                          onError={() => markImageError(leadItem, "backdrop")}
                          className="absolute inset-0 h-full w-full object-cover transition-[filter] duration-300 ease-out group-hover:brightness-110 group-hover:saturate-[1.06] motion-reduce:transition-none"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />

                        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-8">
                          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-white/88">
                            <span className="inline-flex min-h-7 items-center border-l-2 border-[var(--brand-coral)] pl-2 text-sm font-bold text-white">
                              01
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <MediaTypeIcon item={leadItem} />
                              {mediaLabel(leadItem)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{getReleaseYear(leadItem)}</span>
                          </div>

                          <h3 className="max-w-2xl text-balance text-2xl font-bold leading-tight text-white transition-colors duration-200 group-hover:text-[var(--brand-coral-strong)] motion-reduce:transition-none sm:text-3xl">
                            {getTitle(leadItem)}
                          </h3>
                          <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-6 text-white/80">
                            {leadItem.overview ||
                              "Open this title to see more details."}
                          </p>

                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <RatingBadge
                              rating={leadItem.vote_average}
                              variant="colored"
                              size="md"
                            />
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/78">
                              <Calendar
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              {getReleaseLabel(leadItem)}
                            </span>
                            <span
                              aria-hidden="true"
                              className="ml-auto hidden items-center gap-1.5 text-xs font-bold text-white/80 opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none sm:inline-flex"
                            >
                              View details
                              <ArrowUpRight
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    {supportingItems.map((item, index) => (
                      <div
                        key={`${item.type}:${item.id}`}
                        className="group relative overflow-hidden rounded-lg border border-[var(--surface-border)] bg-[var(--surface-1)] transition-[border-color,background-color,box-shadow] duration-200 ease-out hover:border-[var(--brand-coral)] hover:bg-[var(--surface-2)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.28)] motion-reduce:transition-none"
                      >
                        <BookmarkToggle item={item} />
                        <Link
                          href={getDetailUrl(item)}
                          className="grid min-h-32 grid-cols-[7.5rem_minmax(0,1fr)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] sm:min-h-44 sm:grid-cols-1 sm:grid-rows-[minmax(7rem,1fr)_auto] lg:min-h-0 lg:grid-cols-[9rem_minmax(0,1fr)] lg:grid-rows-1"
                          aria-label={`${index + 2}. ${getTitle(item)}, ${mediaLabel(item)}`}
                        >
                          <div className="relative min-h-full overflow-hidden">
                            <img
                              src={getBackdropUrl(item)}
                              alt=""
                              onError={() => markImageError(item, "backdrop")}
                              className="absolute inset-0 h-full w-full object-cover transition-[filter] duration-300 ease-out group-hover:brightness-110 group-hover:saturate-[1.06] motion-reduce:transition-none"
                            />
                            <div className="absolute inset-0 bg-black/15" />
                            <span className="absolute bottom-2 left-2 border-l-2 border-[var(--brand-coral)] bg-black/80 px-2 py-1 text-xs font-bold tabular-nums text-white">
                              {String(index + 2).padStart(2, "0")}
                            </span>
                          </div>

                          <div className="flex min-w-0 flex-col justify-center p-4 lg:p-5">
                            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ink-muted)]">
                              <span className="inline-flex items-center gap-1">
                                <MediaTypeIcon item={item} />
                                {mediaLabel(item)}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{getReleaseYear(item)}</span>
                              <ArrowUpRight
                                className="ml-auto h-4 w-4 text-[var(--brand-coral-strong)] opacity-40 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none"
                                aria-hidden="true"
                              />
                            </div>
                            <h3 className="mt-2 line-clamp-2 text-base font-bold leading-tight text-[var(--ink)] transition-colors group-hover:text-[var(--brand-coral-strong)]">
                              {getTitle(item)}
                            </h3>
                            <p className="mt-3 hidden text-sm leading-6 text-[var(--ink-muted)] lg:line-clamp-2">
                              {item.overview ||
                                "Open this title to see more details."}
                            </p>
                            <div className="mt-4 self-start">
                              <RatingBadge
                                rating={item.vote_average}
                                variant="colored"
                                size="sm"
                              />
                            </div>
                          </div>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {restItems.length > 0 ? (
              <section
                className="mt-10 border-t border-[var(--surface-border)] pt-8 sm:mt-12 sm:pt-10"
                aria-labelledby="category-catalog-heading"
              >
                <div className="mb-5">
                  <h2
                    id="category-catalog-heading"
                    className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
                  >
                    Explore the collection
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                    Open any title for details, reviews, and recommendations.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {restItems.map((item) => (
                    <article
                      key={`${item.type}:${item.id}`}
                      className="group min-w-0"
                    >
                      <div className="relative">
                        <Link
                          href={getDetailUrl(item)}
                          className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-strong)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface-0)]"
                        >
                          <div className="relative aspect-[2/3] overflow-hidden rounded-md border border-[var(--surface-border)] bg-[var(--surface-2)] transition-[border-color,box-shadow] duration-200 ease-out group-hover:border-[var(--brand-coral)] group-hover:shadow-[0_14px_32px_rgba(0,0,0,0.3)] motion-reduce:transition-none">
                            <img
                              src={getPosterUrl(item)}
                              alt={getTitle(item)}
                              loading="lazy"
                              onError={() => markImageError(item, "poster")}
                              className="h-full w-full object-cover transition-[filter] duration-300 ease-out group-hover:brightness-110 group-hover:saturate-[1.05] motion-reduce:transition-none"
                            />
                            <RatingBadge
                              rating={item.vote_average}
                              variant="colored"
                              size="sm"
                              className="absolute right-2 top-2"
                            />
                            <div
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none sm:block"
                            >
                              <span className="flex items-center justify-end gap-1 text-xs font-bold text-white/88">
                                View details
                                <ArrowUpRight
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              </span>
                            </div>
                          </div>
                        </Link>
                        <BookmarkToggle item={item} />
                      </div>

                      <Link
                        href={getDetailUrl(item)}
                        className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-strong)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface-0)]"
                      >
                        <h3 className="mt-2.5 line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)] transition-colors group-hover:text-[var(--brand-coral-strong)]">
                          {getTitle(item)}
                        </h3>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
                          <span>{getReleaseYear(item)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{mediaLabel(item)}</span>
                          {item.number_of_seasons ? (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>
                                {item.number_of_seasons} season
                                {item.number_of_seasons === 1 ? "" : "s"}
                              </span>
                            </>
                          ) : null}
                        </p>
                        {item.genres?.length ? (
                          <p className="mt-1 line-clamp-1 text-xs text-[var(--ink-muted)]">
                            {item.genres.slice(0, 2).join(" · ")}
                          </p>
                        ) : null}
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          {totalPages > 1 ? (
            <nav
              className="mt-10 flex items-center justify-center gap-3 border-t border-[var(--surface-border)] pt-6 sm:mt-12 sm:gap-4 sm:pt-8"
              aria-label="Collection pages"
            >
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isPending}
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border border-[var(--surface-border)] px-3 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brand-coral)] hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                <span className="hidden sm:inline">Previous</span>
              </button>

              <span className="min-w-20 text-center text-sm font-semibold text-[var(--ink-muted)] sm:hidden">
                {currentPage} / {totalPages}
              </span>

              <div className="hidden items-center gap-2 sm:flex">
                {visiblePages.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => handlePageChange(pageNumber)}
                    disabled={isPending}
                    aria-current={
                      pageNumber === currentPage ? "page" : undefined
                    }
                    aria-label={`Page ${pageNumber}`}
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-md border text-sm font-bold transition-colors disabled:cursor-not-allowed ${pageNumber === currentPage
                        ? "border-[var(--brand-coral)] bg-[var(--brand-coral)] text-white"
                        : "border-[var(--surface-border)] text-[var(--ink-muted)] hover:border-[var(--brand-coral)] hover:text-[var(--ink)]"
                      }`}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isPending}
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border border-[var(--surface-border)] px-3 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brand-coral)] hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </nav>
          ) : null}

          {data.length === 0 ? (
            <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center sm:py-20">
              <div className="grid h-14 w-14 place-items-center rounded-full border border-[var(--surface-border)] bg-[var(--surface-1)]">
                <Award
                  className="h-6 w-6 text-[var(--brand-gold)]"
                  aria-hidden="true"
                />
              </div>
              <h2 className="mt-5 text-2xl font-bold text-[var(--ink)]">
                No titles here yet
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                Check back soon for more movies and series in this collection.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
