// src/app/movies/page.tsx
import React from 'react';
import type { All } from '@/types/all'; // Assuming you have a Movie type
import HeroCarousel from '@/components/hero/heroCarousel';
import TrendingSection from "@/components/sections/TrendingSection";
import PremiereHighlights from "@/components/sections/PremiereHighlights";
import FavoritesSection from "@/components/sections/FavoriteSection";
import CelebSection from '@/components/sections/CelebsSection';
import CommunityPicks from '@/components/sections/CommunityPicks';
import { UpcomingTrailers } from '@/components/sections/UpcomingTrailers';

async function fetchTrendingMovies() {
  const base = process.env.NEST_API_URL || 'http://localhost:4000';
  const res = await fetch(`${base}/movies/trending/week`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as All[];
}

async function fetchPopularMovies() {
  const base = process.env.NEST_API_URL || 'http://localhost:4000';
  const res = await fetch(`${base}/movies/popular`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as All[];
}

async function fetchTopRatedMovies() {
  const base = process.env.NEST_API_URL || 'http://localhost:4000';
  const res = await fetch(`${base}/movies/top-rated`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as All[];
}

async function fetchUpcomingMovies() {
  const base = process.env.NEST_API_URL || 'http://localhost:4000';
  const res = await fetch(`${base}/movies/upcoming`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as All[];
}

async function fetchNowPlayingMovies() {
  const base = process.env.NEST_API_URL || 'http://localhost:4000';
  const res = await fetch(`${base}/movies/now-playing`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as All[];
}

export default async function MoviesHomePage() {
  const [trendingMovies, popularMovies, topRatedMovies, upcomingMovies, nowPlayingMovies] = await Promise.all([
    fetchTrendingMovies(),
    fetchPopularMovies(),
    fetchTopRatedMovies(),
    fetchUpcomingMovies(),
    fetchNowPlayingMovies()
  ]);

  return (
    <main className="bg-black min-h-screen overflow-x-hidden">
      {/* Hero section with trending movies */}
      <HeroCarousel all={trendingMovies} />
      
      {/* Movie-specific sections */}
      <TrendingSection data={trendingMovies} title="Trending Movies" />
      
      <PremiereHighlights data={nowPlayingMovies} title="Now Playing in Theaters" />
      
      <FavoritesSection data={topRatedMovies} title="Top Rated Movies" />
      
      <section className="px-4 md:px-8 py-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">Popular Movies</h2>
        {/* Add your carousel component here for popular movies */}
      </section>
      
      <section className="px-4 md:px-8 py-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">Coming Soon</h2>
        {/* Add your carousel component here for upcoming movies */}
      </section>
      
      <CelebSection />
      
      <CommunityPicks />
      
      <UpcomingTrailers />
    </main>
  );
}