import React from "react";
import type { All } from "@/types/all";
import type { ReviewItem } from "@/components/sections/CommunityPicks";
import { homepageSections } from "@/components/sections/HomepageSectionsServer";
import MoviesHomePageClient from "./MovieHomePageClient";

const BASE_URL = process.env.NEST_API_URL || "https://dev.api.moodies.tech/api";

export const dynamic = "force-dynamic";

type DbCriticReview = {
  id: string;
  tmdbId: number;
  rating?: number;
  content?: string;
  movie?: {
    id: number;
    title?: string | null;
    posterPath?: string | null;
    backdropPath?: string | null;
    releaseDate?: string | null;
  };
  user?: {
    id: string;
    username: string;
    name?: string | null;
    avatarUrl?: string | null;
  };
};

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

async function fetchTrendingMovies() {
  return fetchWithFallback<All[]>("/movies/featured?limit=25", []);
}

async function fetchPopularMovies() {
  return fetchWithFallback<All[]>("/movies/trending?limit=25", []);
}




async function fetchKoreanMovies() {
  return fetchWithFallback<All[]>("/movies/koreaTrending?limit=25", []);
}

async function fetchMovieReviews() {
  const reviews = await fetchWithFallback<DbCriticReview[]>(
    "/reviews/critics-corner/movies?limit=12",
    [],
  );

  return reviews.map((review) => {
    const displayName =
      review.user?.name || review.user?.username || "Moodies critic";

    return {
      quote: review.content || "No review available",
      name: displayName,
      title: review.movie?.title || `Movie #${review.tmdbId}`,
      avatar: review.user?.avatarUrl || "",
      rating: review.rating,
      user: review.user,
      tmdbId: review.tmdbId,
      movieTitle: review.movie?.title || `Movie #${review.tmdbId}`,
      moviePoster: review.movie?.posterPath || null,
      movieBackdrop: review.movie?.backdropPath || null,
      movieYear: review.movie?.releaseDate?.split("-")[0] || null,
    };
  }) satisfies ReviewItem[];
}
// Add to your page.tsx server component
async function fetchAnimatedMovies() {
  return fetchWithFallback<All[]>("/movies/animated-movies?limit=20", []);
}

async function fetchActionMovies() {
  return fetchWithFallback<All[]>("/movies/action-movies?limit=20", []);
}

async function fetchIndieMovies() {
  return fetchWithFallback<All[]>("/movies/indie-movies?limit=20", []);
}

async function fetchAwardWinners() {
  return fetchWithFallback<All[]>("/movies/award-winners?limit=25", []);
}


async function fetchNewReleases() {
  const result = await fetchWithFallback<{ data: All[] } | All[]>(
    "/movies/new-releases?page=1&limit=30",
    { data: [] },
  );

  if (Array.isArray(result)) {
    return result;
  }

  return result.data || [];
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
  const sections = homepageSections("movie");
  const [trendingMovies, popularMovies, koreanMovies, movieReviews, animatedMovies,
    indieMovies, awardWinners, actionMovies, moods, newReleaseMovies] = await Promise.all([
    fetchTrendingMovies(), fetchPopularMovies(), fetchKoreanMovies(), fetchMovieReviews(),
    fetchAnimatedMovies(), fetchIndieMovies(), fetchAwardWinners(), fetchActionMovies(),
    fetchMoods(), fetchNewReleases(),
  ]);

  return (
    <MoviesHomePageClient
      trendingMovies={trendingMovies}
      popularMovies={popularMovies}
      upcomingSection={sections.upcoming}
      movieReviews={movieReviews}
      koreanMovies={koreanMovies}
      animatedMovies={animatedMovies}
      indieMovies={indieMovies}
      awardWinners={awardWinners}
      actionMovies={actionMovies}
      moods={moods}
      newReleaseMovies={newReleaseMovies}
      communityPulseSection={sections.communityPulse}
    />
  );
}
