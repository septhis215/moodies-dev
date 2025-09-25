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

async function fetchTrendingTV() {
    const base = process.env.NEST_API_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/all/featured`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json as All[];
}

async function fetchPopularTV() {
    const base = process.env.NEST_API_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/tv/popular`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json as All[];
}

async function fetchTopRatedTV() {
    const base = process.env.NEST_API_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/all/favorite`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json as All[];
}

async function fetchNewTVReleases() {
    const base = process.env.NEST_API_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/all/trailers`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json as All[];
}
export const metadata = {
    title: 'TV Shows - Moodies',
    description: 'Discover trending TV shows and series',
};
export default async function TVHomePage() {
    const [trendingTV, popularTV, topRatedTV, newReleases] = await Promise.all([
        fetchTrendingTV(),
        fetchPopularTV(),
        fetchTopRatedTV(),
        fetchNewTVReleases()
    ]);

    return (
        <main className="bg-black min-h-screen overflow-x-hidden">
            {/* Hero section with trending TV shows */}
            <HeroCarousel all={trendingTV} />

            {/* TV-specific sections */}
            <TrendingSection data={popularTV} title="Trending TV Shows" />

            <PremiereHighlights data={newReleases} title="New Episodes This Week" />

            <FavoritesSection data={topRatedTV} title="Top Rated Series" />

            <KoreaTrendingSection />

            <section className="px-4 md:px-8 py-8">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">Popular Series</h2>
                {/* Add your carousel component here */}
            </section>

            <CelebSection />

            <CommunityPicks/>
        </main>
    );
}