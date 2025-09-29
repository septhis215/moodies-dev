// src/app/tv/page.tsx
import React from 'react';
import type { All } from '@/types/all';
import HeroCarousel from '@/components/hero/heroCarousel';
import TrendingSection from "@/components/sections/TrendingSection";
import PremiereHighlights from "@/components/sections/PremiereHighlights";
import FavoritesSection from "@/components/sections/FavoriteSection";
import KoreaTrendingSection from '@/components/sections/KoreanSection';
import CelebSection from '@/components/sections/CelebsSection';
import CommunityPicks from '@/components/sections/CommunityPicks';
import { UpcomingTrailers } from '@/components/sections/UpcomingTrailers';

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

export const metadata = {
    title: 'TV Shows - Moodies',
    description: 'Discover trending TV shows and series',
};
export default async function TVHomePage() {
    const [trendingTV, popularTV, topRatedTV, TVTrailer, NewTVTrailer, KoreanTV] = await Promise.all([
        fetchTrendingTV(),
        fetchPopularTV(),
        fetchTopRatedTV(),
        fetchTVTrailers(),
        fetchNewTVTrailers(),
        fetchKoreanTV(),
    ]);

    return (
        <main className="bg-black min-h-screen overflow-x-hidden">
            {/* Hero section with trending TV shows */}
            <HeroCarousel all={trendingTV} />

            {/* TV-specific sections */}
            <TrendingSection data={popularTV} title="Trending TV Shows" />

            <PremiereHighlights data={TVTrailer} title="New Episodes This Week" />

            <FavoritesSection data={topRatedTV} title="Top Rated Series" />

            <KoreaTrendingSection data={KoreanTV}/>

            <section className="px-4 md:px-8 py-8">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">Popular Series</h2>
                {/* Add your carousel component here */}
            </section>


            <CommunityPicks/>

            <UpcomingTrailers data={NewTVTrailer} />
        </main>
    );
}