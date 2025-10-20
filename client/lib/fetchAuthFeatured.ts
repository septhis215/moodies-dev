// src/lib/fetchAuthFeatured.ts
import { tmdbImage } from "@/lib/tmdb";

export async function fetchAuthFeatured() {
  const TMDB_KEY = process.env.TMDB_KEY; 
  if (!TMDB_KEY) {
    console.error("Missing TMDB_KEY in environment");
    return null;
  }

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_KEY}`,
      { next: { revalidate: 3600 } } // cache for 1 hour
    );

    if (!res.ok) {
      console.error("TMDB fetch failed:", res.statusText);
      return null;
    }

    const data = await res.json();
    const first = data.results?.[0];
    if (!first) return null;

    return {
      title: first.name,
      poster: tmdbImage(first.poster_path, "w500"),
      backdrop: tmdbImage(first.backdrop_path, "w1280"),
    };
  } catch (err) {
    console.error("TMDB fetch error:", err);
    return null;
  }
}
