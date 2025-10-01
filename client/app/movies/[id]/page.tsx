import React from "react";
import type { Metadata } from "next";
import HeroContentCard from "@/components/selected-content/sections/heroTop";
import MovieDetails from "@/components/selected-content/sections/extras";
import ReviewsSection from "@/components/selected-content/sections/reviews";
import MovieCarousel from "@/components/sections/MovieCarousel";
import ImageVideoCarousel from "@/components/selected-content/sections/imageVideoCarousel";

async function fetchDetails(id: string) {
  const base = process.env.NEST_API_URL ?? "http://localhost:4000";
  const res = await fetch(`${base}/movies/details/${id}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchImages(id: string) {
  try {
    const base = process.env.NEST_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${base}/movies/images/movie/${id}`, {
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
    const res = await fetch(`${base}/movies/videos/movie/${id}`, {
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
  return { title: `Movie ${id}` };
}

export default async function MoviePage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchDetails(id);
  const images = await fetchImages(id);
  const videos = await fetchVideos(id);

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold">Not found</h2>
          <p className="mt-2 text-gray-400">Unable to fetch details.</p>
        </div>
      </main>
    );
  }

  return (
    <main>
      {/* Let the components handle presentation and any mapping/normalisation */}
      <HeroContentCard data={data} />

      <div className="min-h-screen bg-black text-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-16 space-y-14">
          <ImageVideoCarousel
            posters={images.posters}
            backdrops={images.backdrops}
            videos={videos.videos}
          />

          <hr className="border-white/8 my-14" />

          <MovieDetails data={data} />

          <hr className="border-white/8 my-14" />
          <ReviewsSection reviews={data.reviews} movieId={id} />

          <hr className="border-white/8 my-14" />
          <MovieCarousel
            title="Something Similar"
            subtitle="Films you may also enjoy"
            items={data.similar}
          />
        </div>
      </div>
    </main>
  );
}
