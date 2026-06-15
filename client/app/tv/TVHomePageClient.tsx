"use client";

import React, { useState, useEffect } from "react";
import type { All } from "@/types/all";
import type { ReviewItem } from "@/components/sections/CommunityPicks";
import type { CommunityPulseData } from "@/types/communityPulse";
import {
  Star,
  Info,
  ChevronRight,
  Flame,
  Calendar,
  Bookmark,
  Sparkles,
  BookmarkCheck,
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
            shadow-xl shadow-black/30 ring-1 ring-white/10
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
            <div className="absolute top-3 right-3 text-white rounded-lg text-xs font-bold flex items-center gap-1 ">
              <RatingBadge rating={show.vote_average} variant="colored" size="sm" />
            </div>

            {/* ACTIONS */}
            <div
              className="
              absolute inset-x-0 bottom-0
              p-3

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
          <div className="mt-3 px-1">
            <h4 className="font-bold text-sm sm:text-base line-clamp-2 leading-tight text-white md:group-hover:text-[#e94f37] transition-colors">
              {show.title || show.name}
            </h4>

            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
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

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-10 sm:pt-28 sm:pb-16 relative z-20">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-6 items-stretch">
            {/* LEFT mosaic */}
            <div className="md:col-span-7 col-span-1 rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-950/80 backdrop-blur-xl p-4 sm:p-6 flex flex-col ring-1 ring-white/10 shadow-2xl shadow-black/40">
              <div className="h-1 -mx-5 -mt-5 mb-5 bg-gradient-to-r from-[#e94f37] via-[#ff7a66] to-[#38bdf8] sm:-mx-6 sm:-mt-6" />
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04] text-[#ff7a66] ring-1 ring-white/10">
                    <Tv className="w-6 h-6" />
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

              <div className="relative flex-1 min-h-[300px] sm:min-h-[460px] w-full rounded-2xl overflow-hidden ring-1 ring-white/10 bg-black/40">
                <div className="absolute inset-0 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3 p-2.5 sm:p-3">
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

                  <div className="relative w-full h-52 sm:h-80 rounded-t-2xl sm:rounded-t-3xl overflow-hidden">
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

                  <div className="relative p-4 sm:p-8 flex flex-col flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-4">
                      <span className="px-4 py-2 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white rounded-full text-xs font-black uppercase tracking-wider shadow-lg">
                        Series spotlight
                      </span>
                      {featured?.release_date && (
                        <span className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-xs font-bold ring-1 ring-white/20">
                          {featured.release_date.split("-")[0]}
                        </span>
                      )}
                      {featured?.vote_average !== undefined && (
                        <div className="flex items-center gap-1.5 backdrop-blur-sm rounded-full ">
                          <RatingBadge rating={featured.vote_average} variant="colored" size="md"/>
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleFeaturedWatchlist();
                        }}
                        disabled={loadingStates["featured"]}
                        className={`ml-auto px-4 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer
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

                    <h2 className="text-2xl sm:text-4xl font-black mb-3 sm:mb-4 leading-tight line-clamp-2 text-white">
                      {featured?.title || "—"}
                    </h2>

                    <p className="text-sm sm:text-base text-gray-300 line-clamp-2 sm:line-clamp-3 mb-5 sm:mb-6 leading-relaxed">
                      {featured?.overview || "No description available"}
                    </p>

                    <div className="flex gap-3 mt-auto pt-4 sm:pt-6 border-t border-white/10">
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
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12 sm:space-y-20">
        {/* Airing Today */}
        {airingToday && airingToday.length > 0 && (
          <section
            id="airing-today"
            className="relative rounded-3xl border border-white/10 bg-neutral-950/70 p-4 shadow-2xl shadow-black/30 sm:p-6"
          >
            <div className="relative flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#e94f37] blur-lg opacity-40 animate-pulse" />
                  <div className="relative w-3 h-3 rounded-full bg-[#e94f37] animate-pulse" />
                </div>
                <div>
                  <span className="text-xs font-black text-[#ff8b78] uppercase tracking-wider block mb-1">
                    Live Now
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-black text-white">
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
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#e94f37] blur-xl opacity-50" />
                  <Flame className="relative w-8 h-8 text-[#e94f37]" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white">
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
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#e94f37] blur-xl opacity-40" />
                  <Sparkles className="relative w-9 h-9 text-[#ff7a66]" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white">
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

            <div className="grid grid-cols-12 gap-5">
              {/* Large Featured */}
              {newReleaseTV[0] && (
                <Link
                  href={`/tv/${newReleaseTV[0].id}`}
                  className="col-span-12 lg:col-span-8 group"
                >
                  <div className="relative h-96 lg:h-[500px] rounded-3xl overflow-hidden bg-zinc-900 ring-1 ring-white/10 shadow-2xl">
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

                    <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-10">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#e94f37] rounded-xl text-sm font-black mb-4 shadow-lg">
                        <Sparkles className="w-4 h-4" />
                        NEW RELEASE
                      </div>
                      <h3 className="text-4xl font-black mb-4 line-clamp-2 text-white">
                        {newReleaseTV[0].title}
                      </h3>
                      <p className="text-gray-200 line-clamp-2 mb-6 max-w-3xl text-lg leading-relaxed">
                        {newReleaseTV[0].overview}
                      </p>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <RatingBadge rating={newReleaseTV[0].vote_average} variant="colored" size="sm" />
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
              <div className="col-span-12 lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-5">
                {newReleaseTV.slice(1, 3).map((tv) => (
                  <Link key={tv.id} href={`/tv/${tv.id}`} className="group">
                    <div className="relative h-48 lg:h-[238px] rounded-2xl overflow-hidden bg-zinc-900 ring-1 ring-white/10 shadow-xl">
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

                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <h4 className="text-lg font-bold mb-2 line-clamp-1 group-hover:text-[#ff7a66] transition-colors text-white">
                          {tv.title}
                        </h4>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex items-center gap-1">
                            <RatingBadge rating={tv.vote_average} variant="colored" size="sm" />
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

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 mt-6">
              {newReleaseTV.slice(3, 9).map((tv) => (
                <TVCard key={tv.id} show={tv} />
              ))}
            </div>
          </section>
        )}

        {/* Top Rated */}
        {topRatedTV && topRatedTV.length > 0 && (
          <section
            id="top-rated-tv"
            className="relative rounded-3xl border border-white/10 bg-neutral-950/70 p-4 shadow-2xl shadow-black/30 sm:p-6"
          >
            <div className="flex items-center justify-between mb-6">
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

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {topRatedTV.slice(0, 12).map((show) => (
                <TVCard key={show.id} show={show} />
              ))}
            </div>
          </section>
        )}

        {/* Airing This Week */}
        {airingThisWeek && airingThisWeek.length > 0 && (
          <section
            id="airing-this-week"
            className="relative rounded-3xl border border-white/10 bg-neutral-950/70 p-4 shadow-2xl shadow-black/30 sm:p-6"
          >
            <div className="flex items-center justify-between mb-6">
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
            <div className="flex items-center justify-between mb-6">
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

        {NewTVTrailer?.length > 0 && (
          <ComingSoonSection
            title="Premiering Soon"
            items={NewTVTrailer}
            type="tv"
          />
        )}
        {moods && moods.length > 0 && (
          <div className="max-w-7xl mx-auto">
            <MoodRecommendationsSection mediaType="tv" initialMoods={moods} />
          </div>
        )}
      </div>
    </main>
  );
}
