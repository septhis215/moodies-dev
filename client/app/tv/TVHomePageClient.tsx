"use client";

import React, { useState, useEffect } from "react";
import type { All } from "@/types/all";
import type { ReviewItem } from "@/components/sections/CommunityPicks";
import {
  Play,
  Star,
  Plus,
  Info,
  ChevronRight,
  ChevronLeft,
  Flame,
  Calendar,
  TrendingUp,
  Zap,
  Share2,
  Bookmark,
  Sparkles,
  BookmarkCheck,
  Tv,
  Users,
  ThumbsUp,
  MessageSquare,
  Heart,
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
export default function TVHomePageClient({
  trendingTV,
  popularTV,
  topRatedTV,
  TVTrailer,
  NewTVTrailer,
  KoreanTV,
  TVReview,
  newReleaseTV,
  airingToday = [],
  airingThisWeek = [],
  moods,
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
  moods?: any[];
}) {
  const router = useRouter();
  const { add, remove, isInWatchlist, ready } = useWatchlist();
  const [watchlistStates, setWatchlistStates] = useState<
    Record<string | number, boolean>
  >({});
  const [loadingStates, setLoadingStates] = useState<
    Record<string | number, boolean>
  >({});
  const [heroIndex, setHeroIndex] = useState(0);
  const heroShows = popularTV.slice(0, 18);
  const heroShow = heroShows[heroIndex];
  const getImageUrl = (path?: string) =>
    path ? `https://image.tmdb.org/t/p/original${path}` : "/coming-soon.png";
  const getPosterUrl = (path?: string) =>
    path ? `https://image.tmdb.org/t/p/w500${path}` : "/coming-soon.png";
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
            bg-gradient-to-br from-zinc-900 to-zinc-950
            shadow-xl ring-1 ring-white/5

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
              className="
              object-cover
              transition-transform duration-700
              md:group-hover:scale-110
            "
            />

            {/* Always-visible mobile gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent md:opacity-0 md:group-hover:opacity-100 transition-opacity" />

            {/* Rating */}
            <div className="absolute top-3 right-3 bg-black/80 backdrop-blur text-white px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ring-1 ring-white/10">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              {show.vote_average && show.vote_average > 0
                ? show.vote_average.toFixed(1)
                : "New"}
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
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!ready) {
                      router.push("/auth/login");
                      return;
                    }
                    const itemId = show.id;
                    setLoadingStates((prev) => ({ ...prev, [itemId]: true }));
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
                  className={`
                  w-11 h-11 rounded-full flex items-center justify-center
                  shadow-lg transition-transform active:scale-95 hover:bg-[#e94f37] cursor-pointer
                  ${inWL ? "bg-emerald-500 text-white" : "bg-white text-black"}
                `}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : inWL ? (
                    <BookmarkCheck className="w-5 h-5" />
                  ) : (
                    <Plus className="w-5 h-5 " />
                  )}
                </button>

                {/* Info */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/tv/${show.id}`);
                  }}
                  className="w-11 h-11 bg-white rounded-full sm:flex items-center justify-center shadow-lg hidden  active:scale-95 hover:bg-[#e94f37] cursor-pointer"
                >
                  <Info className="w-5 h-5 text-black" />
                </button>
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
                  <span>•</span>
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
    <main className="bg-[#070707] text-white min-h-screen">
      {/* Animated Background Pattern */}
      <div className="fixed inset-0 -z-10">
        {/* Gradient meshes */}
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-gradient-to-br from-[#e94f37]/10 via-purple-600/5 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-cyan-600/10 via-blue-600/5 to-transparent rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute bottom-0 left-1/3 w-[700px] h-[700px] bg-gradient-to-tr from-fuchsia-600/10 via-pink-600/5 to-transparent rounded-full blur-3xl animate-pulse delay-500" />

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem]" />

        {/* Radial gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)]" />
      </div>
      <section className="relative w-full text-white overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black via-black/50 to-transparent pointer-events-none z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-30 pb-20 relative z-20">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
            {/* LEFT mosaic */}
            <div className="md:col-span-7 col-span-1 rounded-3xl overflow-hidden bg-gradient-to-br from-zinc-900/80 via-zinc-900/50 to-zinc-950/80 backdrop-blur-xl p-6 flex flex-col ring-1 ring-white/10 shadow-2xl">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#e94f37] to-orange-400 blur-xl opacity-50" />
                    <Tv className="relative w-8 h-8 text-[#e94f37]" />
                  </div>
                  <h1 className="text-4xl sm:text-5xl font-black leading-tight tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                    TV Series Hub
                  </h1>
                </div>
                <p className="text-gray-400 text-sm ml-11 font-medium hidden sm:block">
                  Click any poster to feature it
                </p>
              </div>

              <div className="relative flex-1 w-full h-full rounded-2xl overflow-hidden ring-1 ring-white/5">
                <div className="absolute inset-0 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 p-3">
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
                        className={`rounded-xl overflow-hidden border-2 transform transition-all duration-300
                                                hover:scale-105 hover:z-10 focus:outline-none
                                                ${
                                                  isActive
                                                    ? "border-[#e94f37]  scale-105 shadow-2xl shadow-[#e94f37]/30"
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
                  className="relative flex flex-col w-full rounded-3xl bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-black/90 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl overflow-hidden"
                >
                  {featured?.backdrop_path && (
                    <div className="absolute inset-0 -z-10">
                      <Image
                        src={getImageUrl(featured.backdrop_path)}
                        alt={featured.title || featured.name || ""}
                        fill
                        className="object-cover opacity-20 blur-sm"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black" />
                    </div>
                  )}

                  <div className="relative w-full h-64 sm:h-80 rounded-t-3xl overflow-hidden">
                    {featured?.backdrop_path ? (
                      <>
                        <Image
                          src={getImageUrl(featured.backdrop_path)}
                          alt={featured.title || featured.name || ""}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                      </>
                    ) : (
                      <div className="w-full h-full bg-zinc-900" />
                    )}
                  </div>

                  <div className="relative p-6 sm:p-8 flex flex-col flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-4">
                      <span className="px-4 py-2 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white rounded-full text-xs font-black uppercase tracking-wider shadow-lg">
                        Featured
                      </span>
                      {featured?.release_date && (
                        <span className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-xs font-bold ring-1 ring-white/20">
                          {featured.release_date.split("-")[0]}
                        </span>
                      )}
                      {featured?.vote_average !== undefined && (
                        <div className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full ring-1 ring-amber-500/30">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span className="text-xs font-bold text-white">
                            {featured.vote_average > 0
                              ? featured.vote_average.toFixed(1)
                              : "New"}
                          </span>
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleFeaturedWatchlist();
                        }}
                        disabled={loadingStates["featured"]}
                        className={`ml-auto px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg
        ${
          featuredInWatchlist
            ? "bg-emerald-500/90 text-white border-emerald-400/50 hover:bg-emerald-600"
            : "bg-white/10 hover:bg-white/20 backdrop-blur-sm border-white/20 text-white"
        }
        ${loadingStates["featured"] ? "opacity-70 cursor-not-allowed" : ""}`}
                        title={
                          featuredInWatchlist
                            ? "Remove from Watchlist"
                            : "Add to Watchlist"
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

                    <h2 className="text-3xl sm:text-4xl font-black mb-4 leading-tight line-clamp-2 text-white">
                      {featured?.title || "—"}
                    </h2>

                    <p className="text-sm sm:text-base text-gray-300 line-clamp-3 mb-6 leading-relaxed">
                      {featured?.overview || "No description available"}
                    </p>

                    <div className="flex gap-3 mt-auto pt-6 border-t border-white/10">
                      <Link href={`/tv/${featured?.id}`} className="flex-1">
                        <button className="w-full px-6 py-4 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] hover:from-[#d4452f] hover:to-[#e94f37] text-white rounded-2xl font-bold transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg shadow-[#e94f37]/30">
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
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 space-y-16 sm:space-y-20 lg:space-y-24">
        {/* Airing Today */}
        {airingToday && airingToday.length > 0 && (
          <section id="airing-today" className="relative ">
            <div className="relative flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-red-500 blur-lg opacity-50 animate-pulse" />
                  <div className="relative w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                </div>
                <div>
                  <span className="text-xs font-black text-red-400 uppercase tracking-wider block mb-1">
                    Live Now
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-black text-white">
                    Airing Today
                  </h2>
                </div>
              </div>
              <Link
                href="/tv/airing/today"
                className="text-sm font-bold text-gray-400 hover:text-red-400 transition-colors flex items-center gap-2 group"
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
          <section id="trending-tv" className="relative">
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
          <section id="new-release-tv" className="relative">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-400 blur-xl opacity-50" />
                  <Sparkles className="relative w-9 h-9 text-cyan-400" />
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
                          className="object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                      </>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-10">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 rounded-xl text-sm font-black mb-4 shadow-lg">
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
                          <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                          <span className="font-bold text-white">
                            {newReleaseTV[0].vote_average &&
                            newReleaseTV[0].vote_average > 0
                              ? newReleaseTV[0].vote_average.toFixed(1)
                              : "New"}
                          </span>
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
                            className="object-cover group-hover:scale-110 transition-transform duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                        </>
                      )}

                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <h4 className="text-lg font-bold mb-2 line-clamp-1 group-hover:text-cyan-400 transition-colors text-white">
                          {tv.title}
                        </h4>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <span className="font-bold text-white">
                              {tv.vote_average && tv.vote_average > 0
                                ? tv.vote_average.toFixed(1)
                                : "New"}
                            </span>
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
          <section id="top-rated-tv" className="relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Star className="w-7 h-7 text-yellow-500" />
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
              {topRatedTV.slice(0, 12).map((show, idx) => (
                <TVCard key={show.id} show={show} />
              ))}
            </div>
          </section>
        )}

        {/* Airing This Week */}
        {airingThisWeek && airingThisWeek.length > 0 && (
          <section id="airing-this-week" className="relative">
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
          <section id="korean-tv" className="relative">
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
        <section className="relative">
          {/* Header (shared) */}
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500 blur-xl opacity-50" />
              <Users className="relative w-7 h-7 sm:w-8 sm:h-8 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white">
                Community Pulse
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 mt-1 font-medium">
                What the community loves right now
              </p>
            </div>
          </div>

          {/* =========================
       MOBILE: Large swipeable cards
       ========================= */}
          <div className="md:hidden">
            <div className="overflow-x-auto  pb-4 snap-x snap-mandatory touch-pan-x flex gap-4">
              {[
                {
                  key: "most-liked",
                  title: "Most Liked",
                  subtitle: "Top rated by users",
                  data: popularTV,
                  icon: <ThumbsUp className="w-5 h-5" />,
                  color: "emerald",
                },
                {
                  key: "most-reviewed",
                  title: "Most Reviews",
                  subtitle: "Highly discussed series",
                  data: TVTrailer,
                  icon: <MessageSquare className="w-5 h-5" />,
                  color: "blue",
                },
                {
                  key: "most-saved",
                  title: "Most Saved",
                  subtitle: "Popular watchlist picks",
                  data: trendingTV,
                  icon: <Bookmark className="w-5 h-5" />,
                  color: "amber",
                },
              ].map((sec) => (
                <article
                  key={sec.key}
                  className={`snap-center min-w-[86%] sm:min-w-[72%] rounded-2xl p-4 bg-gradient-to-br from-zinc-900/70 to-zinc-950/80 ring-1 ring-white/6 shadow-lg`}
                  aria-label={sec.title}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-lg flex items-center justify-center ${
                          sec.color === "emerald"
                            ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-white/10"
                            : sec.color === "blue"
                            ? "bg-blue-500/20 text-blue-400 ring-1 ring-white/10"
                            : "bg-amber-500/20 text-amber-400 ring-1 ring-white/10"
                        }`}
                      >
                        {sec.icon}
                      </div>
                      <div>
                        <h3 className="font-black text-lg text-white">
                          {sec.title}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {sec.subtitle}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={
                        sec.key === "most-liked"
                          ? "/discover/most-liked"
                          : sec.key === "most-reviewed"
                          ? "/discover/most-reviewed"
                          : "/discover/most-saved"
                      }
                      className="text-xs font-semibold text-gray-300 hover:text-white"
                    >
                      View All
                    </Link>
                  </div>

                  {/* Top 3 items (larger visuals) */}
                  <div className="space-y-3">
                    {(sec.data || []).slice(0, 3).map((m, i) => {
                      const mockStats = {
                        likes:
                          Math.floor((m.vote_average || 0) * 0.7) ||
                          Math.floor(Math.random() * 5000) + 1000,
                        reviews:
                          Math.floor((m.vote_average || 0) * 0.3) ||
                          Math.floor(Math.random() * 2000) + 500,
                        saves:
                          Math.floor((m.popularity || 0) * 100) ||
                          Math.floor(Math.random() * 3000) + 800,
                      };

                      const getStatText = () => {
                        if (sec.key === "most-liked")
                          return `${(mockStats.likes / 1000).toFixed(
                            1
                          )}K likes`;
                        if (sec.key === "most-reviewed")
                          return `${(mockStats.reviews / 1000).toFixed(
                            1
                          )}K reviews`;
                        return `${(mockStats.saves / 1000).toFixed(1)}K saves`;
                      };

                      return (
                        <Link
                          key={m.id}
                          href={`/tv/${m.id}`}
                          className="flex items-center gap-3 group"
                        >
                          <div className="relative w-16 aspect-[2/3] sm:w-18 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/10 shadow-md">
                            {m.poster_path ? (
                              <Image
                                src={getPosterUrl(m.poster_path)}
                                alt={m.title}
                                fill
                                sizes="(max-width: 640px) 64px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="bg-zinc-800 w-full h-full" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-bold text-sm leading-tight line-clamp-2 text-white">
                                {m.title}
                              </h4>

                              <div className="text-right text-[11px] text-gray-400">
                                <div>
                                  {m.first_air_date
                                    ? m.first_air_date.split("-")[0]
                                    : "TBA"}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 mt-2 text-xs">
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                <span className="font-bold text-white text-sm">
                                  {m.vote_average && m.vote_average > 0
                                    ? m.vote_average.toFixed(1)
                                    : "New"}
                                </span>
                              </div>

                              <span className="text-gray-500">•</span>

                              <div className="text-[12px] text-gray-400 font-semibold">
                                {getStatText()}
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Card footer summary */}
                  <div className="mt-4 pt-3 border-t border-white/6 flex items-center justify-between">
                    <div className="text-xs text-gray-400">
                      Total engagement
                    </div>
                    <div
                      className={`text-sm font-bold ${
                        sec.color === "emerald"
                          ? "text-emerald-400"
                          : sec.color === "blue"
                          ? "text-blue-400"
                          : "text-amber-400"
                      }`}
                    >
                      {/* simple summarized metric */}
                      {sec.key === "most-liked" &&
                        `${(
                          ((sec.data || [])
                            .slice(0, 3)
                            .reduce(
                              (acc, m) => acc + (m.vote_average || 0),
                              0
                            ) *
                            0.7) /
                          1000
                        ).toFixed(0)}K+`}
                      {sec.key === "most-reviewed" &&
                        `${(
                          ((sec.data || [])
                            .slice(0, 3)
                            .reduce(
                              (acc, m) => acc + (m.vote_average || 0),
                              0
                            ) *
                            0.3) /
                          1000
                        ).toFixed(0)}K+`}
                      {sec.key === "most-saved" &&
                        `${(
                          ((sec.data || [])
                            .slice(0, 3)
                            .reduce((acc, m) => acc + (m.popularity || 0), 0) *
                            100) /
                          1000
                        ).toFixed(0)}K+`}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* =========================
       DESKTOP: original grid (kept intact)
       ========================= */}
          <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
            {[
              {
                title: "Most Liked",
                subtitle: "Top rated by users",
                data: popularTV,
                icon: <ThumbsUp className="w-4 h-4 sm:w-5 sm:h-5" />,
                gradient: "from-emerald-950/40 to-emerald-950/20",
                border: "border-emerald-500/30",
                iconBg: "bg-emerald-500/20",
                textColor: "text-emerald-400",
                hoverColor: "group-hover:text-emerald-400",
                statIcon: <Heart className="w-3 h-3 sm:w-3.5 sm:h-3.5" />,
              },
              {
                title: "Most Reviews",
                subtitle: "Highly discussed series",
                data: TVTrailer,
                icon: <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />,
                gradient: "from-blue-950/40 to-blue-950/20",
                border: "border-blue-500/30",
                iconBg: "bg-blue-500/20",
                textColor: "text-blue-400",
                hoverColor: "group-hover:text-blue-400",
                statIcon: (
                  <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                ),
              },
              {
                title: "Most Saved",
                subtitle: "Popular watchlist picks",
                data: trendingTV,
                icon: <Bookmark className="w-4 h-4 sm:w-5 sm:h-5" />,
                gradient: "from-amber-950/40 to-amber-950/20",
                border: "border-amber-500/30",
                iconBg: "bg-amber-500/20",
                textColor: "text-amber-400",
                hoverColor: "group-hover:text-amber-400",
                statIcon: <Bookmark className="w-3 h-3 sm:w-3.5 sm:h-3.5" />,
              },
            ].map((section, idx) => (
              <div
                key={idx}
                className={`bg-gradient-to-br ${section.gradient} border ${section.border} rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 backdrop-blur-sm ring-1 ring-white/5 shadow-xl`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-5 sm:mb-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 ${section.iconBg} rounded-lg sm:rounded-xl flex items-center justify-center ${section.textColor} ring-1 ring-white/10 shadow-lg`}
                    >
                      {section.icon}
                    </div>
                    <div>
                      <h3 className="font-black text-base sm:text-lg text-white">
                        {section.title}
                      </h3>
                      <p className="text-[10px] sm:text-xs text-gray-400 font-medium mt-0.5">
                        {section.subtitle}
                      </p>
                    </div>
                  </div>
                </div>

                {/* tv List */}
                <div className="space-y-3 sm:space-y-4">
                  {section.data.slice(0, 5).map((m, i) => {
                    // Generate mock stats based on movie data
                    const mockStats = {
                      likes:
                        Math.floor(m.vote_average * 0.7) ||
                        Math.floor(Math.random() * 5000) + 1000,
                      reviews:
                        Math.floor(m.vote_average * 0.3) ||
                        Math.floor(Math.random() * 2000) + 500,
                      saves:
                        Math.floor(m.popularity * 100) ||
                        Math.floor(Math.random() * 3000) + 800,
                    };

                    const getStat = () => {
                      if (idx === 0)
                        return `${(mockStats.likes / 1000).toFixed(1)}K likes`;
                      if (idx === 1)
                        return `${(mockStats.reviews / 1000).toFixed(
                          1
                        )}K reviews`;
                      return `${(mockStats.saves / 1000).toFixed(1)}K saves`;
                    };

                    return (
                      <Link
                        key={m.id}
                        href={`/tv/${m.id}`}
                        className="flex items-center gap-2 sm:gap-3 group"
                      >
                        {/* Rank Number */}
                        <span
                          className={`text-2xl sm:text-3xl font-black ${section.textColor} opacity-30 w-6 sm:w-8 flex-shrink-0`}
                        >
                          {i + 1}
                        </span>

                        {/* Poster */}
                        <div className="relative w-12 h-16 sm:w-14 sm:h-20 rounded-md sm:rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/10 shadow-lg">
                          {m.poster_path && (
                            <Image
                              src={getPosterUrl(m.poster_path)}
                              alt=""
                              fill
                              className="object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div
                            className={`font-bold text-xs sm:text-sm text-white line-clamp-2 mb-1 ${section.hoverColor} transition-colors`}
                          >
                            {m.title}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] sm:text-xs">
                            <div className="flex items-center gap-0.5 sm:gap-1">
                              <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-400 fill-yellow-400" />
                              <span className="font-bold text-white">
                                {m.vote_average && m.vote_average > 0
                                  ? m.vote_average.toFixed(1)
                                  : "New"}
                              </span>
                            </div>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-400 font-semibold">
                              {m.first_air_date?.split("-")[0]}
                            </span>
                          </div>
                          {/* Supporting Stat */}
                          <div
                            className={`flex items-center gap-1 mt-1.5 sm:mt-2 ${section.textColor}`}
                          >
                            {section.statIcon}
                            <span className="text-[10px] sm:text-xs font-bold">
                              {getStat()}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Footer Stats Summary */}
                <div
                  className={`mt-5 sm:mt-6 pt-4 sm:pt-5 border-t ${section.border}`}
                >
                  <div className="flex items-center justify-between text-[10px] sm:text-xs">
                    <span className="text-gray-400 font-medium">
                      Total engagement
                    </span>
                    <span className={`font-bold ${section.textColor}`}>
                      {idx === 0 &&
                        `${(
                          (section.data
                            .slice(0, 5)
                            .reduce(
                              (acc, m) => acc + (m.vote_average || 0),
                              0
                            ) *
                            0.7) /
                          1000
                        ).toFixed(0)}K+`}
                      {idx === 1 &&
                        `${(
                          (section.data
                            .slice(0, 5)
                            .reduce(
                              (acc, m) => acc + (m.vote_average || 0),
                              0
                            ) *
                            0.3) /
                          1000
                        ).toFixed(0)}K+`}
                      {idx === 2 &&
                        `${(
                          (section.data
                            .slice(0, 5)
                            .reduce((acc, m) => acc + (m.popularity || 0), 0) *
                            100) /
                          1000
                        ).toFixed(0)}K+`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {NewTVTrailer?.length > 0 && (
          <ComingSoonSection
            title="Premiering Soon"
            items={NewTVTrailer}
            type="tv"
          />
        )}
        {moods && moods.length > 0 && (
          <div className="max-w-7xl mx-auto">
            <MoodRecommendationsSection moods={moods} mediaType="tv" />
          </div>
        )}
      </div>
    </main>
  );
}
