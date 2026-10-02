import React from "react";
import type { All } from "@/types/all";
import type { ReviewItem } from "@/components/sections/CommunityPicks";
import type { CommunityPulseData } from "@/types/communityPulse";
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

async function fetchTVTrailers() {
  return fetchWithFallback<All[]>("/tv/trailers?limit=15", []);
}

function extractMediaItems(payload: unknown): All[] {
  if (Array.isArray(payload)) return payload as All[];
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  for (const key of ["results", "items", "data"]) {
    if (Array.isArray(record[key])) return record[key] as All[];
  }

  return [];
}

function normalizeUpcomingTV(payload: unknown): All[] {
  const earliestAllowed = new Date();
  earliestAllowed.setHours(0, 0, 0, 0);
  earliestAllowed.setDate(earliestAllowed.getDate() - 1);

  const unique = new Map<string, All>();

  extractMediaItems(payload).forEach((item) => {
    const releaseDate = item.first_air_date || item.release_date;
    if (!item.id || !releaseDate) return;

    const parsedDate = new Date(releaseDate);
    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.getTime() < earliestAllowed.getTime()
    ) {
      return;
    }

    const itemType = item.type;
    const looksLikeTV =
      itemType === "tv" ||
      Boolean(item.first_air_date || item.name || item.number_of_seasons);
    if (!looksLikeTV) return;

    unique.set(String(item.id), {
      ...item,
      type: "tv",
      first_air_date: item.first_air_date || releaseDate,
      release_date: item.release_date || releaseDate,
    });
  });

  return [...unique.values()].sort((a, b) => {
    const aDate = new Date(
      a.first_air_date || a.release_date || "9999-12-31",
    ).getTime();
    const bDate = new Date(
      b.first_air_date || b.release_date || "9999-12-31",
    ).getTime();
    return aDate - bDate;
  });
}

async function fetchNewTVTrailers() {
  const primaryPayload = await fetchWithFallback<unknown>(
    "/tv/upcoming-trailers?limit=60&months=6&perMonth=12&maxPagesPerMonth=3",
    null,
  );
  const primaryItems = normalizeUpcomingTV(primaryPayload);
  if (primaryItems.length > 0) return primaryItems;

  console.warn(
    "TV upcoming endpoint returned no usable releases; using the combined upcoming feed.",
  );
  const fallbackPayload = await fetchWithFallback<unknown>(
    "/all/upcoming-trailers?limit=80",
    null,
  );

  return normalizeUpcomingTV(fallbackPayload).slice(0, 60);
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
  const [
    trendingTV,
    popularTV,
    topRatedTV,
    TVTrailer,
    KoreanTV,
    TVReview,
    newReleaseTV,
    moods,
    NewTVTrailer,
    AiringToday,
    AiringThisWeek,
    communityPulse,
  ] = await Promise.all([
    fetchTrendingTV(),
    fetchPopularTV(),
    fetchTopRatedTV(),
    fetchTVTrailers(),
    fetchKoreanTV(),
    fetchTVReviews(),
    fetchNewReleases(),
    fetchMoods(),
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
