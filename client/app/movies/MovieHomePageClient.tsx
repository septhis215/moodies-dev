// Enhanced Movies Homepage - MovieHomePageClient.tsx
'use client';

import React, { useState, useEffect } from 'react';
import type { All } from '@/types/all';
import type { ReviewItem } from '@/components/sections/CommunityPicks';
import { Star, Plus, Info, ChevronRight, ChevronLeft, Flame, Calendar, Heart, Share2, Bookmark, Film, Award, Ticket, MessageSquare, Globe, Users, Sparkles, Trophy } from 'lucide-react';
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

    const MovieCard = ({ movie, showRank }: { movie: All; showRank?: number }) => (
        <div className="group relative">
            <Link href={`/movies/${movie.id}`} className="block">
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900">
                    <Image
                        src={getPosterUrl(movie.poster_path)}
                        alt={movie.title || ""}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                    />

                    {showRank !== undefined && (
                        <div className="absolute top-3 left-3 w-10 h-10 bg-[#e94f37] rounded-full flex items-center justify-center font-black text-lg shadow-xl">
                            {showRank}
                        </div>
                    )}

                    <div className="absolute top-3 right-3 bg-black/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-bold">{movie.vote_average?.toFixed(1)}</span>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                            <div className="flex gap-2 justify-center mb-2">
                                <button
                                    onClick={(e) => { e.preventDefault(); }}
                                    className="w-9 h-9 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                                    title="Add to Watchlist"
                                >
                                    <Plus className="w-4 h-4 text-black" />
                                </button>
                                <button
                                    className="w-8 h-8 bg-white/95 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                    title="More Info"
                                >
                                    <Info className="w-4 h-4 text-black" />
                                </button>
                                <button
                                    onClick={(e) => { e.preventDefault(); }}
                                    className="w-9 h-9 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                                    title="Share"
                                >
                                    <Share2 className="w-4 h-4 text-black" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-2">
                    <h4 className="font-bold text-sm line-clamp-2 group-hover:text-[#e94f37] transition-colors">
                        {movie.title}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">{movie.release_date?.split('-')[0]}</p>
                </div>
            </Link>
        </div>
    );

    const Carousel = ({ items, showRanks = false }: { items: All[]; showRanks?: boolean }) => {
        const [startIdx, setStartIdx] = useState(0);
        const [perView, setPerView] = useState(6);

        useEffect(() => {
            const updateLayout = () => {
                const w = window.innerWidth;
                setPerView(w < 640 ? 2 : w < 768 ? 3 : w < 1024 ? 4 : w < 1280 ? 5 : 6);
            };
            updateLayout();
            window.addEventListener("resize", updateLayout);
            return () => window.removeEventListener("resize", updateLayout);
        }, []);

        const canScrollLeft = startIdx > 0;
        const canScrollRight = startIdx < items.length - perView;

        return (
            <div className="relative group/carousel">
                {canScrollLeft && (
                    <button
                        onClick={() => setStartIdx(Math.max(0, startIdx - perView))}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-12 h-12 bg-black/90 rounded-full flex items-center justify-center hover:bg-[#e94f37] transition-all opacity-0 group-hover/carousel:opacity-100"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                )}

                {canScrollRight && (
                    <button
                        onClick={() => setStartIdx(Math.min(items.length - perView, startIdx + perView))}
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-12 h-12 bg-black/90 rounded-full flex items-center justify-center hover:bg-[#e94f37] transition-all opacity-0 group-hover/carousel:opacity-100"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {items.slice(startIdx, startIdx + perView).map((item, idx) => (
                        <MovieCard key={item.id} movie={item} showRank={showRanks ? startIdx + idx + 1 : undefined} />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <main className="bg-[#070707] text-white min-h-screen">
            {/* Enhanced Movie Hub Hero */}
            <section
                className="relative w-full bg-gradient-to-b from-zinc-900 to-black text-white overflow-hidden"
            >
                {/* Top gradient for navbar readability */}
                <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-10" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 relative z-20 mt-14">
                    {/* Content grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                        {/* LEFT mosaic */}
                        <div className="md:col-span-7 col-span-1 rounded-2xl overflow-hidden bg-[#070707] p-4 flex flex-col">

                            {/* Heading inside the panel */}
                            <div className="mb-4">
                                <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight bg-gradient-to-r from-[#e94f37] via-orange-400 to-yellow-300 bg-clip-text text-transparent">
                                    Movies Hub
                                </h1>
                                <p className="text-gray-400 text-xs sm:text-sm mt-1">
                                    Click a poster to feature it →
                                </p>
                            </div>

                            <div className="relative flex-1 w-full h-full rounded-lg overflow-hidden">
                                {/* mosaic grid of posters */}
                                <div className="absolute inset-0 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 p-2 animate-mosaic">
                                    {Array.from({ length: 18 }).map((_, i) => {
                                        const s = heroMovies[(index + i) % heroMovies.length] || {};
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
                                                    <span className="text-xs font-bold">{featured.vote_average.toFixed(1)}</span>
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
                                            <Link href={`/movies/${featured?.id}`} className="flex-1">
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


            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">

                {/* Box Office */}
                {popularMovies.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-8">
                            <Ticket className="w-8 h-8 text-amber-500" />
                            <h2 className="text-3xl sm:text-4xl font-black">Box Office Hits</h2>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {popularMovies.slice(0, 4).map((movie, idx) => (
                                <Link key={movie.id} href={`/movies/${movie.id}`}>
                                    <div className="group relative h-64 rounded-2xl overflow-hidden bg-zinc-900">
                                        {movie.backdrop_path && (
                                            <>
                                                <Image
                                                    src={getImageUrl(movie.backdrop_path)}
                                                    alt={movie.title || ""}
                                                    fill
                                                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
                                            </>
                                        )}

                                        <div className="absolute inset-0 p-6 flex flex-col justify-end">
                                            <div className="text-7xl font-black text-white/10 absolute top-6 right-6">#{idx + 1}</div>
                                            <h3 className="text-2xl font-black mb-2 group-hover:text-[#e94f37] transition-colors">
                                                {movie.title}
                                            </h3>
                                            <div className="flex items-center gap-3 text-sm">
                                                <div className="flex items-center gap-1">
                                                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                                    <span className="font-bold">{movie.vote_average?.toFixed(1)}</span>
                                                </div>
                                                <span className="text-gray-300">{movie.release_date?.split('-')[0]}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* New Releases - Fixed Grid */}
                {movieTrailers.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-8">
                            <Sparkles className="w-8 h-8 text-cyan-400" />
                            <h2 className="text-3xl sm:text-4xl font-black">New Releases</h2>
                        </div>

                        <div className="grid grid-cols-12 gap-4">
                            {/* Large Featured - Left side */}
                            {movieTrailers[0] && (
                                <Link href={`/movies/${movieTrailers[0].id}`} className="col-span-12 lg:col-span-8 group">
                                    <div className="relative h-80 lg:h-96 rounded-2xl overflow-hidden bg-zinc-900">
                                        {movieTrailers[0].backdrop_path && (
                                            <>
                                                <Image
                                                    src={getImageUrl(movieTrailers[0].backdrop_path)}
                                                    alt={movieTrailers[0].title || ""}
                                                    fill
                                                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
                                            </>
                                        )}

                                        <div className="absolute bottom-0 left-0 right-0 p-8">
                                            <span className="inline-block px-3 py-1.5 bg-cyan-500 rounded-lg text-sm font-bold mb-3">NEW</span>
                                            <h3 className="text-3xl font-black mb-3 line-clamp-2">{movieTrailers[0].title}</h3>
                                            <p className="text-gray-200 line-clamp-2 mb-4 max-w-2xl">{movieTrailers[0].overview}</p>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-1.5">
                                                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                                                    <span className="font-bold">{movieTrailers[0].vote_average?.toFixed(1)}</span>
                                                </div>
                                                <span className="text-gray-300">{movieTrailers[0].release_date}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            )}

                            {/* Right Side - Stacked Cards */}
                            <div className="col-span-12 lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
                                {movieTrailers.slice(1, 3).map((movie) => (
                                    <Link key={movie.id} href={`/movies/${movie.id}`} className="group">
                                        <div className="relative h-40 lg:h-[182px] rounded-xl overflow-hidden bg-zinc-900">
                                            {movie.backdrop_path && (
                                                <>
                                                    <Image
                                                        src={getImageUrl(movie.backdrop_path)}
                                                        alt={movie.title || ""}
                                                        fill
                                                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                                                </>
                                            )}

                                            <div className="absolute bottom-0 left-0 right-0 p-4">
                                                <h4 className="text-lg font-bold mb-1 line-clamp-1 group-hover:text-cyan-400 transition-colors">
                                                    {movie.title}
                                                </h4>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <div className="flex items-center gap-1">
                                                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                                        <span className="font-bold">{movie.vote_average?.toFixed(1)}</span>
                                                    </div>
                                                    <span className="text-gray-400">{movie.release_date?.split('-')[0]}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Additional New Releases */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
                            {movieTrailers.slice(3, 9).map((movie) => (
                                <MovieCard key={movie.id} movie={movie} />
                            ))}
                        </div>
                    </section>
                )}

                {/* Trending with Ranks */}
                {trendingMovies.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-8">
                            <Flame className="w-8 h-8 text-[#e94f37]" />
                            <h2 className="text-3xl sm:text-4xl font-black">Trending Now</h2>
                        </div>
                        <Carousel items={trendingMovies} showRanks={true} />
                    </section>
                )}

                {/* Top Rated
                {topRatedMovies.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-8">
                            <Trophy className="w-8 h-8 text-yellow-500" />
                            <h2 className="text-3xl sm:text-4xl font-black">All-Time Greats</h2>
                        </div>
                        <Carousel items={topRatedMovies} />
                    </section>
                )} */}

                {/* Korean Cinema */}
                {koreanMovies.length > 0 && (
                    <section className="bg-zinc-950 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-12 rounded-3xl border border-white/5">
                        <div className="flex items-center gap-3 mb-8">
                            <Globe className="w-8 h-8 text-rose-400" />
                            <h2 className="text-3xl sm:text-4xl font-black">Korean Cinema</h2>
                        </div>
                        <Carousel items={koreanMovies} />
                    </section>
                )}

                {/* Enhanced Community Activity */}
                <section>
                    <div className="flex items-center gap-3 mb-8">
                        <Users className="w-8 h-8 text-purple-400" />
                        <h2 className="text-3xl sm:text-4xl font-black">Community Pulse</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                                title: "Most Saved",
                                data: popularMovies,
                                icon: <Bookmark className="w-5 h-5" />,
                                gradient: "from-pink-500/20 to-pink-500/5",
                                border: "border-pink-500/20",
                                iconBg: "bg-pink-500/20",
                                textColor: "text-pink-400",
                                hoverColor: "hover:text-pink-400",
                                statLabel: "saves"
                            },
                            {
                                title: "Hot Discussions",
                                data: movieTrailers,
                                icon: <MessageSquare className="w-5 h-5" />,
                                gradient: "from-orange-500/20 to-orange-500/5",
                                border: "border-orange-500/20",
                                iconBg: "bg-orange-500/20",
                                textColor: "text-orange-400",
                                hoverColor: "hover:text-orange-400",
                                statLabel: "comments"
                            },
                            {
                                title: "Rising Stars",
                                data: trendingMovies,
                                icon: <Sparkles className="w-5 h-5" />,
                                gradient: "from-cyan-500/20 to-cyan-500/5",
                                border: "border-cyan-500/20",
                                iconBg: "bg-cyan-500/20",
                                textColor: "text-cyan-400",
                                hoverColor: "hover:text-cyan-400",
                                statLabel: "views"
                            },
                        ].map((section, idx) => (
                            <div key={idx} className={`bg-gradient-to-br ${section.gradient} border ${section.border} rounded-2xl p-6`}>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className={`w-10 h-10 ${section.iconBg} rounded-xl flex items-center justify-center ${section.textColor}`}>
                                        {section.icon}
                                    </div>
                                    <h3 className="font-bold text-lg">{section.title}</h3>
                                </div>

                                <div className="space-y-4">
                                    {section.data.slice(0, 5).map((m, i) => (
                                        <Link key={m.id} href={`/movies/${m.id}`} className="flex items-center gap-3 group">
                                            <span className={`text-3xl font-black ${section.textColor} opacity-30 w-8`}>{i + 1}</span>
                                            <div className="relative w-12 h-16 rounded-lg overflow-hidden flex-shrink-0">
                                                {m.poster_path && <Image src={getPosterUrl(m.poster_path)} alt="" fill className="object-cover" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-bold text-sm line-clamp-1 ${section.hoverColor} transition-colors`}>
                                                    {m.title}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {section.statLabel === "saves" && `${Math.floor(Math.random() * 3000) + 500} ${section.statLabel}`}
                                                    {section.statLabel === "comments" && `${Math.floor(Math.random() * 200) + 50} ${section.statLabel}`}
                                                    {section.statLabel === "views" && `${Math.floor(Math.random() * 5000) + 1000} ${section.statLabel}`}
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
                        type="movie"
                    />
                )}

                {/* Critics Corner */}
                {movieReviews.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-8">
                            <Heart className="w-8 h-8 text-rose-400" />
                            <h2 className="text-3xl sm:text-4xl font-black">Critics Corner</h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {movieReviews.slice(0, 6).map((review, idx) => (
                                <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:border-rose-500/30 transition-all">
                                    <div className="flex items-start gap-3 mb-4">
                                        <div className="w-10 h-10 bg-rose-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                                            <Heart className="w-5 h-5 text-rose-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-sm line-clamp-1">{review.title || review.name}</h4>
                                            <div className="flex items-center gap-1 mt-1">
                                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                                <span className="text-xs font-bold">{review.rating?.toFixed(1) || "—"}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-400 line-clamp-4 leading-relaxed">
                                        "{review.quote || "No review available"}"
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
                {/* Action-Packed - Split Hero Layout */}
                {actionMovies.length > 0 && (
                    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-900/20 via-orange-900/20 to-black border border-red-500/20">
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNjAgMTAgTSAxMCAwIEwgMTAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30" />

                        <div className="relative p-8 sm:p-12">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/30">
                                    <Film className="w-7 h-7 text-red-400" />
                                </div>
                                <div>
                                    <h2 className="text-3xl sm:text-4xl font-black text-red-400">Action-Packed</h2>
                                    <p className="text-sm text-gray-400 mt-1">High-octane thrillers</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Featured Large */}
                                {actionMovies[0] && (
                                    <Link href={`/movies/${actionMovies[0].id}`} className="lg:col-span-2 group">
                                        <div className="relative h-80 rounded-2xl overflow-hidden bg-black">
                                            {actionMovies[0].backdrop_path && (
                                                <>
                                                    <Image
                                                        src={getImageUrl(actionMovies[0].backdrop_path)}
                                                        alt={actionMovies[0].title || ""}
                                                        fill
                                                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                                                </>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 p-6">
                                                <div className="inline-block px-3 py-1 bg-red-500 rounded-lg text-xs font-bold mb-3">ACTION</div>
                                                <h3 className="text-2xl font-black mb-2 line-clamp-2">{actionMovies[0].title}</h3>
                                                <p className="text-gray-300 text-sm line-clamp-2 mb-3">{actionMovies[0].overview}</p>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1">
                                                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                                        <span className="font-bold">{actionMovies[0].vote_average?.toFixed(1)}</span>
                                                    </div>
                                                    <span className="text-gray-400">{actionMovies[0].release_date?.split('-')[0]}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                )}

                                {/* Side List */}
                                <div className="space-y-4">
                                    {actionMovies.slice(1, 5).map((movie, idx) => (
                                        <Link key={movie.id} href={`/movies/${movie.id}`} className="group flex gap-3 bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-red-500/20 hover:border-red-500/50 transition-all">
                                            <div className="relative w-16 h-20 rounded-lg overflow-hidden flex-shrink-0">
                                                {movie.poster_path && (
                                                    <Image
                                                        src={getPosterUrl(movie.poster_path)}
                                                        alt={movie.title || ""}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-red-400 font-black text-lg mb-1">#{idx + 2}</div>
                                                <h4 className="font-bold text-sm line-clamp-2 group-hover:text-red-400 transition-colors">{movie.title}</h4>
                                                <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                                                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                                    <span>{movie.vote_average?.toFixed(1)}</span>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            {/* More Action Movies */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
                                {actionMovies.slice(5, 11).map((movie) => (
                                    <MovieCard key={movie.id} movie={movie} />
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* Award Winners - Prestige Layout */}
                {awardWinners.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/30">
                                <Award className="w-7 h-7 text-amber-400" />
                            </div>
                            <div>
                                <h2 className="text-3xl sm:text-4xl font-black text-amber-400">Award Winners</h2>
                                <p className="text-sm text-gray-400 mt-1">Critically acclaimed masterpieces</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {awardWinners.slice(0, 8).map((movie, idx) => (
                                <Link key={movie.id} href={`/movies/${movie.id}`} className="group">
                                    <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900">
                                        {movie.poster_path && (
                                            <Image
                                                src={getPosterUrl(movie.poster_path)}
                                                alt={movie.title || ""}
                                                fill
                                                className="object-cover group-hover:scale-110 transition-transform duration-700"
                                            />
                                        )}

                                        {/* Award Badge */}
                                        <div className="absolute top-3 left-3 w-12 h-12 bg-amber-400 rounded-full flex items-center justify-center shadow-xl">
                                            <Award className="w-6 h-6 text-black" />
                                        </div>

                                        {/* Rating */}
                                        <div className="absolute top-3 right-3 bg-black/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-amber-400/50">
                                            <div className="flex items-center gap-1">
                                                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                                <span className="text-sm font-black">{movie.vote_average?.toFixed(1)}</span>
                                            </div>
                                        </div>

                                        {/* Hover Info */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="absolute bottom-0 left-0 right-0 p-4">
                                                <div className="text-amber-400 text-xs font-bold mb-1">AWARD WINNER</div>
                                                <h4 className="font-bold text-sm line-clamp-2 mb-2">{movie.title}</h4>
                                                <div className="text-xs text-gray-400">{movie.release_date?.split('-')[0]}</div>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Animated Features - Playful Grid */}
                {animatedMovies.length > 0 && (
                    <section className="bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-blue-900/20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-12 rounded-3xl border border-purple-500/20">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center border border-purple-500/30">
                                <Sparkles className="w-7 h-7 text-purple-400" />
                            </div>
                            <div>
                                <h2 className="text-3xl sm:text-4xl font-black text-purple-400">Animated Magic</h2>
                                <p className="text-sm text-gray-400 mt-1">For all ages</p>
                            </div>
                        </div>

                        {/* Featured Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                            {animatedMovies.slice(0, 4).map((movie) => (
                                <Link key={movie.id} href={`/movies/${movie.id}`} className="group">
                                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-900 border-2 border-purple-500/30 hover:border-purple-400 transition-all">
                                        {movie.poster_path && (
                                            <Image
                                                src={getPosterUrl(movie.poster_path)}
                                                alt={movie.title || ""}
                                                fill
                                                className="object-cover group-hover:scale-110 transition-transform duration-700"
                                            />
                                        )}

                                        {/* Playful Badge */}
                                        <div className="absolute top-2 right-2 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center animate-pulse">
                                            <Sparkles className="w-4 h-4 text-white" />
                                        </div>

                                        <div className="absolute inset-0 bg-gradient-to-t from-purple-900/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="absolute bottom-0 left-0 right-0 p-3">
                                                <h4 className="font-bold text-sm line-clamp-2 mb-1">{movie.title}</h4>
                                                <div className="flex items-center gap-1 text-xs">
                                                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                                    <span className="font-bold">{movie.vote_average?.toFixed(1)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>

                        {/* Rest in carousel */}
                        <Carousel items={animatedMovies.slice(4)} />
                    </section>
                )}

                {/* Indie Spotlight - Artistic Layout */}
                {indieMovies.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                                <Film className="w-7 h-7 text-indigo-400" />
                            </div>
                            <div>
                                <h2 className="text-3xl sm:text-4xl font-black text-indigo-400">Indie Spotlight</h2>
                                <p className="text-sm text-gray-400 mt-1">Hidden gems & festival favorites</p>
                            </div>
                        </div>

                        {/* Masonry-style Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {indieMovies.slice(0, 8).map((movie, idx) => {
                                // Create varied heights for masonry effect
                                const heights = ['h-72', 'h-64', 'h-80', 'h-64', 'h-72', 'h-80', 'h-64', 'h-72'];
                                return (
                                    <Link
                                        key={movie.id}
                                        href={`/movies/${movie.id}`}
                                        className="group"
                                    >
                                        <div className={`relative ${heights[idx % heights.length]} rounded-2xl overflow-hidden bg-zinc-900 border border-indigo-500/20 hover:border-indigo-400/50 transition-all`}>
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
                                            <div className="absolute top-3 left-3 px-2 py-1 bg-indigo-500/90 backdrop-blur-sm rounded-md text-xs font-bold">
                                                INDIE
                                            </div>

                                            {/* Info on hover */}
                                            <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                                <h4 className="font-bold text-sm line-clamp-2 mb-2">{movie.title}</h4>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <div className="flex items-center gap-1">
                                                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                                        <span className="font-bold">{movie.vote_average?.toFixed(1)}</span>
                                                    </div>
                                                    <span className="text-gray-400">{movie.release_date?.split('-')[0]}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                )}
                {moods && moods.length > 0 && (
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
                        <MoodRecommendationsSection moods={moods} mediaType="movie" />
                    </div>
                )}
            </div>
        </main>
    );
} 