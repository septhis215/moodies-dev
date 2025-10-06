// Enhanced Movies Homepage - MovieHomePageClient.tsx
'use client';

import React, { useState, useEffect } from 'react';
import type { All } from '@/types/all';
import type { ReviewItem } from '@/components/sections/CommunityPicks';
import { Star, Plus, Info, ChevronRight, ChevronLeft, Flame, Calendar, Heart, Share2, Bookmark, Film, Award, Ticket, MessageSquare, Globe, Users, Sparkles, Trophy, Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from "framer-motion";
import { ComingSoonSection } from '@/components/sections/ComingSoon';
import MoodRecommendationsSection from '@/components/sections/MoodRecommendationSection';

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
    const [featured, setFeatured] = useState(trendingMovies[0]);
    const [index, setIndex] = useState(0);
    const heroMovies = trendingMovies.slice(0, 18);

    const getImageUrl = (path?: string) =>
        path ? `https://image.tmdb.org/t/p/original${path}` : "/placeholder.jpg";
    const getPosterUrl = (path?: string) =>
        path ? `https://image.tmdb.org/t/p/w500${path}` : "/placeholder.jpg";

    useEffect(() => {
        if (!heroMovies.length) return;
        const id = setInterval(() => setIndex((i) => (i + 1) % heroMovies.length), 5000);
        return () => clearInterval(id);
    }, [heroMovies.length]);

    const MovieCard = ({ movie, size = "default" }: { movie: All; size?: "default" | "large" | "wide" }) => {
        const isWide = size === "wide";
        const isLarge = size === "large";

        return (
            <div className="group relative h-full">
                <Link href={`/movies/${movie.id}`} className="block h-full">
                    <div
                        className={`relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-xl ring-1 ring-white/5 ${isWide ? "aspect-video" : "aspect-[2/3]"
                            }`}
                    >
                        <Image
                            src={isWide ? getImageUrl(movie.backdrop_path) : getPosterUrl(movie.poster_path)}
                            alt={movie.title || movie.name || ""}
                            fill
                            className="group-hover:scale-110 transition-transform duration-700 object-cover"
                        />

                        {/* Gradient overlay for depth */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        {/* Rating Badge */}
                        <div className="absolute top-3 right-3 bg-black/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg ring-1 ring-white/10">
                            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                            {movie.vote_average?.toFixed(1)}
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
                            {movie.title || movie.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                            {movie.first_air_date && <span className="font-semibold">{movie.first_air_date.split("-")[0]}</span>}
                            {movie.number_of_seasons && (
                                <>
                                    <span>•</span>
                                    <span className="font-semibold">{movie.number_of_seasons} Season{movie.number_of_seasons > 1 ? 's' : ''}</span>
                                </>
                            )}
                        </div>
                    </div>
                </Link>
            </div>
        );
    };

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
                        <MovieCard key={item.id} movie={item} />
                    ))}
                </div>
            </div>
        );
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

                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 relative z-20 mt-14">
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
                                <p className="text-gray-400 text-sm ml-11 font-medium">
                                    Click any poster to feature it
                                </p>
                            </div>

                            <div className="relative flex-1 w-full h-full rounded-2xl overflow-hidden ring-1 ring-white/5">
                                <div className="absolute inset-0 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 p-3">
                                    {Array.from({ length: 18 }).map((_, i) => {
                                        const s = heroMovies[(index + i) % heroMovies.length] || {};
                                        const isActive = featured?.id === s.id;

                                        return (
                                            <button
                                                key={i}
                                                onClick={() => setFeatured(s)}
                                                className={`rounded-xl overflow-hidden border-2 transform transition-all duration-300
                                                hover:scale-105 hover:z-10 focus:outline-none
                                                ${isActive
                                                        ? "border-[#e94f37] ring-4 ring-[#e94f37]/50 scale-105 shadow-2xl shadow-[#e94f37]/30"
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
                                            {featured?.vote_average && (
                                                <div className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full ring-1 ring-amber-500/30">
                                                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                                    <span className="text-xs font-bold text-white">{featured.vote_average > 0 ? featured.vote_average.toFixed(1) : "New"}</span>
                                                </div>
                                            )}
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
                                            <button className="px-6 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-105">
                                                <Plus className="w-5 h-5" />
                                            </button>
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
                    <section className="relative">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="relative">
                                <div className="absolute inset-0 bg-amber-500 blur-xl opacity-50" />
                                <Ticket className="relative w-9 h-9 text-amber-400" />
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-black text-white">Box Office Hits</h2>
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
                                            <div className="text-8xl font-black text-white/5 absolute top-6 right-6">#{idx + 1}</div>
                                            <h3 className="text-3xl font-black mb-3 group-hover:text-[#e94f37] transition-colors text-white">
                                                {movie.title}
                                            </h3>
                                            <div className="flex items-center gap-4 text-sm">
                                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 backdrop-blur-sm rounded-full">
                                                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                                    <span className="font-bold text-white">{movie.vote_average && movie.vote_average > 0 ? movie.vote_average.toFixed(1) : "New"}</span>
                                                </div>
                                                <span className="text-gray-300 font-semibold">{movie.release_date?.split('-')[0]}</span>
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
                    <section className="relative">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="relative">
                                <div className="absolute inset-0 bg-cyan-400 blur-xl opacity-50" />
                                <Sparkles className="relative w-9 h-9 text-cyan-400" />
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-black text-white">New Releases</h2>
                        </div>

                        <div className="grid grid-cols-12 gap-5">
                            {newReleaseMovies[0] && (
                                <Link href={`/movies/${newReleaseMovies[0].id}`} className="col-span-12 lg:col-span-8 group">
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
                                            <h3 className="text-4xl font-black mb-4 line-clamp-2 text-white">{newReleaseMovies[0].title}</h3>
                                            <p className="text-gray-200 line-clamp-2 mb-6 max-w-3xl text-lg leading-relaxed">
                                                {newReleaseMovies[0].overview}
                                            </p>
                                            <div className="flex items-center gap-6">
                                                <div className="flex items-center gap-2">
                                                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                                                    <span className="font-bold text-lg text-white">{newReleaseMovies[0].vote_average && newReleaseMovies[0].vote_average > 0 ? newReleaseMovies[0].vote_average.toFixed(1) : "New"}</span>
                                                </div>
                                                <span className="text-gray-300 font-semibold">{newReleaseMovies[0].release_date}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            )}

                            <div className="col-span-12 lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-5">
                                {newReleaseMovies.slice(1, 3).map((movie) => (
                                    <Link key={movie.id} href={`/movies/${movie.id}`} className="group">
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
                                                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                                        <span className="font-bold text-white">{movie.vote_average && movie.vote_average > 0 ? movie.vote_average.toFixed(1) : "New"}</span>
                                                    </div>
                                                    <span className="text-gray-400 font-semibold">{movie.release_date?.split('-')[0]}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 mt-6">
                            {newReleaseMovies.slice(3, 9).map((movie) => (
                                <MovieCard key={movie.id} movie={movie} />
                            ))}
                        </div>
                    </section>
                )}

                {/* Trending */}
                {trendingMovies.length > 0 && (
                    <section className="relative">
                        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                            <div className="relative">
                                <div className="absolute inset-0 bg-[#e94f37] blur-xl opacity-50" />
                                <Flame className="relative w-7 h-7 sm:w-8 sm:h-8 text-[#e94f37]" />
                            </div>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white">Trending Now</h2>
                        </div>
                        <Carousel items={trendingMovies} />
                    </section>
                )}

                {/* Korean Cinema */}
                {koreanMovies.length > 0 && (
                    <section className="relative bg-gradient-to-br from-rose-950/30 via-pink-950/20 to-transparent backdrop-blur-sm p-5 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl border border-rose-500/20 ring-1 ring-white/5 shadow-2xl overflow-hidden">
                        <div className="absolute top-0 left-0 w-64 sm:w-80 lg:w-96 h-64 sm:h-80 lg:h-96 bg-rose-500/10 rounded-full blur-3xl" />

                        <div className="relative flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                            <div className="text-3xl sm:text-4xl lg:text-5xl">🇰🇷</div>
                            <div>
                                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white">Korean Cinema</h2>
                                <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1 font-medium">Award-winning storytelling</p>
                            </div>
                        </div>
                        <Carousel items={koreanMovies} />
                    </section>
                )}

                {/* Enhanced Community Activity */}
                <section className="relative">
                    <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                        <div className="relative">
                            <div className="absolute inset-0 bg-purple-500 blur-xl opacity-50" />
                            <Users className="relative w-7 h-7 sm:w-8 sm:h-8 text-purple-400" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white">Community Pulse</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                        {[
                            {
                                title: "Most Saved",
                                data: popularMovies,
                                icon: <Bookmark className="w-4 h-4 sm:w-5 sm:h-5" />,
                                gradient: "from-pink-950/40 to-pink-950/20",
                                border: "border-pink-500/30",
                                iconBg: "bg-pink-500/20",
                                textColor: "text-pink-400",
                                hoverColor: "group-hover:text-pink-400",
                            },
                            {
                                title: "Hot Discussions",
                                data: movieTrailers,
                                icon: <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />,
                                gradient: "from-orange-950/40 to-orange-950/20",
                                border: "border-orange-500/30",
                                iconBg: "bg-orange-500/20",
                                textColor: "text-orange-400",
                                hoverColor: "group-hover:text-orange-400",
                            },
                            {
                                title: "Rising Stars",
                                data: trendingMovies,
                                icon: <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />,
                                gradient: "from-cyan-950/40 to-cyan-950/20",
                                border: "border-cyan-500/30",
                                iconBg: "bg-cyan-500/20",
                                textColor: "text-cyan-400",
                                hoverColor: "group-hover:text-cyan-400",
                            },
                        ].map((section, idx) => (
                            <div key={idx} className={`bg-gradient-to-br ${section.gradient} border ${section.border} rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 backdrop-blur-sm ring-1 ring-white/5 shadow-xl`}>
                                <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5 lg:mb-6">
                                    <div className={`w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 ${section.iconBg} rounded-lg sm:rounded-xl flex items-center justify-center ${section.textColor} ring-1 ring-white/10`}>
                                        {section.icon}
                                    </div>
                                    <h3 className="font-black text-base sm:text-lg text-white">{section.title}</h3>
                                </div>

                                <div className="space-y-3 sm:space-y-4">
                                    {section.data.slice(0, 5).map((m, i) => (
                                        <Link key={m.id} href={`/movies/${m.id}`} className="flex items-center gap-2 sm:gap-3 group">
                                            <span className={`text-2xl sm:text-3xl font-black ${section.textColor} opacity-30 w-6 sm:w-8`}>{i + 1}</span>
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
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-bold text-xs sm:text-sm text-white line-clamp-1 ${section.hoverColor} transition-colors`}>
                                                    {m.title}
                                                </div>
                                                <div className="flex items-center justify-between text-[10px] sm:text-xs mt-1 sm:mt-1.5">
                                                    <span className="text-gray-500 font-semibold">{m.release_date?.split('-')[0]}</span>
                                                    <div className="flex items-center gap-0.5 sm:gap-1">
                                                        <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-400 fill-yellow-400" />
                                                        <span className="font-bold text-white">{m.vote_average && m.vote_average > 0 ? m.vote_average.toFixed(1) : "New"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
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
                    <section className="relative">
                        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                            <div className="relative">
                                <div className="absolute inset-0 bg-rose-500 blur-xl opacity-50" />
                                <Heart className="relative w-7 h-7 sm:w-8 sm:h-8 text-rose-400" />
                            </div>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white">Critics Corner</h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                            {movieReviews.slice(0, 6).map((review, idx) => (
                                <div key={idx} className="bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 backdrop-blur-sm border border-zinc-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 hover:border-rose-500/50 transition-all ring-1 ring-white/5 shadow-xl">
                                    <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
                                        <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 bg-rose-500/20 rounded-full flex items-center justify-center flex-shrink-0 ring-1 ring-rose-500/30">
                                            <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-xs sm:text-sm line-clamp-1 text-white">{review.title || review.name}</h4>
                                            <div className="flex items-center gap-1 mt-1">
                                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                                <span className="text-xs font-bold text-white">{review.rating?.toFixed(1) || "—"}</span>
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

                {/* ACTION-PACKED - Fixed Layout */}
                {actionMovies.length > 0 && (
                    <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-red-950/40 via-orange-950/30 to-black backdrop-blur-sm border border-red-500/30 ring-1 ring-white/5 shadow-2xl">
                        {/* Background gradients */}
                        <div className="absolute top-0 right-0 w-64 sm:w-80 lg:w-[400px] h-64 sm:h-80 lg:h-[400px] bg-gradient-to-bl from-red-600/20 to-transparent rounded-full blur-3xl animate-pulse" />
                        <div className="absolute bottom-0 left-0 w-48 sm:w-64 lg:w-[350px] h-48 sm:h-64 lg:h-[350px] bg-gradient-to-tr from-orange-600/20 to-transparent rounded-full blur-3xl animate-pulse delay-700" />

                        <div className="relative p-4 sm:p-5 lg:p-6">
                            {/* Section Title */}
                            <div className="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl blur-xl opacity-50" />
                                    <div className="relative w-9 h-9 sm:w-11 sm:h-11 lg:w-12 lg:h-12 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl flex items-center justify-center ring-2 ring-red-500/50">
                                        <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                    </div>
                                </div>
                                <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
                                    Action-Packed
                                </h2>
                            </div>

                            {/* Grid Layout */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
                                {/* Featured Card */}
                                {actionMovies[0] && (
                                    <Link href={`/movies/${actionMovies[0].id}`} className="lg:col-span-2 group">
                                        <div className="relative aspect-[16/9] rounded-xl sm:rounded-2xl overflow-hidden bg-black ring-1 ring-red-500/30 shadow-xl">
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
                                                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold line-clamp-2 text-white group-hover:text-red-400 transition-colors">
                                                    {actionMovies[0].title}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 rounded-full text-xs font-bold">
                                                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                                        {actionMovies[0].vote_average && actionMovies[0].vote_average > 0
                                                            ? actionMovies[0].vote_average.toFixed(1)
                                                            : "New"}
                                                    </div>
                                                    <span className="text-gray-400 text-xs">{actionMovies[0].release_date?.split("-")[0]}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                )}

                                {/* Side List (2–5) */}
                                <div className="space-y-3 sm:space-y-4">
                                    {actionMovies.slice(1, 5).map((movie, idx) => (
                                        <Link key={movie.id} href={`/movies/${movie.id}`} className="group flex gap-3 bg-gradient-to-r from-red-950/60 to-orange-950/40 rounded-xl p-3 hover:border-red-500/60 border border-red-500/30 transition">
                                            <div className="relative w-14 h-18 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-red-500/30">
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
                                                <h4 className="font-bold text-md line-clamp-2 text-white group-hover:text-red-400 transition-colors">
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

                            {/* More Movies (aligned smaller grid) */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 mt-5">
                                {actionMovies.slice(5, 11).map((movie) => (
                                    <MovieCard key={movie.id} movie={movie} />
                                ))}
                            </div>
                        </div>
                    </section>
                )}


                {/* AWARD WINNERS - Prestigious Design */}
                {awardWinners.length > 0 && (
                    <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-950/40 via-yellow-950/30 to-black backdrop-blur-sm border border-amber-500/30 ring-1 ring-white/5 shadow-2xl">
                        {/* Radial golden glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 lg:w-[600px] h-80 sm:h-96 lg:h-[600px] bg-gradient-to-r from-amber-600/20 to-yellow-600/20 rounded-full blur-3xl" />

                        {/* Subtle grid pattern */}
                        <div className="absolute inset-0 opacity-5">
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#fbbf24_1px,transparent_1px),linear-gradient(to_bottom,#fbbf24_1px,transparent_1px)] bg-[size:2rem_2rem]" />
                        </div>

                        <div className="relative p-5 sm:p-6 lg:p-8">
                            <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
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
                                    <p className="text-xs sm:text-sm text-gray-300 mt-1 sm:mt-2 font-semibold hidden sm:block">Critically acclaimed masterpieces</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5 lg:gap-6">
                                {awardWinners.slice(0, 10).map((movie, idx) => (
                                    <Link key={movie.id} href={`/movies/${movie.id}`} className="group">
                                        <div className="relative aspect-[3/4] rounded-xl sm:rounded-2xl overflow-hidden bg-zinc-900 ring-2 ring-amber-500/30 hover:ring-amber-400/60 transition-all shadow-2xl">
                                            {movie.poster_path && (
                                                <>
                                                    <Image
                                                        src={getPosterUrl(movie.poster_path)}
                                                        alt={movie.title || ""}
                                                        fill
                                                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </>
                                            )}

                                            {/* Prominent Award Badge */}
                                            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-full flex items-center justify-center shadow-2xl ring-4 ring-white/20 transform group-hover:scale-110 group-hover:rotate-12 transition-transform">
                                                <Trophy className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" />
                                            </div>

                                            {/* Rating Badge */}
                                            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-black/90 backdrop-blur-md px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border-2 border-amber-400/50 ring-1 ring-white/10 shadow-xl">
                                                <div className="flex items-center gap-0.5 sm:gap-1">
                                                    <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 text-amber-400 fill-amber-400" />
                                                    <span className="text-xs sm:text-sm font-black text-white">{movie.vote_average && movie.vote_average > 0 ? movie.vote_average.toFixed(1) : "New"}</span>
                                                </div>
                                            </div>

                                            {/* Hover Info */}
                                            <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                                <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                                                    <div className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-amber-500 rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wide">Award Winner</div>
                                                </div>
                                                <h4 className="font-bold text-xs sm:text-sm line-clamp-2 mb-1 text-white">{movie.title}</h4>
                                                <div className="text-[10px] sm:text-xs text-gray-400 font-semibold">{movie.release_date?.split('-')[0]}</div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* ANIMATED FEATURES - Playful Design */}
                {animatedMovies.length > 0 && (
                    <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-purple-950/40 via-pink-950/30 to-blue-950/30 backdrop-blur-sm border border-purple-500/30 ring-1 ring-white/5 shadow-2xl">
                        {/* Colorful gradient orbs */}
                        <div className="absolute top-0 left-0 w-64 sm:w-80 lg:w-96 h-64 sm:h-80 lg:h-96 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-full blur-3xl animate-pulse" />
                        <div className="absolute bottom-0 right-0 w-64 sm:w-80 lg:w-96 h-64 sm:h-80 lg:h-96 bg-gradient-to-tl from-blue-600/20 to-cyan-600/20 rounded-full blur-3xl animate-pulse delay-1000" />

                        {/* Dotted pattern */}
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute inset-0" style={{
                                backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                                backgroundSize: '20px 20px'
                            }} />
                        </div>

                        <div className="relative p-5 sm:p-6 lg:p-8">
                            <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
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
                                    <p className="text-xs sm:text-sm text-gray-300 mt-1 sm:mt-2 font-semibold hidden sm:block">Enchanting stories for all ages</p>
                                </div>
                            </div>

                            {/* Featured Row with playful cards */}
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 sm:gap-5 mb-5 sm:mb-6 lg:mb-8">
                                {animatedMovies.slice(0, 5).map((movie, idx) => (
                                    <Link key={movie.id} href={`/movies/${movie.id}`} className="group">
                                        <div className="relative aspect-[3/4] rounded-2xl sm:rounded-3xl overflow-hidden bg-zinc-900 border-2 sm:border-4 border-purple-500/40 hover:border-pink-400/60 transition-all shadow-2xl transform hover:-translate-y-2 hover:rotate-1 duration-300">
                                            {movie.poster_path && (
                                                <>
                                                    <Image
                                                        src={getPosterUrl(movie.poster_path)}
                                                        alt={movie.title || ""}
                                                        fill
                                                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-purple-900/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </>
                                            )}

                                            {/* Sparkle Badge with animation */}
                                            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center animate-bounce shadow-xl ring-4 ring-white/30">
                                                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                            </div>

                                            {/* Info on hover */}
                                            <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                                <h4 className="font-bold text-xs sm:text-sm line-clamp-2 mb-1.5 sm:mb-2 text-white">{movie.title}</h4>
                                                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                                                    <div className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-amber-500/20 backdrop-blur-sm rounded-full">
                                                        <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 fill-amber-400" />
                                                        <span className="font-bold text-white">{movie.vote_average && movie.vote_average > 0 ? movie.vote_average.toFixed(1) : "New"}</span>
                                                    </div>
                                                    <span className="text-gray-400 font-semibold">{movie.release_date?.split('-')[0]}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>

                            {/* Rest in carousel */}
                            {animatedMovies.length > 5 && <Carousel items={animatedMovies.slice(5)} />}
                        </div>
                    </section>
                )}

                {/* INDIE SPOTLIGHT - Artistic Design */}
                {indieMovies.length > 0 && (
                    <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-950/40 via-slate-950/30 to-black backdrop-blur-sm border border-indigo-500/30 ring-1 ring-white/5 shadow-2xl">
                        {/* Artistic gradient */}
                        <div className="absolute top-0 right-0 w-80 sm:w-96 lg:w-[500px] h-80 sm:h-96 lg:h-[500px] bg-gradient-to-bl from-indigo-600/20 to-transparent rounded-full blur-3xl" />

                        {/* Film grain texture effect */}
                        <div className="absolute inset-0 opacity-5">
                            <div className="absolute inset-0" style={{
                                backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
                                backgroundSize: '200px 200px'
                            }} />
                        </div>

                        <div className="relative p-5 sm:p-6 lg:p-8">
                            <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-indigo-500 rounded-xl sm:rounded-2xl blur-xl opacity-50" />
                                    <div className="relative w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl sm:rounded-2xl flex items-center justify-center ring-2 ring-indigo-500/50 shadow-xl">
                                        <Film className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-white" />
                                    </div>
                                </div>
                                <div>
                                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-indigo-400">Indie Spotlight</h2>
                                    <p className="text-xs sm:text-sm text-gray-400 mt-1 font-medium">Hidden gems & festival favorites</p>
                                </div>
                            </div>

                            {/* Masonry-style Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-4">
                                {indieMovies.slice(0, 10).map((movie, idx) => {
                                    return (
                                        <Link
                                            key={movie.id}
                                            href={`/movies/${movie.id}`}
                                            className="group"
                                        >
                                            <div className={`relative aspect-[4/5] rounded-xl sm:rounded-2xl overflow-hidden bg-zinc-900 border border-indigo-500/20 hover:border-indigo-400/50 transition-all shadow-lg`}>
                                                {movie.poster_path && (
                                                    <>
                                                        <Image
                                                            src={getPosterUrl(movie.poster_path)}
                                                            alt={movie.title || ""}
                                                            fill
                                                            className="object-cover group-hover:scale-110 transition-transform duration-700"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                                                    </>
                                                )}

                                                {/* Indie Badge */}
                                                <div className="absolute top-2 left-2 sm:top-3 sm:left-3 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-indigo-500/90 backdrop-blur-sm rounded text-[9px] sm:text-xs font-bold">
                                                    INDIE
                                                </div>

                                                {/* Info on hover */}
                                                <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                                    <h4 className="font-bold text-xs sm:text-sm line-clamp-2 mb-1.5 sm:mb-2 text-white">{movie.title}</h4>
                                                    <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
                                                        <div className="flex items-center gap-0.5 sm:gap-1">
                                                            <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 fill-amber-400" />
                                                            <span className="font-bold text-white">{movie.vote_average && movie.vote_average > 0 ? movie.vote_average.toFixed(1) : "New"}</span>
                                                        </div>
                                                        <span className="text-gray-400 font-semibold">{movie.release_date?.split('-')[0]}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                )}
                {moods && moods.length > 0 && (
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <MoodRecommendationsSection moods={moods} mediaType="movie" />
                    </div>
                )}
            </div>
        </main>
    );
} 