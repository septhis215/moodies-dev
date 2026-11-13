// src/components/Hero/HeroCarousel.tsx
"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  BookmarkCheck,
  Film,
  Info,
  Tv,
} from "lucide-react";
import type { All } from "@/types/all";
import { tmdbImage } from "@/lib/tmdb";
import useCarousel from "@/hooks/useCarousel";
import { useHeroSwipe } from "@/hooks/useHeroSwipe";
import { useWatchlist } from "@/hooks/useWatchlist";
import { FeaturedPosterWave } from "./FeaturedPosterWave";
import { HeroEdgeNavigation } from "./HeroEdgeNavigation";
import HeroPreview from "./HeroPreview";
import RatingBadge from "@/components/ui/rating-badge";

type Props = { all: All[]; cycleMs?: number };
type ContentKind = "movie" | "tv";
type HookType = "movie" | "series";

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
  const [autoPlay, setAutoPlay] = useState(true);
  const [previewActive, setPreviewActive] = useState(false);
  const { index, setIndex, pause, resume } = useCarousel({
    length: all.length,
    intervalMs: cycleMs,
    autoAdvance: !previewActive,
  });

  const [wlLoading, setWlLoading] = useState(false);
  const swipeHandlers = useHeroSwipe({
    onSwipe: direction => setIndex(current => (current + direction + all.length) % all.length),
    pause,
    resume,
  });

  const router = useRouter();
  const { add, remove, isInWatchlist, ready } = useWatchlist();

  const current = all[index];
  const currentKind = current ? getContentType(current) : "movie";
  const currentInWatchlist = current?.id
    ? isInWatchlist(String(current.id), toHookType(currentKind))
    : false;

  useEffect(() => {
    if (!all || all.length === 0) return;

    if (all.length < 2) return;
    for (const offset of [-1, 1]) {
      const i = (index + offset + all.length) % all.length;
      const item = all[i];
      if (!item) continue;

      const hero = window.matchMedia("(width < 640px)").matches
        ? tmdbImage(item.poster_path, "posterLarge") || tmdbImage(item.backdrop_path, "backdropCard")
        : tmdbImage(item.backdrop_path, window.innerWidth >= 1600 ? "original" : "backdropHero") || tmdbImage(item.poster_path, "w780");

      if (hero) {
        const img = new window.Image();
        img.fetchPriority = "low";
        img.src = hero;
      }

    }
  }, [index, all]);

  if (!all || all.length === 0 || !current) {
    return (
      <section className="landing-hero flex items-center justify-center bg-[var(--surface-0)] px-6 text-center text-white">
        <p className="text-sm font-semibold text-white/70">
          Featured titles are loading.
        </p>
      </section>
    );
  }

  const currentTitle = getTitle(current);
  const slideKey = `${currentKind}-${current.id}`;
  const releaseDate = formatReleaseDate(getReleaseDate(current));
  const backdropSrc =
    tmdbImage(current.backdrop_path, "backdropHero") ??
    tmdbImage(current.poster_path, "w780") ??
    "/placeholder-backdrop.svg";
  const wideBackdropSrc = tmdbImage(current.backdrop_path, "original");
  const posterSrc =
    tmdbImage(current.poster_path, "posterLarge") ??
    tmdbImage(current.backdrop_path, "backdropCard") ?? "/placeholder-poster.svg";
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
      style={{ touchAction: "pan-y pinch-zoom" }}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) resume();
      }}
      aria-roledescription="carousel"
      aria-label="Featured Moodies titles"
      {...swipeHandlers}
    >
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={slideKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.3,
          }}
          className="absolute inset-0"
        >
          <picture>
            <source media="(width < 640px)" srcSet={posterSrc} />
            {wideBackdropSrc && <source media="(width >= 1600px)" srcSet={wideBackdropSrc} />}
            <Image
              src={backdropSrc}
              alt=""
              fill
              sizes="100vw"
              loading="eager"
              fetchPriority={index === 0 ? "high" : "auto"}
              aria-hidden
              className="object-cover object-[center_25%] brightness-110 saturate-110 sm:object-center"
            />
          </picture>
        </motion.div>
      </AnimatePresence>
      <HeroPreview
        key={slideKey}
        id={current.id}
        kind={currentKind}
        trailerKey={current.trailer_key}
        autoPlay={autoPlay}
        onStop={() => setAutoPlay(false)}
        onActiveChange={setPreviewActive}
      />
      <div aria-hidden="true" className="homepage-hero-fade pointer-events-none absolute inset-0 z-[2]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-[2] hidden h-40 bg-[linear-gradient(to_bottom,rgba(8,7,7,0.88),rgba(8,7,7,0.72)_3.5rem,transparent)] lg:block" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2] hidden bg-[radial-gradient(ellipse_at_4%_83%,rgba(8,7,7,0.96)_0%,rgba(8,7,7,0.7)_30%,transparent_70%)] sm:block" />

      {all.length > 1 && <HeroEdgeNavigation onNavigate={(offset) => goToSlide(index + offset)} />}

      <div className="ui-shell pointer-events-none relative z-10 flex flex-col justify-end pb-5 pt-48 sm:pb-7 sm:pt-24 lg:pb-9 [&_button]:pointer-events-auto">
        <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8">
          <motion.div
            key={slideKey}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 0.18,
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

            <h1
              aria-label={currentTitle}
              title={currentTitle}
              className="line-clamp-2 max-w-[20ch] break-words text-balance text-[2.1rem] font-bold leading-[0.98] tracking-normal text-white drop-shadow-[0_8px_28px_rgba(0,0,0,0.5)] min-[390px]:text-[2.45rem] sm:text-[clamp(2.45rem,4.6vw,4rem)] sm:leading-[0.96] xl:text-[clamp(2.45rem,4.2vw,4.8rem)]"
            >
              {currentTitle}
            </h1>

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

            <p
              className="mt-4 line-clamp-2 max-w-xl text-sm leading-6 text-white/80 sm:line-clamp-3"
            >
              <span className="sm:hidden">{mobileOverview}</span>
              <span className="hidden sm:inline">{desktopOverview}</span>
            </p>

            <div
              className="mt-6 grid max-w-[25rem] grid-cols-2 gap-3 sm:flex sm:max-w-none sm:flex-wrap"
            >
              <button
                type="button"
                onClick={goToDetails}
                className="ui-primary-action min-h-12 sm:min-h-11"
              >
                <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Explore
              </button>

              <button
                type="button"
                onClick={toggleWatchlist}
                disabled={wlLoading}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-extrabold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-11 sm:rounded-md ${
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
            </div>
          </motion.div>

          {all.length > 1 && <FeaturedPosterWave items={all} index={index} onSelect={goToSlide} />}
        </div>

        <div className="mt-5 flex items-center gap-3 sm:mt-8 lg:hidden">
          <span className="shrink-0 text-xs text-white/55 sm:hidden">Swipe to explore</span>

          <div className="h-px flex-1 overflow-hidden bg-white/20">
            <motion.div
              className="h-full origin-left bg-[#ff725e]"
              style={{ width: `${progress}%` }}
            />
          </div>

          <span className="min-w-9 text-center text-[11px] font-bold text-white/62 sm:min-w-10 sm:text-xs">
            {index + 1}/{all.length}
          </span>

        </div>
      </div>
    </section>
  );
}
