"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useLiked } from "@/hooks/useLiked";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Heart, BookmarkIcon, MessageSquare } from "lucide-react";
import { useMediaStats } from "@/hooks/useMediaStats";
import { fmtCount } from "@/utils/mediaStatsClient";

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
  director?: string;
  ageRating?: string;
};

export type MovieDetailsData = {
  info: {
    id: number;
    title: string;
    overview: string;
    release_date: string;
    runtime: number;
    budget: number;
    revenue: number;
    vote_average: number;
    vote_count: number;
    genres: Array<{ id: number; name: string }>;
    production_companies: Array<{
      id: number;
      name: string;
      logo_path?: string;
    }>;
    production_countries: Array<{ iso_3166_1: string; name?: string }>;
    spoken_languages: Array<{ iso_639_1: string; name: string }>;
    status: string;
    tagline?: string;
    homepage?: string;
    poster_path?: string;
    backdrop_path?: string;
    content_type: "movie";
    director?: string;
    content_rating?: string;
  };
  credits: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path?: string;
      order: number;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path?: string;
    }>;
  };
  trailer?: {
    iso_639_1: string;
    iso_3166_1: string;
    name: string;
    key: string;
    site: string;
    size: number;
    type: string;
    official: boolean;
    published_at: string;
    id: string;
  };
  providers?: any;
  reviews?: any[];
  similar?: any[];
  raw?: any;
};

export type TvDetailsData = {
  info: {
    id: number;
    title: string;
    original_title?: string;
    overview: string;
    release_date: string;
    runtime: number;
    budget: number;
    revenue: number;
    vote_average: number;
    vote_count: number;
    genres: Array<{ id: number; name: string }>;
    production_companies: Array<{
      id: number;
      name: string;
      logo_path?: string;
    }>;
    production_countries: Array<{ iso_3166_1: string; name?: string }>;
    spoken_languages: Array<{ iso_639_1: string; name: string }>;
    status: string;
    tagline?: string;
    homepage?: string;
    poster_path?: string;
    backdrop_path?: string;
    adult: boolean;
    created_by?: Array<{ id: number; name: string }>;
    content_type: "tv";
    director?: string;
    content_rating?: string;
    number_of_seasons?: number;
    number_of_episodes?: number;
    episode_run_time?: number[];
    first_air_date?: string;
    last_air_date?: string;
    networks?: Array<{ id: number; name: string; logo_path?: string }>;
    seasons?: Array<any>;
    next_episode_to_air?: {
      episode_number: number;
      season_number: number;
      name: string;
      overview?: string;
      air_date: string;
      runtime?: number;
      still_path?: string;
    } | null;
    last_episode_to_air?: {
      episode_number: number;
      season_number: number;
      name: string;
      air_date: string;
      runtime?: number;
    } | null;
  };
  credits: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path?: string;
      order: number;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path?: string;
    }>;
  };
  trailer?: {
    iso_639_1: string;
    iso_3166_1: string;
    name: string;
    key: string;
    site: string;
    size: number;
    type: string;
    official: boolean;
    published_at: string;
    id: string;
  };
  providers?: any;
  reviews?: any[];
  similar?: any[];
  raw?: any;
};

function TrailerModal({
  isOpen,
  onClose,
  trailerKey,
  title,
}: {
  isOpen: boolean;
  onClose: () => void;
  trailerKey: string;
  title: string;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setIsVisible(true)),
      );
      return () => cancelAnimationFrame(raf);
    } else {
      setIsVisible(false);
      const t = setTimeout(() => setIsMounted(false), 260);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  if (!isMounted) return null;
  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(12px)",
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.25s ease",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "#0a0a0a",
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "scale(1) translateY(0)" : "scale(0.95) translateY(20px)",
          transition: "opacity 0.25s ease, transform 0.25s ease",
          /* Prevent the card from exceeding the viewport at any zoom level */
          maxHeight: "calc(100svh - 2rem)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.65rem 1rem",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "rgba(255,255,255,0.6)",
              letterSpacing: "0.04em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </span>
          <button
            onClick={onClose}
            aria-label="Close trailer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.55)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        {/* Video — aspect-ratio driven, shrinks to fit remaining height */}
        <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", minHeight: 0, flex: "1 1 auto" }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
            title={`${title} Trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

function RatingDisplay({
  rating,
  tmdbRating,
  showTmdb,
}: {
  rating: number;
  tmdbRating?: number;
  showTmdb?: boolean;
}) {
  const displayRating = rating > 0.5 ? rating : (tmdbRating ?? 0);
  const isCustom = rating > 0.5;
  const pct = Math.round((displayRating / 10) * 100);

  if (displayRating === 0)
    return (
      <span
        style={{
          color: "rgba(255,255,255,0.35)",
          fontSize: "0.75rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        No rating yet
      </span>
    );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      {/* Arc score */}
      <div
        style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}
      >
        <svg width="52" height="52" viewBox="0 0 52 52">
          <circle
            cx="26"
            cy="26"
            r="22"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="4"
          />
          <circle
            cx="26"
            cy="26"
            r="22"
            fill="none"
            stroke={isCustom ? "#f5c518" : "#01b4e4"}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 22}`}
            strokeDashoffset={`${2 * Math.PI * 22 * (1 - pct / 100)}`}
            style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
          />
        </svg>
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "0.8rem",
            color: "#fff",
          }}
        >
          {displayRating.toFixed(1)}
        </span>
      </div>
      <div>
        <p
          style={{
            fontSize: "0.65rem",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.4)",
            marginBottom: 2,
          }}
        >
          {isCustom ? "User Score" : "TMDb"}
        </p>
        {showTmdb && tmdbRating && tmdbRating > 0 && isCustom && (
          <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)" }}>
            TMDb {tmdbRating.toFixed(1)}
          </p>
        )}
      </div>
    </div>
  );
}

function ReadMore({ text, limit = 220 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = React.useState(false);
  if (!text?.trim())
    return (
      <p
        style={{
          color: "rgba(255,255,255,0.35)",
          fontStyle: "italic",
          fontSize: "0.875rem",
        }}
      >
        No overview available.
      </p>
    );
  const shouldTruncate = text.length > limit;
  const display =
    expanded || !shouldTruncate ? text : text.slice(0, limit).trim() + "…";
  return (
    <p
      style={{
        color: "rgba(255,255,255,0.75)",
        lineHeight: 1.7,
        fontSize: "0.9rem",
        margin: 0,
      }}
    >
      {display}
      {shouldTruncate && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginLeft: "0.4rem",
            color: "#e94f37",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "0.85rem",
            fontWeight: 600,
            padding: 0,
          }}
        >
          {expanded ? "Less" : "More"}
        </button>
      )}
    </p>
  );
}

function formatRuntime(minutes: number): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function extractYear(dateString: string): string {
  if (!dateString) return "—";
  const y = new Date(dateString).getFullYear();
  return isNaN(y) ? "—" : y.toString();
}

function findDirectorOrCreator(
  crew: MovieDetailsData["credits"]["crew"] | TvDetailsData["credits"]["crew"],
  createdBy?: Array<{ id: number; name: string }>,
): string {
  const d = crew.find((p) => p.job === "Director");
  if (d) return d.name;
  if (createdBy?.length) return createdBy[0].name;
  return "Unknown";
}

function isPublicImagePath(value?: string): boolean {
  return Boolean(
    value && /^\/images\/.+\.(png|jpe?g|webp|gif|svg)$/i.test(value),
  );
}

function getMoodLabel(value: string, index: number): string {
  if (!isPublicImagePath(value)) return `Mood ${index + 1}`;

  const fileName = value.split("/").pop() ?? "";
  const baseName = fileName.replace(/\.(png|jpe?g|webp|gif|svg)$/i, "");

  return baseName
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface HeroContentCardProps {
  content?: Content;
  data?: MovieDetailsData | TvDetailsData;
  topMoods?: Array<{ emoji: string; count: number }>;
  reviewStats?: { totalRatings: number; averageRating: number };
}

export function HeroContentCard({
  content,
  data,
  topMoods = [],
  reviewStats,
}: HeroContentCardProps) {
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const router = useRouter();
  const { isInWatchlist, add, remove, ready } = useWatchlist();
  const { isLiked, like: addToLiked, unlike: removeFromLiked, ready: likedReady } = useLiked();

  const contentType = data?.info?.content_type === "tv" ? "tv" : "movies";
  const tvInfo = contentType === "tv" ? (data as TvDetailsData).info : null;
  const trailerKey = data?.trailer?.key;
  const contentId = data?.info?.id ?? content?.id ?? null;
  const viewAllRef = contentId ? `/${contentType}/${contentId}/reviews` : "#";
  const displayedTopMoods = topMoods.slice(0, 3);
  const displayedMoodTotal = displayedTopMoods.reduce(
    (total, mood) => total + mood.count,
    0,
  );

  const mappedContent: Content = React.useMemo(() => {
    if (content) return content;
    if (!data) throw new Error("Either content or data prop must be provided");
    const isTV = data.info.content_type === "tv";
    const tvData = isTV ? (data as TvDetailsData) : null;
    return {
      id: data.info.id,
      title: data.info.title || "Untitled",
      year: extractYear(data.info.release_date),
      poster: data.info.poster_path
        ? `https://image.tmdb.org/t/p/w500${data.info.poster_path}`
        : "/placeholder-poster.svg",
      backdrop: data.info.backdrop_path
        ? `https://image.tmdb.org/t/p/original${data.info.backdrop_path}`
        : "/placeholder-backdrop.svg",
      genres: data.info.genres.map((g) => g.name),
      runtime: formatRuntime(data.info.runtime || 0),
      rating:
        reviewStats && reviewStats.totalRatings > 0
          ? reviewStats.averageRating
          : data.info.vote_average,
      overview: data.info.overview,
      director:
        data.info.director ||
        findDirectorOrCreator(data.credits.crew, tvData?.info.created_by) ||
        "Unknown",
      ageRating: data.info.content_rating?.trim() || undefined,
    };
  }, [content, data, reviewStats]);

  const watchType = contentType === "tv" ? "series" : "movie";
  const mediaStatType = contentType === "tv" ? "tv" : "movie";
  const { getStat } = useMediaStats(
    contentId ? [{ id: contentId, type: mediaStatType }] : [],
  );
  const engagementStat = contentId ? getStat(contentId, mediaStatType) : { likeCount: 0, savedCount: 0, reviewCount: 0 };

  const [likeDelta, setLikeDelta] = useState(0);
  const [savedDelta, setSavedDelta] = useState(0);

  useEffect(() => {
    setLikeDelta(0);
    setSavedDelta(0);
  }, [contentId]);

  const liveLikeCount = engagementStat.likeCount + likeDelta;
  const liveSavedCount = engagementStat.savedCount + savedDelta;

  const inWatchlist = contentId
    ? isInWatchlist(String(contentId), watchType)
    : false;
  const inLiked = contentId
    ? isLiked(String(contentId), watchType)
    : false;
  const [isTogglingWatchlist, setIsTogglingWatchlist] = useState(false);
  const [isTogglingLiked, setIsTogglingLiked] = useState(false);

  const handleWatchlistToggle = async () => {
    if (!contentId) return;
    if (!ready) {
      router.push("/auth/login");
      return;
    }
    setIsTogglingWatchlist(true);
    try {
      const opts = {
        title: mappedContent.title,
        posterUrl: mappedContent.poster,
        variant: "info" as const,
        duration: 3500,
      };
      if (inWatchlist) {
        await remove(String(contentId), watchType, opts);
        setSavedDelta((d) => d - 1);
      } else {
        await add(String(contentId), watchType, opts);
        setSavedDelta((d) => d + 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsTogglingWatchlist(false);
    }
  };

  const handleLikeToggle = async () => {
    if (!contentId) return;
    if (!likedReady) {
      router.push("/auth/login");
      return;
    }
    setIsTogglingLiked(true);
    try {
      const opts = {
        title: mappedContent.title,
        posterUrl: mappedContent.poster,
        duration: 3500,
      };
      if (inLiked) {
        await removeFromLiked(String(contentId), watchType, opts);
        setLikeDelta((d) => d - 1);
      } else {
        await addToLiked(String(contentId), watchType, opts);
        setLikeDelta((d) => d + 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsTogglingLiked(false);
    }
  };

  /* ─── styles ─── */
  const s = {
    root: {
      position: "relative" as const,
      width: "100%",
      minHeight: "100svh",
      color: "#fff",
      fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)",
      overflow: "hidden",
    } as React.CSSProperties,

    bg: {
      position: "absolute" as const,
      inset: 0,
      zIndex: 1,
      width: "100%",
      height: "100%",
      display: "block",
      alignItems: "stretch",
      justifyContent: "stretch",
    } as React.CSSProperties,

    /* Two-column grid that collapses naturally */
    layout: {
      position: "relative" as const,
      display: "grid",
      gridTemplateColumns: "min(38vw, 320px) 1fr",
      gridTemplateRows: "auto",
      gap: 0,
      zIndex: 5,
      minHeight: "100svh",
      maxWidth: 1200,
      margin: "0 auto",
      padding:
        "clamp(7rem, 12vw, 9rem) clamp(1rem, 4vw, 3rem) clamp(2rem, 4vw, 3rem)",
    } as React.CSSProperties,

    posterCol: {
      gridColumn: "1",
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "flex-start",
      paddingRight: "clamp(1rem, 3vw, 2.5rem)",
    } as React.CSSProperties,

    posterWrap: {
      width: "100%",
      borderRadius: "clamp(8px, 1.5vw, 16px)",
      overflow: "hidden",
      boxShadow:
        "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
      flexShrink: 0,
    } as React.CSSProperties,

    infoCol: {
      gridColumn: "2",
      display: "flex",
      flexDirection: "column" as const,
      justifyContent: "center",
      gap: "clamp(0.75rem, 2vh, 1.25rem)",
      paddingLeft: "clamp(0.5rem, 2vw, 1.5rem)",
      borderLeft: "1px solid rgba(255,255,255,0.08)",
    } as React.CSSProperties,

    eyebrow: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      flexWrap: "wrap" as const,
    } as React.CSSProperties,

    tag: {
      fontSize: "clamp(0.6rem, 1.2vw, 0.7rem)",

      letterSpacing: "0.12em",
      textTransform: "uppercase" as const,
      padding: "0.2rem 0.6rem",
      borderRadius: 4,
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.12)",
      color: "rgba(255,255,255,0.7)",
      whiteSpace: "nowrap" as const,
    } as React.CSSProperties,

    ageTag: {
      fontSize: "clamp(0.6rem, 1.2vw, 0.7rem)",

      letterSpacing: "0.1em",
      textTransform: "uppercase" as const,
      padding: "0.2rem 0.6rem",
      borderRadius: 4,
      background: "rgba(234,179,8,0.15)",
      border: "1px solid rgba(234,179,8,0.35)",
      color: "rgb(234,179,8)",
    } as React.CSSProperties,

    title: {
      margin: 0,
      fontSize: "clamp(1.6rem, 4.5vw, 3.5rem)",
      fontWeight: 700,
      lineHeight: 1.05,
      letterSpacing: "-0.02em",
      color: "#fff",
    } as React.CSSProperties,

    divider: {
      width: 40,
      height: 2,
      background: "#e94f37",
      border: "none",
      margin: 0,
      borderRadius: 99,
    } as React.CSSProperties,

    metaRow: {
      display: "flex",
      alignItems: "center",
      gap: "1.25rem",
      flexWrap: "wrap" as const,
    } as React.CSSProperties,

    metaItem: {
      fontSize: "clamp(0.7rem, 1.4vw, 0.8rem)",
      color: "rgba(255,255,255,0.55)",
      display: "flex",
      alignItems: "center",
      gap: "0.35rem",
    } as React.CSSProperties,

    metaLabel: {
      fontSize: "clamp(0.6rem, 1.1vw, 0.68rem)",
      textTransform: "uppercase" as const,
      letterSpacing: "0.1em",
      color: "rgba(255,255,255,0.3)",
    } as React.CSSProperties,

    metaValue: {
      fontSize: "clamp(0.75rem, 1.4vw, 0.85rem)",
      color: "rgba(255,255,255,0.75)",
    } as React.CSSProperties,

    genreList: {
      display: "flex",
      gap: "0.4rem",
      flexWrap: "wrap" as const,
    } as React.CSSProperties,

    genre: {
      fontSize: "clamp(0.6rem, 1.2vw, 0.68rem)",

      letterSpacing: "0.06em",
      padding: "0.25rem 0.65rem",
      borderRadius: 99,
      background: "rgba(233,79,55,0.12)",
      border: "1px solid rgba(233,79,55,0.3)",
      color: "#f87c6d",
    } as React.CSSProperties,

    moodBubble: {
      position: "relative" as const,
      width: "fit-content",
      maxWidth: "min(100%, 430px)",
      display: "flex",
      alignItems: "center",
      gap: "0.65rem",
      padding: "0.58rem 0.78rem 0.58rem 0.62rem",
      borderRadius: 18,
      border: "1px solid rgba(233,79,55,0.3)",
      background:
        "linear-gradient(135deg, rgba(233,79,55,0.12), rgba(255,255,255,0.045))",
      boxShadow:
        "0 18px 42px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.08)",
      backdropFilter: "blur(18px)",
      color: "#fff",
      textDecoration: "none",
    } as React.CSSProperties,

    moodBubbleTail: {
      position: "absolute" as const,
      left: "1.25rem",
      bottom: -7,
      width: 14,
      height: 14,
      background: "rgba(233,79,55,0.12)",
      borderRight: "1px solid rgba(233,79,55,0.26)",
      borderBottom: "1px solid rgba(233,79,55,0.26)",
      transform: "rotate(45deg)",
    } as React.CSSProperties,

    moodLeadIcon: {
      width: "clamp(3.1rem, 6vw, 3.7rem)",
      height: "clamp(3.1rem, 6vw, 3.7rem)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      borderRadius: "50%",
      background: "rgba(233,79,55,0.12)",
      border: "1px solid rgba(233,79,55,0.3)",
      boxShadow: "0 0 28px rgba(233,79,55,0.26)",
      overflow: "hidden",
    } as React.CSSProperties,

    moodText: {
      minWidth: 0,
      display: "flex",
      flexDirection: "column" as const,
      gap: "0.22rem",
    } as React.CSSProperties,

    moodEyebrow: {
      margin: 0,
      fontSize: "0.62rem",
      textTransform: "uppercase" as const,
      letterSpacing: "0.14em",
      color: "rgba(248,124,109,0.88)",
      fontWeight: 800,
    } as React.CSSProperties,

    moodTitle: {
      margin: 0,
      fontSize: "clamp(0.82rem, 1.55vw, 0.96rem)",
      color: "rgba(255,255,255,0.92)",
      fontWeight: 850,
      lineHeight: 1.15,
      whiteSpace: "nowrap" as const,
      overflow: "hidden",
      textOverflow: "ellipsis",
    } as React.CSSProperties,

    moodVotes: {
      color: "rgba(255,255,255,0.5)",
      fontSize: "0.66rem",
      fontWeight: 700,
      whiteSpace: "nowrap" as const,
    } as React.CSSProperties,

    moodMiniStack: {
      display: "flex",
      alignItems: "center",
      marginLeft: "0.1rem",
      paddingLeft: "0.15rem",
      flexShrink: 0,
    } as React.CSSProperties,

    moodMiniIcon: {
      width: "1.8rem",
      height: "1.8rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginLeft: "-0.45rem",
      borderRadius: "50%",
      border: "1px solid rgba(233,79,55,0.3)",
      background: "rgba(233,79,55,0.12)",
      boxShadow: "0 8px 18px rgba(0,0,0,0.28)",
      overflow: "hidden",
    } as React.CSSProperties,

    moodIcon: {
      width: "100%",
      height: "100%",
      objectFit: "contain" as const,
      filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.35))",
    } as React.CSSProperties,

    moodEmoji: {
      fontSize: "1.35rem",
      lineHeight: 1,
    } as React.CSSProperties,

    actions: {
      display: "flex",
      gap: "0.6rem",
      flexWrap: "wrap" as const,
      paddingTop: "0.25rem",
    } as React.CSSProperties,

    btnPrimary: {
      display: "inline-flex",
      alignItems: "center",
      gap: "0.4rem",
      padding: "0.6rem 1.4rem",
      borderRadius: 8,
      background: "#fff",
      color: "#000",
      fontWeight: 700,
      fontSize: "clamp(0.75rem, 1.4vw, 0.85rem)",
      border: "none",
      cursor: "pointer",
      letterSpacing: "0.03em",
      transition: "opacity 0.15s",
      flexShrink: 0,
    } as React.CSSProperties,

    btnSecondary: {
      display: "inline-flex",
      alignItems: "center",
      gap: "0.4rem",
      padding: "0.6rem 1.2rem",
      borderRadius: 8,
      background: "rgba(255,255,255,0.07)",
      color: "#fff",
      fontWeight: 600,
      fontSize: "clamp(0.75rem, 1.4vw, 0.85rem)",
      border: "1px solid rgba(255,255,255,0.14)",
      cursor: "pointer",
      letterSpacing: "0.03em",
      transition: "background 0.15s",
      flexShrink: 0,
    } as React.CSSProperties,

    btnAccent: {
      display: "inline-flex",
      alignItems: "center",
      gap: "0.4rem",
      padding: "0.6rem 1.2rem",
      borderRadius: 8,
      background: "#e94f37",
      color: "#fff",
      fontWeight: 700,
      fontSize: "clamp(0.75rem, 1.4vw, 0.85rem)",
      border: "none",
      cursor: "pointer",
      letterSpacing: "0.03em",
      transition: "opacity 0.15s",
      flexShrink: 0,
    } as React.CSSProperties,

    nextEp: {
      background: "rgba(6,182,212,0.07)",
      border: "1px solid rgba(6,182,212,0.2)",
      borderRadius: 10,
      padding: "0.75rem 1rem",
    } as React.CSSProperties,
  };

  /* responsive: collapse to single column below ~520px using CSS custom property */
  const responsiveStyle = `
    @media (max-width: 520px) {
      .hero-layout {
        grid-template-columns: 1fr !important;
        min-height: auto !important;
        padding: 1.25rem 1rem 2rem !important;
      }
      .hero-poster-col {
        padding-right: 0 !important;
        align-items: center !important;
        max-width: 168px;
        margin: 0 auto;
      }
      .hero-info-col {
        grid-column: 1 !important;
        border-left: none !important;
        padding-left: 0 !important;
        border-top: 1px solid rgba(255,255,255,0.08);
        padding-top: 1.25rem;
        align-items: center;
        text-align: center;
        gap: 0.8rem !important;
      }
      .hero-eyebrow, .hero-genres, .hero-meta, .hero-actions, .hero-credits {
        justify-content: center !important;
      }
      .hero-mood-bubble {
        max-width: min(100%, 340px) !important;
        padding: 0.58rem 0.7rem !important;
        text-align: left !important;
      }
      .hero-credits,
      .hero-meta {
        display: none !important;
      }
      .hero-genres span:nth-child(n + 4) {
        display: none !important;
      }
      .hero-info-col h1 {
        font-size: 2rem !important;
        line-height: 1.05 !important;
      }
      .hero-actions {
        width: 100%;
        display: grid !important;
        grid-template-columns: 1fr 1fr;
        gap: 0.6rem !important;
      }
      .hero-actions > button,
      .hero-actions > a,
      .hero-actions > a > button {
        width: 100% !important;
        min-height: 2.75rem !important;
        justify-content: center !important;
        padding-inline: 0.75rem !important;
      }
    }
  `;

  return (
    <>
      <style>{responsiveStyle}</style>

      <div style={s.root}>
        {/* Background */}
        <div style={s.bg}>
          <Image
            src={mappedContent.backdrop}
            alt=""
            fill
            sizes="100vw"
            priority
            aria-hidden
            style={{
              objectFit: "cover",
              objectPosition: "center 30%",
              filter: "brightness(0.35) saturate(0.7)",
            }}
          />
          {/* Vignette */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 120% 100% at 60% 50%, transparent 20%, rgba(0,0,0,0.7) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to right, rgba(0,0,0,0.65) 0%, transparent 60%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)",
            }}
          />
        </div>

        {/* Main layout */}
        <div className="hero-layout" style={s.layout}>
          {/* ── Poster Column ── */}
          <div className="hero-poster-col" style={s.posterCol}>
            <div style={{ position: "relative", width: "100%" }}>
              <div style={s.posterWrap}>
                <Image
                  src={mappedContent.poster}
                  width={320}
                  height={480}
                  alt={`${mappedContent.title} poster`}
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </div>
            </div>

            {/* Rating below poster */}
            <div
              style={{
                marginTop: "1.25rem",
                width: "100%",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <RatingDisplay
                rating={mappedContent.rating}
                tmdbRating={data?.info?.vote_average}
                showTmdb={!!(reviewStats && reviewStats.totalRatings > 0)}
              />
            </div>
          </div>

          {/* ── Info Column ── */}
          <div className="hero-info-col" style={s.infoCol}>
            {/* Eyebrow tags */}
            <div className="hero-eyebrow" style={s.eyebrow}>
              <span style={s.tag}>{mappedContent.year}</span>
              {mappedContent.ageRating && (
                <span style={s.ageTag}>{mappedContent.ageRating}</span>
              )}
              <span style={s.tag}>{mappedContent.runtime}</span>
              {contentType === "tv" && tvInfo?.number_of_seasons && (
                <span style={s.tag}>
                  {tvInfo.number_of_seasons} season
                  {tvInfo.number_of_seasons !== 1 ? "s" : ""}
                </span>
              )}
              {contentType === "tv" && tvInfo?.number_of_episodes && (
                <span style={s.tag}>{tvInfo.number_of_episodes} eps</span>
              )}
            </div>

            {/* Title */}
            <h1 style={s.title}>{mappedContent.title}</h1>

            {/* Red rule */}
            <hr style={s.divider} />

            {/* Credits */}
            <div className="hero-credits" style={s.metaRow}>
              <div>
                <p style={s.metaLabel}>
                  {contentType === "tv" ? "Created by" : "Directed by"}
                </p>
                <p style={s.metaValue}>{mappedContent.director ?? "Unknown"}</p>
              </div>
              {contentType === "tv" &&
                tvInfo?.networks &&
                tvInfo.networks.length > 0 && (
                  <div>
                    <p style={s.metaLabel}>Network</p>
                    <p style={s.metaValue}>
                      {tvInfo.networks.map((n) => n.name).join(", ")}
                    </p>
                  </div>
                )}
            </div>

            {/* Genres */}
            {mappedContent.genres.length > 0 && (
              <div className="hero-genres" style={s.genreList}>
                {mappedContent.genres.map((g) => (
                  <span key={g} style={s.genre}>
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Audience mood */}
            {displayedTopMoods.length > 0 && (
              <Link
                href={viewAllRef}
                className="hero-mood-bubble"
                style={s.moodBubble}
                aria-label="See audience reviews"
              >
                <span style={s.moodBubbleTail} aria-hidden />

                <span style={s.moodLeadIcon}>
                  {isPublicImagePath(displayedTopMoods[0].emoji) ? (
                    <Image
                      src={displayedTopMoods[0].emoji}
                      alt={getMoodLabel(displayedTopMoods[0].emoji, 0)}
                      width={62}
                      height={62}
                      style={s.moodIcon}
                    />
                  ) : (
                    <span style={s.moodEmoji}>{displayedTopMoods[0].emoji}</span>
                  )}
                </span>

                <span style={s.moodText}>
                  <span style={s.moodEyebrow}>Audience mood</span>
                  <span style={s.moodTitle}>
                    Mostly {getMoodLabel(displayedTopMoods[0].emoji, 0)}
                  </span>
                  <span style={s.moodVotes}>
                    {displayedTopMoods[0].count} vote
                    {displayedTopMoods[0].count === 1 ? "" : "s"}
                    {displayedMoodTotal > 0
                      ? ` - ${Math.round(
                          (displayedTopMoods[0].count / displayedMoodTotal) *
                            100,
                        )}% of top moods`
                      : ""}
                  </span>
                </span>

                {displayedTopMoods.length > 1 && (
                  <span style={s.moodMiniStack} aria-label="Other top moods">
                    {displayedTopMoods.slice(1).map((mood, i) => {
                      const label = getMoodLabel(mood.emoji, i + 1);

                      return (
                        <span
                          key={`${mood.emoji}-${i}`}
                          title={`${label}: ${mood.count} vote${
                            mood.count === 1 ? "" : "s"
                          }`}
                          style={s.moodMiniIcon}
                        >
                          {isPublicImagePath(mood.emoji) ? (
                            <Image
                              src={mood.emoji}
                              alt={label}
                              width={30}
                              height={30}
                              style={s.moodIcon}
                            />
                          ) : (
                            <span style={s.moodEmoji}>{mood.emoji}</span>
                          )}
                        </span>
                      );
                    })}
                  </span>
                )}
              </Link>
            )}

            {/* Engagement stats */}
            {(liveLikeCount > 0 || liveSavedCount > 0 || engagementStat.reviewCount > 0) && (
              <div className="hero-meta" style={s.metaRow}>
                {liveLikeCount > 0 && (
                  <div style={s.metaItem}>
                    <Heart
                      size={13}
                      style={{ color: "#f472b6", flexShrink: 0 }}
                      fill="#f472b6"
                    />
                    <span>{fmtCount(liveLikeCount)} likes</span>
                  </div>
                )}
                {liveSavedCount > 0 && (
                  <div style={s.metaItem}>
                    <BookmarkIcon
                      size={13}
                      style={{ color: "#34d399", flexShrink: 0 }}
                      fill="#34d399"
                    />
                    <span>{fmtCount(liveSavedCount)} saves</span>
                  </div>
                )}
                {engagementStat.reviewCount > 0 && (
                  <div style={s.metaItem}>
                    <MessageSquare
                      size={13}
                      style={{ color: "#60a5fa", flexShrink: 0 }}
                    />
                    <span>{fmtCount(engagementStat.reviewCount)} reviews</span>
                  </div>
                )}
              </div>
            )}

            {/* Overview */}
            <ReadMore text={mappedContent.overview} limit={220} />

            {/* Next episode banner */}
            {contentType === "tv" && tvInfo?.next_episode_to_air && (
              <div style={s.nextEp}>
                <p
                  style={{
                    fontSize: "0.62rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "rgba(6,182,212,0.8)",
                    margin: "0 0 0.25rem",
                  }}
                >
                  Next episode
                </p>
                <p
                  style={{
                    fontWeight: 600,
                    margin: "0 0 0.3rem",
                    fontSize: "0.9rem",
                  }}
                >
                  {tvInfo.next_episode_to_air.name}
                </p>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.5)",
                    margin: 0,
                  }}
                >
                  S{tvInfo.next_episode_to_air.season_number}:E
                  {tvInfo.next_episode_to_air.episode_number} ·{" "}
                  {new Date(
                    tvInfo.next_episode_to_air.air_date,
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="hero-actions" style={s.actions}>
              <button
                onClick={() => trailerKey && setIsTrailerOpen(true)}
                disabled={!trailerKey}
                style={{ ...s.btnPrimary, opacity: trailerKey ? 1 : 0.4 }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M5 3v18l15-9L5 3z" />
                </svg>
                Watch Trailer
              </button>

              <button
                onClick={handleWatchlistToggle}
                disabled={isTogglingWatchlist}
                style={{
                  ...s.btnSecondary,
                  ...(inWatchlist
                    ? {
                      background: "rgba(34,197,94,0.12)",
                      border: "1px solid rgba(34,197,94,0.3)",
                      color: "#86efac",
                    }
                    : {}),
                  opacity: isTogglingWatchlist ? 0.6 : 1,
                }}
              >
                {isTogglingWatchlist ? (
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                ) : inWatchlist ? (
                  <BookmarkCheck size={14} />
                ) : (
                  <Bookmark size={14} />
                )}
                {inWatchlist ? "Saved" : "My List"}
              </button>

              <Link href={viewAllRef}>
                <button style={s.btnAccent}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                    />
                  </svg>
                  Write a Review
                </button>
              </Link>

              <button
                onClick={handleLikeToggle}
                disabled={isTogglingLiked}
                style={{
                  ...s.btnSecondary,
                  ...(inLiked ? { color: "#f472b6", borderColor: "#f472b6" } : {}),
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill={inLiked ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth={inLiked ? 0 : 1.5}
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                {inLiked ? "Liked" : "Like"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {trailerKey && (
        <TrailerModal
          isOpen={isTrailerOpen}
          onClose={() => setIsTrailerOpen(false)}
          trailerKey={trailerKey}
          title={mappedContent.title}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

export default HeroContentCard;
