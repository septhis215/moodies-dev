// src/components/Hero/HeroCarousel.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  BookmarkCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Film,
  Info,
  Star,
  Tv,
} from "lucide-react";
import type { All } from "@/types/all";
import { tmdbImage } from "@/lib/tmdb";
import useCarousel from "@/hooks/useCarousel";
import { useWatchlist } from "@/hooks/useWatchlist";
import HeroThumbnail from "./heroThumbnail";
import "./hero.css";

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
  const { index, setIndex, pause, resume } = useCarousel({
    length: all.length,
    intervalMs: cycleMs,
  });

  const [mounted, setMounted] = useState(false);
  const [thumbnailWindowSize, setThumbnailWindowSize] = useState(5);
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

    const updateThumbnailSize = () => {
      if (window.innerWidth <= 640) {
        setThumbnailWindowSize(4);
      } else if (window.innerWidth <= 1024) {
        setThumbnailWindowSize(5);
      } else {
        setThumbnailWindowSize(5);
      }
    };

    updateThumbnailSize();
    window.addEventListener("resize", updateThumbnailSize);
    return () => window.removeEventListener("resize", updateThumbnailSize);
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
  const rating =
    typeof current.vote_average === "number" && current.vote_average > 0
      ? current.vote_average.toFixed(1)
      : null;
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
      className="relative isolate h-[86svh] min-h-[620px] w-full overflow-hidden bg-[#080808] text-white sm:h-[82vh] sm:min-h-[560px] lg:h-screen lg:max-h-[1100px]"
      onMouseEnter={pause}
      onMouseLeave={resume}
      aria-roledescription="carousel"
      aria-label="Featured Moodies titles"
    >
      <div className="absolute inset-0">
        <Image
          key={current.id}
          src={backdropSrc}
          alt=""
          fill
          sizes="100vw"
          priority
          aria-hidden
          className="hero-backdrop-image object-cover object-[58%_center] sm:object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.42)_0%,rgba(0,0,0,0.08)_58%,rgba(0,0,0,0.28)_100%)] sm:bg-[linear-gradient(90deg,rgba(0,0,0,0.78)_0%,rgba(0,0,0,0.16)_68%,rgba(0,0,0,0.36)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.12)_36%,rgba(0,0,0,0.9)_100%)] sm:bg-[linear-gradient(180deg,rgba(0,0,0,0.12)_0%,rgba(0,0,0,0.12)_48%,rgba(0,0,0,0.82)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(ellipse_at_bottom,rgba(0,0,0,0.86)_0%,rgba(0,0,0,0.45)_44%,transparent_74%)] sm:hidden" />
      </div>

      <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-5 pb-7 pt-24 sm:px-6 sm:pb-7 lg:px-8 lg:pb-9 xl:px-12">
        <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8 xl:gap-10">
          <div className="max-w-[34rem] sm:max-w-2xl xl:max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-1.5 sm:mb-2.5 sm:gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e94f37]/40 bg-[#e94f37]/18 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#ffb2a5] sm:text-[10px] lg:text-[11px]">
                {currentKind === "tv" ? (
                  <Tv className="h-3 w-3 lg:h-3.5 lg:w-3.5" />
                ) : (
                  <Film className="h-3 w-3 lg:h-3.5 lg:w-3.5" />
                )}
                {currentKind === "tv" ? "Series" : "Movie"}
              </span>

              {rating ? (
                <span className="hidden items-center gap-1.5 rounded-full border border-white/12 bg-black/35 px-2.5 py-1 text-[10px] font-bold text-white/88 sm:inline-flex sm:text-xs">
                  <Star className="h-3 w-3 fill-[#f6b73c] text-[#f6b73c] sm:h-3.5 sm:w-3.5" />
                  {rating}
                </span>
              ) : null}

              {releaseDate ? (
                <span className="hidden items-center gap-1.5 rounded-full border border-white/12 bg-black/35 px-2.5 py-1 text-[10px] font-bold text-white/78 sm:inline-flex sm:text-xs">
                  <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {releaseDate}
                </span>
              ) : null}
            </div>

            <h1 className="max-w-3xl text-balance text-[2.35rem] font-black leading-[0.98] tracking-normal text-white drop-shadow-[0_8px_28px_rgba(0,0,0,0.56)] min-[390px]:text-[2.7rem] sm:text-[clamp(1.65rem,4.6vw,4rem)] sm:leading-[0.96] xl:text-[clamp(2.35rem,4.2vw,4.8rem)]">
              {currentTitle}
            </h1>

            <div className="mt-4 hidden flex-wrap gap-1.5 sm:flex sm:gap-2">
              {current.genres?.slice(0, 3).map((genre) => (
                <span
                  key={genre}
                  className="rounded-full border border-white/12 bg-white/[0.09] px-2.5 py-1 text-[10px] font-semibold text-white/78 backdrop-blur-sm sm:text-xs"
                >
                  {genre}
                </span>
              ))}
            </div>

            <p className="mt-4 max-w-[31rem] text-sm leading-6 text-white/80 sm:hidden">
              {mobileOverview}
            </p>
            <p className="mt-3 hidden max-w-xl text-xs leading-5 text-white/76 sm:mt-4 sm:block sm:text-sm sm:leading-6 lg:mt-4 lg:max-w-2xl lg:text-[15px] lg:leading-7 xl:text-base">
              {desktopOverview}
            </p>

            <div className="mt-6 grid max-w-[24rem] grid-cols-2 gap-3 sm:mt-4 sm:flex sm:max-w-none sm:flex-wrap sm:gap-3 lg:mt-6">
              <button
                type="button"
                onClick={goToDetails}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#e94f37] px-4 py-3 text-sm font-black text-white shadow-[0_12px_32px_rgba(233,79,55,0.28)] transition hover:bg-[#d9412b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff9c8d] sm:min-h-11 sm:px-5 sm:py-2.5"
              >
                <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Details
              </button>

              <button
                type="button"
                onClick={toggleWatchlist}
                disabled={wlLoading}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-11 sm:px-5 sm:py-2.5 ${
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
          </div>

          <div className="hidden min-w-[392px] flex-col items-end gap-3 lg:flex xl:min-w-[420px] xl:gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToSlide(index - 1)}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/14 bg-black/34 text-white/78 transition hover:bg-white/12 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 xl:h-10 xl:w-10"
                aria-label="Previous featured title"
              >
                <ChevronLeft className="h-4 w-4 xl:h-5 xl:w-5" />
              </button>
              <button
                type="button"
                onClick={() => goToSlide(index + 1)}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/14 bg-black/34 text-white/78 transition hover:bg-white/12 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 xl:h-10 xl:w-10"
                aria-label="Next featured title"
              >
                <ChevronRight className="h-4 w-4 xl:h-5 xl:w-5" />
              </button>
            </div>

            <div className="flex gap-3 xl:gap-4">
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
                      width={96}
                      height={138}
                    />
                  );
                })}
            </div>
          </div>
        </div>

        <div className="mt-7 flex items-center gap-3 sm:mt-5 lg:hidden">
          <button
            type="button"
            onClick={() => goToSlide(index - 1)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/14 bg-black/38 text-white/78 backdrop-blur-sm sm:h-10 sm:w-10"
            aria-label="Previous featured title"
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/12">
            <div
              className="h-full rounded-full bg-[#e94f37] transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <span className="min-w-9 text-center text-[11px] font-bold text-white/62 sm:min-w-10 sm:text-xs">
            {index + 1}/{all.length}
          </span>

          <button
            type="button"
            onClick={() => goToSlide(index + 1)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/14 bg-black/38 text-white/78 backdrop-blur-sm sm:h-10 sm:w-10"
            aria-label="Next featured title"
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
