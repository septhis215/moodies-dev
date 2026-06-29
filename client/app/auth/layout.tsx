import { tmdbImage } from "@/lib/tmdb";
// app/auth/layout.tsx
import React from "react";
import AuthBackground from "./AuthBackground";
import AuthLayoutClient from "./AuthLayoutClient";

type Slide = {
  id?: number;
  title: string;
  poster: string;
  backdrop: string;
  rating?: number;
  year?: string;
  genre?: string;
  kind?: "movie" | "tv";
};

type FeaturedItem = {
  id?: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  genres?: string[];
  type?: "movie" | "tv";
};

const fallbackSlides: Slide[] = [
  {
    title: "Welcome",
    poster: "/images/ironmanposter.jpeg",
    backdrop: "/images/ironmanbg.jpg",
  },
];

async function fetchAuthFeatured(): Promise<Slide[]> {
  const base = process.env.NEST_API_URL || "http://localhost:4000";
  try {
    const res = await fetch(`${base}/all/trending`, {
      next: { revalidate: 180 },
    });
    if (!res.ok) return fallbackSlides;
    const data = (await res.json()) as unknown;
    const slides: Slide[] = (Array.isArray(data) ? data : [])
      .filter(
        (x: unknown): x is FeaturedItem =>
          typeof x === "object" &&
          x !== null &&
          Boolean((x as FeaturedItem).poster_path) &&
          Boolean((x as FeaturedItem).backdrop_path),
      )
      .slice(0, 5)
      .map((x) => ({
        id: typeof x?.id === "number" ? x.id : undefined,
        title: x?.title || x?.name || "Featured",
        poster: x?.poster_path
          ? tmdbImage(x.poster_path, "w500")
          : "/images/ironmanposter.jpeg",
        backdrop: x?.backdrop_path
          ? tmdbImage(x.backdrop_path, "original")
          : "/images/ironmanbg.jpg",
        rating:
          typeof x?.vote_average === "number"
            ? Math.round(x.vote_average * 10) / 10
            : undefined,
        year:
          (x?.release_date || x?.first_air_date || "").slice(0, 4) ||
          undefined,
        genre: Array.isArray(x?.genres) ? x.genres[0] : undefined,
        kind:
          x?.type === "tv" ? "tv" : x?.type === "movie" ? "movie" : undefined,
      }));
    return slides.length ? slides : fallbackSlides;
  } catch {
    return fallbackSlides;
  }
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const slides = await fetchAuthFeatured();

  return (
    <main className="relative min-h-[100dvh] bg-black text-white overflow-hidden flex items-center justify-center px-4 py-4 sm:px-6">
      <AuthBackground slides={slides} rotationMs={10000} />
      <AuthLayoutClient slides={slides}>{children}</AuthLayoutClient>
    </main>
  );
}
