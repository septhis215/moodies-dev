import type { All } from "@/types/all";
import { readHomepageTitles } from "@/lib/homepage-sections";
import TVHomePageClient from "./TVHomePageClient";
const BASE_URL = process.env.NEST_API_URL || "https://dev.api.moodies.tech/api";

export const dynamic = "force-dynamic";

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

async function fetchTvList(endpoint: string): Promise<All[]> {
  return readHomepageTitles(await fetchWithFallback<unknown>(endpoint, null));
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
  const popularTV = await fetchTvList("/tv/trending?limit=25");
  const trendingTV = popularTV.length ? [] : await fetchTvList("/tv/featured?limit=25");
  return <TVHomePageClient popularTV={popularTV} trendingTV={trendingTV} />;
}
