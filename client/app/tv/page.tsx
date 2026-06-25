import React from "react";
import type { All } from "@/types/all";
import type { ReviewItem } from "@/components/sections/CommunityPicks";
import type { CommunityPulseData } from "@/types/communityPulse";
import TVHomePageClient from "./TVHomePageClient";
const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

export const dynamic = "force-dynamic";

type DbCriticReview = {
  id: string;
  tmdbId: number;
  rating?: number;
  content?: string;
  tv?: {
    id: number;
    title?: string | null;
    posterPath?: string | null;
    backdropPath?: string | null;
    firstAirDate?: string | null;
  };
  user?: {
    id: string;
    username: string;
    name?: string | null;
    avatarUrl?: string | null;
  };
};

// Fetch functions with error handling
async function fetchWithFallback<T>(endpoint: string, fallback: T): Promise<T> {
  // Hard timeout so a slow/down backend can't hang static generation past Next's
  // 60s page-build limit — a hiccup degrades the section to its fallback instead
  // of failing the whole deploy.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      next: { revalidate: 60 },
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
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
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMoods() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${BASE_URL}/moods`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error("Failed to fetch moods");
      return [];
    }

    return res.json();
  } catch (error) {
    console.error("Error fetching moods:", error);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTrendingTV() {
  return fetchWithFallback<All[]>("/tv/featured?limit=20", []);
}

async function fetchPopularTV() {
  return fetchWithFallback<All[]>("/tv/trending?limit=25", []);
}

async function fetchTopRatedTV() {
  return fetchWithFallback<All[]>("/tv/favorites?limit=30", []);
}

async function fetchTVTrailers() {
  return fetchWithFallback<All[]>("/tv/trailers?limit=15", []);
}

async function fetchNewTVTrailers() {
  return fetchWithFallback<All[]>(
    "/tv/upcoming-trailers?months=6&perMonth=18&maxPagesPerMonth=5",
    [],
  );
}

async function fetchKoreanTV() {
  return fetchWithFallback<All[]>("/tv/koreaTrending?limit=20", []);
}

async function fetchNewReleases() {
  return fetchWithFallback<All[]>("/tv/new-releases?limit=30", []);
}

async function fetchTVReviews() {
  const reviews = await fetchWithFallback<DbCriticReview[]>(
    "/reviews/critics-corner/tv?limit=12",
    [],
  );

  return reviews.map((review) => {
    const displayName =
      review.user?.name || review.user?.username || "Moodies critic";

    return {
      quote: review.content || "No review available",
      name: displayName,
      title: review.tv?.title || `Series #${review.tmdbId}`,
      avatar: review.user?.avatarUrl || "",
      rating: review.rating,
      user: review.user,
      tmdbId: review.tmdbId,
      mediaType: "TV",
      movieTitle: review.tv?.title || `Series #${review.tmdbId}`,
      moviePoster: review.tv?.posterPath || null,
      movieBackdrop: review.tv?.backdropPath || null,
      movieYear: review.tv?.firstAirDate?.split("-")[0] || null,
    };
  }) satisfies ReviewItem[];
}

// NEW: Fetch airing today
async function fetchAiringToday() {
  return fetchWithFallback<All[]>("/tv/airing/today?limit=15", []);
}

// NEW: Fetch airing this week
async function fetchCommunityPulse(): Promise<CommunityPulseData> {
  return fetchWithFallback<CommunityPulseData>(
    "/media-stats/community-pulse?mediaType=tv&limit=5",
    { mostLiked: [], mostReviewed: [], mostSaved: [] },
  );
}

async function fetchAiringThisWeek() {
  return fetchWithFallback<All[]>("/tv/airing/week?limit=20", []);
}

// NEW: Use bulk endpoint for better performance (if available)
async function fetchDashboardData() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${BASE_URL}/tv/bulk/dashboard?limit=15`, {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
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
  } catch {
    console.error("Bulk fetch failed, falling back to individual requests");
  } finally {
    clearTimeout(timer);
  }

  // Fallback to individual requests
  return null;
}

export const metadata = {
  title: "TV Shows - Discover Trending Series",
  description:
    "Explore trending TV shows, top-rated series, K-dramas, and community favorites. Stay updated with airing schedules and new releases.",
  keywords:
    "tv shows, series, k-drama, trending shows, top rated series, airing today",
  openGraph: {
    title: "TV Shows - Moodies",
    description: "Discover trending TV shows and series",
    type: "website",
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
    newReleaseTV = bulkData.newReleases;
    moods = bulkData.moods;
    // Fetch remaining data in parallel
    [topRatedTV, TVReview] = await Promise.all([
      fetchTopRatedTV(),
      fetchTVReviews(),
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
  const [NewTVTrailer, AiringToday, AiringThisWeek, communityPulse] =
    await Promise.all([
      fetchNewTVTrailers(),
      fetchAiringToday(),
      fetchAiringThisWeek(),
      fetchCommunityPulse(),
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
      communityPulse={communityPulse}
    />
  );
}
