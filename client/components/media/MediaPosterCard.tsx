"use client";

import type { All } from "@/types/all";
import { tmdbImage } from "@/lib/tmdb";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MediaCard } from "@/components/ui/MediaCard";

type Props = {
  item: All;
  hrefBase: "/movies" | "/tv";
  watchType: "movie" | "series";
};

export function MediaPosterCard({ item, hrefBase, watchType }: Props) {
  const router = useRouter();
  const { add, remove, isInWatchlist, ready } = useWatchlist();
  const [loading, setLoading] = useState(false);
  const title = item.title || item.name || "Untitled";
  const saved = isInWatchlist(String(item.id), watchType);
  const poster = item.poster_path
    ? tmdbImage(item.poster_path, "w500")
    : "/placeholder-poster.svg";

  const toggleSaved = async () => {
    if (!ready) {
      router.push("/auth/login");
      return;
    }

    setLoading(true);
    try {
      if (saved) {
        await remove(String(item.id), watchType, { title, posterUrl: poster });
      } else {
        await add(String(item.id), watchType, { title, posterUrl: poster });
      }
    } catch {
      // The watchlist hook reports and reconciles the failure.
    } finally {
      setLoading(false);
    }
  };

  return (
    <MediaCard
      item={item}
      type={hrefBase === "/tv" ? "tv" : "movie"}
      saved={saved}
      saving={loading}
      onToggleSave={toggleSaved}
    />
  );
}
