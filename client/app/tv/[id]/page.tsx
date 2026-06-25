import React from "react";
import type { Metadata } from "next";

import HeroContentCard from "@/components/selected-content/sections/heroTop";
import ExtraDetails from "@/components/selected-content/sections/extras";
import ReviewsSection from "@/components/selected-content/sections/reviews";
import TvSeasonsEpisodes from "@/components/selected-content/sections/TvSeasonsEpisodes";
import ImageVideoCarousel from "@/components/selected-content/sections/imageVideoCarousel";
import CommonCardCarousel from "@/components/sections/CommonCardCarousel";

async function fetchDetails(id: string) {
  const base = process.env.NEST_API_URL ?? "http://localhost:4000";
  const res = await fetch(`${base}/tv/details/${id}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchSeasonsWithEpisodes(id: string) {
  try {
    const base = process.env.NEST_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${base}/tv/seasons/episodes/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchImages(id: string) {
  try {
    const base = process.env.NEST_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${base}/tv/images/tv/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchVideos(id: string) {
  try {
    const base = process.env.NEST_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${base}/tv/videos/tv/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchRecommendations(id: string) {
  try {
    const base = process.env.NEST_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${base}/tv/recommendations/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchReviews(id: string) {
  try {
    const base = process.env.NEST_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${base}/reviews/media/TV/${id}?page=1&limit=10`, {
      next: { revalidate: 60 },
      cache: "no-store",
    });
    if (!res.ok)
      return {
        reviews: [],
        topMoods: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
    return res.json();
  } catch {
    return {
      reviews: [],
      topMoods: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    };
  }
}

async function fetchReviewStats(id: string) {
  try {
    const base = process.env.NEST_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${base}/reviews/media/TV/${id}/stats`, {
      next: { revalidate: 60 },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchDetails(id);

  if (!data || !data.info) {
    return {
      title: "TV Show not found",
    };
  }

  const info = data.info;

  const title =
    info.title?.trim() ||
    info.name?.trim() ||
    info.original_title?.trim() ||
    `TV Show ${info.id ?? ""}`;

  const metadata: Metadata = {
    title,
  };

  return metadata;
}

export default async function TvPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [
    data,
    images,
    videos,
    reviews,
    reviewStats,
    recommendations,
    seasonsFromEndpoint,
  ] = await Promise.all([
    fetchDetails(id),
    fetchImages(id),
    fetchVideos(id),
    fetchReviews(id),
    fetchReviewStats(id),
    fetchRecommendations(id),
    fetchSeasonsWithEpisodes(id),
  ]);

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold">TV show not found</h2>
          <p className="mt-2 text-gray-400">Unable to fetch TV show details.</p>
        </div>
      </main>
    );
  }
  type SeasonSummary = {
    season_number?: number;
    name?: string;
    overview?: string;
    air_date?: string;
    poster_path?: string | null;
    episode_count?: number;
    episodes?: unknown[];
  };

  const seasonsProp =
    seasonsFromEndpoint && Array.isArray(seasonsFromEndpoint)
      ? seasonsFromEndpoint
      : // fallback to minimal shape expected by TvSeasonsEpisodes (episodes = [])
        ((data.info?.seasons ?? []) as SeasonSummary[]).map((s) => ({
          season_number: s.season_number,
          name: s.name,
          overview: s.overview,
          air_date: s.air_date,
          poster_path: s.poster_path,
          episode_count: s.episode_count ?? 0,
          episodes: s.episodes ?? [], // likely empty unless backend included episodes
        }));

  return (
    <main>
      {/* Let the components handle presentation and any mapping/normalisation */}
      <HeroContentCard
        data={data}
        topMoods={reviews.topMoods || []}
        reviewStats={reviewStats}
      />

      <div className="min-h-screen bg-black text-slate-100">
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:space-y-14 sm:px-6">
          {/* Seasons / Episodes — placed above details as requested */}

          <TvSeasonsEpisodes seasons={seasonsProp} />

          <hr className="my-8 border-white/8 sm:my-14" />
          <ImageVideoCarousel
            posters={images.posters}
            backdrops={images.backdrops}
            videos={videos.videos}
          />

          <hr className="my-8 border-white/8 sm:my-14" />
          <ExtraDetails data={data} contentId={id} />

          <hr className="my-8 border-white/8 sm:my-14" />
          <ReviewsSection
            reviews={reviews.reviews}
            contentId={id}
            contentType="tv"
          />

          <hr className="my-8 border-white/8 sm:my-14" />
          <CommonCardCarousel
            title="Something Similar"
            subtitle="TV shows you may also enjoy"
            type="tv"
            items={recommendations}
          />
        </div>
      </div>
    </main>
  );
}
