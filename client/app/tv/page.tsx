import React from "react";
import type { All } from "@/types/all";
import type { ReviewItem } from "@/components/sections/CommunityPicks";
import { homepageSections } from "@/components/sections/HomepageSectionsServer";
import TVHomePageClient from "./TVHomePageClient";
const BASE_URL = process.env.NEST_API_URL || "https://dev.api.moodies.tech/api";

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

async function fetchAiringThisWeek() {
  return fetchWithFallback<All[]>("/tv/airing/week?limit=20", []);
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
  const sections = homepageSections("tv");
  const [
    trendingTV,
    popularTV,
    topRatedTV,
    KoreanTV,
    TVReview,
    newReleaseTV,
    moods,
    AiringToday,
    AiringThisWeek,
  ] = await Promise.all([
    fetchTrendingTV(),
    fetchPopularTV(),
    fetchTopRatedTV(),
    fetchKoreanTV(),
    fetchTVReviews(),
    fetchNewReleases(),
    fetchMoods(),
    fetchAiringToday(),
    fetchAiringThisWeek(),
  ]);

  return (
    <TVHomePageClient
      trendingTV={trendingTV}
      popularTV={popularTV}
      topRatedTV={topRatedTV}
      upcomingSection={sections.upcoming}
      KoreanTV={KoreanTV}
      TVReview={TVReview}
      newReleaseTV={newReleaseTV}
      airingToday={AiringToday}
      airingThisWeek={AiringThisWeek}
      moods={moods}
      communityPulseSection={sections.communityPulse}
    />
  );
}
