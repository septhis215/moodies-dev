import React from "react";
import type { Metadata } from "next";
import HeroContentCard from "@/components/selected-content/sections/heroTop";
import MovieDetails from "@/components/selected-content/sections/extras";
import ReviewsSection from "@/components/selected-content/sections/reviews";
import CardCarousel from "@/components/sections/CardCarousel";
import ImageVideoCarousel from "@/components/selected-content/sections/imageVideoCarousel";
import CommonCardCarousel from "@/components/sections/CommonCardCarousel";

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

async function fetchRecommendations(id: string) {
  try {
    const base = process.env.NEST_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${base}/movies/recommendations/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    return null;
  }
}

async function fetchReviews(id: string) {
  try {
    const base = process.env.NEST_API_URL ?? "http://localhost:4000";
    const res = await fetch(
      `${base}/reviews/media/MOVIE/${id}?page=1&limit=10`,
      {
        next: { revalidate: 60 },
        cache: "no-store", // Don't cache since reviews need auth
      },
    );
    if (!res.ok)
      return {
        reviews: [],
        topMoods: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
    return res.json();
  } catch (err) {
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
    const res = await fetch(`${base}/reviews/media/MOVIE/${id}/stats`, {
      next: { revalidate: 60 },
      cache: "no-store",
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
      title: "Movie not found",
    };
  }

  const info = data.info;

  const title =
    info.title?.trim() ||
    info.name?.trim() ||
    info.original_title?.trim() ||
    `Movie ${info.id ?? ""}`;

  const metadata: Metadata = {
    title,
  };

  return metadata;
}
export default async function MoviePage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, images, videos, reviews, reviewStats, recommendations] =
    await Promise.all([
      fetchDetails(id),
      fetchImages(id),
      fetchVideos(id),
      fetchReviews(id),
      fetchReviewStats(id),
      fetchRecommendations(id),
    ]);

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
      <HeroContentCard
        data={data}
        topMoods={reviews.topMoods || []}
        reviewStats={reviewStats}
      />

      <div className="min-h-screen bg-black text-slate-100">
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:space-y-14 sm:px-6 sm:py-16">
          <ImageVideoCarousel
            posters={images.posters}
            backdrops={images.backdrops}
            videos={videos.videos}
          />

          <hr className="my-8 border-white/8 sm:my-14" />

          <MovieDetails data={data} contentId={id} />

          <hr className="my-8 border-white/8 sm:my-14" />
          <ReviewsSection
            reviews={reviews.reviews}
            contentId={id}
            contentType="movie"
          />

          <hr className="my-8 border-white/8 sm:my-14" />
          <CommonCardCarousel
            title="Something Similar"
            subtitle="Films you may also enjoy"
            type="movie"
            items={recommendations}
          />
        </div>
      </div>
    </main>
  );
}
