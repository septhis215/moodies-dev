"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Heart,
  MessageCircle,
  Play,
  Share2,
} from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { Pill } from "@/components/ui/pill";
import { SnapshotShareModal } from "@/components/snapshot/SnapshotShareModal";
import { useLiked } from "@/hooks/useLiked";
import { useMediaStats } from "@/hooks/useMediaStats";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useAuth } from '@/app/context/AuthProvider';
import { AudienceMoodPoster } from '../AudienceMoodPoster';
import styles from "./HeroTop.module.css";
import WatchedTitleButton from "@/components/achievements/WatchedTitleButton";
import { fmtCount } from "@/utils/mediaStatsClient";
import { tmdbImage } from "@/lib/tmdb";
import { loadYouTubeApi, YT_PLAYER_STATE, type YouTubePlayer } from "@/lib/youtube-player";
import type {
  MovieDetailsData,
  TrailerData,
  TvDetailsData,
} from "@/components/selected-content/types";

export type Content = {
  id: number;
  title: string;
  year: number | string;
  poster: string;
  backdrop: string;
  genres: string[];
  runtime: string;
  rating: number;
  overview: string;
  tagline?: string;
  director?: string;
  ageRating?: string;
};

type HeroContentCardProps = {
  content?: Content;
  data?: MovieDetailsData | TvDetailsData;
  topMoods?: Array<{ emoji: string; count: number }>;
  totalMoodVotes?: number;
  reviewStats?: { totalRatings: number; averageRating: number };
  trailers?: TrailerData[];
};

function extractYear(dateString: string): string {
  if (!dateString) return "Year unknown";
  const year = new Date(dateString).getFullYear();
  return Number.isNaN(year) ? "Year unknown" : year.toString();
}

function formatRuntime(minutes: number): string {
  if (!minutes) return "Runtime unavailable";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
}

function findDirectorOrCreator(
  crew: MovieDetailsData["credits"]["crew"] | TvDetailsData["credits"]["crew"],
  createdBy?: Array<{ id: number; name: string }>,
): string {
  const director = crew.find((person) => person.job === "Director");
  if (director) return director.name;
  if (createdBy?.length) return createdBy[0].name;
  return "Unknown";
}

function ScoreCard({
  label,
  score,
  detail,
}: {
  label: string;
  score?: number | null;
  detail: string;
}) {
  const hasScore = typeof score === "number" && score > 0;
  const displayScore = hasScore ? score.toFixed(1) : "—";

  return (
    <div>
      <p className="text-xs font-semibold text-[var(--ink-muted)]">
        {label}
      </p>
      <p
        className="mt-2 text-2xl font-bold leading-none tabular-nums text-[var(--ink)]"
      >
        {displayScore}
        {hasScore ? (
          <span className="ml-1 text-xs font-semibold text-[var(--ink-muted)]">/10</span>
        ) : null}
      </p>
      <p className="mt-1 text-xs leading-4 text-[var(--ink-muted)]">{detail}</p>
    </div>
  );
}

function ReadMore({ text, limit = 240 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  const safeText = text?.trim();

  if (!safeText) {
    return <p className="text-sm leading-6 text-[var(--ink-muted)]">No synopsis available yet.</p>;
  }

  const shouldTruncate = safeText.length > limit;
  const display = expanded || !shouldTruncate ? safeText : `${safeText.slice(0, limit).trim()}…`;

  return (
    <p className="text-sm leading-6 text-[var(--ink-muted)]">
      {display}
      {shouldTruncate ? (
        <button
          type="button"
          className="ml-1 font-semibold text-brand-coral-strong underline-offset-4 hover:underline"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Less" : "More"}
        </button>
      ) : null}
    </p>
  );
}

function trailerEmbedUrl(videoKey: string) {
  const autoplay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1;
  return `https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=${autoplay}&mute=1&playsinline=1&controls=1&rel=0&iv_load_policy=3&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
}

function TrailerVideoPlayer({
  videoKey,
  title,
  onEnded,
}: {
  videoKey: string;
  title: string;
  onEnded: () => string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const readyRef = useRef(false);
  const videoKeyRef = useRef(videoKey);
  const onEndedRef = useRef(onEnded);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    videoKeyRef.current = videoKey;
    if (readyRef.current) {
      playerRef.current?.loadVideoById(videoKey);
    } else if (frameRef.current) {
      frameRef.current.src = trailerEmbedUrl(videoKey);
    }
  }, [videoKey]);

  useEffect(() => {
    const frame = frameRef.current;
    if (frame) frame.title = title;
  }, [title]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let player: YouTubePlayer | null = null;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionChange = () => {
      if (motionPreference.matches) playerRef.current?.pauseVideo();
    };
    motionPreference.addEventListener("change", handleMotionChange);
    // Render the working embed immediately; API loading must never leave an empty player.
    // This child is owned imperatively so API cleanup cannot remove a React-owned node.
    const frame = document.createElement("iframe");
    frame.src = trailerEmbedUrl(videoKeyRef.current);
    frame.title = host.getAttribute("aria-label") || "Trailer";
    frame.allow = "autoplay; encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.className = "absolute inset-0 h-full w-full border-0";
    host.appendChild(frame);
    frameRef.current = frame;

    void loadYouTubeApi().then((YT) => {
      // Strict Mode can clean up this effect while the shared API is still loading.
      if (cancelled) return;
      player = new YT.Player(frame, {
        events: {
          onReady: ({ target }) => {
            if (cancelled) return;
            playerRef.current = target;
            readyRef.current = true;
            handleMotionChange();
          },
          onStateChange: ({ data }) => {
            if (!cancelled && !motionPreference.matches && data === YT_PLAYER_STATE.ENDED) {
              const nextKey = onEndedRef.current();
              // Restart a one-video list without recreating the player or resetting audio.
              if (nextKey === videoKeyRef.current) {
                playerRef.current?.loadVideoById(nextKey);
              }
            }
          },
        },
      });
      playerRef.current = player;
    }).catch((error: unknown) => {
      if (!cancelled) console.error("Could not initialize trailer player", error);
    });

    return () => {
      cancelled = true;
      readyRef.current = false;
      playerRef.current = null;
      frameRef.current = null;
      motionPreference.removeEventListener("change", handleMotionChange);
      player?.destroy();
      frame.remove();
    };
  }, []);

  return <div ref={hostRef} className="absolute inset-0" aria-label={title} />;
}

function TrailerPlayer({
  trailers,
  title,
  poster,
}: {
  trailers: TrailerData[];
  title: string;
  poster: string;
}) {
  const youtubeTrailers = trailers.filter(
    (video): video is TrailerData & { key: string } =>
      Boolean(video.key) &&
      (!video.site || video.site.toLowerCase() === "youtube"),
  );
  const [activeKey, setActiveKey] = useState(youtubeTrailers[0]?.key ?? "");
  const activeTrailer =
    youtubeTrailers.find((video) => video.key === activeKey) ??
    youtubeTrailers[0];

  if (!youtubeTrailers.length) {
    return (
      <section aria-labelledby="trailer-heading">
        <div className="mb-3">
          <h2
            id="trailer-heading"
            className="text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl"
          >
            Trailer
          </h2>
        </div>
        <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
          <Image
            src={poster}
            alt=""
            fill
            sizes="(max-width: 1023px) 100vw, 44vw"
            className="object-cover opacity-45"
            aria-hidden="true"
          />
          <div className="absolute inset-0 grid place-items-center bg-black/55 p-6 text-center">
            <div>
              <Play className="mx-auto h-8 w-8 text-white/55" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-[var(--ink)]">
                Trailer unavailable here
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="trailer-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="trailer-heading"
            className="text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl"
          >
            Trailer
          </h2>
        </div>
      </div>

      <div
        className={`grid gap-3 lg:items-stretch ${
          youtubeTrailers.length > 1
            ? "lg:h-[min(34rem,calc(100dvh-12rem))] lg:grid-cols-[16rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]"
            : "lg:grid-cols-1"
        }`}
      >
        <div
          className={`min-h-0 min-w-0 overflow-hidden rounded-xl bg-black lg:order-last ${
            youtubeTrailers.length > 1 ? "lg:flex lg:h-full lg:flex-col" : ""
          }`}
        >
          <div
            className={`relative ${
              youtubeTrailers.length > 1
                ? "aspect-video lg:aspect-auto lg:min-h-0 lg:flex-1"
                : "aspect-video lg:max-h-[min(calc(90dvh-4rem),42rem)]"
            }`}
          >
            <TrailerVideoPlayer
              videoKey={activeTrailer.key}
              title={`${title} — ${activeTrailer.name || "trailer"}`}
              onEnded={() => {
                const currentIndex = youtubeTrailers.findIndex((video) => video.key === activeTrailer.key);
                const nextTrailer = youtubeTrailers[(currentIndex + 1) % youtubeTrailers.length];
                setActiveKey(nextTrailer.key);
                return nextTrailer.key;
              }}
            />
          </div>
        </div>

        {youtubeTrailers.length > 1 ? (
          <aside
            className="flex min-h-0 min-w-0 flex-col overflow-hidden lg:h-full"
            aria-label="Trailer playlist"
          >
            <div
              className="flex gap-2 overflow-x-auto overflow-y-hidden overscroll-contain max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden lg:min-h-0 lg:flex-1 lg:block lg:space-y-2 lg:overflow-x-hidden lg:overflow-y-auto lg:p-1 lg:pr-3"
              tabIndex={0}
              role="region"
              aria-label="More trailers, scroll to browse"
            >
              {youtubeTrailers.map((video, index) => {
                const isActive = video.key === activeTrailer.key;

                return (
                  <button
                    key={video.key}
                    type="button"
                    onClick={() => setActiveKey(video.key)}
                    aria-pressed={isActive}
                    aria-label={`Play ${video.name || `trailer ${index + 1}`}`}
                    className="group relative block aspect-video w-64 shrink-0 overflow-hidden rounded-xl bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-coral-strong lg:w-full"
                  >
                    <Image
                      src={`https://img.youtube.com/vi/${video.key}/mqdefault.jpg`}
                      alt=""
                      fill
                      sizes="256px"
                      unoptimized
                      className="object-contain"
                    />
                    <span
                      className={`absolute inset-0 grid place-items-center text-white transition-colors ${
                        isActive ? "bg-brand-coral-strong/15" : "bg-black/10 group-hover:bg-black/25"
                      }`}
                    >
                      <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

export function HeroContentCard({
  content,
  data,
  topMoods = [],
  totalMoodVotes,
  reviewStats,
  trailers = [],
}: HeroContentCardProps) {
  const router = useRouter();
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false);
  const { isAuthenticated, loading: sessionLoading } = useAuth();
  const likeLock = useRef(false);
  const saveLock = useRef(false);
  const [isTogglingWatchlist, setIsTogglingWatchlist] = useState(false);
  const [isTogglingLiked, setIsTogglingLiked] = useState(false);
  const { isInWatchlist, add, remove, ready } = useWatchlist();
  const { isLiked, like: addToLiked, unlike: removeFromLiked, ready: likedReady } = useLiked();

  const mappedContent = useMemo<Content>(() => {
    if (content) return content;
    if (!data) throw new Error("Either content or data prop must be provided");

    const isTv = data.info.content_type === "tv";
    const tvData = isTv ? (data as TvDetailsData) : null;

    return {
      id: data.info.id,
      title: data.info.title || "Untitled",
      year: extractYear(data.info.release_date),
      poster: data.info.poster_path
        ? tmdbImage(data.info.poster_path, "w500")
        : "/placeholder-poster.svg",
      backdrop: data.info.backdrop_path
        ? tmdbImage(data.info.backdrop_path, "original")
        : "/placeholder-backdrop.svg",
      genres: data.info.genres.map((genre) => genre.name),
      runtime: formatRuntime(data.info.runtime || 0),
      rating: reviewStats?.totalRatings ? reviewStats.averageRating : data.info.vote_average,
      overview: data.info.overview,
      tagline: data.info.tagline?.trim() || undefined,
      director:
        data.info.director ||
        findDirectorOrCreator(data.credits.crew, tvData?.info.created_by) ||
        "Unknown",
      ageRating: data.info.content_rating?.trim() || undefined,
    };
  }, [content, data, reviewStats]);

  const contentType = data?.info.content_type === "tv" ? "tv" : "movie";
  const tvInfo = contentType === "tv" && data ? (data as TvDetailsData).info : null;
  const contentId = data?.info.id ?? content?.id ?? null;
  const reviewHref = contentId
    ? `/${contentType === "tv" ? "tv" : "movies"}/${contentId}/reviews`
    : "#";
  const watchType = contentType === "tv" ? "series" : "movie";
  const { stats, getStat, loading: statsLoading, error: statsError, refresh: refreshStats } = useMediaStats(
    contentId ? [{ id: contentId, type: contentType }] : [],
  );
  const engagementStat = contentId
    ? getStat(contentId, contentType)
    : { likeCount: 0, savedCount: 0, reviewCount: 0 };
  const initialStatsLoading = statsLoading && (!contentId || !stats[`${contentId}:${contentType}`]);
  const inWatchlist = contentId ? isInWatchlist(String(contentId), watchType) : false;
  const inLiked = contentId ? isLiked(String(contentId), watchType) : false;
  const trailerOptions = useMemo(() => {
    const seen = new Set<string>();
    return [data?.trailer, ...trailers].filter((video): video is TrailerData => {
      if (!video?.key || seen.has(video.key)) return false;
      seen.add(video.key);
      return true;
    });
  }, [data?.trailer, trailers]);
  const hasReviewScore = Boolean(reviewStats?.totalRatings);

  const handleWatchlistToggle = async () => {
    if (!contentId || saveLock.current || sessionLoading) return;
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    if (!ready) return;
    saveLock.current = true;
    setIsTogglingWatchlist(true);
    try {
      const options = {
        title: mappedContent.title,
        posterUrl: mappedContent.poster,
        variant: "info" as const,
        duration: 3500,
      };
      if (inWatchlist) {
        await remove(String(contentId), watchType, options);
      } else {
        await add(String(contentId), watchType, options);
      }
    } catch {
      // The shared hook reports the failure and reloads the saved state.
    } finally {
      saveLock.current = false;
      setIsTogglingWatchlist(false);
    }
  };

  const handleLikeToggle = async () => {
    if (!contentId || likeLock.current || sessionLoading) return;
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    if (!likedReady) return;
    likeLock.current = true;
    setIsTogglingLiked(true);
    try {
      const options = {
        title: mappedContent.title,
        posterUrl: mappedContent.poster,
        duration: 3500,
      };
      if (inLiked) {
        await removeFromLiked(String(contentId), watchType, options);
      } else {
        await addToLiked(String(contentId), watchType, options);
      }
    } finally {
      likeLock.current = false;
      setIsTogglingLiked(false);
    }
  };

  return (
    <section
      className="relative isolate overflow-hidden bg-surface-0"
      aria-labelledby="content-title"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] opacity-40">
        <Image
          src={mappedContent.backdrop}
          alt=""
          fill
          sizes="100vw"
          priority
          aria-hidden="true"
          className="object-cover object-[center_24%]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-surface-0 via-surface-0/85 to-surface-0/55" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface-0/55 via-transparent to-surface-0" />
      </div>

      <div className="ui-shell relative pt-[calc(2rem+var(--mobile-nav-safe))] pb-8 sm:pt-[calc(2.5rem+var(--mobile-nav-safe))] sm:pb-10 lg:pt-[calc(3rem+6rem)] lg:pb-12">
        <div className="grid grid-cols-[calc(min(6rem,25%)_+_4.5rem)_minmax(0,1fr)] items-start gap-x-5 gap-y-6 sm:grid-cols-[calc(min(8rem,25%)_+_4.5rem)_minmax(0,1fr)] sm:gap-x-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-x-16 lg:gap-y-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="col-start-1 row-start-1 lg:col-start-2 lg:row-span-2">
            <AudienceMoodPoster poster={mappedContent.poster} title={mappedContent.title} moods={topMoods} totalVotes={totalMoodVotes} />
          </div>

          <div className="col-start-2 row-start-1 min-w-0 self-center lg:col-start-1 lg:self-start">
            <p className="ui-kicker">{contentType === "tv" ? "Series" : "Film"}</p>

            <h1
              id="content-title"
              className="mt-2 max-w-3xl text-balance text-[2.1rem] font-bold leading-[0.98] tracking-normal text-[var(--ink)] [overflow-wrap:anywhere] min-[390px]:text-[2.45rem] sm:text-[clamp(2.45rem,4.6vw,4rem)] sm:leading-[0.96] xl:text-[clamp(2.45rem,4.2vw,4.8rem)]"
            >
              {mappedContent.title}
            </h1>

            {mappedContent.tagline?.trim() ? (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-muted)] sm:text-base">
                {mappedContent.tagline.trim()}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[var(--ink-muted)]">
              <span>{mappedContent.year}</span>
              <span aria-hidden="true">&middot;</span>
              <span>{mappedContent.runtime}</span>
              {contentType === "tv" && tvInfo?.number_of_seasons ? (
                <><span aria-hidden="true">&middot;</span><span>{tvInfo.number_of_seasons} {tvInfo.number_of_seasons === 1 ? "season" : "seasons"}</span></>
              ) : null}
            </div>
          </div>

          <div className="col-span-2 min-w-0 lg:col-span-1 lg:col-start-1 lg:row-start-2">
            {mappedContent.genres.length > 0 || mappedContent.ageRating ? (
              <div className="flex flex-wrap items-start gap-2">
                {mappedContent.genres.length > 0 ? (
                  <Pill variant="genre">
                    {mappedContent.genres.join(" / ")}
                  </Pill>
                ) : null}
                {mappedContent.ageRating ? (
                  <Pill variant="age-rating">
                    {mappedContent.ageRating}
                  </Pill>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 max-w-xl sm:max-w-2xl">
              <ReadMore text={mappedContent.overview} />
            </div>

            {mappedContent.director && mappedContent.director !== "Unknown" ? (
              <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
                {contentType === "tv" ? "Created by" : "Directed by"}{" "}
                <span className="font-semibold text-[var(--ink)]">{mappedContent.director}</span>
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4" aria-label="Audience ratings">
              <ScoreCard
                label="Moodies"
                score={hasReviewScore ? reviewStats?.averageRating : null}
                detail={hasReviewScore ? `${reviewStats?.totalRatings} ratings` : "No ratings yet"}
              />
              <ScoreCard
                label="TMDb"
                score={data?.info.vote_average}
                detail={`${fmtCount(data?.info.vote_count ?? 0)} votes`}
              />
            </div>

            <div className={`${styles.actions} mt-6 flex flex-wrap gap-2.5`}>
              <Link href={reviewHref} className="ui-primary-action leading-none">
                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Reviews</span>
              </Link>
              <button type="button" onClick={handleWatchlistToggle} disabled={sessionLoading || isTogglingWatchlist || (isAuthenticated && !ready)} aria-pressed={inWatchlist} aria-busy={isTogglingWatchlist} className="ui-secondary-action leading-none">
                {inWatchlist ? <BookmarkCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Bookmark className="h-4 w-4 shrink-0" aria-hidden="true" />}
                <span className="sr-only sm:not-sr-only">{inWatchlist ? "Saved" : "Save"}</span>
              </button>
              <button type="button" onClick={handleLikeToggle} disabled={sessionLoading || isTogglingLiked || (isAuthenticated && !likedReady)} aria-pressed={inLiked} aria-busy={isTogglingLiked} className="ui-secondary-action leading-none">
                <Heart className="h-4 w-4 shrink-0" fill={inLiked ? "currentColor" : "none"} aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">{inLiked ? "Liked" : "Like"}</span>
              </button>
              {contentId ? (
                <WatchedTitleButton id={Number(contentId)} type={contentType === "tv" ? "tv" : "movie"} />
              ) : null}
              {contentId ? (
                <button type="button" onClick={() => setIsSnapshotOpen(true)} className="ui-secondary-action leading-none" aria-label="Share content snapshot">
                  <Share2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">Share</span>
                </button>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--ink-muted)]" role="status" aria-atomic="true" aria-busy={statsLoading}>
              {statsError ? (
                <button type="button" onClick={refreshStats} className="min-h-11 text-sm font-semibold underline underline-offset-4">Counts unavailable · Retry</button>
              ) : (
                <>
                  <span><span className="font-semibold tabular-nums text-[var(--ink)]">{initialStatsLoading ? '—' : engagementStat.likeCount.toLocaleString()}</span> likes</span>
                  <span><span className="font-semibold tabular-nums text-[var(--ink)]">{initialStatsLoading ? '—' : engagementStat.reviewCount.toLocaleString()}</span> reviews</span>
                  <span><span className="font-semibold tabular-nums text-[var(--ink)]">{initialStatsLoading ? '—' : engagementStat.savedCount.toLocaleString()}</span> saves</span>
                </>
              )}
            </div>
          </div>

          <div className="col-span-2 mt-2 min-w-0 lg:mt-4">
            <TrailerPlayer
              trailers={trailerOptions}
              title={mappedContent.title}
              poster={mappedContent.poster}
            />
          </div>
        </div>
      </div>

      <SnapshotShareModal
        open={isSnapshotOpen}
        onClose={() => setIsSnapshotOpen(false)}
        source={
          contentId
            ? {
                type: "content",
                mediaType: contentType === "tv" ? "TV" : "MOVIE",
                tmdbId: contentId,
              }
            : null
        }
      />
    </section>
  );
}

export default HeroContentCard;
