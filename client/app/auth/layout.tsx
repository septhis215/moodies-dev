// app/auth/layout.tsx
import React from "react";
import AuthBackground from "./AuthBackground";
import AuthPoster from "./AuthPoster";
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

async function fetchAuthFeatured(): Promise<Slide[]> {
  const base = process.env.NEST_API_URL || "http://localhost:4000";
  const res = await fetch(`${base}/all/trending`, {
    next: { revalidate: 180 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const slides: Slide[] = (Array.isArray(data) ? data : [])
    .filter((x: any) => x?.poster_path && x?.backdrop_path)
    .slice(0, 5)
    .map((x: any) => ({
      id: typeof x?.id === "number" ? x.id : undefined,
      title: x?.title || x?.name || "Featured",
      poster: x?.poster_path
        ? `https://image.tmdb.org/t/p/w500${x.poster_path}`
        : "/images/ironmanposter.jpeg",
      backdrop: x?.backdrop_path
        ? `https://image.tmdb.org/t/p/original${x.backdrop_path}`
        : "/images/ironmanbg.jpg",
      rating:
        typeof x?.vote_average === "number"
          ? Math.round(x.vote_average * 10) / 10
          : undefined,
      year: (x?.release_date || x?.first_air_date || "").slice(0, 4) || undefined,
      genre: Array.isArray(x?.genres) ? x.genres[0] : undefined,
      kind: x?.type === "tv" ? "tv" : x?.type === "movie" ? "movie" : undefined,
    }),
  );
  return slides.length
    ? slides
    : [
        {
          title: "Welcome",
          poster: "/images/ironmanposter.jpeg",
          backdrop: "/images/ironmanbg.jpg",
        },
      ];
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
