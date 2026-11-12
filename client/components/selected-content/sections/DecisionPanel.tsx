import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Star } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import type { MovieDetailsData, TrailerData, TvDetailsData } from "@/components/selected-content/types";
import { tmdbImage } from "@/lib/tmdb";
import TrailerBackground from "./TrailerBackground";
import { AudienceMood } from "../AudienceMood";

type DecisionPanelProps = {
  data: MovieDetailsData | TvDetailsData;
  trailers?: TrailerData[];
  children?: ReactNode;
  topMoods?: Array<{ emoji: string; count: number }>;
  totalMoodVotes?: number;
  reviewStats?: { totalRatings: number; averageRating: number } | null;
};

export default function DecisionPanel({
  data,
  trailers = [],
  topMoods = [],
  totalMoodVotes,
  reviewStats,
  children,
}: DecisionPanelProps) {
  const info = data.info;
  const mediaPath = info.content_type === "tv" ? "tv" : "movies";
  const appRating = reviewStats?.totalRatings ? reviewStats.averageRating : null;
  const rating = appRating ?? info.vote_average;
  const ratingLabel = appRating !== null ? "Moodies" : "TMDb";
  const firstTrailer = [data.trailer, ...trailers].find(
    (video) => video?.key && (!video.site || video.site.toLowerCase() === "youtube"),
  );

  return (
    <section className="relative isolate overflow-hidden bg-surface-0" aria-labelledby="decision-heading">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {info.backdrop_path ? (
          <Image src={tmdbImage(info.backdrop_path, "original")} alt="" fill sizes="100vw" className="object-cover" />
        ) : null}
        {firstTrailer?.key ? <TrailerBackground videoKey={firstTrailer.key} /> : null}
        <div className="absolute inset-0 bg-surface-0/85" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface-0 via-transparent to-surface-0" />
      </div>
      <div className="ui-shell relative py-8 sm:py-10">
        <div className="mb-5 flex flex-col gap-5 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="ui-kicker">Community perspective</p>
            <h2 id="decision-heading" className="mt-2 text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">
              Does this fit your mood?
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
              See how viewers felt about {info.title}.
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--ink-muted)]">
              {rating > 0 ? <>
                <Star className="h-4 w-4 text-[var(--brand-gold)]" aria-hidden="true" />
                <span><strong className="font-semibold tabular-nums text-[var(--ink)]">{rating.toFixed(1)}</strong>/10 {ratingLabel}</span>
              </> : <span>No score yet</span>}
              {reviewStats?.totalRatings ? <>
                <span aria-hidden="true">&middot;</span>
                <span>{reviewStats.totalRatings.toLocaleString()} {reviewStats.totalRatings === 1 ? "rating" : "ratings"}</span>
              </> : null}
            </p>
          </div>
          <Link href={"/" + mediaPath + "/" + info.id + "/reviews"} className="ui-primary-action w-full shrink-0 rounded-full shadow-none hover:transform-none sm:w-auto">
            Read reviews
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <AudienceMood moods={topMoods} totalVotes={totalMoodVotes} />
        {children ? <div className="mt-8 min-w-0 sm:mt-10">{children}</div> : null}
      </div>
    </section>
  );
}
