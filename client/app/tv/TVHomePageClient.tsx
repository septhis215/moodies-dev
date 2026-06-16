"use client";

import React, { useState, useEffect } from "react";
import type { All } from "@/types/all";
import type { ReviewItem } from "@/components/sections/CommunityPicks";
import type { CommunityPulseData } from "@/types/communityPulse";
import {
  Star,
  Heart,
  Info,
  ChevronRight,
  Flame,
  Calendar,
  Bookmark,
  Sparkles,
  BookmarkCheck,
  MessageSquare,
  Tv,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ComingSoonSection } from "@/components/sections/ComingSoon";
import MoodRecommendationsSection from "@/components/sections/MoodRecommendationSection";
import { useScrollToHash } from "@/hooks/useScrollToHash";
import { useRouter } from "next/navigation";
import { useWatchlist } from "@/hooks/useWatchlist";
import { Carousel } from "@/components/ui/Carousel";
import { CommunityPulseSection } from "@/components/sections/CommunityPulseSection";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import RatingBadge from "@/components/ui/rating-badge";
export default function TVHomePageClient({
  trendingTV,
  popularTV,
  topRatedTV,
  NewTVTrailer,
  KoreanTV,
  newReleaseTV,
  airingToday = [],
  airingThisWeek = [],
  TVReview = [],
  moods,
  communityPulse,
}: {
  trendingTV: All[];
  popularTV: All[];
  topRatedTV: All[];
  TVTrailer: All[];
  NewTVTrailer: All[];
  KoreanTV: All[];
  TVReview: ReviewItem[];
  newReleaseTV: All[];
  airingToday?: All[];
  airingThisWeek?: All[];
  moods?: unknown[];
  communityPulse?: CommunityPulseData;
}) {
  const router = useRouter();
  const { add, remove, isInWatchlist, ready } = useWatchlist();
  const [loadingStates, setLoadingStates] = useState<
    Record<string | number, boolean>
  >({});
  const [heroIndex, setHeroIndex] = useState(0);
  const heroShows = popularTV.slice(0, 18);
  const getImageUrl = (path?: string | null) =>
    path
      ? `https://image.tmdb.org/t/p/original${path}`
      : "/placeholder-backdrop.svg";
  const getPosterUrl = (path?: string | null) =>
    path ? `https://image.tmdb.org/t/p/w500${path}` : "/placeholder-poster.svg";
  useScrollToHash(100);

  // Keep `featured` derived from heroShows so it's always in sync
  const featured = heroShows[heroIndex] || heroShows[0] || null;

  // Auto-advance heroIndex every 8s
  useEffect(() => {
    if (!heroShows.length) return;
    const id = setInterval(() => {
      setHeroIndex((i) => (heroShows.length ? (i + 1) % heroShows.length : 0));
    }, 8000);
    return () => clearInterval(id);
  }, [heroShows.length]);

  /* ---------------- Compact TVCard ---------------- */
  /* ---------------- Compact TVCard (Mobile Optimized) ---------------- */
  const TVCard = ({
    show,
    size = "default",
  }: {
    show?: All;
    size?: "default" | "large" | "wide";
  }) => {
    if (!show) return null;

    const isWide = size === "wide";

    const inWL = isInWatchlist(String(show.id), "series");
    const isLoading = loadingStates[show.id] || false;

    return (
      <div className="group relative h-full">
        <Link href={`/tv/${show.id}`} className="block h-full">
          <div
            className={`
            relative rounded-2xl overflow-hidden
            bg-neutral-950
            shadow-lg shadow-black/25 ring-1 ring-white/10
            transition duration-300 md:group-hover:ring-[#e94f37]/45

            /* MOBILE: bigger + consistent */
            aspect-[2/3]
            w-full

            /* DESKTOP */
            md:${isWide ? "aspect-video" : "aspect-[2/3]"}
          `}
          >
            <Image
              src={
                isWide
                  ? getImageUrl(show.backdrop_path)
                  : getPosterUrl(show.poster_path)
              }
              alt={show.title || show.name || ""}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="
              object-cover
              transition-transform duration-700
              md:group-hover:scale-110
            "
            />

            {/* Always-visible mobile gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent md:opacity-0 md:group-hover:opacity-100 transition-opacity" />

            {/* Rating */}
            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg text-xs font-bold text-white sm:right-3 sm:top-3">
              <RatingBadge
                rating={show.vote_average}
                variant="colored"
                size="sm"
              />
            </div>

            {/* ACTIONS */}
            <div
              className="
              absolute inset-x-0 bottom-0
              p-2.5 sm:p-3

              /* Mobile: always visible */
              opacity-100

              /* Desktop: hover only */
              md:opacity-0 md:group-hover:opacity-100
              transition-opacity
            "
            >
              <div className="flex justify-center gap-2">
                {/* Watchlist */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!ready) {
                            router.push("/auth/login");
                            return;
                          }
                          const itemId = show.id;
                          setLoadingStates((prev) => ({
                            ...prev,
                            [itemId]: true,
                          }));
                          try {
                            const title = show?.title ?? show?.name ?? null;
                            const posterUrl = show?.poster_path
                              ? getPosterUrl(show.poster_path)
                              : null;

                            if (inWL) {
                              await remove(String(show.id), "series", {
                                title,
                                posterUrl,
                              });
                            } else {
                              await add(String(show.id), "series", {
                                title,
                                posterUrl,
                              });
                            }
                          } finally {
                            setLoadingStates((prev) => ({
                              ...prev,
                              [itemId]: false,
                            }));
                          }
                        }}
                        disabled={isLoading}
                        className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 hover:scale-110 cursor-pointer ${
                          inWL
                            ? "bg-[#e94f37] text-white"
                            : "bg-white text-black"
                        } ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}
                      >
                        {isLoading ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : inWL ? (
                          <BookmarkCheck className="w-4 h-4" />
                        ) : (
                          <Bookmark className="w-4 h-4" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      sideOffset={8}
                      className="rounded-lg bg-black/90 backdrop-blur-md px-3 py-2 shadow-xl border border-white/20"
                    >
                      <div className="text-xs font-medium text-white">
                        {isLoading
                          ? "Updating..."
                          : inWL
                            ? "Remove from My List"
                            : "Add to My List"}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Info */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/tv/${show.id}`);
                        }}
                        className="w-10 h-10 bg-white rounded-full sm:flex items-center justify-center shadow-lg hidden active:scale-95 hover:scale-110 cursor-pointer"
                      >
                        <Info className="w-4 h-4 text-black" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      sideOffset={8}
                      className="rounded-lg bg-black/90 backdrop-blur-md px-3 py-2 shadow-xl border border-white/20"
                    >
                      <div className="text-xs font-medium text-white">
                        More Info
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          {/* TEXT */}
          <div className="mt-2.5 px-0.5 sm:mt-3 sm:px-1">
            <h4 className="line-clamp-2 text-sm font-bold leading-tight text-white transition-colors md:group-hover:text-[#e94f37] sm:text-base">
              {show.title || show.name}
            </h4>

            <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400 sm:text-xs">
              {show.first_air_date && (
                <span className="font-semibold">
                  {show.first_air_date.split("-")[0]}
                </span>
              )}
              {show.number_of_seasons && (
                <>
                  <span className="text-white/25">•</span>
                  <span className="font-semibold">
                    {show.number_of_seasons} Season
                    {show.number_of_seasons > 1 ? "s" : ""}
                  </span>
                </>
              )}
            </div>
          </div>
        </Link>
      </div>
    );
  };

  const featuredInWatchlist = featured?.id
    ? isInWatchlist(String(featured.id), "series")
    : false;

  const handleFeaturedWatchlist = async () => {
    if (!featured?.id) return;
    if (!ready) {
      router.push("/auth/login");
      return;
    }

    setLoadingStates((prev) => ({ ...prev, ["featured"]: true }));

    try {
      const title = featured?.title ?? featured?.name ?? null;
      const posterUrl = featured?.poster_path
        ? getPosterUrl(featured.poster_path)
        : featured?.backdrop_path
          ? getImageUrl(featured.backdrop_path)
          : null;

      if (featuredInWatchlist) {
        await remove(String(featured.id), "series", { title, posterUrl });
      } else {
        await add(String(featured.id), "series", { title, posterUrl });
      }
    } catch (err) {
      console.error("Failed to update watchlist:", err);
    } finally {
      setLoadingStates((prev) => ({ ...prev, ["featured"]: false }));
    }
  };

  /* ---------------- Page Layout ---------------- */
  return (
    <main className="relative bg-black text-white min-h-screen overflow-hidden">
      {/* Moodies series backdrop */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(233,79,55,0.18),transparent_42%),linear-gradient(180deg,#030303_0%,#090909_45%,#000_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_82%)]" />
      </div>
      <section className="relative w-full text-white overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black via-black/50 to-transparent pointer-events-none z-10" />

        <div className="relative z-20 mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6 sm:pb-16 sm:pt-28">
          <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-12 md:gap-6">
            {/* LEFT mosaic */}
            <div className="col-span-1 flex flex-col overflow-hidden rounded-2xl bg-neutral-950/80 p-3 shadow-2xl shadow-black/40 ring-1 ring-white/10 backdrop-blur-xl sm:rounded-3xl sm:p-6 md:col-span-7">
              <div className="-mx-3 -mt-3 mb-4 h-1 bg-gradient-to-r from-[#e94f37] via-[#ff7a66] to-[#38bdf8] sm:-mx-6 sm:-mt-6 sm:mb-5" />
              <div className="mb-4 sm:mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-[#ff7a66] ring-1 ring-white/10 sm:h-11 sm:w-11">
                    <Tv className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ff8b78]">
                      Moodies series
                    </p>
                    <h1 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                      TV Series Hub
                    </h1>
                  </div>
                </div>
                <p className="text-gray-400 text-sm font-medium hidden sm:block">
                  Pick a poster to tune the episode-night spotlight.
                </p>
              </div>

              <div className="relative h-[300px] w-full overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10 sm:h-auto sm:min-h-[460px] sm:flex-1">
                <div className="flex h-full snap-x snap-mandatory gap-3 overflow-x-auto px-3 py-4 scroll-smooth sm:hidden">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const s =
                      heroShows[(heroIndex + i) % heroShows.length] || {};
                    const isActive = featured?.id === s.id;
                    return (
                      <button
                        key={i}
                        onClick={() =>
                          setHeroIndex((heroIndex + i) % heroShows.length)
                        }
                        className={`relative h-full w-[42vw] min-w-[150px] max-w-[175px] shrink-0 snap-start overflow-hidden rounded-2xl border transition-all duration-300 ${
                          isActive
                            ? "border-[#e94f37] shadow-2xl shadow-[#e94f37]/25"
                            : "border-white/10"
                        }`}
                      >
                        {s.poster_path ? (
                          <Image
                            src={getPosterUrl(s.poster_path)}
                            alt={s.title || s.name || ""}
                            fill
                            sizes="170px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-zinc-800" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-3 text-left">
                          <p className="line-clamp-2 text-sm font-black leading-tight text-white">
                            {s.title || s.name}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  <div className="w-1 shrink-0" aria-hidden="true" />
                </div>

                <div className="absolute inset-0 hidden grid-cols-3 gap-2 p-2 sm:grid sm:grid-cols-4 sm:gap-3 sm:p-3 md:grid-cols-5 lg:grid-cols-6">
                  {Array.from({ length: 18 }).map((_, i) => {
                    const s =
                      heroShows[(heroIndex + i) % heroShows.length] || {};
                    const isActive = featured?.id === s.id;
                    return (
                      <button
                        key={i}
                        onClick={() =>
                          setHeroIndex((heroIndex + i) % heroShows.length)
                        }
                        className={`rounded-xl overflow-hidden border transform transition-all duration-300 cursor-pointer
                                                hover:scale-105 hover:z-10 focus:outline-none
                                                ${
                                                  isActive
                                                    ? "border-[#e94f37] scale-105 shadow-2xl shadow-[#e94f37]/30"
                                                    : "border-white/10 hover:border-[#e94f37]/50"
                                                }`}
                      >
                        {s.poster_path ? (
                          <Image
                            src={getPosterUrl(s.poster_path)}
                            alt={s.title || s.name || ""}
                            width={150}
                            height={180}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="bg-zinc-800 w-full h-full aspect-[2/3]" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.8)_95%)]" />
              </div>
            </div>

            {/* RIGHT featured card */}
            <div className="md:col-span-5 col-span-1 flex items-stretch">
              <AnimatePresence mode="wait">
                <motion.div
                  key={featured?.id}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  className="relative flex flex-col w-full rounded-2xl sm:rounded-3xl bg-neutral-950/90 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl shadow-black/40 overflow-hidden"
                >
                  {featured?.backdrop_path && (
                    <div className="absolute inset-0 -z-10">
                      <Image
                        src={getImageUrl(featured.backdrop_path)}
                        alt={featured.title || featured.name || ""}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        priority
                        className="object-cover opacity-25 blur-sm"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black" />
                    </div>
                  )}

                  <div className="relative h-52 w-full overflow-hidden rounded-t-2xl sm:h-80 sm:rounded-t-3xl">
                    {featured?.backdrop_path ? (
                      <>
                        <Image
                          src={getImageUrl(featured.backdrop_path)}
                          alt={featured.title || featured.name || ""}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          priority
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                      </>
                    ) : (
                      <div className="w-full h-full bg-zinc-900" />
                    )}
                  </div>

                  <div className="relative flex flex-1 flex-col p-4 sm:p-8">
                    <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
                      <span className="rounded-full bg-gradient-to-r from-[#e94f37] to-[#ff6b58] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg sm:px-4 sm:py-2 sm:text-xs">
                        Series spotlight
                      </span>
                      {featured?.release_date && (
                        <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold ring-1 ring-white/20 backdrop-blur-sm sm:px-4 sm:py-2 sm:text-xs">
                          {featured.release_date.split("-")[0]}
                        </span>
                      )}
                      {featured?.vote_average !== undefined && (
                        <div className="flex items-center gap-1.5 backdrop-blur-sm rounded-full ">
                          <RatingBadge
                            rating={featured.vote_average}
                            variant="colored"
                            size="md"
                          />
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleFeaturedWatchlist();
                        }}
                        disabled={loadingStates["featured"]}
                        className={`ml-auto flex h-10 w-10 items-center justify-center gap-2 rounded-xl font-semibold shadow-lg transition-all cursor-pointer sm:h-auto sm:w-auto sm:px-4 sm:py-3
        ${
          featuredInWatchlist
            ? "bg-emerald-500/90 text-white border-emerald-400/50 hover:bg-emerald-600"
            : "bg-white/10 hover:bg-white/20 backdrop-blur-sm border-white/20 text-white"
        }
        ${loadingStates["featured"] ? "opacity-70 cursor-not-allowed" : ""}`}
                        title={
                          featuredInWatchlist
                            ? "Remove from My List"
                            : "Add to My List"
                        }
                      >
                        {loadingStates["featured"] ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                            className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full"
                          />
                        ) : featuredInWatchlist ? (
                          <BookmarkCheck className="w-5 h-5" />
                        ) : (
                          <Bookmark className="w-5 h-5" />
                        )}
                      </button>
                    </div>

                    <h2 className="mb-2 line-clamp-2 text-xl font-black leading-tight text-white sm:mb-4 sm:text-4xl">
                      {featured?.title || "—"}
                    </h2>

                    <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-gray-300 sm:mb-6 sm:line-clamp-3 sm:text-base">
                      {featured?.overview || "No description available"}
                    </p>

                    <div className="mt-auto flex gap-3 border-t border-white/10 pt-3 sm:pt-6">
                      <Link href={`/tv/${featured?.id}`} className="flex-1">
                        <button className="w-full min-h-12 px-5 py-3 sm:px-6 sm:py-4 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] hover:from-[#d4452f] hover:to-[#e94f37] text-white rounded-xl sm:rounded-2xl font-bold transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-[#e94f37]/30 cursor-pointer">
                          <Info className="w-5 h-5" />
                          View Details
                        </button>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <div className="relative mx-auto max-w-7xl space-y-11 px-4 py-10 sm:space-y-14 sm:px-6 sm:py-12 lg:space-y-16 lg:px-8 lg:py-14">
        {/* Airing Today */}
        {airingToday && airingToday.length > 0 && (
          <section
            id="airing-today"
            className="relative rounded-3xl border border-white/10 bg-neutral-950/70 p-4 shadow-2xl shadow-black/30 sm:p-6"
          >
            <div className="relative mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#e94f37] blur-lg opacity-40 animate-pulse" />
                  <div className="relative w-3 h-3 rounded-full bg-[#e94f37] animate-pulse" />
                </div>
                <div>
                  <span className="text-xs font-black text-[#ff8b78] uppercase tracking-wider block mb-1">
                    Live Now
                  </span>
                  <h2 className="text-2xl font-black text-white sm:text-3xl lg:text-4xl">
                    Airing Today
                  </h2>
                </div>
              </div>
              <Link
                href="/tv/airing/today"
                className="text-sm font-bold text-gray-400 hover:text-[#e94f37] transition-colors flex items-center gap-2 group"
              >
                View All
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            <Carousel items={airingToday} CardComponent={TVCard} />
          </section>
        )}

        {/* Trending Now */}
        {popularTV && popularTV.length > 0 && (
          <section
            id="trending-tv"
            className="relative rounded-3xl border border-white/10 bg-neutral-950/70 p-4 shadow-2xl shadow-black/30 sm:p-6"
          >
            <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#e94f37] blur-xl opacity-50" />
                  <Flame className="relative h-7 w-7 text-[#e94f37] sm:h-8 sm:w-8" />
                </div>
                <h2 className="text-2xl font-black text-white sm:text-3xl lg:text-4xl">
                  Trending Now
                </h2>
              </div>
              <Link
                href="/tv/trending"
                className="text-sm font-bold text-gray-400 hover:text-[#e94f37] transition-colors flex items-center gap-2 group"
              >
                View All
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            <Carousel items={popularTV} CardComponent={TVCard} />
          </section>
        )}

        {/* New This Week - Responsive Grid */}
        {newReleaseTV && newReleaseTV.length > 0 && (
          <section
            id="new-release-tv"
            className="relative rounded-3xl border border-white/10 bg-neutral-950/70 p-4 shadow-2xl shadow-black/30 sm:p-6"
          >
            <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#e94f37] blur-xl opacity-40" />
                  <Sparkles className="relative h-7 w-7 text-[#ff7a66] sm:h-9 sm:w-9" />
                </div>
                <h2 className="text-2xl font-black text-white sm:text-3xl lg:text-4xl">
                  New Releases
                </h2>
              </div>

              <Link
                href="/tv/new-releases"
                className="text-sm font-bold text-gray-400 hover:text-[#e94f37] transition-colors flex items-center gap-2 group"
              >
                View All
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-12 gap-4 sm:gap-5">
              {/* Large Featured */}
              {newReleaseTV[0] && (
                <Link
                  href={`/tv/${newReleaseTV[0].id}`}
                  className="col-span-12 lg:col-span-8 group"
                >
                  <div className="relative h-[320px] overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl ring-1 ring-white/10 sm:h-96 sm:rounded-3xl lg:h-[500px]">
                    {newReleaseTV[0].backdrop_path && (
                      <>
                        <Image
                          src={getImageUrl(newReleaseTV[0].backdrop_path)}
                          alt={newReleaseTV[0].title || ""}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                      </>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-8 lg:p-10">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-xl bg-[#e94f37] px-3 py-1.5 text-xs font-black shadow-lg sm:mb-4 sm:px-4 sm:py-2 sm:text-sm">
                        <Sparkles className="w-4 h-4" />
                        NEW RELEASE
                      </div>
                      <h3 className="mb-2 line-clamp-2 text-xl font-black text-white sm:mb-4 sm:text-4xl">
                        {newReleaseTV[0].title}
                      </h3>
                      <p className="mb-4 line-clamp-2 max-w-3xl text-sm leading-6 text-gray-200 sm:mb-6 sm:text-lg sm:leading-relaxed">
                        {newReleaseTV[0].overview}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                        <div className="flex items-center gap-2">
                          <RatingBadge
                            rating={newReleaseTV[0].vote_average}
                            variant="colored"
                            size="sm"
                          />
                        </div>
                        <span className="text-gray-300 font-semibold">
                          {newReleaseTV[0].release_date}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              )}

              {/* Right Side */}
              <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1 lg:gap-5">
                {newReleaseTV.slice(1, 3).map((tv) => (
                  <Link key={tv.id} href={`/tv/${tv.id}`} className="group">
                    <div className="relative h-40 overflow-hidden rounded-2xl bg-zinc-900 shadow-xl ring-1 ring-white/10 sm:h-48 lg:h-[238px]">
                      {tv.backdrop_path && (
                        <>
                          <Image
                            src={getImageUrl(tv.backdrop_path)}
                            alt={tv.title || ""}
                            fill
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className="object-cover group-hover:scale-110 transition-transform duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                        </>
                      )}

                      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                        <h4 className="mb-2 line-clamp-1 text-base font-bold text-white transition-colors group-hover:text-[#ff7a66] sm:text-lg">
                          {tv.title}
                        </h4>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex items-center gap-1">
                            <RatingBadge
                              rating={tv.vote_average}
                              variant="colored"
                              size="sm"
                            />
                          </div>
                          <span className="text-gray-400 font-semibold">
                            {tv.release_date?.split("-")[0]}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scroll-smooth sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-6">
              {newReleaseTV.slice(3, 9).map((tv) => (
                <div
                  key={tv.id}
                  className="w-[42vw] min-w-[145px] max-w-[176px] shrink-0 snap-start sm:w-auto sm:min-w-0 sm:max-w-none"
                >
                  <TVCard show={tv} />
                </div>
              ))}
              <div className="w-1 shrink-0 sm:hidden" aria-hidden="true" />
            </div>
          </section>
        )}

        {/* Top Rated */}
        {topRatedTV && topRatedTV.length > 0 && (
          <section
            id="top-rated-tv"
            className="relative rounded-3xl border border-white/10 bg-neutral-950/70 p-4 shadow-2xl shadow-black/30 sm:p-6"
          >
            <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Star className="w-7 h-7 text-[#ff7a66]" />
                <h2 className="text-2xl sm:text-3xl font-black">
                  Top Rated Series
                </h2>
              </div>

              <Link
                href="/tv/top-rated"
                className="text-sm font-bold text-gray-400 hover:text-[#e94f37] transition-colors flex items-center gap-2 group"
              >
                View All
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scroll-smooth sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-6">
              {topRatedTV.slice(0, 12).map((show) => (
                <div
                  key={show.id}
                  className="w-[42vw] min-w-[145px] max-w-[176px] shrink-0 snap-start sm:w-auto sm:min-w-0 sm:max-w-none"
                >
                  <TVCard show={show} />
                </div>
              ))}
              <div className="w-1 shrink-0 sm:hidden" aria-hidden="true" />
            </div>
          </section>
        )}

        {/* Airing This Week */}
        {airingThisWeek && airingThisWeek.length > 0 && (
          <section
            id="airing-this-week"
            className="relative rounded-3xl border border-white/10 bg-neutral-950/70 p-4 shadow-2xl shadow-black/30 sm:p-6"
          >
            <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-7 h-7 text-indigo-500" />
                <h2 className="text-2xl sm:text-3xl font-black">
                  Airing This Week
                </h2>
              </div>

              <Link
                href="/tv/airing/week"
                className="text-sm font-bold text-gray-400 hover:text-[#e94f37] transition-colors flex items-center gap-2 group"
              >
                View All
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            <Carousel items={airingThisWeek} CardComponent={TVCard} />
          </section>
        )}

        {/* K-Drama Collection */}
        {KoreanTV && KoreanTV.length > 0 && (
          <section
            id="korean-tv"
            className="relative rounded-3xl border border-white/10 bg-neutral-950/70 p-4 shadow-2xl shadow-black/30 sm:p-6"
          >
            <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Image
                  src="/images/south-korea.png"
                  alt="Korean flag"
                  width={40}
                  height={40}
                  className="rounded-full object-cover border border-white/20"
                />
                <h2 className="text-2xl sm:text-3xl font-black">
                  K-Drama Collection
                </h2>
              </div>

              <Link
                href="/tv/k-drama"
                className="text-sm font-bold text-gray-400 hover:text-[#e94f37] transition-colors flex items-center gap-2 group"
              >
                View All
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            <Carousel items={KoreanTV} CardComponent={TVCard} />
          </section>
        )}
        <CommunityPulseSection data={communityPulse} mediaType="tv" />

        {TVReview.length > 0 && (
          <section
            id="reviews"
            className="relative overflow-hidden p-3 sm:p-10"
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(233,79,55,0.055),transparent_34%),radial-gradient(circle_at_86%_12%,rgba(255,255,255,0.045),transparent_24%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />

            <div className="relative mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="relative mt-1 flex h-10 w-10 items-center justify-center rounded-xl border border-[#e94f37]/25 bg-[#e94f37]/10 text-[#ff8b78] shadow-xl shadow-black/20">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">
                    Critics Corner
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-5 text-zinc-400">
                    Quick community takes paired with the series they reviewed.
                  </p>
                </div>
              </div>

              <div className="flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-2.5 py-1.5 text-xs font-bold text-white/75">
                <Heart className="h-3.5 w-3.5 text-[#ff8b78]" />
                {Math.min(TVReview.length, 6)} fresh takes
              </div>
            </div>

            <div className="relative -mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 scroll-smooth sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
              {TVReview.slice(0, 6).map((review, idx) => {
                const criticName =
                  review.user?.name || review.name || "Moodies critic";
                const criticHandle = review.user?.username || review.name;
                const initial =
                  criticName.trim().charAt(0).toUpperCase() || "M";
                const showTitle =
                  review.movieTitle ||
                  review.title ||
                  (review.tmdbId
                    ? `Series #${review.tmdbId}`
                    : "Series review");
                const showPoster = review.moviePoster
                  ? getPosterUrl(review.moviePoster)
                  : "/placeholder-poster.svg";

                return (
                  <div
                    key={`${review.user?.id || "critic"}-${review.tmdbId || idx}-${idx}`}
                    className="group relative w-[80vw] max-w-[330px] shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 bg-zinc-950/85 p-2.5 shadow-xl shadow-black/25 ring-1 ring-white/5 transition-all hover:border-[#e94f37]/35 hover:bg-zinc-950 sm:w-auto sm:max-w-none"
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-[#e94f37]/45" />

                    <div className="mb-2.5 flex gap-2.5">
                      <div className="relative h-[4.5rem] w-12 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/10 sm:h-20 sm:w-14">
                        <Image
                          src={showPoster}
                          alt={showTitle}
                          fill
                          sizes="64px"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-sm font-black leading-tight text-white">
                          {showTitle}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {review.movieYear && (
                            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                              {review.movieYear}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-black text-amber-200 ring-1 ring-amber-400/20">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {review.rating?.toFixed(1) || "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-black/25 p-2.5">
                      <p className="line-clamp-3 text-sm leading-5 text-zinc-300">
                        &ldquo;{review.quote || "No review available"}&rdquo;
                      </p>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#e94f37]/15 text-[11px] font-black text-white ring-1 ring-[#e94f37]/25">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white">
                          {criticName}
                        </p>
                        {criticHandle && (
                          <p className="truncate text-[11px] font-medium text-zinc-500">
                            @{criticHandle}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="w-1 shrink-0 sm:hidden" aria-hidden="true" />
            </div>
          </section>
        )}

        {NewTVTrailer?.length > 0 && (
          <ComingSoonSection
            title="Premiering Soon"
            items={NewTVTrailer}
            type="tv"
          />
        )}
        {moods && moods.length > 0 && (
          <div className="mx-auto max-w-7xl pt-1 sm:pt-0">
            <MoodRecommendationsSection mediaType="tv" initialMoods={moods} />
          </div>
        )}
      </div>
    </main>
  );
}
