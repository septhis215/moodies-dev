"use client";

import Link from "next/link";
import { Bookmark, BookmarkCheck } from "lucide-react";
import type { All } from "@/types/all";
import { tmdbImage } from "@/lib/tmdb";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useRouter } from "next/navigation";
import { useState } from "react";
import RatingBadge from "@/components/ui/rating-badge";

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
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
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
    <article className="relative min-w-0">
      <Link href={`${hrefBase}/${item.id}`} className="group block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)]">
        <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-[var(--surface-2)]">
          <Image
            src={poster}
            alt={title}
            fill
            sizes="(max-width: 640px) 44vw, (max-width: 1024px) 24vw, 180px"
            className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.025]"
          />
          <RatingBadge
            rating={item.vote_average}
            placement="poster"
            variant="colored"
            size="sm"
            className="absolute right-2 top-2 z-10"
          />
        </div>
        <h3 className="mt-2.5 line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)] transition-colors group-hover:text-[var(--brand-coral-strong)]">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
          {year || "Date TBA"}
        </p>
      </Link>
      <button
        type="button"
        onClick={toggleSaved}
        disabled={loading}
        aria-pressed={saved}
        className={`absolute left-2 top-2 z-20 grid size-11 place-items-center rounded-sm border border-white/25 shadow-[0_6px_18px_rgba(0,0,0,0.35)] text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60 ${
          saved
            ? "bg-[var(--brand-coral)]"
            : "bg-[#0b0909]/90 hover:bg-[var(--ink)] hover:text-[var(--surface-0)]"
        }`}
        aria-label={
          saved ? `Remove ${title} from My List` : `Add ${title} to My List`
        }
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
        ) : saved ? (
          <BookmarkCheck className="h-4 w-4" />
        ) : (
          <Bookmark className="h-4 w-4" />
        )}
      </button>
    </article>
  );
}
