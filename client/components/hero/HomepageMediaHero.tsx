"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bookmark, BookmarkCheck, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import type { All } from "@/types/all";
import { tmdbImage } from "@/lib/tmdb";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import RatingBadge from "@/components/ui/rating-badge";
import { useWatchlist } from "@/hooks/useWatchlist";
import useCarousel from "@/hooks/useCarousel";
import { useHeroSwipe } from "@/hooks/useHeroSwipe";
import { CarouselNavButton } from "@/components/ui/CarouselNavButton";

type HomepageMediaHeroProps = {
  items: All[];
  mediaType: "movie" | "tv";
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  spotlightLabel: string;
  mediaLabel: string;
  primaryCta?: string;
};

const getBackdropUrl = (path?: string | null) =>
  path ? tmdbImage(path, "backdropHero") : "/placeholder-backdrop.svg";

const getPosterUrl = (path?: string | null) =>
  path ? tmdbImage(path, "posterCard") : "/placeholder-poster.svg";

const getTitle = (item?: All | null) => item?.title || item?.name || "Untitled";

const getYear = (item?: All | null) =>
  (item?.release_date || item?.first_air_date || item?.year || "TBA")
    .toString()
    .slice(0, 4);

export function HomepageMediaHero({
  items,
  mediaType,
  icon,
  eyebrow,
  title,
  description,
  spotlightLabel,
  mediaLabel,
  primaryCta = "View details",
}: HomepageMediaHeroProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { add, remove, isInWatchlist, ready } = useWatchlist();
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const selectorRailRef = useRef<HTMLDivElement>(null);
  const heroItems = useMemo(() => items.slice(0, 8), [items]);
  const {
    index: activeIndex,
    setIndex: setActiveIndex,
    pause,
    resume,
  } = useCarousel({ length: heroItems.length, intervalMs: 8000 });
  const swipeHandlers = useHeroSwipe({
    onSwipe: direction => setActiveIndex(current => heroItems.length > 1
      ? (current + direction + heroItems.length) % heroItems.length : current),
    pause,
    resume,
  });
  const featured = heroItems[activeIndex] || heroItems[0] || null;
  const routeBase = mediaType === "tv" ? "tv" : "movies";
  const watchlistType = mediaType === "tv" ? "series" : "movie";
  const saved = featured?.id
    ? isInWatchlist(String(featured.id), watchlistType)
    : false;

  useEffect(() => {
    const rail = selectorRailRef.current;
    const activeButton = selectorRailRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]',
    );
    if (!rail || !activeButton) return;

    rail.scrollTo({
      left:
        activeButton.offsetLeft -
        (rail.clientWidth - activeButton.clientWidth) / 2,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [activeIndex, reduceMotion]);

  const toggleWatchlist = async () => {
    if (!featured?.id) return;
    if (!ready) {
      router.push("/auth/login");
      return;
    }

    setWatchlistLoading(true);
    const titleValue = getTitle(featured);
    const posterUrl = getPosterUrl(featured.poster_path);
    try {
      if (saved) {
        await remove(String(featured.id), watchlistType, {
          title: titleValue,
          posterUrl,
        });
      } else {
        await add(String(featured.id), watchlistType, {
          title: titleValue,
          posterUrl,
        });
      }
    } finally {
      setWatchlistLoading(false);
    }
  };

  if (!featured) return null;

  const selectRelative = (offset: number) => {
    if (!heroItems.length) return;
    setActiveIndex(
      (activeIndex + offset + heroItems.length) % heroItems.length,
    );
  };

  return (
    <section
      className="ui-shell pt-0 sm:pt-6 lg:pt-24"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
      aria-labelledby={`${mediaType}-hub-heading`}
    >
      <header className="sr-only sm:not-sr-only sm:flex sm:max-w-3xl sm:items-start sm:gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[var(--surface-border)] text-[var(--brand-coral-strong)]">
          {icon}
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--brand-coral-strong)]">
            {eyebrow}
          </p>
          <h1
            id={`${mediaType}-hub-heading`}
            className="mt-1 text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
          >
            {title}
          </h1>
          <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-[var(--ink-muted)]">
            {description}
          </p>
        </div>
      </header>

      <div {...swipeHandlers} className="relative -mx-4 overflow-hidden bg-[var(--surface-0)] sm:mx-0 sm:mt-4 sm:rounded-md sm:border sm:border-[var(--surface-border)] sm:bg-[var(--surface-1)]">
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            key={`backdrop-${featured.id}`}
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 1.025 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.65, ease: "easeOut" }}
            className="absolute inset-0"
            style={{ touchAction: "pan-y pinch-zoom" }}
          >
            <Image
              src={getBackdropUrl(
                featured.backdrop_path || featured.poster_path,
              )}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 hidden bg-gradient-to-r from-[#080707] via-[#080707]/82 to-[#080707]/24 sm:block" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,7,0.06)_0%,rgba(8,7,7,0.12)_30%,rgba(8,7,7,0.82)_62%,var(--surface-0)_100%)] sm:bg-gradient-to-t sm:from-[#080707] sm:via-transparent sm:to-black/20" />
          </motion.div>
        </AnimatePresence>

        <div className="relative z-10 grid min-h-[min(620px,calc(100svh-var(--mobile-nav-safe)))] min-w-0 grid-rows-[auto_1fr_auto] px-5 pb-5 pt-4 sm:min-h-[460px] sm:grid-rows-[1fr_auto] sm:p-6 lg:p-7">
          <div aria-hidden="true" className="h-44 sm:hidden" style={{ touchAction: "pan-y pinch-zoom" }} />
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={`copy-${featured.id}`}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
              transition={{
                duration: reduceMotion ? 0 : 0.34,
                ease: "easeOut",
              }}
              className="grid min-h-0 items-end gap-5 pb-5 sm:items-center sm:grid-cols-[minmax(0,1fr)_140px] lg:grid-cols-[minmax(0,620px)_160px] lg:gap-9"
              style={{ touchAction: "pan-y pinch-zoom" }}
            >
              <div className="min-w-0 max-w-2xl self-end sm:self-center">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/65">
                  <span className="text-[#ff8b78]">
                    <span className="sm:hidden">{mediaLabel} spotlight</span>
                    <span className="hidden sm:inline">{spotlightLabel}</span>
                  </span>
                  <span aria-hidden="true" className="hidden sm:inline">/</span>
                  <span className="hidden sm:inline">{mediaLabel}</span>
                  <span aria-hidden="true">/</span>
                  <span>{getYear(featured)}</span>
                  <span className="sm:hidden">
                    <RatingBadge rating={featured.vote_average} variant="colored" size="sm" />
                  </span>
                </div>

                <motion.h2
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.36,
                    delay: reduceMotion ? 0 : 0.08,
                  }}
                  aria-label={getTitle(featured)}
                  title={getTitle(featured)}
                  className="mt-3 line-clamp-3 max-w-[20ch] break-words text-balance text-4xl font-bold leading-none tracking-normal text-white drop-shadow-lg sm:line-clamp-2 sm:text-5xl sm:leading-[0.95]"
                >
                  {getTitle(featured)}
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.32,
                    delay: reduceMotion ? 0 : 0.14,
                  }}
                  className="mt-3 line-clamp-2 max-w-xl text-sm leading-6 text-white/72 sm:text-base"
                >
                  {featured.overview || "No description available."}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.3,
                    delay: reduceMotion ? 0 : 0.18,
                  }}
                  className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap sm:gap-3"
                >
                  <span className="hidden sm:contents">
                    <RatingBadge rating={featured.vote_average} variant="colored" size="sm" />
                  </span>
                  <Link
                    href={`/${routeBase}/${featured.id}`}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--brand-coral)] px-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-coral-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:min-h-11 sm:rounded-md sm:px-5"
                  >
                    <Info className="h-4 w-4" />
                    {primaryCta}
                  </Link>
                  <button
                    type="button"
                    onClick={toggleWatchlist}
                    disabled={watchlistLoading}
                    className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60 sm:min-h-11 sm:rounded-md ${
                      saved
                        ? "border-[var(--brand-coral)] bg-[var(--brand-coral)] text-white"
                        : "border-white/25 bg-black/30 text-white backdrop-blur-sm hover:border-white/55 hover:bg-black/50"
                    }`}
                    aria-label={
                      saved ? "Remove from My List" : "Add to My List"
                    }
                  >
                    {watchlistLoading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
                    ) : saved ? (
                      <BookmarkCheck className="h-4 w-4" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                    <span>
                      {saved ? "Saved" : "My List"}
                    </span>
                  </button>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, x: reduceMotion ? 0 : 18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.42,
                  delay: reduceMotion ? 0 : 0.08,
                }}
                className="relative hidden aspect-[2/3] overflow-hidden rounded-sm border border-white/20 bg-[var(--surface-2)] shadow-[0_24px_70px_rgba(0,0,0,0.42)] sm:block"
              >
                <Image
                  src={getPosterUrl(featured.poster_path)}
                  alt={`${getTitle(featured)} poster`}
                  fill
                  sizes="210px"
                  className="object-cover"
                />
              </motion.div>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center gap-3 text-xs text-white/55 lg:hidden">
            <span>Swipe to explore</span>
            <span aria-hidden="true" className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-[var(--brand-coral)]" style={{ width: `${((activeIndex + 1) / heroItems.length) * 100}%` }} /></span>
            <span className="tabular-nums">{activeIndex + 1} / {heroItems.length}</span>
          </div>
          <div className="hidden min-w-0 overflow-hidden border-t border-white/15 pt-3 lg:block">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">
                <span className="sm:hidden">Swipe to explore</span>
                <span className="hidden sm:inline">Now in the marquee</span>
              </p>
              <div className="flex items-center gap-2">
                <span className="mr-1 text-[10px] tabular-nums text-white/55">
                  {String(activeIndex + 1).padStart(2, "0")} /{" "}
                  {String(heroItems.length).padStart(2, "0")}
                </span>
                <CarouselNavButton
                  direction="previous"
                  onClick={() => selectRelative(-1)}
                  disabled={heroItems.length < 2}
                  className="hidden h-9 w-9 shadow-none sm:grid"
                  aria-label="Previous featured title"
                />
                <CarouselNavButton
                  direction="next"
                  onClick={() => selectRelative(1)}
                  disabled={heroItems.length < 2}
                  className="hidden h-9 w-9 shadow-none sm:grid"
                  aria-label="Next featured title"
                />
              </div>
            </div>

            <div className="relative w-full min-w-0 max-w-full">
              <div
                ref={selectorRailRef}
                data-hero-selector
                className="mobile-native-scroll -mx-4 flex w-auto min-w-0 max-w-[calc(100%+2rem)] snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-full sm:max-w-full sm:px-0"
              >
                {heroItems.map((item, index) => {
                  const active = item.id === featured.id;
                  return (
                    <button
                      key={`${item.id}-${index}`}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      data-active={active}
                      className={`group/thumb relative grid w-14 shrink-0 snap-center items-center rounded-lg border p-1 text-left transition-colors sm:w-[166px] sm:grid-cols-[40px_minmax(0,1fr)] sm:gap-2 sm:rounded-sm sm:p-1.5 ${
                        active
                          ? "border-[var(--brand-coral)] bg-black/50"
                          : "border-white/12 bg-black/20 hover:border-white/40 hover:bg-black/35"
                      }`}
                      aria-label={`Feature ${getTitle(item)}`}
                      aria-pressed={active}
                    >
                      <span className="relative aspect-[2/3] overflow-hidden rounded-sm bg-white/10">
                        <Image
                          src={getPosterUrl(item.poster_path)}
                          alt=""
                          fill
                          sizes="46px"
                          className={`object-cover transition-opacity ${active ? "opacity-100" : "opacity-65 group-hover/thumb:opacity-100"}`}
                        />
                      </span>
                      <span className="hidden min-w-0 sm:block">
                        <span
                          className={`block truncate text-xs font-semibold ${active ? "text-white" : "text-white/65"}`}
                        >
                          {getTitle(item)}
                        </span>
                        <span className="mt-1 block text-[10px] uppercase tracking-[0.08em] text-white/40">
                          {getYear(item)} · {mediaLabel}
                        </span>
                      </span>
                      {active ? (
                        <motion.span
                          layoutId={`${mediaType}-hero-selector`}
                          className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--brand-coral)]"
                          transition={{ duration: reduceMotion ? 0 : 0.22 }}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
