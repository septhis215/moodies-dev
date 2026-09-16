import Link from "next/link";
import { CalendarDays, Clock3, Heart, MessageSquare, Sparkles } from "lucide-react";
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
      <div className="ui-panel grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-8">
        <div>
          <p className="ui-kicker">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Make the call
          </p>
          <h2 id="decision-heading" className="mt-2 text-2xl font-black text-white sm:text-3xl">
            Everything you need before pressing play.
          </h2>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/65">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-brand-coral-strong" aria-hidden="true" />
              {yearOf(date) || "Year unknown"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              <Clock3 className="h-3.5 w-3.5 text-brand-coral-strong" aria-hidden="true" />
              {isTv ? `${tvInfo?.number_of_seasons || "?"} seasons` : formatRuntime(info.runtime)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              <Heart className="h-3.5 w-3.5 text-brand-coral-strong" aria-hidden="true" />
              {rating ? `${rating.toFixed(1)} ${ratingLabel}` : "No score yet"}
            </span>
            {reviewStats?.totalRatings ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-brand-coral-strong" aria-hidden="true" />
                {reviewStats.totalRatings} ratings
              </span>
            ) : null}
          </div>
          {moodLabels.length ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-bold uppercase tracking-[0.16em] text-white/35">
                Fits your mood
              </span>
              {moodLabels.map((mood) => (
                <span key={mood.emoji} className="rounded-full bg-brand-coral/12 px-3 py-1.5 text-xs font-semibold text-brand-coral-strong">
                  {mood.emoji} {mood.count}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <Link href={`/${mediaPath}/${info.id}/reviews`} className="ui-primary-action">
          Read community reviews
        </Link>
      </div>
    </section>
  );
}
