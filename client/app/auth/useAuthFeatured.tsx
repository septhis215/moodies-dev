"use client";

import { useEffect, useMemo, useState } from "react";
import { tmdbImage } from "@/lib/tmdb";

type TmdbItem = {
  id: number;
  name?: string;
  title?: string;
  overview: string;
  backdrop_path: string | null;
  poster_path: string | null;
};

type Featured = {
  id: number;
  title: string;
  overview: string;
  backdrop?: string | null;
  poster?: string | null;
};

const SIZE_BACKDROP = "w1280";
const SIZE_POSTER   = "w500";

// simple client-side fetch (no cache; trending = always fresh)
async function fetchTrendingTV(): Promise<TmdbItem[]> {
  const key = process.env.NEXT_PUBLIC_TMDB_KEY;
  if (!key) return [];
  const url = `https://api.themoviedb.org/3/trending/tv/week?language=en-US&api_key=${key}`;
  const res = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return [];
  const json = await res.json();
  return (json?.results ?? []) as TmdbItem[];
}

export default function useAuthFeatured() {
  const [item, setItem] = useState<TmdbItem | null>(null);

  useEffect(() => {
    let alive = true;
    fetchTrendingTV().then((list) => {
      if (!alive) return;
      // pick the first with an image
      const pick = list.find(x => x.backdrop_path || x.poster_path) || null;
      setItem(pick);
      // preload current + a likely next image like HeroCarousel does
      if (pick?.backdrop_path) {
        const i = new window.Image();
        i.src = tmdbImage(pick.backdrop_path, SIZE_BACKDROP) || "";
      }
      if (pick?.poster_path) {
        const i = new window.Image();
        i.src = tmdbImage(pick.poster_path, "w342") || "";
      }
    });
    return () => { alive = false; };
  }, []);

  const featured: Featured | null = useMemo(() => {
    if (!item) return null;
    return {
      id: item.id,
      title: item.name || item.title || "Featured",
      overview: item.overview || "",
      backdrop: item.backdrop_path ? tmdbImage(item.backdrop_path, SIZE_BACKDROP) : null,
      poster:   item.poster_path   ? tmdbImage(item.poster_path,   SIZE_POSTER)   : null,
    };
  }, [item]);

  return featured;
}
