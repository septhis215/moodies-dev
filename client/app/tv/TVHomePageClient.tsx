'use client';

import React, { useState, useEffect } from 'react';
import type { All } from '@/types/all';
import type { ReviewItem } from '@/components/sections/CommunityPicks';
import { Play, Star, Plus, Info, ChevronRight, ChevronLeft, Flame, Calendar, TrendingUp, Zap, Share2, Bookmark, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from "framer-motion";
import { ComingSoonSection } from '@/components/sections/ComingSoon';
import MoodRecommendationsSection from '@/components/sections/MoodRecommendationSection';
import { useScrollToHash } from "@/hooks/useScrollToHash";
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

    const [heroIndex, setHeroIndex] = useState(0);
    const heroShows = popularTV.slice(0, 18);
    const heroShow = heroShows[heroIndex];
    const getImageUrl = (path?: string) =>
        path ? `https://image.tmdb.org/t/p/original${path}` : "/placeholder.jpg";
    const getPosterUrl = (path?: string) =>
        path ? `https://image.tmdb.org/t/p/w500${path}` : "/placeholder.jpg";
    useScrollToHash(100);
    const nextHero = () =>
        setHeroIndex((prev) => (heroShows.length ? (prev + 1) % heroShows.length : 0));
    const prevHero = () =>
        setHeroIndex((prev) =>
            heroShows.length ? (prev - 1 + heroShows.length) % heroShows.length : 0
        );

    useEffect(() => {
        if (!heroShows.length) return;
        const id = setInterval(() => setHeroIndex((i) => (i + 1) % heroShows.length), 8000);
        return () => clearInterval(id);
    }, [heroShows.length]);

    /* ---------------- Compact TVCard ---------------- */
    const TVCard = ({ show, size = "default" }: { show: All; size?: "default" | "large" | "wide" }) => {
        const isWide = size === "wide";
        const isLarge = size === "large";

        return (
            <div className="group relative h-full">
                <Link href={`/tv/${show.id}`} className="block h-full">
                    <div
                        className={`relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-xl ring-1 ring-white/5 ${isWide ? "aspect-video" : "aspect-[2/3]"
                            }`}
                    >
                        <Image
                            src={isWide ? getImageUrl(show.backdrop_path) : getPosterUrl(show.poster_path)}
                            alt={show.title || show.name || ""}
                            fill
                            className="group-hover:scale-110 transition-transform duration-700 object-cover"
                        />

                        {/* Gradient overlay for depth */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        <div className="absolute top-3 right-3 bg-black/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg ring-1 ring-white/10">
                            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                            {show.vote_average && show.vote_average > 0 ? show.vote_average.toFixed(1) : "New"}
                        </div>

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                                <div className="flex justify-center gap-2 mb-3">
                                    <button
                                        onClick={(e) => { e.preventDefault(); }}
                                        className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
                                        title="Add to List"
                                    >
                                        <Plus className="w-5 h-5 text-black" />
                                    </button>

                                    <button
                                        className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
                                        title="More Info"
                                    >
                                        <Info className="w-5 h-5 text-black" />
                                    </button>

                                    <button
                                        onClick={(e) => { e.preventDefault(); }}
                                        className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
                                        title="Share"
                                    >
                                        <Share2 className="w-5 h-5 text-black" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 px-1">
                        <h4 className="font-bold text-sm sm:text-base line-clamp-2 group-hover:text-[#e94f37] transition-colors leading-tight text-white">
                            {show.title || show.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                            {show.first_air_date && <span className="font-semibold">{show.first_air_date.split("-")[0]}</span>}
                            {show.number_of_seasons && (
                                <>
                                    <span>•</span>
                                    <span className="font-semibold">{show.number_of_seasons} Season{show.number_of_seasons > 1 ? 's' : ''}</span>
                                </>
                            )}
                        </div>
                    </div>
                </Link>
            </div>
        );
    };

    /* ---------------- Fixed Carousel Component ---------------- */
    const Carousel = ({ items }: { items: All[] }) => {
        const [startIndex, setStartIndex] = useState(0);
        const [itemsPerView, setItemsPerView] = useState(6);

        useEffect(() => {
            const updateLayout = () => {
                const w = window.innerWidth;
                if (w < 640) setItemsPerView(2);
                else if (w < 768) setItemsPerView(3);
                else if (w < 1024) setItemsPerView(4);
                else if (w < 1280) setItemsPerView(5);
                else setItemsPerView(6);
            };

            updateLayout();
            window.addEventListener("resize", updateLayout);
            return () => window.removeEventListener("resize", updateLayout);
        }, []);

        const canScrollLeft = startIndex > 0;
        const canScrollRight = startIndex < items.length - itemsPerView;

        const scrollLeft = () => {
            setStartIndex((prev) => Math.max(0, prev - itemsPerView));
        };

        const scrollRight = () => {
            setStartIndex((prev) => Math.min(items.length - itemsPerView, prev + itemsPerView));
        };

        const visibleItems = items.slice(startIndex, startIndex + itemsPerView);

        return (
            <div className="relative group/carousel">
                {canScrollLeft && (
                    <button
                        onClick={scrollLeft}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-12 h-12 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 shadow-2xl ring-2 ring-white/10"
                        aria-label="Scroll left"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                )}

                {canScrollRight && (
                    <button
                        onClick={scrollRight}
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-12 h-12 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 shadow-2xl ring-2 ring-white/10"
                        aria-label="Scroll right"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                    {visibleItems.map((item) => (
                        <TVCard key={item.id} show={item} />
                    ))}
                </div>
            </div>
        );
    };
    const [featured, setFeatured] = useState(heroShows[0]); 
    const [index, setIndex] = useState(0);

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
                {/* Top gradient for navbar readability */}
                <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black via-black/50 to-transparent pointer-events-none z-10" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-30 pb-20 relative z-20">
                    {/* Content grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                        {/* LEFT mosaic */}
                        <div className="md:col-span-7 col-span-1 rounded-3xl overflow-hidden bg-gradient-to-br from-zinc-900/80 via-zinc-900/50 to-zinc-950/80 backdrop-blur-xl p-6 flex flex-col ring-1 ring-white/10 shadow-2xl">
                            {/* Heading inside the panel */}
                            <div className="mb-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-[#e94f37] to-orange-400 blur-xl opacity-50" />
                                        <Zap className="relative w-8 h-8 text-[#e94f37]" />
                                    </div>
                                    <h1 className="text-4xl sm:text-5xl font-black leading-tight tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                                        TV Series Hub
                                    </h1>
                                </div>
                                <p className="text-gray-400 text-sm ml-11 font-medium">
                                    Click any poster to feature it
                                </p>
                            </div>

                            <div className="relative flex-1 w-full h-full rounded-lg overflow-hidden">
                                {/* mosaic grid of posters */}
                                <div className="absolute inset-0 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 p-2 animate-mosaic">
                                    {Array.from({ length: 18 }).map((_, i) => {
                                        const s = heroShows[(index + i) % heroShows.length] || {};
                                        const isActive = featured?.id === s.id;

                                        return (
                                            <button
                                                key={i}
                                                onClick={() => setFeatured(s)}
                                                className={`rounded-md overflow-hidden border transform transition 
              hover:scale-105 focus:outline-none 
              ${isActive ? "border-[#e94f37] ring-2 ring-[#e94f37]" : "border-white/6"}`}
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

                                {/* gradient overlay for cinematic depth */}
                                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_55%,black_95%)]" />
                            </div>
                        </div>

                        {/* RIGHT featured card */}
                        <div className="md:col-span-5 col-span-1 flex items-stretch scale-[0.98]">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={featured?.id}
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={{ duration: 0.4, ease: "easeInOut" }}
                                    className="relative flex flex-col w-full rounded-2xl bg-gradient-to-br from-black/70 via-black/40 to-transparent border border-white/10 shadow-2xl overflow-hidden"
                                >
                                    {featured?.backdrop_path && (
                                        <div className="absolute inset-0 -z-10">
                                            <Image
                                                src={getImageUrl(featured.backdrop_path)}
                                                alt={featured.title || featured.name || ""}
                                                fill
                                                className="object-cover opacity-30 blur-sm"
                                            />
                                        </div>
                                    )}

                                    {/* fixed-height hero image */}
                                    <div className="relative w-full h-56 sm:h-72 rounded-t-2xl overflow-hidden">
                                        {featured?.backdrop_path ? (
                                            <>
                                                <Image
                                                    src={getImageUrl(featured.backdrop_path)}
                                                    alt={featured.title || featured.name || ""}
                                                    fill
                                                    className="object-cover"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                                            </>
                                        ) : (
                                            <div className="w-full h-full bg-zinc-800" />
                                        )}
                                    </div>

                                    {/* card body */}
                                    {/* Content */}
                                    <div className="relative p-6 flex flex-col flex-1">
                                        <div className="flex items-center gap-2 flex-wrap mb-4">
                                            <span className="px-3 py-1.5 bg-[#e94f37] text-white rounded-full text-xs font-bold uppercase tracking-wider">
                                                Featured
                                            </span>
                                            {featured?.release_date && (
                                                <span className="px-3 py-1.5 bg-white/10 rounded-full text-xs font-semibold">
                                                    {featured.release_date.split("-")[0]}
                                                </span>
                                            )}
                                            {featured?.vote_average && (
                                                <div className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 rounded-full">
                                                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                                    <span className="text-xs font-bold">{featured.vote_average && featured.vote_average > 0 ? featured.vote_average.toFixed(1) : "New"}</span>
                                                </div>
                                            )}
                                        </div>

                                        <h2 className="text-2xl sm:text-3xl font-black mb-3 leading-tight line-clamp-2">
                                            {featured?.title || "—"}
                                        </h2>

                                        <p className="text-sm sm:text-base text-gray-300 line-clamp-3  leading-relaxed">
                                            {featured?.overview || "No description available"}
                                        </p>

                                        <div className="flex gap-3 mt-6 pt-4 border-t border-white/10">
                                            <Link href={`/tv/${featured?.id}`} className="flex-1">
                                                <button className="w-full px-6 py-3 bg-[#e94f37] hover:bg-[#d4452f] text-white rounded-xl font-bold transition-all transform hover:scale-105 flex items-center justify-center gap-2">
                                                    <Info className="w-4 h-4" />
                                                    View Details
                                                </button>
                                            </Link>
                                            <button className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
                                                <Plus className="w-4 h-4" />
                                            </button>
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
                    <section id="airing-today" className="relative bg-gradient-to-br from-red-950/30 via-orange-950/20 to-transparent backdrop-blur-sm p-6 sm:p-8 lg:p-10 rounded-3xl border border-red-500/20 ring-1 ring-white/5 shadow-2xl overflow-hidden">
                        {/* Decorative elements */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl" />

                        <div className="relative flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-red-500 blur-lg opacity-50 animate-pulse" />
                                    <div className="relative w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                                </div>
                                <div>
                                    <span className="text-xs font-black text-red-400 uppercase tracking-wider block mb-1">Live Now</span>
                                    <h2 className="text-3xl sm:text-4xl font-black text-white">Airing Today</h2>
                                </div>
                            </div>
                            <Link href="/tv/airing/today" className="text-sm font-bold text-gray-400 hover:text-red-400 transition-colors flex items-center gap-2 group">
                                View All
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                        <Carousel items={airingToday} />
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
                                <h2 className="text-3xl sm:text-4xl font-black text-white">Trending Now</h2>
                            </div>
                            <Link href="/tv/trending" className="text-sm font-bold text-gray-400 hover:text-[#e94f37] transition-colors flex items-center gap-2 group">
                                View All
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                        <Carousel items={popularTV} />
                    </section>
                )}


                {/* New This Week - Responsive Grid */}
                {newReleaseTV && newReleaseTV.length > 0 && (
                    <section id="new-release-tv" className="relative">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="relative">
                                <div className="absolute inset-0 bg-cyan-400 blur-xl opacity-50" />
                                <Sparkles className="relative w-9 h-9 text-cyan-400" />
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-black text-white">New Releases</h2>
                        </div>

                        <div className="grid grid-cols-12 gap-5">
                            {/* Large Featured */}
                            {newReleaseTV[0] && (
                                <Link href={`/tv/${newReleaseTV[0].id}`} className="col-span-12 lg:col-span-8 group">
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
                                            <h3 className="text-4xl font-black mb-4 line-clamp-2 text-white">{newReleaseTV[0].title}</h3>
                                            <p className="text-gray-200 line-clamp-2 mb-6 max-w-3xl text-lg leading-relaxed">
                                                {newReleaseTV[0].overview}
                                            </p>
                                            <div className="flex items-center gap-6">
                                                <div className="flex items-center gap-2">
                                                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                                                    <span className="font-bold text-lg text-white">{newReleaseTV[0].vote_average?.toFixed(1)}</span>
                                                </div>
                                                <span className="text-gray-300 font-semibold">{newReleaseTV[0].release_date}</span>
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
                                                        <span className="font-bold text-white">{tv.vote_average && tv.vote_average > 0 ? tv.vote_average.toFixed(1) : "New"}</span>
                                                    </div>
                                                    <span className="text-gray-400 font-semibold">{tv.release_date?.split('-')[0]}</span>
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
                {
                    topRatedTV && topRatedTV.length > 0 && (
                        <section id="top-rated-tv" className="relative">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <Star className="w-7 h-7 text-yellow-500" />
                                    <h2 className="text-2xl sm:text-3xl font-black">Top Rated Series</h2>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                                {topRatedTV.slice(0, 12).map((show, idx) => (
                                    <div key={show.id} className="group">
                                        <Link href={`/tv/${show.id}`}>
                                            <div>
                                                <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-zinc-900 mb-2">
                                                    {show.poster_path ? (
                                                        <Image
                                                            src={getPosterUrl(show.poster_path)}
                                                            alt={show.title || show.name || ""}
                                                            fill
                                                            className="group-hover:scale-110 transition-transform duration-500 object-cover"
                                                        />
                                                    ) : (
                                                        <div className="bg-zinc-900 w-full h-full" />
                                                    )}
                                                    {idx < 3 && (
                                                        <div className="absolute top-2 left-2 w-10 h-10 bg-[#e94f37] rounded-full flex items-center justify-center font-black text-lg shadow-lg">
                                                            {idx + 1}
                                                        </div>
                                                    )}
                                                </div>

                                                <h3 className="text-xs sm:text-sm font-bold line-clamp-2 group-hover:text-[#e94f37] transition-colors">
                                                    {show.title || show.name}
                                                </h3>
                                                <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-400 mt-1">
                                                    <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                                                    <span className="font-bold text-white">{show.vote_average && show.vote_average > 0 ? show.vote_average.toFixed(1) : "New"}</span>
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )
                }

                {/* Airing This Week */}
                {
                    airingThisWeek && airingThisWeek.length > 0 && (
                        <section id="airing-this-week" className="relative">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <Calendar className="w-7 h-7 text-indigo-500" />
                                    <h2 className="text-2xl sm:text-3xl font-black">Airing This Week</h2>
                                </div>
                            </div>
                            <Carousel items={airingThisWeek} />
                        </section>
                    )
                }

                {/* K-Drama Collection */}
                {
                    KoreanTV && KoreanTV.length > 0 && (
                        <section id="korean-tv" className="bg-gradient-to-br from-purple-900/10 to-pink-900/10 p-4 sm:p-6 lg:p-8 rounded-2xl border border-purple-500/10">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">🇰🇷</span>
                                    <h2 className="text-2xl sm:text-3xl font-black">K-Drama Collection</h2>
                                </div>
                            </div>
                            <Carousel items={KoreanTV} />
                        </section>
                    )
                }

                {/* Community Activity */}
                {
                    popularTV && topRatedTV && TVTrailer && (
                        <section className="relative">
                            <div className="flex items-center gap-3 mb-6">
                                <TrendingUp className="w-7 h-7 text-green-500" />
                                <h2 className="text-2xl sm:text-3xl font-black">Community Activity</h2>
                            </div>

                            {/* Use a static mapping of Tailwind classes (build-time safe) */}
                            {(() => {
                                const colorStyles: Record<
                                    string,
                                    { gradient: string; border: string; iconBg: string; iconColor: string; hoverText: string }
                                > = {
                                    green: {
                                        gradient: "from-green-900/20 to-green-900/10",
                                        border: "border-green-500/20",
                                        iconBg: "bg-green-500/20",
                                        iconColor: "text-green-500",
                                        hoverText: "group-hover:text-green-400",
                                    },
                                    blue: {
                                        gradient: "from-blue-900/20 to-blue-900/10",
                                        border: "border-blue-500/20",
                                        iconBg: "bg-blue-500/20",
                                        iconColor: "text-blue-500",
                                        hoverText: "group-hover:text-blue-400",
                                    },
                                    orange: {
                                        gradient: "from-orange-900/20 to-orange-900/10",
                                        border: "border-orange-500/20",
                                        iconBg: "bg-orange-500/20",
                                        iconColor: "text-orange-500",
                                        hoverText: "group-hover:text-orange-400",
                                    },
                                };

                                const groups = [
                                    { title: "Most Viewed", data: popularTV, color: "green", icon: <TrendingUp className="w-4 h-4" /> },
                                    { title: "Most Saved", data: topRatedTV, color: "blue", icon: <Bookmark className="w-4 h-4" /> },
                                    { title: "Hot Discussions", data: TVTrailer, color: "orange", icon: <Flame className="w-4 h-4" /> },
                                ];

                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                                        {groups.map((section, sectionIdx) => {
                                            const styles = colorStyles[section.color];
                                            return (
                                                <div key={sectionIdx} className={`rounded-xl p-4 sm:p-6 border ${styles.border} bg-gradient-to-br ${styles.gradient}`}>
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <div className={`${styles.iconBg} w-8 h-8 rounded-lg flex items-center justify-center ${styles.iconColor}`}>
                                                            {section.icon}
                                                        </div>
                                                        <h3 className="font-bold">{section.title}</h3>
                                                    </div>

                                                    <ul className="space-y-3">
                                                        {section.data.slice(0, 5).map((show, idx) => (
                                                            <li key={show.id}>
                                                                <Link href={`/tv/${show.id}`}>
                                                                    <div className="flex items-start gap-3 group">
                                                                        <div className={`${styles.iconColor} text-2xl font-black w-6 flex-shrink-0`}>{idx + 1}</div>

                                                                        <div className="relative w-12 h-16 rounded overflow-hidden flex-shrink-0">
                                                                            {show.poster_path ? (
                                                                                <Image src={getPosterUrl(show.poster_path)} alt={show.title || show.name || ""} fill className="object-cover" />
                                                                            ) : (
                                                                                <div className="bg-zinc-800 w-full h-full" />
                                                                            )}
                                                                        </div>

                                                                        <div className="flex-1 min-w-0">
                                                                            <div className={`font-semibold text-sm truncate ${styles.hoverText} transition-colors`}>
                                                                                {show.title || show.name}
                                                                            </div>

                                                                            {show.overview && (
                                                                                <p className="text-xs text-gray-300 line-clamp-2 mt-1 mb-2 leading-relaxed">
                                                                                    {show.overview}
                                                                                </p>
                                                                            )}

                                                                            <div className="flex items-center justify-between text-xs text-gray-400">
                                                                                <div>{show.first_air_date ? new Date(show.first_air_date).getFullYear() : "TBA"}</div>
                                                                                <div className="flex items-center gap-1">
                                                                                    <Star className="w-3 h-3 text-yellow-400" />
                                                                                    <span className="font-bold text-white">{show.vote_average && show.vote_average > 0 ? show.vote_average.toFixed(1) : "New"}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </Link>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </section>
                    )
                }

                {NewTVTrailer?.length > 0 && (
                    <ComingSoonSection
                        title="Premiering Soon"
                        items={NewTVTrailer}
                        type="tv"
                    />
                )}
                {moods && moods.length > 0 && (
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ">
                        <MoodRecommendationsSection moods={moods} mediaType="tv" />
                    </div>
                )}
            </div >
        </main >
    )
};
