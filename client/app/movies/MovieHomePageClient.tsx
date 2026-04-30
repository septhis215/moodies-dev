// Enhanced Movies Homepage - MovieHomePageClient.tsx
"use client";

import React, { useState, useEffect } from "react";
import type { All } from "@/types/all";
import type { ReviewItem } from "@/components/sections/CommunityPicks";
import {
    Star,
    Plus,
    Info,
    ChevronRight,
    ChevronLeft,
    Flame,
    Calendar,
    Heart,
    Share2,
    Bookmark,
    Film,
    Award,
    Ticket,
    MessageSquare,
    Globe,
    Users,
    Sparkles,
    Trophy,
    Zap,
    BookmarkCheck,
    ThumbsUp,
    Rat,
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
import RatingBadge from "@/components/ui/rating-badge";
export default function MoviesHomePageClient({
    trendingMovies,
    popularMovies,
    topRatedMovies,
    movieTrailers,
    newMovieTrailers,
    movieReviews,
    koreanMovies,
    animatedMovies,
    indieMovies,
    awardWinners,
    actionMovies,
    moods,
    newReleaseMovies,
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
    moods?: any[];
    newReleaseMovies: All[];
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
    const getImageUrl = (path?: string) =>
        path ? `https://image.tmdb.org/t/p/original${path}` : "/placeholder-backdrop.svg";
    const getPosterUrl = (path?: string) =>
        path ? `https://image.tmdb.org/t/p/w500${path}` : "/placeholder-poster.svg";

    // Keep `featured` derived from heroShows so it's always in sync
    const featured = heroMovies[heroIndex] || heroMovies[0] || null;

    // Auto-advance heroIndex every 8s
    useEffect(() => {
        if (!heroMovies.length) return;
        const id = setInterval(() => {
            setHeroIndex((i) =>
                heroMovies.length ? (i + 1) % heroMovies.length : 0
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
        const isLarge = size === "large";

        const inWL = isInWatchlist(String(show.id), "movie");
        const isLoading = loadingStates[show.id] || false;

        return (
            <div className="group relative h-full">
                <Link href={`/movies/${show.id}`} className="block h-full">
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
                        <div className="absolute top-3 right-3 ">
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
                                        router.push(`/movies/${show.id}`);
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
            {/* Animated Background Pattern */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-gradient-to-br from-[#e94f37]/10 via-purple-600/5 to-transparent rounded-full blur-3xl animate-pulse" />
                <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-cyan-600/10 via-blue-600/5 to-transparent rounded-full blur-3xl animate-pulse delay-1000" />
                <div className="absolute bottom-0 left-1/3 w-[700px] h-[700px] bg-gradient-to-tr from-fuchsia-600/10 via-pink-600/5 to-transparent rounded-full blur-3xl animate-pulse delay-500" />

                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem]" />

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
                                        <Film className="relative w-8 h-8 text-[#e94f37]" />
                                    </div>
                                    <h1 className="text-4xl sm:text-5xl font-black leading-tight tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                                        Movies Hub
                                    </h1>
                                </div>
                                <p className="text-gray-400 text-sm ml-8 font-medium hidden sm:block">
                                    Click any poster to feature it
                                </p>
                            </div>

                            <div className="relative flex-1 w-full h-full rounded-2xl overflow-hidden ring-1 ring-white/5">
                                <div className="absolute inset-0 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 p-3">
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
                                                className={`rounded-xl overflow-hidden border-2 transform transition-all duration-300
                                                hover:scale-105 hover:z-10 focus:outline-none
                                                ${isActive
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
                                                <div className="flex items-center gap-1.5 ">
                                                    <RatingBadge rating={featured.vote_average} variant="colored" size="md" />
                                                </div>
                                            )}

                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    handleFeaturedWatchlist();
                                                }}
                                                disabled={wlLoading}
                                                className={`ml-auto px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2  shadow-lg
s                                                    ${featuredInWatchlist
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

                                        <h2 className="text-3xl sm:text-4xl font-black mb-4 leading-tight line-clamp-2 text-white">
                                            {featured?.title || "—"}
                                        </h2>

                                        <p className="text-sm sm:text-base text-gray-300 line-clamp-3 mb-6 leading-relaxed">
                                            {featured?.overview || "No description available"}
                                        </p>

                                        <div className="flex gap-3 mt-auto pt-6 border-t border-white/10">
                                            <Link href={`/movies/${featured?.id}`} className="flex-1">
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

            {/* Content */}
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-24">
                {/* Box Office */}
                {popularMovies.length > 0 && (
                    <section id="popular-movies" className="relative">
                        <div className="relative flex items-center justify-between mb-10">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-amber-500 blur-xl opacity-50" />
                                    <Ticket className="relative w-9 h-9 text-amber-400" />
                                </div>

                                <h2 className="text-3xl sm:text-4xl font-black text-white">
                                    Box Office Hits
                                </h2>
                            </div>

                            <Link
                                href="/movies/box-office"
                                className="text-sm font-bold text-gray-400 hover:text-[#e94f37] transition-colors flex items-center gap-2 group shrink-0 mt-1"
                            >
                                View All
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {popularMovies.slice(0, 4).map((movie, idx) => (
                                <Link key={movie.id} href={`/movies/${movie.id}`}>
                                    <div className="group relative h-72 rounded-3xl overflow-hidden bg-zinc-900 ring-1 ring-white/10 shadow-2xl">
                                        {movie.backdrop_path && (
                                            <>
                                                <Image
                                                    src={getImageUrl(movie.backdrop_path)}
                                                    alt={movie.title || ""}
                                                    fill
                                                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
                                            </>
                                        )}

                                        <div className="absolute inset-0 p-8 flex flex-col justify-end">
                                            <div className="text-8xl font-black text-white/80 absolute top-6 right-6">
                                                #{idx + 1}
                                            </div>

                                            <h3 className="text-3xl font-black mb-3 group-hover:text-[#e94f37] transition-colors text-white">
                                                {movie.title}
                                            </h3>

                                            <div className="flex items-center gap-4 text-sm">
                                                <div className="flex items-center gap-1.5 ">
                                                    <RatingBadge rating={movie.vote_average} variant="minimal" size="md" />
                                                </div>

                                                <span className="text-gray-300 font-semibold">
                                                    {movie.release_date?.split("-")[0]}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* New Releases */}
                {newReleaseMovies.length > 0 && (
                    <section id="new-release-movies" className="relative">
                        <div className="relative flex items-center justify-between mb-10">
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
                                href="/movies/new-releases"
                                className="text-sm font-bold text-gray-400 hover:text-[#e94f37] transition-colors flex items-center gap-2 group shrink-0 mt-1"
                            >
                                View All
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>

                        {/* Main grid */}
                        <div className="grid grid-cols-12 gap-5">
                            {newReleaseMovies[0] && (
                                <Link
                                    href={`/movies/${newReleaseMovies[0].id}`}
                                    className="col-span-12 lg:col-span-8 group"
                                >
                                    <div className="relative h-96 lg:h-[500px] rounded-3xl overflow-hidden bg-zinc-900 ring-1 ring-white/10 shadow-2xl">
                                        {newReleaseMovies[0].backdrop_path && (
                                            <>
                                                <Image
                                                    src={getImageUrl(newReleaseMovies[0].backdrop_path)}
                                                    alt={newReleaseMovies[0].title || ""}
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
                                                {newReleaseMovies[0].title}
                                            </h3>

                                            <p className="text-gray-200 line-clamp-2 mb-6 max-w-3xl text-lg leading-relaxed">
                                                {newReleaseMovies[0].overview}
                                            </p>

                                            <div className="flex items-center gap-6">
                                                <div className="flex items-center gap-2">
                                                    <RatingBadge rating={newReleaseMovies[0].vote_average} variant="colored" size="md" />
                                                </div>
                                                <span className="text-gray-300 font-semibold">
                                                    {newReleaseMovies[0].release_date}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            )}

                            <div className="col-span-12 lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-5">
                                {newReleaseMovies.slice(1, 3).map((movie) => (
                                    <Link
                                        key={movie.id}
                                        href={`/movies/${movie.id}`}
                                        className="group"
                                    >
                                        <div className="relative h-48 lg:h-[238px] rounded-2xl overflow-hidden bg-zinc-900 ring-1 ring-white/10 shadow-xl">
                                            {movie.backdrop_path && (
                                                <>
                                                    <Image
                                                        src={getImageUrl(movie.backdrop_path)}
                                                        alt={movie.title || ""}
                                                        fill
                                                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                                                </>
                                            )}

                                            <div className="absolute bottom-0 left-0 right-0 p-5">
                                                <h4 className="text-lg font-bold mb-2 line-clamp-1 group-hover:text-cyan-400 transition-colors text-white">
                                                    {movie.title}
                                                </h4>

                                                <div className="flex items-center gap-3 text-sm">
                                                    <div className="flex items-center gap-1">
                                                        <RatingBadge rating={movie.vote_average} variant="colored" size="sm" />
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 mt-6">
                            {newReleaseMovies.slice(3, 9).map((movie) => (
                                <MovieCard key={movie.id} show={movie} />
                            ))}
                        </div>
                    </section>
                )}

                {/* Featured */}
                {trendingMovies.length > 0 && (
                    <section id="trending-movies" className="relative">
                        <div className="flex items-center justify-between mb-6 sm:mb-8">
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
                    <section id="korean-movies" className="relative">
                        <div className="relative flex items-center justify-between mb-6 sm:mb-8">
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
                                    data: popularMovies,
                                    icon: <ThumbsUp className="w-5 h-5" />,
                                    color: "emerald",
                                },
                                {
                                    key: "most-reviewed",
                                    title: "Most Reviews",
                                    subtitle: "Highly discussed films",
                                    data: movieTrailers,
                                    icon: <MessageSquare className="w-5 h-5" />,
                                    color: "blue",
                                },
                                {
                                    key: "most-saved",
                                    title: "Most Saved",
                                    subtitle: "Popular watchlist picks",
                                    data: trendingMovies,
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
                                                className={`w-11 h-11 rounded-lg flex items-center justify-center ${sec.color === "emerald"
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
                                                    href={`/movies/${m.id}`}
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
                                                                    {m.release_date
                                                                        ? m.release_date.split("-")[0]
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
                                            className={`text-sm font-bold ${sec.color === "emerald"
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
                                data: popularMovies,
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
                                subtitle: "Highly discussed films",
                                data: movieTrailers,
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
                                data: trendingMovies,
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

                                {/* Movies List */}
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
                                                href={`/movies/${m.id}`}
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
                                                            {m.release_date?.split("-")[0]}
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
                    <section id="reviews" className="relative">
                        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                            <div className="relative">
                                <div className="absolute inset-0 bg-rose-500 blur-xl opacity-50" />
                                <Heart className="relative w-7 h-7 sm:w-8 sm:h-8 text-rose-400" />
                            </div>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white">
                                Critics Corner
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                            {movieReviews.slice(0, 6).map((review, idx) => (
                                <div
                                    key={idx}
                                    className="bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 backdrop-blur-sm border border-zinc-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 hover:border-rose-500/50 transition-all ring-1 ring-white/5 shadow-xl"
                                >
                                    <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
                                        <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 bg-rose-500/20 rounded-full flex items-center justify-center flex-shrink-0 ring-1 ring-rose-500/30">
                                            <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-xs sm:text-sm line-clamp-1 text-white">
                                                {review.title || review.name}
                                            </h4>
                                            <div className="flex items-center gap-1 mt-1">
                                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                                <span className="text-xs font-bold text-white">
                                                    {review.rating?.toFixed(1) || "—"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-xs sm:text-sm text-gray-400 line-clamp-4 leading-relaxed">
                                        "{review.quote || "No review available"}"
                                    </p>
                                </div>
                            ))}
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
                            <div className="flex items-center justify-between mb-5 sm:mb-6">
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
                                                    <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 rounded-full text-xs font-bold">
                                                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                                        {actionMovies[0].vote_average &&
                                                            actionMovies[0].vote_average > 0
                                                            ? actionMovies[0].vote_average.toFixed(1)
                                                            : "New"}
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
                                    {actionMovies.slice(1, 5).map((movie, idx) => (
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
                                                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                                                    />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-md line-clamp-2 text-white group-hover:text-zinc-300 transition-colors">
                                                    {movie.title}
                                                </h4>
                                                <div className="flex items-center gap-1.5 text-[13px] text-gray-400 mt-1">
                                                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                                    <span className="font-semibold text-white">
                                                        {movie.vote_average && movie.vote_average > 0
                                                            ? movie.vote_average.toFixed(1)
                                                            : "New"}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{movie.release_date?.split("-")[0]}</span>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            {/* More Movies */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 mt-5">
                                {actionMovies.slice(5, 11).map((movie) => (
                                    <MovieCard key={movie.id} show={movie} />
                                ))}
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
                            <div className="flex items-start justify-between mb-6 sm:mb-8">
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
                            <div className="flex items-start justify-between mb-6 sm:mb-8">
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
                        {/* Subtle gradient */}
                        <div className="absolute top-0 right-0 w-80 sm:w-96 lg:w-[500px] h-80 sm:h-96 lg:h-[500px] bg-gradient-to-bl from-slate-700/10 to-transparent rounded-full blur-3xl" />

                        <div className="relative p-5 sm:p-6 lg:p-8">
                            <div className="flex items-start justify-between mb-6 sm:mb-8">
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

                                {/* View All */}
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
                    <div className="max-w-7xl mx-auto w-full">
                        <MoodRecommendationsSection mediaType="movie" />
                    </div>
                )}
            </div>
        </main>
    );
}
