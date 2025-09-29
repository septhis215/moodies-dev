// src/app/tv/page.tsx
import React from 'react';
import type { All } from '@/types/all';
import type { ReviewItem } from '@/components/sections/CommunityPicks';
import { Play, Star, Clock, TrendingUp, Sparkles, Calendar, Users, Plus, Info, ChevronRight } from '@/components/ui/icons';
import CommunityPicks from '@/components/sections/CommunityPicks';
import Image from 'next/image';

async function fetchTrendingTV() {
    const base = process.env.NEST_API_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/tv/featured`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json as All[];
}

async function fetchPopularTV() {
    const base = process.env.NEST_API_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/tv/trending`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json as All[];
}

async function fetchTopRatedTV() {
    const base = process.env.NEST_API_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/tv/favorites`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json as All[];
}

async function fetchTVTrailers() {
    const base = process.env.NEST_API_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/tv/trailers`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json as All[];
}

async function fetchNewTVTrailers() {
    const base = process.env.NEST_API_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/tv/upcoming-trailers`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json as All[];
}

async function fetchKoreanTV() {
    const base = process.env.NEST_API_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/tv/koreaTrending`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json as All[];
}

async function fetchTVReview() {
    const base = process.env.NEST_API_URL;
    const res = await fetch(`${base}/tv/trending-reviews`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json as ReviewItem[];
}

export const metadata = {
    title: 'TV Shows - Moodies',
    description: 'Discover trending TV shows and series',
};

export default async function TVHomePage() {
    const [trendingTV, popularTV, topRatedTV, TVTrailer, NewTVTrailer, KoreanTV, TVReview] = await Promise.all([
        fetchTrendingTV(),
        fetchPopularTV(),
        fetchTopRatedTV(),
        fetchTVTrailers(),
        fetchNewTVTrailers(),
        fetchKoreanTV(),
        fetchTVReview(),
    ]);

    const heroShows = trendingTV.slice(0, 3);
    const getImageUrl = (path: string | undefined) => path ? `https://image.tmdb.org/t/p/original${path}` : '/placeholder.jpg';
    const getPosterUrl = (path: string | undefined) => path ? `https://image.tmdb.org/t/p/w500${path}` : '/placeholder.jpg';

    return (
        <main className="bg-black min-h-screen text-white overflow-x-hidden">
            {/* Revolutionary Multi-Show Hero */}
            <section className="relative h-[100vh] sm:h-[90vh] lg:h-[95vh]">
                {/* Layered Background Images with Parallax Effect */}
                <div className="absolute inset-0">
                    {heroShows.map((show, idx) => (
                        <div
                            key={show.id}
                            className="absolute inset-0 transition-opacity duration-1000"
                            style={{
                                opacity: idx === 0 ? 1 : 0,
                                zIndex: idx === 0 ? 1 : 0
                            }}
                        >
                            {show.backdrop_path && (
                                <Image
                                    src={getImageUrl(show.backdrop_path)}
                                    alt={show.title || show.name || ''}
                                    fill
                                    priority={idx === 0}
                                    className="object-cover"
                                />
                            )}
                        </div>
                    ))}

                    {/* Sophisticated Gradient Overlays */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black" />
                </div>

                {/* Hero Content Grid */}
                <div className="relative h-full max-w-[1920px] mx-auto px-4 sm:px-6 md:px-10 lg:px-16 xl:px-20">
                    <div className="h-full grid lg:grid-cols-2 gap-8 lg:gap-12 items-center pt-20 sm:pt-24 lg:pt-0">
                        {/* Left: Main Featured Show */}
                        {heroShows[0] && (
                            <div className="space-y-4 sm:space-y-6 lg:space-y-8 z-10">
                                {/* Category Badge */}
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                    <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full backdrop-blur-sm">
                                        <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">Series Premiere</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-purple-500/30">
                                        <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                                        <span className="text-xs sm:text-sm font-semibold text-green-400">#1 Trending</span>
                                    </div>
                                </div>

                                {/* Title */}
                                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight leading-none">
                                    <span className="bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                                        {heroShows[0].title || heroShows[0].name}
                                    </span>
                                </h1>

                                {/* Meta Information */}
                                <div className="flex flex-wrap items-center gap-3 sm:gap-4 lg:gap-6 text-sm sm:text-base">
                                    <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/20 backdrop-blur-sm rounded-lg border border-yellow-500/30">
                                        <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-yellow-400" />
                                        <span className="text-yellow-100 font-bold">{heroShows[0].vote_average?.toFixed(1)}</span>
                                    </div>
                                    <span className="text-gray-300 font-medium">{heroShows[0].first_air_date?.split('-')[0]}</span>
                                    {heroShows[0].number_of_seasons && (
                                        <span className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 text-gray-200 font-semibold">
                                            {heroShows[0].number_of_seasons} Season{heroShows[0].number_of_seasons > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>

                                {/* Description */}
                                <p className="text-base sm:text-lg lg:text-xl text-gray-300 leading-relaxed max-w-2xl line-clamp-3 sm:line-clamp-4">
                                    {heroShows[0].overview}
                                </p>

                                {/* CTA Buttons */}
                                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-4">
                                    <button className="group relative px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base overflow-hidden shadow-2xl shadow-purple-600/50 hover:shadow-purple-600/70 transition-all transform hover:scale-105">
                                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                                        <span className="relative flex items-center justify-center gap-2 sm:gap-3">
                                            <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />
                                            Watch Now
                                        </span>
                                    </button>
                                    <button className="px-6 sm:px-8 py-3 sm:py-4 bg-white/10 backdrop-blur-xl border-2 border-white/30 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base hover:bg-white/20 hover:border-white/50 transition-all flex items-center justify-center gap-2 sm:gap-3">
                                        <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                                        My List
                                    </button>
                                    <button className="px-6 sm:px-8 py-3 sm:py-4 bg-black/40 backdrop-blur-xl border-2 border-white/20 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base hover:bg-black/60 transition-all flex items-center justify-center gap-2">
                                        <Info className="w-4 h-4 sm:w-5 sm:h-5" />
                                        <span className="hidden sm:inline">More Info</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Right: Upcoming Shows Preview Cards */}
                        <div className="hidden lg:flex flex-col gap-4 xl:gap-6 justify-center z-10">
                            {heroShows.slice(1, 3).map((show, idx) => (
                                <div key={show.id} className="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-purple-900/30 to-pink-900/30 backdrop-blur-xl border border-purple-500/30 hover:border-purple-500/60 transition-all cursor-pointer transform hover:-translate-y-2 duration-300">
                                    <div className="flex gap-4 p-4 xl:p-6">
                                        {/* Thumbnail */}
                                        <div className="relative w-32 xl:w-40 h-20 xl:h-24 rounded-xl overflow-hidden flex-shrink-0">
                                            {show.backdrop_path && (
                                                <Image
                                                    src={getImageUrl(show.backdrop_path)}
                                                    alt={show.title || show.name || ''}
                                                    fill
                                                    className="object-cover transform group-hover:scale-110 transition-transform duration-500"
                                                />
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                                                    <Play className="w-5 h-5 text-white fill-white" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 flex flex-col justify-between min-w-0">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="px-2 py-0.5 bg-purple-600/50 rounded text-xs font-bold uppercase">Up Next</span>
                                                    <span className="text-xs text-gray-400">#{idx + 2}</span>
                                                </div>
                                                <h3 className="text-lg xl:text-xl font-bold mb-1 line-clamp-1 group-hover:text-purple-300 transition-colors">
                                                    {show.title || show.name}
                                                </h3>
                                                <p className="text-sm text-gray-400 line-clamp-2">
                                                    {show.overview}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-gray-400 mt-2">
                                                <span className="flex items-center gap-1">
                                                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                                    {show.vote_average?.toFixed(1)}
                                                </span>
                                                <span>•</span>
                                                <span>{show.first_air_date?.split('-')[0]}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Navigation Dots */}
                    <div className="absolute bottom-8 sm:bottom-12 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
                        {heroShows.map((_, idx) => (
                            <button
                                key={idx}
                                className={`h-1.5 sm:h-2 rounded-full transition-all ${idx === 0
                                        ? 'w-8 sm:w-12 bg-purple-500'
                                        : 'w-1.5 sm:w-2 bg-white/30 hover:bg-white/50'
                                    }`}
                                aria-label={`Go to show ${idx + 1}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Scroll Indicator */}
                <div className="absolute bottom-4 sm:bottom-6 left-1/2 transform -translate-x-1/2 animate-bounce hidden sm:block">
                    <ChevronRight className="w-6 h-6 text-white/60 rotate-90" />
                </div>
            </section>

            {/* Content Sections */}
            <div className="max-w-[1920px] mx-auto px-4 sm:px-6 md:px-10 lg:px-16 xl:px-20 py-8 sm:py-12 lg:py-16 space-y-12 sm:space-y-16 lg:space-y-20">
                {/* Trending TV Shows - Enhanced Cards */}
                {popularTV.length > 0 && (
                    <section>
                        <div className="flex items-center justify-between mb-6 sm:mb-8 lg:mb-10">
                            <div>
                                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight mb-1 sm:mb-2">
                                    <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                        Trending Now
                                    </span>
                                </h2>
                                <p className="text-sm sm:text-base lg:text-lg text-gray-400">Most watched series this week</p>
                            </div>
                            <button className="hidden sm:flex items-center gap-2 text-purple-400 hover:text-purple-300 font-semibold text-sm lg:text-base transition-colors group">
                                View All
                                <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 transform group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-6">
                            {popularTV.slice(0, 12).map((show, idx) => (
                                <div key={show.id} className="group cursor-pointer">
                                    <div className="relative aspect-[2/3] rounded-lg sm:rounded-xl lg:rounded-2xl overflow-hidden bg-gradient-to-br from-purple-900/20 to-gray-900 shadow-lg transform transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-purple-500/30">
                                        {show.poster_path && (
                                            <Image
                                                src={getPosterUrl(show.poster_path)}
                                                alt={show.title || show.name || ''}
                                                fill
                                                className="object-cover"
                                            />
                                        )}

                                        {/* Ranking Badge */}
                                        <div className="absolute top-2 sm:top-3 left-2 sm:left-3 w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-purple-600 to-pink-600 backdrop-blur-sm rounded-full flex items-center justify-center font-black text-xs sm:text-sm lg:text-base shadow-lg">
                                            {idx + 1}
                                        </div>

                                        {/* Hover Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 sm:p-4">
                                            <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 space-y-2">
                                                <div className="flex items-center gap-2 text-xs">
                                                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                                    <span className="font-bold">{show.vote_average?.toFixed(1)}</span>
                                                    {show.number_of_seasons && (
                                                        <>
                                                            <span className="text-gray-400">•</span>
                                                            <span className="text-gray-300 text-xs">{show.number_of_seasons}S</span>
                                                        </>
                                                    )}
                                                </div>
                                                <button className="w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold text-xs sm:text-sm hover:from-purple-500 hover:to-pink-500 transition-all flex items-center justify-center gap-2 shadow-lg">
                                                    <Play className="w-3 h-3 sm:w-4 sm:h-4 fill-white" />
                                                    Play
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <h3 className="mt-2 sm:mt-3 font-semibold text-xs sm:text-sm lg:text-base group-hover:text-purple-400 transition-colors line-clamp-2 leading-tight">
                                        {show.title || show.name}
                                    </h3>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* New Episodes - Premium Cards */}
                {TVTrailer.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 lg:mb-10">
                            <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl sm:rounded-2xl border border-purple-500/30">
                                <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-purple-400" />
                            </div>
                            <div>
                                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight">
                                    <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                                        Fresh Episodes
                                    </span>
                                </h2>
                                <p className="text-sm sm:text-base lg:text-lg text-gray-400">New content this week</p>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                            {TVTrailer.slice(0, 4).map((show) => (
                                <div key={show.id} className="group relative rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden bg-gradient-to-br from-purple-900/30 via-pink-900/20 to-gray-900/50 border border-purple-500/30 hover:border-purple-500/60 transition-all backdrop-blur-sm hover:transform hover:-translate-y-1 duration-300">
                                    <div className="flex flex-col sm:flex-row gap-4 p-4 sm:p-5 lg:p-6">
                                        {/* Episode Thumbnail */}
                                        <div className="relative w-full sm:w-48 lg:w-56 h-32 sm:h-28 lg:h-32 rounded-lg sm:rounded-xl overflow-hidden flex-shrink-0">
                                            {show.backdrop_path && (
                                                <Image
                                                    src={getImageUrl(show.backdrop_path)}
                                                    alt={show.title || show.name || ''}
                                                    fill
                                                    className="object-cover"
                                                />
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-purple-600 rounded-full flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform">
                                                    <Play className="w-6 h-6 sm:w-7 sm:h-7 text-white fill-white" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Episode Info */}
                                        <div className="flex-1 flex flex-col justify-between min-w-0">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                                                    <span className="px-2 sm:px-3 py-1 bg-gradient-to-r from-green-500/30 to-emerald-500/30 text-green-400 text-xs sm:text-sm font-bold rounded-lg border border-green-500/30">
                                                        NEW
                                                    </span>
                                                    <span className="text-xs sm:text-sm text-gray-400">
                                                        {show.first_air_date?.split('-')[0]}
                                                    </span>
                                                </div>
                                                <h3 className="font-bold text-base sm:text-lg lg:text-xl mb-2 line-clamp-1 group-hover:text-purple-300 transition-colors">
                                                    {show.title || show.name}
                                                </h3>
                                                <p className="text-xs sm:text-sm text-gray-400 leading-relaxed line-clamp-2 sm:line-clamp-3">
                                                    {show.overview}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-400 mt-3 sm:mt-4">
                                                <span className="flex items-center gap-1">
                                                    <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 fill-yellow-400" />
                                                    <span className="font-semibold">{show.vote_average?.toFixed(1)}</span>
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                                                    {show.first_air_date}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Top Rated Series - Premium Grid */}
                {topRatedTV.length > 0 && (
                    <section className="relative">
                        {/* Background Glow */}
                        <div className="absolute inset-0 bg-gradient-to-r from-yellow-600/5 via-amber-600/5 to-orange-600/5 rounded-3xl blur-3xl" />

                        <div className="relative">
                            <div className="flex items-center justify-between mb-6 sm:mb-8 lg:mb-10">
                                <div>
                                    <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight mb-1 sm:mb-2">
                                        <span className="bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent">
                                            Top Rated
                                        </span>
                                    </h2>
                                    <p className="text-sm sm:text-base lg:text-lg text-gray-400">Critically acclaimed series</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-6">
                                {topRatedTV.slice(0, 12).map((show) => (
                                    <div key={show.id} className="group cursor-pointer">
                                        <div className="relative aspect-[2/3] rounded-lg sm:rounded-xl lg:rounded-2xl overflow-hidden bg-gray-900 shadow-xl group-hover:shadow-2xl group-hover:shadow-yellow-500/20 transition-all duration-300">
                                            {show.poster_path && (
                                                <Image
                                                    src={getPosterUrl(show.poster_path)}
                                                    alt={show.title || show.name || ''}
                                                    fill
                                                    className="object-cover transform group-hover:scale-110 transition-transform duration-500"
                                                />
                                            )}

                                            {/* Rating Badge */}
                                            <div className="absolute top-2 sm:top-3 right-2 sm:right-3 px-2 sm:px-3 py-1 bg-yellow-500/90 backdrop-blur-sm rounded-lg flex items-center gap-1 shadow-lg">
                                                <Star className="w-3 h-3 sm:w-4 sm:h-4 text-black fill-black" />
                                                <span className="text-black font-black text-xs sm:text-sm">{show.vote_average?.toFixed(1)}</span>
                                            </div>

                                            {/* Hover Info */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4">
                                                    <button className="w-full py-2 bg-yellow-500 text-black rounded-lg font-bold text-xs sm:text-sm hover:bg-yellow-400 transition-colors shadow-lg">
                                                        Watch Now
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <h3 className="mt-2 sm:mt-3 font-semibold text-xs sm:text-sm lg:text-base line-clamp-2 group-hover:text-yellow-400 transition-colors leading-tight">
                                            {show.title || show.name}
                                        </h3>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* Korean Drama - Cultural Showcase */}
                {KoreanTV.length > 0 && (
                    <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-red-900/20 via-pink-900/20 to-purple-900/20 border border-red-500/30 p-6 sm:p-8 lg:p-12">
                        {/* Decorative Elements */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl" />

                        <div className="relative">
                            <div className="flex items-center justify-between mb-6 sm:mb-8 lg:mb-10">
                                <div>
                                    <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight mb-1 sm:mb-2">
                                        <span className="bg-gradient-to-r from-red-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                                            K-Drama Fever
                                        </span>
                                    </h2>
                                    <p className="text-sm sm:text-base lg:text-lg text-gray-400">Most popular Korean series</p>
                                </div>
                                <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-xl font-semibold text-sm transition-all">
                                    Explore More
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-6">
                                {KoreanTV.slice(0, 6).map((show) => (
                                    <div key={show.id} className="group cursor-pointer">
                                        <div className="relative aspect-[2/3] rounded-lg sm:rounded-xl lg:rounded-2xl overflow-hidden bg-gray-900 shadow-xl transform transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-red-500/30">
                                            {show.poster_path && (
                                                <Image
                                                    src={getPosterUrl(show.poster_path)}
                                                    alt={show.title || show.name || ''}
                                                    fill
                                                    className="object-cover transform group-hover:scale-110 transition-transform duration-500"
                                                />
                                            )}

                                            {/* K-Drama Badge */}
                                            <div className="absolute top-2 sm:top-3 left-2 sm:left-3 px-2 sm:px-3 py-1 bg-gradient-to-r from-red-600 to-pink-600 backdrop-blur-sm rounded-lg text-xs sm:text-sm font-bold shadow-lg">
                                                K-DRAMA
                                            </div>

                                            {/* Hover Overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-red-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4">
                                                    <div className="flex items-center gap-1 mb-2">
                                                        <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 fill-yellow-400" />
                                                        <span className="font-bold text-sm">{show.vote_average?.toFixed(1)}</span>
                                                    </div>
                                                    <button className="w-full py-2 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg font-semibold text-xs sm:text-sm hover:from-red-500 hover:to-pink-500 transition-all">
                                                        Watch
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <h3 className="mt-2 sm:mt-3 font-semibold text-xs sm:text-sm lg:text-base line-clamp-2 group-hover:text-red-400 transition-colors leading-tight">
                                            {show.title || show.name}
                                        </h3>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* Community Reviews */}
                <CommunityPicks data={TVReview} />

                {/* Coming Soon - Premium Preview */}
                {NewTVTrailer.length > 0 && (
                    <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl">
                        {/* Animated Background */}
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/30 via-purple-900/30 to-pink-900/30" />
                        <div className="absolute inset-0">
                            <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
                            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                        </div>

                        <div className="relative px-6 sm:px-8 lg:px-12 py-8 sm:py-10 lg:py-14">
                            <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 lg:mb-10">
                                <div className="p-2 sm:p-3 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 rounded-xl sm:rounded-2xl border border-indigo-500/30">
                                    <Calendar className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-indigo-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight">
                                        <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                            Coming Soon
                                        </span>
                                    </h2>
                                    <p className="text-sm sm:text-base lg:text-lg text-gray-400">Highly anticipated premieres</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
                                {NewTVTrailer.slice(0, 10).map((show) => (
                                    <div key={show.id} className="group cursor-pointer">
                                        <div className="relative aspect-[2/3] rounded-lg sm:rounded-xl lg:rounded-2xl overflow-hidden bg-gray-900 shadow-xl transform transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-purple-500/40">
                                            {show.poster_path && (
                                                <Image
                                                    src={getPosterUrl(show.poster_path)}
                                                    alt={show.title || show.name || ''}
                                                    fill
                                                    className="object-cover transform group-hover:scale-110 transition-transform duration-500"
                                                />
                                            )}

                                            {/* Release Date Badge */}
                                            <div className="absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3">
                                                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 backdrop-blur-sm rounded-lg sm:rounded-xl p-2 sm:p-3 text-center shadow-2xl border border-white/10">
                                                    <div className="text-purple-100 text-xs font-bold uppercase tracking-wider mb-0.5">Premieres</div>
                                                    <div className="text-white font-black text-xs sm:text-sm">
                                                        {show.first_air_date ? new Date(show.first_air_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBA'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Hover Overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/90 via-purple-900/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 space-y-2">
                                                    <div className="flex items-center gap-1 text-xs">
                                                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                                        <span className="font-bold">{show.vote_average?.toFixed(1)}</span>
                                                    </div>
                                                    <button className="w-full py-1.5 sm:py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold text-xs sm:text-sm hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg flex items-center justify-center gap-1.5">
                                                        <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                                                        Remind Me
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <h3 className="mt-2 sm:mt-3 font-semibold text-xs sm:text-sm lg:text-base line-clamp-2 group-hover:text-purple-400 transition-colors leading-tight">
                                            {show.title || show.name}
                                        </h3>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* Bottom CTA Section */}
                <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-purple-900/40 via-pink-900/40 to-indigo-900/40 border border-purple-500/30 p-8 sm:p-12 lg:p-16 text-center">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE2YzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMCAyNGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNCAxLjc5IDQgNCA0IDQtMS43OSA0LTR6bS0yNCAwYzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMC0yNGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNCAxLjc5IDQgNCA0IDQtMS43OSA0LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />

                    <div className="relative z-10 max-w-3xl mx-auto space-y-4 sm:space-y-6">
                        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight">
                            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                                Ready to Binge?
                            </span>
                        </h2>
                        <p className="text-sm sm:text-base lg:text-lg text-gray-300 max-w-2xl mx-auto">
                            Discover thousands of TV shows and series. Start watching your favorites today.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-4">
                            <button className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base hover:from-purple-500 hover:to-pink-500 transition-all transform hover:scale-105 shadow-2xl shadow-purple-600/50">
                                Start Watching Free
                            </button>
                            <button className="px-6 sm:px-8 py-3 sm:py-4 bg-white/10 backdrop-blur-xl border-2 border-white/30 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base hover:bg-white/20 hover:border-white/50 transition-all">
                                Browse All Shows
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            {/* Mobile View All Button */}
            <div className="sm:hidden px-4 pb-8">
                <button className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors">
                    View All TV Shows
                </button>
            </div>
        </main>
    );
}