import type { All } from "@/types/all";
import { readHomepageTitles } from "@/lib/homepage-sections";
import MoviesHomePageClient from "./MovieHomePageClient";

const BASE_URL = process.env.NEST_API_URL || "https://dev.api.moodies.tech/api";

export const dynamic = "force-dynamic";

async function fetchWithFallback<T>(endpoint: string, fallback: T): Promise<T> {
  // A slow backend must not hold up the hero indefinitely.
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
async function fetchMovieList(endpoint: string): Promise<All[]> {
  return readHomepageTitles(await fetchWithFallback<unknown>(endpoint, null));
}

export const metadata = {
  title: "Movies - Discover Trending Films",
  description:
    "Explore trending movies, box office hits, top-rated classics, and upcoming releases. Stay updated with new trailers and community reviews.",
  keywords:
    "movies, films, box office, trending movies, top rated, upcoming releases, movie reviews",
  openGraph: {
    title: "Movies - Moodies",
    description: "Discover trending movies and upcoming releases",
    type: "website",
  },
};

export default async function MoviesHomePage() {
  const trendingMovies = await fetchMovieList("/movies/featured?limit=25");
  const popularMovies = trendingMovies.length
    ? []
    : await fetchMovieList("/movies/trending?limit=25");

  return (
    <MoviesHomePageClient
      trendingMovies={trendingMovies}
      popularMovies={popularMovies}
    />
  );
}
