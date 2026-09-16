"use client";

import Link from "next/link";
import { Bookmark, BookmarkCheck, LoaderCircle } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import RatingBadge from "@/components/ui/rating-badge";
import { tmdbImage } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

export type MediaCardItem = {
  id: number;
  type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  vote_average?: number;
  release_date?: string | null;
  first_air_date?: string | null;
  reason?: string;
};

type MediaCardProps = {
  item: MediaCardItem;
  type?: "movie" | "tv";
  saved?: boolean;
  saving?: boolean;
  onToggleSave?: () => void;
  actionLabel?: string;
  className?: string;
};

function yearOf(item: MediaCardItem): string | null {
  const date = item.release_date || item.first_air_date;
  return date?.slice(0, 4) || null;
}

export function MediaCard({
  item,
  type = item.type === "tv" ? "tv" : "movie",
  saved = false,
  saving = false,
  onToggleSave,
  actionLabel,
  className,
}: MediaCardProps) {
  const title = item.title || item.name || "Untitled";
  const href = type === "tv" ? `/tv/${item.id}` : `/movies/${item.id}`;
  const poster = item.poster_path
    ? tmdbImage(item.poster_path, "w342")
    : "/placeholder-poster.svg";

  return (
    <article className={cn("group relative min-w-0", className)}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 bg-surface-1 shadow-xl shadow-black/20">
        <Link href={href} className="block h-full focus-visible:outline-none">
          <Image
            src={poster}
            alt={title}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 23vw, 180px"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />
          <div className="absolute right-2.5 top-2.5">
            <RatingBadge rating={item.vote_average} size="sm" />
          </div>
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="line-clamp-2 text-sm font-black leading-tight text-white">
              {title}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-white/55">
              {yearOf(item) ? <span>{yearOf(item)}</span> : null}
              {type === "tv" ? <span>Series</span> : <span>Movie</span>}
            </div>
          </div>
        </Link>

        {onToggleSave ? (
          <button
            type="button"
            onClick={onToggleSave}
            disabled={saving}
            aria-label={actionLabel || (saved ? "Remove from collection" : "Save to collection")}
            title={actionLabel || (saved ? "Remove from collection" : "Save to collection")}
            className={cn(
              "absolute left-2.5 top-2.5 grid h-10 w-10 place-items-center rounded-xl border text-white shadow-lg backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral-strong",
              saved
                ? "border-brand-coral/40 bg-brand-coral text-white"
                : "border-white/15 bg-black/55 hover:border-white/35 hover:bg-black/75",
            )}
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : saved ? (
              <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Bookmark className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
      {item.reason ? (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-brand-coral-strong">
          {item.reason}
        </p>
      ) : null}
    </article>
  );
}

export function MediaCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] rounded-2xl bg-white/[0.07]" />
      <div className="mt-3 h-4 w-4/5 rounded bg-white/[0.07]" />
      <div className="mt-2 h-3 w-1/3 rounded bg-white/[0.05]" />
    </div>
  );
}

export default MediaCard;
