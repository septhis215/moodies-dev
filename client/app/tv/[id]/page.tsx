import React from "react";
import type { Metadata } from "next";

import HeroContentCard from "@/components/selected-content/sections/heroTop";
import ExtraDetails from "@/components/selected-content/sections/extras";
import ReviewsSection from "@/components/selected-content/sections/reviews";
import CardCarousel from "@/components/sections/CardCarousel";
import TvSeasonsEpisodes from "@/components/selected-content/sections/TvSeasonsEpisodes";
import ImageVideoCarousel from "@/components/selected-content/sections/imageVideoCarousel";
import Analytics from "@/components/selected-content/sections/analytics";

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
  } catch (err) {
    // swallow errors and fallback to info.seasons in the main payload
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
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
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
    title
  };

  return metadata;
}

export default async function TvPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchDetails(id);
  const images = await fetchImages(id);
  const videos = await fetchVideos(id);
  const recommendations = await fetchRecommendations(id);

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

  // Try to fetch rich season+episode info from dedicated endpoint.
  // If not available, fallback to the seasons array in the details payload (no episode details).
  const seasonsFromEndpoint = await fetchSeasonsWithEpisodes(id);
  const seasonsProp =
    seasonsFromEndpoint && Array.isArray(seasonsFromEndpoint)
      ? seasonsFromEndpoint
      : // fallback to minimal shape expected by TvSeasonsEpisodes (episodes = [])
        (data.info?.seasons ?? []).map((s: any) => ({
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
      <HeroContentCard data={data} />

      <div className="min-h-screen bg-black text-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-10 space-y-14">
          {/* Seasons / Episodes — placed above details as requested */}

          <TvSeasonsEpisodes seasons={seasonsProp} />

          <hr className="border-white/8 my-14" />
          <ImageVideoCarousel
            posters={images.posters}
            backdrops={images.backdrops}
            videos={videos.videos}
          />

          <hr className="border-white/8 my-14" />
          <ExtraDetails data={data} contentId={id}/>

          <hr className="border-white/8 my-14" />
          <ReviewsSection
            reviews={data.reviews}
            contentId={id}
            contentType="tv"
          />

          <hr className="border-white/8 my-14" />
          <CardCarousel
            title="Something Similar"
            subtitle="TV shows you may also enjoy"
            items={recommendations}
          />
        </div>
      </div>
    </main>
  );
}
