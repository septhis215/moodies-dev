import React from "react";
import type { Metadata } from "next";
import HeroContentCard from "@/components/selected-content/sections/heroTop";
import MovieDetails from "@/components/selected-content/sections/extras";
import ReviewsSection from "@/components/selected-content/sections/reviews";
import MovieCarousel from "@/components/sections/MovieCarousel";

async function fetchDetails(id: string) {
  const base = process.env.NEST_API_URL ?? "http://localhost:4000";
  const res = await fetch(`${base}/movies/details/${id}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({
  params,
}: {
  // params may be a Promise in App Router, so await it below
  params: { id: string } | Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params; // <--- await here
  return { title: `Movie ${id}` };
}

export default async function MoviePage({
  params,
}: {
  // params may be a Promise in App Router, so await it below
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await params; // <--- await here
  const data = await fetchDetails(id);

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
