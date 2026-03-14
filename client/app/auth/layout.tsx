// app/auth/layout.tsx
import React from "react";
import AuthBackground from "./AuthBackground";
import AuthPoster from "./AuthPoster";
import AuthLayoutClient from "./AuthLayoutClient";

type Slide = { title: string; poster: string; backdrop: string };

async function fetchAuthFeatured(): Promise<Slide[]> {
  const base = process.env.NEST_API_URL || "http://localhost:4000";
  const res = await fetch(`${base}/tv/featured`, { next: { revalidate: 180 } });
  if (!res.ok) return [];
  const data = await res.json();
  const slides: Slide[] = (Array.isArray(data) ? data.slice(0, 5) : []).map(
    (x: any) => ({
      title: x?.title || x?.name || "Featured",
      poster: x?.poster_path
        ? `https://image.tmdb.org/t/p/w500${x.poster_path}`
        : "/images/ironmanposter.jpeg",
      backdrop: x?.backdrop_path
        ? `https://image.tmdb.org/t/p/original${x.backdrop_path}`
        : "/images/ironmanbg.jpg",
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
    <main className="relative min-h-screen bg-black text-white overflow-hidden flex items-center justify-center">
      <AuthBackground slides={slides} rotationMs={10000} />
      <AuthLayoutClient slides={slides}>{children}</AuthLayoutClient>
    </main>
  );
}
