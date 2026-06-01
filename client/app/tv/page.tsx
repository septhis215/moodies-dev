import React from 'react';
import type { All } from '@/types/all';
import type { ReviewItem } from '@/components/sections/CommunityPicks';
import TVHomePageClient from './TVHomePageClient';
const BASE_URL = process.env.NEST_API_URL || 'http://localhost:4000';

// Fetch functions with error handling
async function fetchWithFallback<T>(endpoint: string, fallback: T): Promise<T> {
    try {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            next: { revalidate: 60 },
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!res.ok) {
            console.error(`Failed to fetch ${endpoint}: ${res.status}`);
            return fallback;
        }

        const json = await res.json();
        return json as T;
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        return fallback;
    }
}

async function fetchMoods() {
    try {
        const res = await fetch(`${BASE_URL}/moods`, {
            next: { revalidate: 3600 }, // Cache for 1 hour
        });

        if (!res.ok) {
            console.error('Failed to fetch moods');
            return [];
        }

        return res.json();
    } catch (error) {
        console.error('Error fetching moods:', error);
        return [];
    }
}

async function fetchTrendingTV() {
    return fetchWithFallback<All[]>('/tv/featured?limit=20', []);
}

async function fetchPopularTV() {
    return fetchWithFallback<All[]>('/tv/trending?limit=25', []);
}

async function fetchTopRatedTV() {
    return fetchWithFallback<All[]>('/tv/favorites?limit=30', []);
}

async function fetchTVTrailers() {
    return fetchWithFallback<All[]>('/tv/trailers?limit=20', []);
}

async function fetchNewTVTrailers() {
    return fetchWithFallback<All[]>('/tv/upcoming-trailers', []);
}

async function fetchKoreanTV() {
    return fetchWithFallback<All[]>('/tv/koreaTrending?limit=20', []);
}

async function fetchNewReleases() {
    return fetchWithFallback<All[]>('/tv/new-releases?limit=30', []);
}

async function fetchTVReviews() {
    return fetchWithFallback<ReviewItem[]>('/tv/trending-reviews?limit=20', []);
}

// NEW: Fetch airing today
async function fetchAiringToday() {
    return fetchWithFallback<All[]>('/tv/airing/today?limit=15', []);
}

// NEW: Fetch airing this week
async function fetchAiringThisWeek() {
    return fetchWithFallback<All[]>('/tv/airing/week?limit=20', []);
}

// NEW: Use bulk endpoint for better performance (if available)
async function fetchDashboardData() {
    try {
        const res = await fetch(`${BASE_URL}/tv/bulk/dashboard?limit=15`, {
            next: { revalidate: 60 },
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (res.ok) {
            const data = await res.json();
            return {
                featured: data.featured || [],
                trending: data.trending || [],
                trailers: data.trailers || [],
                koreaTrending: data.koreaTrending || [],
                reviews: data.reviews || [],
                newReleases: data.newReleases || [],
                moods: data.moods || [],
            };
        }
    } catch (error) {
        console.error('Bulk fetch failed, falling back to individual requests');
    }

    // Fallback to individual requests
    return null;
}

export const metadata = {
    title: 'TV Shows - Discover Trending Series',
    description: 'Explore trending TV shows, top-rated series, K-dramas, and community favorites. Stay updated with airing schedules and new releases.',
    keywords: 'tv shows, series, k-drama, trending shows, top rated series, airing today',
    openGraph: {
        title: 'TV Shows - Moodies',
        description: 'Discover trending TV shows and series',
        type: 'website',
    },
};

export default async function TVHomePage() {
    // Try bulk fetch first for better performance
    const bulkData = await fetchDashboardData();

    let trendingTV: All[];
    let popularTV: All[];
    let topRatedTV: All[];
    let TVTrailer: All[];
    let KoreanTV: All[];
    let TVReview: ReviewItem[];
    let newReleaseTV: All[];
    let moods;

    if (bulkData) {
        // Use bulk data
        trendingTV = bulkData.featured;
        popularTV = bulkData.trending;
        TVTrailer = bulkData.trailers;
        KoreanTV = bulkData.koreaTrending;
        TVReview = bulkData.reviews;
        newReleaseTV = bulkData.newReleases;
        moods = bulkData.moods;
        // Fetch remaining data in parallel
        [topRatedTV] = await Promise.all([
            fetchTopRatedTV(),
        ]);
    } else {
        // Fallback: fetch all data in parallel
        [
            trendingTV,
            popularTV,
            topRatedTV,
            TVTrailer,
            KoreanTV,
            TVReview,
            newReleaseTV,
            moods,
        ] = await Promise.all([
            fetchTrendingTV(),
            fetchPopularTV(),
            fetchTopRatedTV(),
            fetchTVTrailers(),
            fetchKoreanTV(),
            fetchTVReviews(),
            fetchNewReleases(),
            fetchMoods(),
        ]);
    }

    // Always fetch these separately for more control
    const [NewTVTrailer, AiringToday, AiringThisWeek] = await Promise.all([
        fetchNewTVTrailers(),
        fetchAiringToday(),
        fetchAiringThisWeek(),
    ]);

    return (
        <TVHomePageClient
            trendingTV={trendingTV}
            popularTV={popularTV}
            topRatedTV={topRatedTV}
            TVTrailer={TVTrailer}
            NewTVTrailer={NewTVTrailer}
            KoreanTV={KoreanTV}
            TVReview={TVReview}
            newReleaseTV={newReleaseTV}
            airingToday={AiringToday}
            airingThisWeek={AiringThisWeek}
            moods={moods}
        />
    );
}