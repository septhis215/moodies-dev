// src/components/Hero/HeroCarousel.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Film,
  Info,
  Tv,
} from "lucide-react";
import type { All } from "@/types/all";
import { tmdbImage } from "@/lib/tmdb";
import useCarousel from "@/hooks/useCarousel";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import HeroThumbnail from "./heroThumbnail";
import RatingBadge from "@/components/ui/rating-badge";

type Props = { all: All[]; cycleMs?: number };
type ContentKind = "movie" | "tv";
type HookType = "movie" | "series";

function getThumbnailWindow<T>(items: T[], index: number, windowSize = 5): T[] {
  const half = Math.floor(windowSize / 2);
  const start = Math.max(0, Math.min(index - half, items.length - windowSize));
  return items.slice(start, start + windowSize);
}

function getContentType(item: Partial<All>): ContentKind {
  if (item.type === "tv") return "tv";
  if (item.type === "movie") return "movie";
  if (item.number_of_seasons || item.first_air_date || item.name) return "tv";
  return "movie";
}

function toHookType(kind: ContentKind): HookType {
  return kind === "tv" ? "series" : "movie";
}

function getTitle(item: All) {
  return item.title || item.name || "Featured title";
}

function getReleaseDate(item: All) {
  return item.release_date || item.first_air_date || null;
}

function formatReleaseDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function getOverview(item: All, maxLength: number) {
  const overview = item.overview || "Discover why this title is trending now.";
  if (overview.length <= maxLength) return overview;
  return `${overview.slice(0, maxLength).trim()}...`;
}

export default function HeroCarousel({ all = [], cycleMs = 7000 }: Props) {
  const reduceMotion = useReducedMotion();
  const { index, setIndex, pause, resume } = useCarousel({
    length: all.length,
    intervalMs: cycleMs,
  });

  const [mounted, setMounted] = useState(false);
  const isCompact = useMediaQuery("(max-width: 640px)");
  const thumbnailWindowSize = isCompact ? 4 : 5;
  const [wlLoading, setWlLoading] = useState(false);

  const router = useRouter();
  const { add, remove, isInWatchlist, ready } = useWatchlist();

  const current = all[index];
  const currentKind = current ? getContentType(current) : "movie";
  const currentInWatchlist = current?.id
    ? isInWatchlist(String(current.id), toHookType(currentKind))
    : false;

  const thumbnailWindow = useMemo(
    () => getThumbnailWindow(all, index, thumbnailWindowSize),
    [all, index, thumbnailWindowSize],
  );

  useEffect(() => {
    if (!all || all.length === 0) return;

    [index, (index + 1) % all.length].forEach((i) => {
      const item = all[i];
      if (!item) return;

      const backdrop =
        tmdbImage(item.backdrop_path, "w1280") ||
        tmdbImage(item.poster_path, "w1280");
      const poster = tmdbImage(item.poster_path, "w342");

      if (backdrop) {
        const img = new window.Image();
        img.src = backdrop;
      }

      if (poster) {
        const img = new window.Image();
        img.src = poster;
      }
    });
  }, [index, all]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!all || all.length === 0 || !current) {
    return (
      <section className="flex h-[60vh] min-h-[420px] items-center justify-center bg-[#09090a] px-6 text-center text-white">
        <p className="text-sm font-semibold text-white/70">
          Featured titles are loading.
        </p>
      </section>
    );
  }

  const currentTitle = getTitle(current);
  const releaseDate = formatReleaseDate(getReleaseDate(current));
  const backdropSrc =
    tmdbImage(current.backdrop_path || current.poster_path, "w1280") ??
    "/placeholder-backdrop.svg";
  const mobileOverview = getOverview(current, 105);
  const desktopOverview = getOverview(current, 180);
  const progress = all.length > 0 ? ((index + 1) / all.length) * 100 : 0;

  const goToDetails = () => {
    const routePath = currentKind === "tv" ? "tv" : "movies";
    router.push(`/${routePath}/${current.id}`);
  };

  const goToSlide = (nextIndex: number) => {
    setIndex((nextIndex + all.length) % all.length);
  };

  const toggleWatchlist = async () => {
    if (!current?.id) return;

    if (!ready) {
      router.push("/auth/login");
      return;
    }

    setWlLoading(true);

    try {
      const posterUrl =
        tmdbImage(current.poster_path ?? current.backdrop_path, "w154") ?? null;

      if (currentInWatchlist) {
        await remove(String(current.id), toHookType(currentKind), {
          title: currentTitle,
          posterUrl,
        });
      } else {
        await add(String(current.id), toHookType(currentKind), {
          title: currentTitle,
          posterUrl,
        });
      }
    } catch (error) {
      console.error("Watchlist toggle failed:", error);
    } finally {
      setWlLoading(false);
    }
  };

  return (
    <section
      className="landing-hero relative isolate flex w-full overflow-hidden bg-[var(--surface-0)] text-white"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
      aria-roledescription="carousel"
      aria-label="Featured Moodies titles"
    >
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={`landing-backdrop-${current.id}`}
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 1.025 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: reduceMotion ? 0 : 0.55 },
            scale: { duration: reduceMotion ? 0 : 1.1, ease: "easeOut" },
          }}
          className="absolute inset-0"
        >
          <Image
            src={backdropSrc}
            alt=""
            fill
            sizes="100vw"
            priority={index === 0}
            aria-hidden
            className="object-cover object-[58%_center] sm:object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,4,4,0.9)_0%,rgba(5,4,4,0.62)_42%,rgba(5,4,4,0.12)_78%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,4,4,0.24)_0%,rgba(5,4,4,0.06)_38%,rgba(5,4,4,0.96)_100%)]" />
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col justify-end px-5 pb-6 pt-10 sm:px-6 sm:pb-7 sm:pt-24 lg:px-8 lg:pb-9">
        <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={`landing-copy-${current.id}`}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -10 }}
              transition={{
                duration: reduceMotion ? 0 : 0.34,
                ease: "easeOut",
              }}
              className="min-w-0 max-w-[34rem] sm:max-w-2xl xl:max-w-3xl"
            >
              <p className="ui-kicker mb-3">
                Moodies spotlight
              </p>
              <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/65 sm:text-xs">
                <span className="inline-flex items-center gap-1.5 text-white">
                  {currentKind === "tv" ? (
                    <Tv className="h-3.5 w-3.5 text-[#ff8b78]" />
                  ) : (
                    <Film className="h-3.5 w-3.5 text-[#ff8b78]" />
                  )}
                  {currentKind === "tv" ? "Series" : "Movie"}
                </span>
                {releaseDate ? (
                  <>
                    <span aria-hidden="true" className="text-white/30">
                      /
                    </span>
                    <span>{releaseDate}</span>
                  </>
                ) : null}
                <RatingBadge
                  rating={current.vote_average}
                  variant="colored"
                  size="sm"
                />
              </div>

              <motion.h1
                initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.38,
                  delay: reduceMotion ? 0 : 0.07,
                }}
                aria-label={currentTitle}
                title={currentTitle}
                className="line-clamp-2 max-w-[20ch] break-words text-balance text-[2.1rem] font-bold leading-[0.98] tracking-normal text-white drop-shadow-[0_8px_28px_rgba(0,0,0,0.5)] min-[390px]:text-[2.45rem] sm:text-[clamp(2.45rem,4.6vw,4rem)] sm:leading-[0.96]"
              >
                {currentTitle}
              </motion.h1>

              <div className="mt-4 hidden items-center gap-2 text-xs font-semibold text-white/62 sm:flex">
                {current.genres?.slice(0, 3).map((genre, genreIndex) => (
                  <React.Fragment key={genre}>
                    {genreIndex > 0 ? (
                      <span aria-hidden="true" className="text-white/25">
                        ·
                      </span>
                    ) : null}
                    <span>{genre}</span>
                  </React.Fragment>
                ))}
              </div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.32,
                  delay: reduceMotion ? 0 : 0.14,
                }}
                className="mt-4 line-clamp-3 max-w-xl text-sm leading-6 text-white/80"
              >
                <span className="sm:hidden">{mobileOverview}</span>
                <span className="hidden sm:inline">{desktopOverview}</span>
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.3,
                  delay: reduceMotion ? 0 : 0.18,
                }}
                className="mt-6 grid max-w-[25rem] grid-cols-2 gap-3 sm:flex sm:max-w-none sm:flex-wrap"
              >
                <button
                  type="button"
                  onClick={goToDetails}
                  className="ui-primary-action min-h-11"
                >
                  <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Explore
                </button>

                <button
                  type="button"
                  onClick={toggleWatchlist}
                  disabled={wlLoading}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-5 py-3 text-sm font-extrabold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    currentInWatchlist
                      ? "border-emerald-300/45 bg-emerald-400/18 text-emerald-100 hover:bg-emerald-400/24 focus-visible:outline-emerald-200"
                      : "border-white/18 bg-white/10 text-white hover:bg-white/16 focus-visible:outline-white/70"
                  }`}
                >
                  {wlLoading ? (
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/70 border-t-transparent motion-safe:animate-spin sm:h-4 sm:w-4" />
                  ) : currentInWatchlist ? (
                    <BookmarkCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  ) : (
                    <Bookmark className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                  {currentInWatchlist ? "Saved" : "My List"}
                </button>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          <div className="hidden flex-col items-end gap-3 lg:flex">
            <div className="flex w-full justify-end">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToSlide(index - 1)}
                  className="grid h-10 w-10 place-items-center rounded-sm border border-white/20 bg-black/35 text-white/80 transition-colors hover:border-white/50 hover:bg-black/55 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
                  aria-label="Previous featured title"
                >
                  <ChevronLeft className="h-4 w-4 xl:h-5 xl:w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => goToSlide(index + 1)}
                  className="grid h-10 w-10 place-items-center rounded-sm border border-white/20 bg-black/35 text-white/80 transition-colors hover:border-white/50 hover:bg-black/55 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
                  aria-label="Next featured title"
                >
                  <ChevronRight className="h-4 w-4 xl:h-5 xl:w-5" />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              {mounted &&
                thumbnailWindow.map((item) => {
                  const slideIndex = all.findIndex(
                    (entry) => entry.id === item.id,
                  );
                  return (
                    <HeroThumbnail
                      key={item.id}
                      all={item}
                      active={slideIndex === index}
                      onClick={() => goToSlide(slideIndex)}
                      width={72}
                      height={108}
                    />
                  );
                })}
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-3 lg:hidden">
          <button
            type="button"
            onClick={() => goToSlide(index - 1)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-white/20 bg-black/38 text-white/80 backdrop-blur-sm"
            aria-label="Previous featured title"
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          <div className="h-px flex-1 overflow-hidden bg-white/20">
            <motion.div
              className="h-full origin-left bg-[#ff725e]"
              style={{ width: `${progress}%` }}
            />
          </div>

          <span className="min-w-9 text-center text-[11px] font-bold text-white/62 sm:min-w-10 sm:text-xs">
            {index + 1}/{all.length}
          </span>

          <button
            type="button"
            onClick={() => goToSlide(index + 1)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-white/20 bg-black/38 text-white/80 backdrop-blur-sm"
            aria-label="Next featured title"
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
