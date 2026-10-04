import Link from "next/link";
import { CalendarDays, Clock3, Heart, MessageSquare } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import type { MovieDetailsData, TvDetailsData } from "@/components/selected-content/types";

type DecisionPanelProps = {
  data: MovieDetailsData | TvDetailsData;
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
  topMoods = [],
  reviewStats,
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

  return (
    <section className="ui-shell py-8 sm:py-10" aria-labelledby="decision-heading">
      <div className="grid gap-6 border-y border-[var(--surface-border)] py-6 sm:py-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <h2 id="decision-heading" className="mt-2 text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">
            Does this fit your night?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
            A quick read of the audience signal, score, and format before you spend time with it.
          </p>
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
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                Audience mood
              </span>
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
          ) : null}
        </div>
        <Link href={`/${mediaPath}/${info.id}/reviews`} className="ui-primary-action w-full sm:w-auto">
          Read all reviews
        </Link>
      </div>
    </section>
  );
}
