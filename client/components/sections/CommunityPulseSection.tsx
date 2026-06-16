"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertCircle,
  Bookmark,
  Heart,
  Loader2,
  MessageSquare,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import type {
  CommunityPulseData,
  CommunityPulseItem,
} from "@/types/communityPulse";
import { fmtCount } from "@/utils/mediaStatsClient";

type MediaType = "movie" | "tv";
type PulseMetric = "liked" | "saved" | "reviewed";

type MetricTheme = {
  label: string;
  shortLabel: string;
  icon: ReactNode;
  text: string;
  bg: string;
  border: string;
  soft: string;
  hoverBorder: string;
};

type PulseLane = {
  metric: PulseMetric;
  title: string;
  description: string;
  data: CommunityPulseItem[];
};

type CommunityPulseSectionProps = {
  data?: CommunityPulseData;
  mediaType: MediaType;
  isLoading?: boolean;
  error?: string | null;
};

const METRIC_THEME: Record<PulseMetric, MetricTheme> = {
  liked: {
    label: "Likes",
    shortLabel: "Liked",
    icon: <Heart className="h-3.5 w-3.5" />,
    text: "text-pink-300",
    bg: "bg-pink-400/10",
    border: "border-pink-400/25",
    soft: "bg-pink-400/5",
    hoverBorder: "hover:border-pink-300/35",
  },
  saved: {
    label: "Saves",
    shortLabel: "Saved",
    icon: <Bookmark className="h-3.5 w-3.5" />,
    text: "text-emerald-300",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/25",
    soft: "bg-emerald-400/5",
    hoverBorder: "hover:border-emerald-300/35",
  },
  reviewed: {
    label: "Reviews",
    shortLabel: "Reviewed",
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    text: "text-blue-300",
    bg: "bg-blue-400/10",
    border: "border-blue-400/25",
    soft: "bg-blue-400/5",
    hoverBorder: "hover:border-blue-300/35",
  },
};

const getPosterUrl = (path?: string | null) =>
  path ? `https://image.tmdb.org/t/p/w500${path}` : "/placeholder-poster.svg";

const getItemHref = (mediaType: MediaType, id: number) =>
  mediaType === "tv" ? `/tv/${id}` : `/movies/${id}`;

const getYear = (item: CommunityPulseItem) =>
  item.release_date ? item.release_date.split("-")[0] : "TBA";

const getStatValue = (item: CommunityPulseItem, metric: PulseMetric) => {
  if (metric === "liked") return item.likeCount;
  if (metric === "saved") return item.savedCount;
  return item.reviewCount;
};

function StatPill({
  metric,
  value,
  compact = false,
}: {
  metric: PulseMetric;
  value: number;
  compact?: boolean;
}) {
  const theme = METRIC_THEME[metric];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${theme.border} ${theme.bg} px-2 py-1 font-bold ${theme.text} ${
        compact ? "text-[10px]" : "text-xs"
      }`}
    >
      {theme.icon}
      <span>{fmtCount(value)}</span>
      {!compact && <span className="text-white/45">{theme.label}</span>}
    </span>
  );
}

function PosterThumb({
  item,
  priority = false,
}: {
  item: CommunityPulseItem;
  priority?: boolean;
}) {
  return (
    <div className="relative h-[78px] w-[52px] shrink-0 overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/10 sm:h-[84px] sm:w-14">
      <Image
        src={getPosterUrl(item.poster_path)}
        alt={item.title}
        fill
        priority={priority}
        sizes="56px"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
    </div>
  );
}

function FeaturedWinnerCard({
  item,
  metric,
  mediaType,
}: {
  item: CommunityPulseItem;
  metric: PulseMetric;
  mediaType: MediaType;
}) {
  const theme = METRIC_THEME[metric];
  const mediaLabel = mediaType === "tv" ? "Series" : "Movie";

  return (
    <Link
      href={getItemHref(mediaType, item.id)}
      className={`group relative block overflow-hidden rounded-2xl border ${theme.border} bg-zinc-950 shadow-xl shadow-black/25 transition-all duration-200 hover:bg-zinc-900/95 ${theme.hoverBorder}`}
    >
      <div className={`pointer-events-none absolute inset-0 ${theme.soft}`} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20" />

      <div className="relative grid grid-cols-[5.75rem_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[7.25rem_minmax(0,1fr)] sm:gap-4 sm:p-4">
        <div className="relative">
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10">
            <Image
              src={getPosterUrl(item.poster_path)}
              alt={item.title}
              fill
              priority
              sizes="128px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
          </div>
          <div
            className={`absolute -left-2 -top-2 flex h-10 w-10 items-center justify-center rounded-2xl border ${theme.border} bg-black/90 text-base font-black ${theme.text} shadow-xl shadow-black/40 backdrop-blur sm:h-12 sm:w-12 sm:text-lg`}
          >
            1
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between py-1">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border ${theme.border} ${theme.bg} px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${theme.text}`}
              >
                <Trophy className="h-3 w-3" />
                Top Pulse
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.055] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                {mediaLabel}
              </span>
            </div>

            <h4 className="line-clamp-2 text-base font-black leading-tight text-white sm:text-xl">
              {item.title}
            </h4>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1 font-bold text-white">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {item.vote_average > 0 ? item.vote_average.toFixed(1) : "New"}
              </span>
              <span>{getYear(item)}</span>
            </div>
          </div>

          <div className="mt-3 sm:mt-4">
            <div
              className={`mb-2 inline-flex items-center gap-1.5 rounded-full border ${theme.border} ${theme.bg} px-3 py-1.5 text-xs font-black ${theme.text}`}
            >
              {theme.icon}
              {fmtCount(getStatValue(item, metric))} {theme.label}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {metric !== "liked" && (
                <StatPill metric="liked" value={item.likeCount} compact />
              )}
              {metric !== "saved" && (
                <StatPill metric="saved" value={item.savedCount} compact />
              )}
              {metric !== "reviewed" && (
                <StatPill metric="reviewed" value={item.reviewCount} compact />
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function RankingRow({
  item,
  rank,
  metric,
  mediaType,
}: {
  item: CommunityPulseItem;
  rank: number;
  metric: PulseMetric;
  mediaType: MediaType;
}) {
  const theme = METRIC_THEME[metric];
  const mediaLabel = mediaType === "tv" ? "Series" : "Movie";

  return (
    <Link
      href={getItemHref(mediaType, item.id)}
      className={`group grid grid-cols-[2.25rem_3.25rem_minmax(0,1fr)] gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-2.5 transition-all duration-200 hover:bg-white/[0.06] ${theme.hoverBorder} sm:grid-cols-[2.75rem_3.5rem_minmax(0,1fr)] sm:p-3`}
    >
      <div className="flex items-start justify-center pt-1">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl border text-sm font-black ${theme.border} ${theme.soft} ${theme.text} sm:h-9 sm:w-9`}
        >
          {rank}
        </span>
      </div>

      <PosterThumb item={item} priority={rank === 1} />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-white/10 bg-white/[0.055] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
            {mediaLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-black text-amber-200 ring-1 ring-amber-400/20">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {item.vote_average > 0 ? item.vote_average.toFixed(1) : "New"}
          </span>
          <span className="text-[11px] font-semibold text-zinc-500">
            {getYear(item)}
          </span>
        </div>

        <h4 className="mt-1.5 line-clamp-2 text-sm font-black leading-tight text-white transition-colors group-hover:text-white sm:text-[15px]">
          {item.title}
        </h4>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <StatPill metric="liked" value={item.likeCount} compact />
          <StatPill metric="saved" value={item.savedCount} compact />
          <StatPill metric="reviewed" value={item.reviewCount} compact />
        </div>
      </div>
    </Link>
  );
}

function PulseLaneCard({
  lane,
  mediaType,
}: {
  lane: PulseLane;
  mediaType: MediaType;
}) {
  const theme = METRIC_THEME[lane.metric];
  const leader = lane.data[0];

  return (
    <article className="rounded-2xl border border-white/10 bg-zinc-950/80 p-3 shadow-xl shadow-black/20 ring-1 ring-white/[0.04] sm:p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${theme.border} ${theme.bg} ${theme.text}`}
          >
            {theme.icon}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-black text-white sm:text-lg">
              {lane.title}
            </h3>
            <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-5 text-zinc-500">
              {lane.description}
            </p>
          </div>
        </div>
      </div>

      {leader ? (
        <>
          <FeaturedWinnerCard
            item={leader}
            metric={lane.metric}
            mediaType={mediaType}
          />
          <div className="mt-2 space-y-2.5">
            {lane.data.slice(1, 5).map((item, index) => (
              <RankingRow
                key={`${lane.metric}-${item.id}`}
                item={item}
                rank={index + 2}
                metric={lane.metric}
                mediaType={mediaType}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyLane metric={lane.metric} />
      )}
    </article>
  );
}

function EmptyLane({ metric }: { metric: PulseMetric }) {
  const theme = METRIC_THEME[metric];

  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-5 text-center">
      <div
        className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border ${theme.border} ${theme.bg} ${theme.text}`}
      >
        {theme.icon}
      </div>
      <p className="text-sm font-bold text-white">No rankings yet</p>
      <p className="mt-1 text-xs leading-5 text-zinc-500">
        Community activity will appear here once members start engaging.
      </p>
    </div>
  );
}

function PulseState({
  icon,
  title,
  message,
}: {
  icon: ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-8 text-center shadow-xl shadow-black/20">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] text-[#ff8b78]">
        {icon}
      </div>
      <h3 className="text-lg font-black text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
        {message}
      </p>
    </div>
  );
}

function PulseSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {[0, 1, 2].map((lane) => (
        <div
          key={lane}
          className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-white/10" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
              <div className="mt-2 h-3 w-40 animate-pulse rounded bg-white/[0.07]" />
            </div>
          </div>
          <div className="space-y-3">
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                className="grid grid-cols-[2.25rem_3.25rem_1fr] gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-2.5"
              >
                <div className="h-8 w-8 animate-pulse rounded-xl bg-white/10" />
                <div className="h-[78px] w-[52px] animate-pulse rounded-lg bg-white/10" />
                <div className="min-w-0 pt-1">
                  <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
                  <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-white/10" />
                  <div className="mt-3 h-3 w-full animate-pulse rounded bg-white/[0.07]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
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
  const lanes: PulseLane[] = [
    {
      metric: "liked",
      title: "Most Liked",
      description: `The ${mediaLabel} getting the warmest reactions.`,
      data: data?.mostLiked ?? [],
    },
    {
      metric: "saved",
      title: "Most Saved",
      description: `Watchlist picks people are saving for later.`,
      data: data?.mostSaved ?? [],
    },
    {
      metric: "reviewed",
      title: "Most Reviewed",
      description: `The ${mediaLabel} driving the most conversation.`,
      data: data?.mostReviewed ?? [],
    },
  ];

  const shouldShowLoading = isLoading || (!data && !error);
  const hasItems = lanes.some((lane) => lane.data.length > 0);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/75 p-4 shadow-2xl shadow-black/30 sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(233,79,55,0.055),transparent_34%),radial-gradient(circle_at_86%_10%,rgba(244,114,182,0.07),transparent_22%),radial-gradient(circle_at_14%_88%,rgba(52,211,153,0.055),transparent_24%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />

      <div className="relative mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#e94f37]/25 bg-[#e94f37]/10 text-[#ff8b78] shadow-xl shadow-black/20 sm:h-12 sm:w-12">
            <Users className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ff8b78]">
              Community leaderboard
            </p>
            <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl lg:text-4xl">
              Community Pulse
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-zinc-400">
              A quick read on what Moodies members are liking, saving, and
              reviewing most right now.
            </p>
          </div>
        </div>

        <div className="grid w-full grid-cols-3 gap-2 lg:w-auto">
          {(["liked", "saved", "reviewed"] as PulseMetric[]).map((metric) => {
            const theme = METRIC_THEME[metric];
            return (
              <div
                key={metric}
                className={`rounded-2xl border ${theme.border} ${theme.bg} px-3 py-2`}
              >
                <div className={`flex items-center gap-1.5 ${theme.text}`}>
                  {theme.icon}
                  <span className="text-[11px] font-black uppercase tracking-[0.12em]">
                    {theme.shortLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative">
        {shouldShowLoading ? (
          <PulseSkeleton />
        ) : error ? (
          <PulseState
            icon={<AlertCircle className="h-5 w-5" />}
            title="Community pulse is unavailable"
            message={error}
          />
        ) : hasItems ? (
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scroll-smooth xl:mx-0 xl:grid xl:grid-cols-3 xl:gap-4 xl:overflow-visible xl:px-0 xl:pb-0">
            {lanes.map((lane) => (
              <div
                key={lane.metric}
                className="w-[88vw] max-w-[390px] shrink-0 snap-start xl:w-auto xl:max-w-none"
              >
                <PulseLaneCard lane={lane} mediaType={mediaType} />
              </div>
            ))}
            <div className="w-1 shrink-0 xl:hidden" aria-hidden="true" />
          </div>
        ) : (
          <PulseState
            icon={<Trophy className="h-5 w-5" />}
            title="No community rankings yet"
            message="Likes, saves, and reviews will appear here once the community starts engaging with these titles."
          />
        )}
      </div>

      {shouldShowLoading && (
        <div className="sr-only" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading community pulse rankings
        </div>
      )}
    </section>
  );
}
