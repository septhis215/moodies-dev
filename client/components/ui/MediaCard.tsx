"use client";

import { PosterSkeleton } from "@/components/loading/PageSkeleton";
import Link from "next/link";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { PosterSaveButton } from "@/components/ui/PosterSaveButton";
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
  const metadata = [type === "tv" ? "Series" : "Movie", yearOf(item) || "Date TBA"];

  return (
    <article className={cn("group relative min-w-0", className)}>
      <Link href={href} className="ui-card-link block">
        <div className="ui-media-artwork ui-poster">
          <Image
            src={poster}
            alt=""
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 23vw, 180px"
            className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.025]"
          />
          <RatingBadge rating={item.vote_average} placement="poster" />
        </div>
        <h3 className="ui-poster-title">{title}</h3>
        <p className="ui-poster-meta">{metadata.join(" · ")}</p>
      </Link>
      {onToggleSave && (
        <PosterSaveButton title={title} saved={saved} saving={saving} onClick={onToggleSave} label={actionLabel} />
      )}
      {item.reason ? (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-brand-coral-strong">
          {item.reason}
        </p>
      ) : null}
    </article>
  );
}

export function MediaCardSkeleton() {
  return <PosterSkeleton />;
}

export default MediaCard;
