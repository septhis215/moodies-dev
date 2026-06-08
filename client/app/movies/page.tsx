import React from "react";
import type { All } from "@/types/all";
import type { ReviewItem } from "@/components/sections/CommunityPicks";
import MoviesHomePageClient from "./MovieHomePageClient";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

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
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      next: { revalidate: 60 },
      headers: {
        "Content-Type": "application/json",
      },
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
      console.error("Failed to fetch moods");
      return [];
    }

    return res.json();
  } catch (error) {
    console.error("Error fetching moods:", error);
    return [];
  }
}

async function fetchTrendingMovies() {
  return fetchWithFallback<All[]>("/movies/featured?limit=25", []);
}

async function fetchPopularMovies() {
  return fetchWithFallback<All[]>("/movies/trending?limit=25", []);
}

async function fetchTopRatedMovies() {
  return fetchWithFallback<All[]>("/movies/favorites?limit=30", []);
}

async function fetchMovieTrailers() {
  return fetchWithFallback<All[]>("/movies/trailers?limit=15", []);
}

async function fetchNewMovieTrailers() {
  return fetchWithFallback<All[]>(
    "/movies/upcoming-trailers?months=6&perMonth=18&maxPagesPerMonth=5",
    [],
  );
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
  const bulkData = await fetchWithFallback<{
    featured?: All[];
    trending?: All[];
    trailers?: All[];
    koreaTrending?: All[];
    reviews?: ReviewItem[];
  } | null>("/movies/bulk/dashboard?limit=15", null);

  const [
    topRatedMovies,
    animatedMovies,
    indieMovies,
    awardWinners,
    actionMovies,
    moods,
    newReleaseMovies,
    newMovieTrailers,
  ] = await Promise.all([
    fetchTopRatedMovies(),
    fetchAnimatedMovies(),
    fetchIndieMovies(),
    fetchAwardWinners(),
    fetchActionMovies(),
    fetchMoods(),
    fetchNewReleases(),
    fetchNewMovieTrailers(),
  ]);

  const [trendingMovies, popularMovies, movieTrailers, koreanMovies] = bulkData
    ? [
        bulkData.featured || [],
        bulkData.trending || [],
        bulkData.trailers || [],
        bulkData.koreaTrending || [],
      ]
    : await Promise.all([
        fetchTrendingMovies(),
        fetchPopularMovies(),
        fetchMovieTrailers(),
        fetchKoreanMovies(),
      ]);
  const movieReviews = await fetchMovieReviews();

  return (
    <MoviesHomePageClient
      trendingMovies={trendingMovies}
      popularMovies={popularMovies}
      topRatedMovies={topRatedMovies}
      movieTrailers={movieTrailers}
      newMovieTrailers={newMovieTrailers}
      movieReviews={movieReviews}
      koreanMovies={koreanMovies}
      animatedMovies={animatedMovies}
      indieMovies={indieMovies}
      awardWinners={awardWinners}
      actionMovies={actionMovies}
      moods={moods}
      newReleaseMovies={newReleaseMovies}
    />
  );
}
