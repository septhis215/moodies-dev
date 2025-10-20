import React from "react";
import AuthBackground from "./AuthBackground";
import AuthPoster from "./AuthPoster";

type Slide = { title: string; poster: string; backdrop: string };

async function fetchAuthFeatured(): Promise<Slide[]> {
  const base = process.env.NEST_API_URL || "http://localhost:4000";
  const res = await fetch(`${base}/tv/featured`, { next: { revalidate: 180 } });
  if (!res.ok) return [];

  const data = await res.json();
  // take top 5 and build slide objects
  const slides: Slide[] = (Array.isArray(data) ? data.slice(0, 5) : [])
    .map((x: any) => ({
      title: x?.title || x?.name || "Featured",
      poster: x?.poster_path
        ? `https://image.tmdb.org/t/p/w500${x.poster_path}`
        : "/images/ironmanposter.jpeg",
      backdrop: x?.backdrop_path
        ? `https://image.tmdb.org/t/p/original${x.backdrop_path}`
        : "/images/ironmanbg.jpg",
    }));

  // fallback if endpoint empty
  return slides.length ? slides : [{
    title: "Welcome",
    poster: "/images/ironmanposter.jpeg",
    backdrop: "/images/ironmanbg.jpg",
  }];
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const slides = await fetchAuthFeatured();

  return (
    <main className="relative min-h-screen bg-black text-white overflow-hidden flex items-center justify-center">
      {/* Rotating background behind everything */}
      <AuthBackground slides={slides} rotationMs={10000} />

      {/* Unified glass card with poster + form */}
      <div className="relative z-10 w-full max-w-5xl mx-auto p-6 sm:p-8 lg:p-10 rounded-3xl
                      bg-black/55 backdrop-blur-xl border border-white/10
                      shadow-[0_10px_80px_-15px_rgba(0,0,0,0.9)]
                      flex flex-col md:flex-row items-center gap-8 animate-fadeIn">

        {/* Poster (rotating) */}
        <div className="w-full md:w-1/2 flex justify-center">
          <AuthPoster slides={slides} rotationMs={10000} />
        </div>

        {/* Form slot */}
        <div className="w-full md:w-1/2">
          <div className="rounded-2xl bg-black/35 border border-white/10 p-6 sm:p-7">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
