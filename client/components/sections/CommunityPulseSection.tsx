"use client";

import Link from "next/link";
import { AlertCircle, Bookmark, Heart, MessageSquare } from "lucide-react";
import type {
  CommunityPulseData,
  CommunityPulseItem,
} from "@/types/communityPulse";
import { tmdbImage } from "@/lib/tmdb";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import RatingBadge from "@/components/ui/rating-badge";
import { fmtCount } from "@/utils/mediaStatsClient";

type MediaType = "movie" | "tv";
type PulseMetric = "liked" | "saved" | "reviewed";

type CommunityPulseSectionProps = {
  data?: CommunityPulseData;
  mediaType: MediaType;
  isLoading?: boolean;
  error?: string | null;
};

type CommunitySignal = {
  metric: PulseMetric;
  item: CommunityPulseItem;
};

const getPosterUrl = (path?: string | null) =>
  path ? tmdbImage(path, "posterCard") : "/placeholder-poster.svg";

const getItemHref = (mediaType: MediaType, id: number) =>
  mediaType === "tv" ? `/tv/${id}` : `/movies/${id}`;

const getYear = (item: CommunityPulseItem) =>
  item.release_date?.split("-")[0] || "TBA";

const signalIcon = (metric: PulseMetric) => {
  if (metric === "saved") return <Bookmark className="h-3.5 w-3.5" />;
  if (metric === "reviewed") return <MessageSquare className="h-3.5 w-3.5" />;
  return <Heart className="h-3.5 w-3.5" />;
};

const signalCopy = (signal: CommunitySignal) => {
  const { item, metric } = signal;
  if (metric === "saved") {
    return `${fmtCount(item.savedCount)} members saved this for later`;
  }
  if (metric === "reviewed") {
    return `${fmtCount(item.reviewCount)} reviews are keeping this in conversation`;
  }
  return `${fmtCount(item.likeCount)} members gave this a positive signal`;
};

function collectSignals(data: CommunityPulseData): CommunitySignal[] {
  const candidates: CommunitySignal[] = [
    ...data.mostSaved.slice(0, 3).map((item) => ({
      metric: "saved" as const,
      item,
    })),
    ...data.mostReviewed.slice(0, 3).map((item) => ({
      metric: "reviewed" as const,
      item,
    })),
    ...data.mostLiked.slice(0, 3).map((item) => ({
      metric: "liked" as const,
      item,
    })),
  ];

  const seen = new Set<number>();
  return candidates.filter(({ item }) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function PulseLoading() {
  return (
    <div className="grid gap-4 lg:grid-cols-12" aria-hidden="true">
      <div className="h-[280px] animate-pulse rounded-md bg-[var(--surface-1)] lg:col-span-5" />
      <div className="divide-y divide-[var(--surface-border)] border-y border-[var(--surface-border)] lg:col-span-7">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="flex gap-3 py-1.5">
            <div className="h-[50px] w-9 animate-pulse rounded-sm bg-[var(--surface-2)]" />
            <div className="flex-1 space-y-2 pt-1.5">
              <div className="h-3 w-28 animate-pulse rounded bg-[var(--surface-2)]" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--surface-2)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CommunityPulseSection({
  data,
  mediaType,
  isLoading = false,
  error,
}: CommunityPulseSectionProps) {
  const mediaLabel = mediaType === "tv" ? "series" : "movies";
  const signals = data ? collectSignals(data) : [];
  const [leadSignal, ...remainingSignals] = signals;
  const showLoading = isLoading || (!data && !error);

  return (
    <section
      id={`${mediaType}-community-pulse`}
      className="border-t border-[var(--surface-border)] pt-6 sm:pt-7"
      aria-labelledby={`${mediaType}-community-pulse-heading`}
    >
      <div className="mb-4 max-w-2xl">
        <p className="ui-kicker">Community signal</p>
        <h2
          id={`${mediaType}-community-pulse-heading`}
          className="mt-2 text-balance text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
        >
          Community pulse
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          The {mediaLabel} members are saving, reviewing and enjoying right now.
        </p>
      </div>

      {showLoading ? (
        <PulseLoading />
      ) : error ? (
        <div className="flex items-start gap-3 border-y border-[var(--surface-border)] py-6 text-[var(--ink-muted)]">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand-coral-strong)]" />
          <div>
            <p className="font-semibold text-[var(--ink)]">
              Community activity is unavailable
            </p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        </div>
      ) : leadSignal ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <Link
            href={getItemHref(mediaType, leadSignal.item.id)}
            className="group grid min-h-[280px] grid-cols-[38%_1fr] overflow-hidden rounded-md border border-[var(--surface-border)] bg-[var(--surface-1)] transition-colors hover:border-[var(--brand-coral)] lg:col-span-5 lg:grid-cols-[42%_1fr]"
          >
            <div className="relative min-h-full bg-[var(--surface-2)]">
              <Image
                src={getPosterUrl(leadSignal.item.poster_path)}
                alt={leadSignal.item.title}
                fill
                sizes="(max-width: 640px) 100vw, 220px"
                className="object-cover"
              />
            </div>
            <div className="flex min-w-0 flex-col p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--brand-coral-strong)]">
                {signalIcon(leadSignal.metric)}
                Moving now
              </p>
              <h3 className="mt-3 text-xl font-bold leading-none text-[var(--ink)] transition-colors group-hover:text-[var(--brand-coral-strong)]">
                {leadSignal.item.title}
              </h3>
              <p className="mt-2 line-clamp-3 text-sm leading-5 text-[var(--ink-muted)]">
                {signalCopy(leadSignal)}.
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                <RatingBadge
                  rating={leadSignal.item.vote_average}
                  variant="colored"
                  size="sm"
                />
                <span className="text-xs text-[var(--ink-muted)]">
                  {mediaType === "tv" ? "Series" : "Movie"} ·{" "}
                  {getYear(leadSignal.item)}
                </span>
              </div>
            </div>
          </Link>

          <div className="lg:col-span-7">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
              Elsewhere in the community
            </p>
            <ol className="divide-y divide-[var(--surface-border)] border-y border-[var(--surface-border)]">
              {remainingSignals.slice(0, 5).map((signal) => (
                <li key={`${signal.metric}-${signal.item.id}`}>
                  <Link
                    href={getItemHref(mediaType, signal.item.id)}
                    className="group grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2.5 py-1.5"
                  >
                    <span className="relative aspect-[2/3] overflow-hidden rounded-sm bg-[var(--surface-2)]">
                      <Image
                        src={getPosterUrl(signal.item.poster_path)}
                        alt=""
                        fill
                        sizes="54px"
                        className="object-cover"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[var(--ink)] transition-colors group-hover:text-[var(--brand-coral-strong)]">
                        {signal.item.title}
                      </span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-[var(--ink-muted)]">
                        {signalIcon(signal.metric)}
                        <span className="truncate">{signalCopy(signal)}</span>
                      </span>
                    </span>
                    <RatingBadge
                      rating={signal.item.vote_average}
                      variant="minimal"
                      size="sm"
                    />
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <div className="border-y border-[var(--surface-border)] py-8 text-sm text-[var(--ink-muted)]">
          Community activity will appear here once members start engaging with
          these titles.
        </div>
      )}
    </section>
  );
}
