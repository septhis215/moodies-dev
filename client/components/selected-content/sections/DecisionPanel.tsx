import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, Clock3, Eye, Heart, MessageSquare } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import type { MovieDetailsData, TrailerData, TvDetailsData } from "@/components/selected-content/types";
import { tmdbImage } from "@/lib/tmdb";
import TrailerBackground from "./TrailerBackground";

type DecisionPanelProps = {
  data: MovieDetailsData | TvDetailsData;
  trailers?: TrailerData[];
  children?: ReactNode;
  topMoods?: Array<{ emoji: string; count: number }>;
  reviewStats?: { totalRatings: number; averageRating: number } | null;
};

function formatRuntime(minutes: number): string {
  if (!minutes) return "Runtime unavailable";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
}

function yearOf(date: string): string | null {
  return date ? date.slice(0, 4) : null;
}

function isImagePath(value: string): boolean {
  return value.startsWith("/") || value.startsWith("http://") || value.startsWith("https://");
}

export default function DecisionPanel({
  data,
  trailers = [],
  topMoods = [],
  reviewStats,
  children,
}: DecisionPanelProps) {
  const info = data.info;
  const isTv = info.content_type === "tv";
  const tvInfo = isTv ? (data as TvDetailsData).info : null;
  const mediaPath = isTv ? "tv" : "movies";
  const appRating = reviewStats?.totalRatings ? reviewStats.averageRating : null;
  const rating = appRating ?? info.vote_average;
  const ratingLabel = appRating ? "Moodies audience" : "TMDB";
  const date = info.release_date || tvInfo?.first_air_date || "";
  const moodLabels = topMoods.slice(0, 3);
  const firstTrailer = [data.trailer, ...trailers].find(
    (video) => video?.key && (!video.site || video.site.toLowerCase() === "youtube"),
  );

  return (
    <section className="relative isolate overflow-hidden bg-[var(--surface-0)]" aria-labelledby="decision-heading">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {info.backdrop_path ? (
          <Image src={tmdbImage(info.backdrop_path, "original")} alt="" fill sizes="100vw" className="object-cover" />
        ) : null}
        {firstTrailer?.key ? <TrailerBackground videoKey={firstTrailer.key} /> : null}
        <div className="absolute inset-0 bg-[var(--surface-0)]/60" />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--surface-0)] via-transparent to-[var(--surface-0)]" />
      </div>
      <div className="ui-shell relative flex min-h-[28rem] flex-col justify-center py-8 sm:min-h-[36rem] sm:py-10">
      <div className="grid gap-6 border-b border-[var(--surface-border)] py-6 sm:py-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="ui-kicker">Find your next watch</p>
          <h2 id="decision-heading" className="mt-2 text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">
            Does this fit your mood?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
            A quick read of the audience signal, score, and format before you spend time with it.
          </p>
          {info.genres.length ? (
            <div className="mt-5 flex flex-wrap gap-2" aria-label="Genres">
              {info.genres.slice(0, 4).map((genre) => (
                <span key={genre.id} className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-1)]/70 px-3 py-1 text-xs font-semibold text-[var(--ink-muted)]">
                  {genre.name}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-xs text-[var(--ink-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-brand-coral-strong" aria-hidden="true" />
              {yearOf(date) || "Year unknown"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5 text-brand-coral-strong" aria-hidden="true" />
              {isTv ? `${tvInfo?.number_of_seasons || "?"} seasons` : formatRuntime(info.runtime)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 text-brand-coral-strong" aria-hidden="true" />
              {rating ? `${rating.toFixed(1)} ${ratingLabel}` : "No score yet"}
            </span>
            {reviewStats?.totalRatings ? (
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-brand-coral-strong" aria-hidden="true" />
                {reviewStats.totalRatings} ratings
              </span>
            ) : null}
          </div>
          {moodLabels.length ? (
            <div className="mt-5" role="group" aria-labelledby="audience-mood-heading">
              <h3 id="audience-mood-heading" className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                Audience mood
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-2">
              {moodLabels.map((mood) => (
                <span
                  key={mood.emoji}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-coral/25 bg-brand-coral/[0.08] py-1 pl-1.5 pr-2 text-xs font-semibold text-brand-coral-strong"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.08] p-1">
                    {isImagePath(mood.emoji) ? (
                      <Image
                        src={mood.emoji}
                        alt=""
                        width={32}
                        height={32}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      mood.emoji
                    )}
                  </span>
                  <span>{mood.count}</span>
                </span>
              ))}
              </div>
            </div>
          ) : null}
        </div>
        <Link href={`/${mediaPath}/${info.id}/reviews`} className="ui-primary-action w-full sm:w-auto">
          Reviews
          <Eye className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      {children ? <div className="mt-8 min-w-0 sm:mt-10">{children}</div> : null}
      </div>
    </section>
  );
}
