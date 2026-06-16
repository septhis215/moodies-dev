// Enhanced Movies Homepage - MovieHomePageClient.tsx
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
  Heart,
  Bookmark,
  Film,
  Award,
  Ticket,
  MessageSquare,
  Sparkles,
  Zap,
  BookmarkCheck,
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
import RatingBadge from "@/components/ui/rating-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
export default function MoviesHomePageClient({
  trendingMovies,
  popularMovies,
  newMovieTrailers,
  movieReviews,
  koreanMovies,
  animatedMovies,
  indieMovies,
  awardWinners,
  actionMovies,
  moods,
  newReleaseMovies,
  communityPulse,
}: {
  trendingMovies: All[];
  popularMovies: All[];
  topRatedMovies: All[];
  movieTrailers: All[];
  newMovieTrailers: All[];
  movieReviews: ReviewItem[];
  koreanMovies: All[];
  animatedMovies: All[];
  indieMovies: All[];
  awardWinners: All[];
  actionMovies: All[];
  moods?: unknown[];
  newReleaseMovies: All[];
  communityPulse?: CommunityPulseData;
}) {
  const router = useRouter();
  const { add, remove, isInWatchlist, ready } = useWatchlist();
  const [wlLoading, setWlLoading] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroMovies = trendingMovies.slice(0, 18);
  const [loadingStates, setLoadingStates] = useState<
    Record<string | number, boolean>
  >({});
  useScrollToHash(100);
  const getImageUrl = (path?: string | null) =>
    path
      ? `https://image.tmdb.org/t/p/original${path}`
      : "/placeholder-backdrop.svg";
  const getPosterUrl = (path?: string | null) =>
    path ? `https://image.tmdb.org/t/p/w500${path}` : "/placeholder-poster.svg";
  // Keep `featured` derived from heroShows so it's always in sync
  const featured = heroMovies[heroIndex] || heroMovies[0] || null;

  // Auto-advance heroIndex every 8s
  useEffect(() => {
    if (!heroMovies.length) return;
    const id = setInterval(() => {
      setHeroIndex((i) =>
        heroMovies.length ? (i + 1) % heroMovies.length : 0,
      );
    }, 8000);
    return () => clearInterval(id);
  }, [heroMovies.length]);

  const MovieCard = ({
    show,
    size = "large",
  }: {
    show?: All;
    size?: "default" | "large" | "wide";
  }) => {
    if (!show) return null; // safety check

    const isWide = size === "wide";
    const inWL = isInWatchlist(String(show.id), "movie");
    const isLoading = loadingStates[show.id] || false;

    return (
      <div className="group relative h-full">
        <Link href={`/movies/${show.id}`} className="block h-full">
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
            <div className="absolute right-2 top-2 sm:right-3 sm:top-3">
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
                              await remove(String(show.id), "movie", {
                                title,
                                posterUrl,
                              });
                            } else {
                              await add(String(show.id), "movie", {
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
                          router.push(`/movies/${show.id}`);
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
              {show.release_date && (
                <span className="font-semibold">
                  {show.release_date.split("-")[0]}
                </span>
              )}
            </div>
          </div>
        </Link>
      </div>
    );
  };

  const featuredInWatchlist = featured?.id
    ? isInWatchlist(String(featured.id), "movie")
    : false;

  const handleFeaturedWatchlist = async () => {
    if (!featured?.id) return;
    if (!ready) {
      // not logged in -> send user to login
      router.push("/auth/login");
      return;
    }
    setWlLoading(true);
    try {
      const title = featured?.title ?? featured?.name ?? null;
      const posterUrl = featured?.poster_path
        ? getPosterUrl(featured.poster_path)
        : featured?.backdrop_path
          ? getImageUrl(featured.backdrop_path)
          : null;

      if (featuredInWatchlist) {
        await remove(String(featured.id), "movie", { title, posterUrl });
      } else {
        await add(String(featured.id), "movie", { title, posterUrl });
      }
    } catch (e) {
      console.error("Watchlist toggle failed:", e);
    } finally {
      setWlLoading(false);
    }
  };

  return (
    <main className="relative bg-black text-white min-h-screen overflow-hidden">
      {/* Moodies cinema backdrop */}
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
              <div className="-mx-3 -mt-3 mb-4 h-1 bg-gradient-to-r from-[#e94f37] via-[#ff7a66] to-[#f59e0b] sm:-mx-6 sm:-mt-6 sm:mb-5" />
              <div className="mb-4 sm:mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-[#ff7a66] ring-1 ring-white/10 sm:h-11 sm:w-11">
                    <Film className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ff8b78]">
                      Moodies cinema
                    </p>
                    <h1 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                      Movies Hub
                    </h1>
                  </div>
                </div>
                <p className="text-gray-400 text-sm font-medium hidden sm:block">
                  Pick a poster to tune the spotlight, then follow the mood into
                  your next watch.
                </p>
              </div>

              <div className="relative h-[300px] w-full overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10 sm:h-auto sm:min-h-[460px] sm:flex-1">
                <div className="flex h-full snap-x snap-mandatory gap-3 overflow-x-auto px-3 py-4 scroll-smooth sm:hidden">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const s =
                      heroMovies[(heroIndex + i) % heroMovies.length] || {};
                    const isActive = featured?.id === s.id;
                    return (
                      <button
                        key={i}
                        onClick={() =>
                          setHeroIndex((heroIndex + i) % heroMovies.length)
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
                      heroMovies[(heroIndex + i) % heroMovies.length] || {};
                    const isActive = featured?.id === s.id;
                    return (
                      <button
                        key={i}
                        onClick={() =>
                          setHeroIndex((heroIndex + i) % heroMovies.length)
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
                        Mood spotlight
                      </span>
                      {featured?.release_date && (
                        <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold ring-1 ring-white/20 backdrop-blur-sm sm:px-4 sm:py-2 sm:text-xs">
                          {featured.release_date.split("-")[0]}
                        </span>
                      )}
                      {featured?.vote_average !== undefined && (
                        <div className="flex items-center gap-1.5 ">
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
                        disabled={wlLoading}
                        className={`ml-auto flex h-10 w-10 items-center justify-center gap-2 rounded-xl font-semibold shadow-lg transition-all cursor-pointer sm:h-auto sm:w-auto sm:px-4 sm:py-3
                                                    ${
                                                      featuredInWatchlist
                                                        ? "bg-emerald-500/90 text-white border-emerald-400/50 hover:bg-emerald-600"
                                                        : "bg-white/10 hover:bg-white/20 backdrop-blur-sm border-white/20 text-white"
                                                    }`}
                        title={
                          featuredInWatchlist
                            ? "Remove from My List"
                            : "Add to My List"
                        }
                      >
                        {wlLoading ? (
                          <span className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                        ) : featuredInWatchlist ? (
                          <>
                            <BookmarkCheck className="w-5 h-5" />
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-5 h-5" />
                          </>
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
                      <Link href={`/movies/${featured?.id}`} className="flex-1">
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

      {/* Content */}
      <div className="relative mx-auto max-w-7xl space-y-11 px-4 py-10 sm:space-y-14 sm:px-6 sm:py-12 lg:space-y-16 lg:px-8 lg:py-14">
        {/* Box Office */}
        {popularMovies.length > 0 && (
          <section
            id="popular-movies"
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/80 p-4 shadow-2xl shadow-black/30 sm:p-6"
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(245,158,11,0.08),transparent_30%),radial-gradient(circle_at_78%_4%,rgba(233,79,55,0.09),transparent_25%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_36%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />

            <div className="relative mb-5 flex flex-col gap-4 sm:mb-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-300 shadow-xl shadow-black/20 sm:h-12 sm:w-12">
                  <Ticket className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">
                    Crowd magnets
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl lg:text-4xl">
                    Box Office Hits
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-zinc-400">
                    Big-screen picks pulling the strongest attention right now.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-200">
                  Top {Math.min(popularMovies.length, 4)} ranked
                </div>
                <Link
                  href="/movies/box-office"
                  className="group inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-bold text-zinc-300 transition-colors hover:border-[#e94f37]/40 hover:text-white"
                >
                  View All
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
              {popularMovies[0] && (
                <Link
                  href={`/movies/${popularMovies[0].id}`}
                  className="group lg:col-span-7"
                >
                  <div className="relative min-h-[330px] overflow-hidden rounded-3xl border border-amber-300/15 bg-zinc-950 ring-1 ring-white/10 shadow-2xl shadow-black/30 sm:min-h-[380px] lg:min-h-[460px]">
                    <Image
                      src={getImageUrl(
                        popularMovies[0].backdrop_path ||
                          popularMovies[0].poster_path,
                      )}
                      alt={popularMovies[0].title || ""}
                      fill
                      sizes="(max-width: 1024px) 100vw, 58vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/72 to-black/15" />
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.68),transparent_62%),radial-gradient(circle_at_18%_18%,rgba(245,158,11,0.22),transparent_30%)]" />
                    <div className="absolute inset-x-0 top-0 h-px bg-amber-200/25" />

                    <div className="absolute left-4 top-4 flex items-center gap-2 rounded-2xl border border-amber-300/30 bg-black/60 px-3 py-2 text-amber-200 shadow-xl shadow-black/30 backdrop-blur sm:left-5 sm:top-5">
                      <Ticket className="h-4 w-4" />
                      <span className="text-xs font-black uppercase tracking-[0.14em]">
                        Weekend leader
                      </span>
                    </div>

                    <div className="absolute right-4 top-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/35 bg-black/70 text-xl font-black text-amber-200 shadow-xl shadow-black/35 backdrop-blur transition-transform duration-300 group-hover:scale-105 sm:right-5 sm:top-5 sm:h-16 sm:w-16 sm:text-2xl">
                      #1
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-4 sm:p-7">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <RatingBadge
                          rating={popularMovies[0].vote_average}
                          variant="colored"
                          size="md"
                        />
                        <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs font-bold text-zinc-200">
                          {popularMovies[0].release_date?.split("-")[0] ||
                            "TBA"}
                        </span>
                      </div>

                      <h3 className="max-w-3xl text-2xl font-black leading-tight text-white transition-colors group-hover:text-[#ff8b78] sm:text-4xl lg:text-5xl">
                        {popularMovies[0].title}
                      </h3>

                      {popularMovies[0].overview && (
                        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-zinc-300 line-clamp-2 sm:text-base">
                          {popularMovies[0].overview}
                        </p>
                      )}

                      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-bold text-zinc-200 backdrop-blur sm:mt-5">
                        <Ticket className="h-3.5 w-3.5 text-amber-300" />
                        Current crowd-puller
                      </div>
                    </div>
                  </div>
                </Link>
              )}

              <div className="rounded-3xl border border-white/10 bg-black/25 p-3 ring-1 ring-white/[0.04] sm:p-4 lg:col-span-5">
                <div className="mb-3 flex items-start justify-between gap-3 px-1">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                      Box office board
                    </span>
                    <p className="mt-1 text-xs font-medium text-zinc-500">
                      Fast-scan rankings for the next biggest crowd-pullers.
                    </p>
                  </div>
                  <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs font-bold text-amber-200">
                    Live list
                  </span>
                </div>

                <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 scroll-smooth lg:mx-0 lg:block lg:space-y-3 lg:overflow-visible lg:px-0 lg:pb-0">
                  {popularMovies.slice(1, 6).map((movie, idx) => (
                    <Link
                      key={movie.id}
                      href={`/movies/${movie.id}`}
                      className="group relative grid w-[82vw] max-w-[360px] shrink-0 snap-start grid-cols-[2.75rem_4.5rem_minmax(0,1fr)] gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-2.5 transition-all hover:border-amber-300/30 hover:bg-white/[0.06] sm:w-[340px] lg:w-auto lg:max-w-none lg:grid-cols-[3rem_5.25rem_minmax(0,1fr)]"
                    >
                      <div className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-amber-300/25 transition-colors group-hover:bg-[#e94f37]/70" />
                      <div className="flex items-start justify-center pt-1">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-sm font-black text-amber-200 transition-transform duration-300 group-hover:scale-105">
                          #{idx + 2}
                        </span>
                      </div>

                      <div className="relative h-24 overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10 sm:h-28">
                        <Image
                          src={getPosterUrl(movie.poster_path)}
                          alt={movie.title || ""}
                          fill
                          sizes="84px"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>

                      <div className="min-w-0 py-1">
                        <h3 className="line-clamp-2 text-sm font-black leading-tight text-white transition-colors group-hover:text-[#ff8b78] sm:text-base">
                          {movie.title}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <RatingBadge
                            rating={movie.vote_average}
                            variant="minimal"
                            size="sm"
                          />
                          <span className="text-xs font-semibold text-zinc-500">
                            {movie.release_date?.split("-")[0] || "TBA"}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                  <div className="w-1 shrink-0 lg:hidden" aria-hidden="true" />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* New Releases */}
        {newReleaseMovies.length > 0 && (
          <section
            id="new-release-movies"
            className="relative rounded-3xl border border-white/10 bg-neutral-950/70 p-4 shadow-2xl shadow-black/30 sm:p-6"
          >
            <div className="relative mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-400 blur-xl opacity-50" />
                  <Sparkles className="relative h-7 w-7 text-cyan-400 sm:h-9 sm:w-9" />
                </div>

                <h2 className="text-2xl font-black text-white sm:text-3xl lg:text-4xl">
                  New Releases
                </h2>
              </div>

              <Link
                href="/movies/new-releases"
                className="text-sm font-bold text-gray-400 hover:text-[#e94f37] transition-colors flex items-center gap-2 group shrink-0 mt-1"
              >
                View All
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-12 gap-4 sm:gap-5">
              {newReleaseMovies[0] && (
                <Link
                  href={`/movies/${newReleaseMovies[0].id}`}
                  className="col-span-12 lg:col-span-8 group"
                >
                  <div className="relative h-[320px] overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl ring-1 ring-white/10 sm:h-96 sm:rounded-3xl lg:h-[500px]">
                    {newReleaseMovies[0].backdrop_path && (
                      <>
                        <Image
                          src={getImageUrl(newReleaseMovies[0].backdrop_path)}
                          alt={newReleaseMovies[0].title || ""}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                      </>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-8 lg:p-10">
                      <h3 className="mb-2 line-clamp-2 text-xl font-black text-white sm:mb-4 sm:text-4xl">
                        {newReleaseMovies[0].title}
                      </h3>

                      <p className="mb-4 line-clamp-2 max-w-3xl text-sm leading-6 text-gray-200 sm:mb-6 sm:text-lg sm:leading-relaxed">
                        {newReleaseMovies[0].overview}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                        <div className="flex items-center gap-2">
                          <RatingBadge
                            rating={newReleaseMovies[0].vote_average}
                            variant="colored"
                            size="md"
                          />
                        </div>
                        <span className="text-gray-300 font-semibold">
                          {newReleaseMovies[0].release_date}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              )}

              <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1 lg:gap-5">
                {newReleaseMovies.slice(1, 3).map((movie) => (
                  <Link
                    key={movie.id}
                    href={`/movies/${movie.id}`}
                    className="group"
                  >
                    <div className="relative h-40 overflow-hidden rounded-2xl bg-zinc-900 shadow-xl ring-1 ring-white/10 sm:h-48 lg:h-[238px]">
                      {movie.backdrop_path && (
                        <>
                          <Image
                            src={getImageUrl(movie.backdrop_path)}
                            alt={movie.title || ""}
                            fill
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className="object-cover group-hover:scale-110 transition-transform duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                        </>
                      )}

                      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                        <h4 className="mb-2 line-clamp-1 text-base font-bold text-white transition-colors group-hover:text-cyan-400 sm:text-lg">
                          {movie.title}
                        </h4>

                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex items-center gap-1">
                            <RatingBadge
                              rating={movie.vote_average}
                              variant="colored"
                              size="sm"
                            />
                          </div>
                          <span className="text-gray-400 font-semibold">
                            {movie.release_date?.split("-")[0]}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Extra cards */}
            <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scroll-smooth sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-6">
              {newReleaseMovies.slice(3, 9).map((movie) => (
                <div
                  key={movie.id}
                  className="w-[42vw] min-w-[145px] max-w-[176px] shrink-0 snap-start sm:w-auto sm:min-w-0 sm:max-w-none"
                >
                  <MovieCard show={movie} />
                </div>
              ))}
              <div className="w-1 shrink-0 sm:hidden" aria-hidden="true" />
            </div>
          </section>
        )}

        {/* Featured */}
        {trendingMovies.length > 0 && (
          <section
            id="trending-movies"
            className="relative rounded-3xl border border-white/10 bg-neutral-950/70 p-4 shadow-2xl shadow-black/30 sm:p-6"
          >
            <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#e94f37] blur-xl opacity-50" />
                  <Flame className="relative w-7 h-7 sm:w-8 sm:h-8 text-[#e94f37]" />
                </div>

                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white">
                  Featured Now
                </h2>
              </div>

              <Link
                href="/movies/featured"
                className="text-sm font-bold text-gray-400 hover:text-[#e94f37] transition-colors flex items-center gap-2 group shrink-0"
              >
                View All
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <Carousel items={trendingMovies} CardComponent={MovieCard} />
          </section>
        )}

        {/* Korean Cinema */}
        {koreanMovies.length > 0 && (
          <section
            id="korean-movies"
            className="relative rounded-3xl border border-white/10 bg-neutral-950/70 p-4 shadow-2xl shadow-black/30 sm:p-6"
          >
            <div className="relative mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="text-3xl sm:text-4xl lg:text-5xl">
                  <Image
                    src="/images/south-korea.png"
                    alt="Korean flag"
                    width={40}
                    height={40}
                    className="rounded-full object-cover border border-white/20"
                  />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white">
                    Korean Cinema
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1 font-medium">
                    Award-winning storytelling
                  </p>
                </div>
              </div>

              <Link
                href="/movies/korean-cinema"
                className="text-sm font-bold text-gray-400 hover:text-[#e94f37] transition-colors flex items-center gap-2 group shrink-0"
              >
                View All
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            <Carousel items={koreanMovies} CardComponent={MovieCard} />
          </section>
        )}

        <CommunityPulseSection data={communityPulse} mediaType="movie" />

        {/* Coming Soon */}
        {newMovieTrailers.length > 0 && (
          <ComingSoonSection
            title="Coming to Theaters"
            items={newMovieTrailers}
            type="movies"
          />
        )}

        {/* Critics Corner */}
        {movieReviews.length > 0 && (
          <section
            id="reviews"
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/80 p-4 shadow-2xl shadow-black/25 sm:p-6"
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(233,79,55,0.055),transparent_34%),radial-gradient(circle_at_86%_12%,rgba(255,255,255,0.045),transparent_24%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />

            <div className="relative mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="relative mt-1">
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-[#e94f37]/25 bg-[#e94f37]/10 text-[#ff8b78] shadow-xl shadow-black/20">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff8b78]">
                    Community reviews
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl lg:text-4xl">
                    Critics Corner
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                    Random picks from Moodies members, paired with the movies
                    they reviewed.
                  </p>
                </div>
              </div>

              <div className="flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-bold text-white/75">
                <Heart className="h-3.5 w-3.5 text-[#ff8b78]" />
                {Math.min(movieReviews.length, 6)} fresh takes
              </div>
            </div>

            <div className="relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scroll-smooth sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 lg:gap-6">
              {movieReviews.slice(0, 6).map((review, idx) => {
                const criticName =
                  review.user?.name || review.name || "Moodies critic";
                const criticHandle = review.user?.username || review.name;
                const initial =
                  criticName.trim().charAt(0).toUpperCase() || "M";
                const movieTitle =
                  review.movieTitle ||
                  review.title ||
                  (review.tmdbId ? `Movie #${review.tmdbId}` : "Movie review");
                const moviePoster = review.moviePoster
                  ? getPosterUrl(review.moviePoster)
                  : "/placeholder-poster.svg";

                return (
                  <div
                    key={`${review.user?.id || "critic"}-${review.tmdbId || idx}-${idx}`}
                    className="group relative w-[84vw] max-w-[360px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/85 p-3 shadow-xl shadow-black/25 ring-1 ring-white/5 transition-all hover:border-[#e94f37]/35 hover:bg-zinc-950 sm:w-auto sm:max-w-none sm:p-4"
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-[#e94f37]/45" />

                    <div className="mb-3 flex gap-3 sm:mb-4">
                      <div className="relative h-20 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/10 sm:h-28 sm:w-[4.6rem]">
                        <Image
                          src={moviePoster}
                          alt={movieTitle}
                          fill
                          sizes="80px"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#ff8b78]">
                          Reviewed movie
                        </p>
                        <h3 className="line-clamp-2 text-sm font-black leading-tight text-white sm:text-base">
                          {movieTitle}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
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

                    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                      <p className="line-clamp-3 text-sm leading-6 text-zinc-300 sm:line-clamp-4">
                        &ldquo;{review.quote || "No review available"}&rdquo;
                      </p>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#e94f37]/15 text-xs font-black text-white ring-1 ring-[#e94f37]/25">
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

        {/* ACTION-PACKED - Toned Down Design */}
        {actionMovies.length > 0 && (
          <section
            id="action-movies"
            className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-zinc-900/60 to-black backdrop-blur-sm border border-zinc-700/30 ring-1 ring-white/5 shadow-xl"
          >
            {/* Subtle background gradient */}
            <div className="absolute top-0 right-0 w-64 sm:w-80 lg:w-[400px] h-64 sm:h-80 lg:h-[400px] bg-gradient-to-bl from-zinc-700/10 to-transparent rounded-full blur-3xl" />

            <div className="relative p-4 sm:p-5 lg:p-6">
              {/* Section Title */}
              <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-zinc-600 rounded-xl blur-lg opacity-30" />
                    <div className="relative w-9 h-9 sm:w-11 sm:h-11 lg:w-12 lg:h-12 bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-xl flex items-center justify-center ring-1 ring-zinc-600/50">
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-300" />
                    </div>
                  </div>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-zinc-200">
                    Action-Packed
                  </h2>
                </div>

                {/* View All */}
                <Link
                  href="/movies/action"
                  className="text-sm font-bold text-gray-400 hover:text-[#e94f37] transition-colors flex items-center gap-2 group shrink-0"
                >
                  View All
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Grid Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
                {/* Featured Card */}
                {actionMovies[0] && (
                  <Link
                    href={`/movies/${actionMovies[0].id}`}
                    className="lg:col-span-2 group"
                  >
                    <div className="relative aspect-[16/9] rounded-xl sm:rounded-2xl overflow-hidden bg-black ring-1 ring-zinc-700/30 shadow-lg">
                      {actionMovies[0].backdrop_path && (
                        <>
                          <Image
                            src={getImageUrl(actionMovies[0].backdrop_path)}
                            alt={actionMovies[0].title || ""}
                            fill
                            sizes="(max-width: 768px) 100vw, 50vw"
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                        </>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                        <h3 className="text-lg sm:text-xl lg:text-2xl font-bold line-clamp-2 text-white group-hover:text-zinc-300 transition-colors">
                          {actionMovies[0].title}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center gap-1 rounded-full text-xs font-bold">
                            <RatingBadge
                              rating={actionMovies[0].vote_average}
                              variant="colored"
                              size="sm"
                            />
                          </div>
                          <span className="text-gray-400 text-xs">
                            {actionMovies[0].release_date?.split("-")[0]}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}

                {/* Side List (2–5) */}
                <div className="space-y-3 sm:space-y-4">
                  {actionMovies.slice(1, 5).map((movie) => (
                    <Link
                      key={movie.id}
                      href={`/movies/${movie.id}`}
                      className="group flex gap-3 bg-zinc-900/60 rounded-xl p-3 hover:border-zinc-600/60 border border-zinc-700/30 transition"
                    >
                      <div className="relative w-14 h-18 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-zinc-700/30">
                        {movie.poster_path && (
                          <Image
                            src={getPosterUrl(movie.poster_path)}
                            alt={movie.title || ""}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                            className="object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-md line-clamp-2 text-white group-hover:text-zinc-300 transition-colors">
                          {movie.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[13px] text-gray-400 mt-2">
                          <RatingBadge
                            rating={movie.vote_average}
                            variant="colored"
                            size="sm"
                          />
                          <span>{movie.release_date?.split("-")[0]}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* More Movies */}
              <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scroll-smooth sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-6">
                {actionMovies.slice(5, 11).map((movie) => (
                  <div
                    key={movie.id}
                    className="w-[42vw] min-w-[145px] max-w-[176px] shrink-0 snap-start sm:w-auto sm:min-w-0 sm:max-w-none"
                  >
                    <MovieCard show={movie} />
                  </div>
                ))}
                <div className="w-1 shrink-0 sm:hidden" aria-hidden="true" />
              </div>
            </div>
          </section>
        )}

        {/* AWARD WINNERS - Toned Down Design */}
        {awardWinners.length > 0 && (
          <section
            id="award-winners"
            className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-950/40 via-yellow-950/30 to-black backdrop-blur-sm border border-amber-500/30 ring-1 ring-white/5 shadow-2xl"
          >
            {/* Radial golden glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 lg:w-[600px] h-80 sm:h-96 lg:h-[600px] bg-gradient-to-r from-amber-600/20 to-yellow-600/20 rounded-full blur-3xl" />

            {/* Subtle grid pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#fbbf24_1px,transparent_1px),linear-gradient(to_bottom,#fbbf24_1px,transparent_1px)] bg-[size:2rem_2rem]" />
            </div>
            <div className="relative p-5 sm:p-6 lg:p-8">
              <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-xl sm:rounded-2xl blur-xl opacity-60 animate-pulse" />
                    <div className="relative w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-amber-600 to-yellow-600 rounded-xl sm:rounded-2xl flex items-center justify-center ring-2 ring-amber-500/50 shadow-xl">
                      <Award className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-white" />
                    </div>
                  </div>

                  <div>
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 bg-clip-text text-transparent">
                      Award Winners
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-300 mt-1 sm:mt-2 font-semibold hidden sm:block">
                      Critically acclaimed masterpieces
                    </p>
                  </div>
                </div>

                {/* View All */}
                <Link
                  href="/movies/award-winners"
                  className="text-sm font-bold text-gray-400 hover:text-[#e94f37] transition-colors flex items-center gap-2 group shrink-0 mt-1"
                >
                  View All
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
              <Carousel items={awardWinners} CardComponent={MovieCard} />
            </div>
          </section>
        )}

        {/* ANIMATED FEATURES - Playful Design */}
        {animatedMovies.length > 0 && (
          <section
            id="animated-movies"
            className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-purple-950/40 via-pink-950/30 to-blue-950/30 backdrop-blur-sm border border-purple-500/30 ring-1 ring-white/5 shadow-2xl"
          >
            {/* Colorful gradient orbs */}
            <div className="absolute top-0 left-0 w-64 sm:w-80 lg:w-96 h-64 sm:h-80 lg:h-96 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 right-0 w-64 sm:w-80 lg:w-96 h-64 sm:h-80 lg:h-96 bg-gradient-to-tl from-blue-600/20 to-cyan-600/20 rounded-full blur-3xl animate-pulse delay-1000" />

            {/* Dotted pattern */}
            <div className="absolute inset-0 opacity-10">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, white 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />
            </div>

            <div className="relative p-5 sm:p-6 lg:p-8">
              <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-xl sm:rounded-2xl blur-xl opacity-60 animate-pulse" />
                    <div className="relative w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center ring-2 ring-purple-500/50 shadow-xl">
                      <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-white" />
                    </div>
                  </div>

                  <div>
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                      Animated Magic
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-300 mt-1 sm:mt-2 font-semibold hidden sm:block">
                      Enchanting stories for all ages
                    </p>
                  </div>
                </div>

                {/* View All */}
                <Link
                  href="/movies/animated"
                  className="text-sm font-bold text-gray-400 hover:text-[#e94f37] transition-colors flex items-center gap-2 group shrink-0 mt-1"
                >
                  View All
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Use Carousel instead of custom grid */}
              <Carousel items={animatedMovies} CardComponent={MovieCard} />
            </div>
          </section>
        )}

        {/* INDIE SPOTLIGHT - Simplified Design */}
        {indieMovies.length > 0 && (
          <section
            id="indie-movies"
            className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900/60 to-black backdrop-blur-sm border border-slate-700/30 ring-1 ring-white/5 shadow-xl"
          >
            <div className="absolute top-0 right-0 w-80 sm:w-96 lg:w-[500px] h-80 sm:h-96 lg:h-[500px] bg-gradient-to-bl from-slate-700/10 to-transparent rounded-full blur-3xl" />

            <div className="relative p-5 sm:p-6 lg:p-8">
              <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-slate-600 rounded-xl sm:rounded-2xl blur-lg opacity-30" />
                    <div className="relative w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl sm:rounded-2xl flex items-center justify-center ring-1 ring-slate-600/50 shadow-lg">
                      <Film className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-slate-300" />
                    </div>
                  </div>

                  <div>
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-200">
                      Indie Spotlight
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1 font-medium">
                      Hidden gems & festival favorites
                    </p>
                  </div>
                </div>

                <Link
                  href="/movies/indie"
                  className="text-sm font-bold text-gray-400 hover:text-[#e94f37] transition-colors flex items-center gap-2 group shrink-0 mt-1"
                >
                  View All
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              <Carousel items={indieMovies} CardComponent={MovieCard} />
            </div>
          </section>
        )}

        {moods && moods.length > 0 && (
          <div className="mx-auto w-full max-w-7xl pt-1 sm:pt-0">
            <MoodRecommendationsSection
              mediaType="movie"
              initialMoods={moods}
            />
          </div>
        )}
      </div>
    </main>
  );
}
