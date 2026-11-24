"use client";

import { PosterSkeleton } from "@/components/loading/PageSkeleton";
import IntentPrefetchLink from "@/components/ui/IntentPrefetchLink";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { PosterActions } from "@/components/ui/PosterActions";
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
  status?: string | null;
  reason?: string;
};

type MediaCardProps = {
  item: MediaCardItem;
  type?: "movie" | "tv";
  saved?: boolean;
  saving?: boolean;
  onToggleSave?: () => void | Promise<void>;
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
  saved,
  saving,
  onToggleSave,
  actionLabel,
  className,
}: MediaCardProps) {
  const title = item.title || item.name || "Untitled";
  const href = type === "tv" ? `/tv/${item.id}` : `/movies/${item.id}`;
  const poster = item.poster_path
    ? tmdbImage(item.poster_path, "w342")
    : "/placeholder-poster.svg";
  const year = yearOf(item);

  return (
    <article className={cn("group relative min-w-0", className)}>
      <div className="relative">
        <IntentPrefetchLink href={href} aria-label={title} className="ui-card-link ui-media-artwork ui-poster block">
          <Image
            src={poster}
            alt=""
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 23vw, 180px"
            className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.025]"
          />
        </IntentPrefetchLink>
      </div>
      <IntentPrefetchLink href={href} tabIndex={-1} className="ui-card-link block">
        <h3 className="ui-poster-title">{title}</h3>
        {year && <p className="ui-poster-meta">{year}</p>}
      </IntentPrefetchLink>
      {item.reason ? (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-brand-coral-strong">
          {item.reason}
        </p>
      ) : null}
      <PosterActions id={item.id} type={type} title={title} rating={item.vote_average} releaseDate={type === "tv" ? item.first_air_date || item.release_date : item.release_date} status={item.status} posterUrl={poster} saved={saved} saving={saving} onToggleSave={onToggleSave} saveLabel={actionLabel} />
    </article>
  );
}

export function MediaCardSkeleton() {
  return <PosterSkeleton />;
}

export default MediaCard;
