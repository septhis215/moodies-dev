"use client";

import { tmdbImage } from "@/lib/tmdb";
import AppLoading from "@/components/ui/AppLoading";
import RatingBadge from "@/components/ui/rating-badge";
import { useWatchlist } from "@/hooks/useWatchlist";
import {
  BookmarkCheck,
  Briefcase,
  Calendar,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clapperboard,
  ExternalLink,
  Facebook,
  Film,
  Globe,
  Instagram,
  Layers,
  MapPin,
  Play,
  Plus,
  SearchX,
  Sparkles,
  Star,
  Tv,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ElementType,
  type ReactNode,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface Credit {
  id: number;
  title?: string;
  name?: string;
  character?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
  media_type: "movie" | "tv" | string;
  genre_ids?: number[];
}

interface Person {
  id: number;
  name: string;
  biography?: string;
  birthday?: string;
  deathday?: string;
  place_of_birth?: string;
  profile_path?: string | null;
  known_for_department?: string;
  popularity?: number;
  gender?: number;
  also_known_as?: string[];
  homepage?: string;
  external_ids?: {
    instagram_id?: string;
    twitter_id?: string;
    facebook_id?: string;
    imdb_id?: string;
  };
  images?: {
    profiles?: Array<{
      file_path: string;
      vote_average?: number;
      aspect_ratio?: number;
    }>;
  };
  combined_credits?: {
    cast?: Credit[];
  };
  tagged_images?: {
    results?: Array<{
      file_path: string;
      vote_average?: number;
      media?: {
        id: number;
        title?: string;
        name?: string;
        media_type: "movie" | "tv";
        vote_average?: number;
      };
    }>;
  };
}

interface SimilarPerson {
  id: number;
  name: string;
  profile_path?: string | null;
  known_for_department?: string;
  popularity?: number;
}

interface Collaboration {
  id: number;
  name: string;
  count: number;
  projects?: string[];
  profile_path?: string | null;
}

interface RelatedVideo {
  id: string;
  media_id: number;
  media_type: "movie" | "tv";
  media_title: string;
  media_poster_path?: string | null;
  media_backdrop_path?: string | null;
  media_vote_average?: number | null;
  release_year?: number | null;
  role?: string | null;
  video_id?: string | null;
  video_key: string;
  video_source?: string;
  youtube_url: string;
  thumbnail_url: string;
  video_title: string;
  video_type: string;
  official: boolean;
  celebrity_relevance_score?: number;
  relevance_label?: string;
  relevance_reason?: string;
  published_at?: string | null;
}

type FilmographyTab = "all" | "movies" | "tv";
type SortMode = "notable" | "latest" | "rating" | "oldest";
type VideoFilter = "all" | "trailer" | "clip" | "interview" | "behind" | "show";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_NEST_API_URL ||
  "http://localhost:4000";

const videoFilters: Array<{ value: VideoFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "trailer", label: "Trailers" },
  { value: "clip", label: "Clips" },
  { value: "interview", label: "Interviews" },
  { value: "behind", label: "Behind" },
  { value: "show", label: "Shows" },
];

const sortOptions: Array<{
  value: SortMode;
  label: string;
  description: string;
  icon: ElementType;
}> = [
  {
    value: "notable",
    label: "Most notable",
    description: "Popularity and rating balance",
    icon: Sparkles,
  },
  {
    value: "latest",
    label: "Latest first",
    description: "Newest releases at the top",
    icon: Calendar,
  },
  {
    value: "rating",
    label: "Highest rated",
    description: "Best audience scores first",
    icon: Star,
  },
  {
    value: "oldest",
    label: "Oldest first",
    description: "Browse from the debut era",
    icon: Clapperboard,
  },
];

const genreMap: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

const getImageUrl = (path?: string | null, size = "original") =>
  path
    ? tmdbImage(path, size)
    : "/placeholder-backdrop.svg";

const getPosterUrl = (path?: string | null, size = "w500") =>
  path
    ? tmdbImage(path, size)
    : "/placeholder-poster.svg";

const getProfileUrl = (path?: string | null, size = "w500") =>
  path
    ? tmdbImage(path, size)
    : "/placeholder-person.svg";

const getTitle = (credit?: Credit) =>
  credit?.title || credit?.name || "Untitled";
const getDate = (credit?: Credit) =>
  credit?.release_date || credit?.first_air_date || "";
const getYear = (credit?: Credit) => {
  const date = getDate(credit);
  return date ? new Date(date).getFullYear() : null;
};
const getHref = (credit: Credit) =>
  `/${credit.media_type === "tv" ? "tv" : "movies"}/${credit.id}`;
const hasReleased = (credit: Credit) => {
  const date = getDate(credit);
  return date ? new Date(date) <= new Date() : false;
};
const formatDate = (date?: string) =>
  date
    ? new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown";

function calculateAge(birthday?: string, deathday?: string) {
  if (!birthday) return null;
  const start = new Date(birthday);
  const end = deathday ? new Date(deathday) : new Date();
  let age = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && end.getDate() < start.getDate()))
    age -= 1;
  return age;
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: ElementType;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e94f37]/20 bg-white/[0.04] shadow-lg shadow-black/20 backdrop-blur sm:h-10 sm:w-10 sm:rounded-xl">
          <Icon className="h-4 w-4 text-[#e94f37] sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold leading-tight tracking-tight text-white sm:text-2xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 max-w-2xl text-[12px] leading-5 text-zinc-400 sm:text-sm sm:leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="max-w-full sm:shrink-0">{action}</div>}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/70 p-4 text-center sm:p-6">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-zinc-500 sm:h-12 sm:w-12">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-zinc-500 sm:text-sm">
        {text}
      </p>
    </div>
  );
}

function ProfilePill({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 line-clamp-1 text-sm font-black text-white">
        {value}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: ElementType;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 sm:rounded-2xl sm:p-3">
      <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-500 sm:gap-2 sm:text-[11px]">
        <Icon className="h-3.5 w-3.5 text-[#e94f37]" />
        {label}
      </div>
      <div className="mt-1 text-base font-black text-white sm:text-xl">
        {value}
      </div>
    </div>
  );
}

function SpotlightWorkCard({
  label,
  credit,
}: {
  label: string;
  credit?: Credit;
}) {
  if (!credit) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-black/25 p-3 text-sm text-zinc-500">
        {label} is not available yet.
      </div>
    );
  }

  return (
    <Link
      href={getHref(credit)}
      className="group flex min-h-[108px] gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-lg shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.07]"
    >
      <div className="relative h-[92px] w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-900">
        <Image
          src={getPosterUrl(credit.poster_path, "w342")}
          alt={getTitle(credit)}
          fill
          sizes="64px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-white transition group-hover:text-zinc-200">
            {getTitle(credit)}
          </h3>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-500">
            {getYear(credit) || "TBA"}
          </span>
          <RatingBadge
            rating={credit.vote_average}
            variant="colored"
            size="sm"
          />
        </div>
      </div>
    </Link>
  );
}

function WorkCard({
  credit,
  compact = false,
  onWatchlistToggle,
  inWatchlist,
  isLoading,
}: {
  credit: Credit;
  compact?: boolean;
  onWatchlistToggle?: (credit: Credit) => void;
  inWatchlist?: boolean;
  isLoading?: boolean;
}) {
  const year = getYear(credit);

  return (
    <div className="group h-full">
      <Link href={getHref(credit)} className="block h-full">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-xl shadow-black/20 backdrop-blur transition duration-300 group-hover:-translate-y-1 group-hover:border-white/30">
          <div className="relative aspect-[2/3]">
            <Image
              src={getPosterUrl(credit.poster_path)}
              alt={getTitle(credit)}
              fill
              sizes={
                compact
                  ? "(max-width: 640px) 30vw, (max-width: 768px) 34vw, 138px"
                  : "(max-width: 640px) 44vw, (max-width: 768px) 50vw, 220px"
              }
              className="object-cover transition duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
            <div className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-200 backdrop-blur">
              {credit.media_type === "tv" ? "TV" : "Movie"}
            </div>
            <RatingBadge
              rating={credit.vote_average}
              variant="colored"
              size="sm"
              className="absolute right-2 top-2 backdrop-blur"
            />
            {onWatchlistToggle && (
              <button
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onWatchlistToggle(credit);
                }}
                disabled={isLoading}
                className={`absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition hover:scale-105 sm:bottom-3 sm:right-3 ${
                  inWatchlist
                    ? "bg-emerald-500 text-white"
                    : "bg-white text-black"
                } ${isLoading ? "cursor-not-allowed opacity-70" : ""}`}
                aria-label={
                  inWatchlist ? "Remove from watchlist" : "Add to watchlist"
                }
                title={
                  inWatchlist ? "Remove from watchlist" : "Add to watchlist"
                }
              >
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : inWatchlist ? (
                  <BookmarkCheck className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 sm:mt-3">
          <h3 className="line-clamp-2 text-[11px] font-bold leading-snug text-white transition group-hover:text-zinc-200 sm:text-[13px]">
            {getTitle(credit)}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-zinc-500 sm:text-[11px]">
            <span>{year || "TBA"}</span>
            {credit.character && (
              <>
                <span className="text-zinc-700">|</span>
                <span className="line-clamp-1">as {credit.character}</span>
              </>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

function FilmographyGridCard({
  credit,
  onWatchlistToggle,
  inWatchlist,
  isLoading,
}: {
  credit: Credit;
  onWatchlistToggle: (credit: Credit) => void;
  inWatchlist: boolean;
  isLoading?: boolean;
}) {
  const year = getYear(credit);

  return (
    <article className="group h-full overflow-hidden rounded-[1.1rem] border border-white/10 bg-zinc-950/70 p-2 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06] sm:rounded-2xl sm:p-2.5">
      <div className="relative">
        <Link
          href={getHref(credit)}
          className="relative block aspect-[2/3] overflow-hidden bg-zinc-950"
        >
          <Image
            src={getPosterUrl(credit.poster_path, "w342")}
            alt={getTitle(credit)}
            fill
            sizes="(max-width: 640px) 44vw, (max-width: 1024px) 22vw, 170px"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        </Link>
        <div className="absolute left-2 top-2 flex max-w-[calc(100%-5.5rem)] flex-wrap items-start gap-1.5">
          <span className="rounded-full bg-black/70 px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-white backdrop-blur">
            {credit.media_type === "tv" ? "TV" : "Movie"}
          </span>
        </div>
        <div className="absolute bottom-2 left-2">
          <span className="rounded-full bg-white/90 px-2 py-1 text-[8px] font-black text-black">
            {year || "TBA"}
          </span>
        </div>
        <div className="absolute right-2 top-2">
          <RatingBadge
            rating={credit.vote_average}
            variant="colored"
            size="sm"
            className="backdrop-blur"
          />
        </div>
        <button
          type="button"
          onClick={() => onWatchlistToggle(credit)}
          disabled={isLoading}
          className={`absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 shadow-lg transition hover:scale-105 sm:h-9 sm:w-9 ${
            inWatchlist
              ? "bg-emerald-500 text-white"
              : "bg-white text-black"
          } ${isLoading ? "cursor-not-allowed opacity-70" : ""}`}
          aria-label={
            inWatchlist ? "Remove from watchlist" : "Add to watchlist"
          }
          title={inWatchlist ? "Remove from watchlist" : "Save to watchlist"}
        >
          {isLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : inWatchlist ? (
            <BookmarkCheck className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </button>
      </div>

      <Link
        href={getHref(credit)}
        className="mt-2 block px-1.5 pb-1.5 sm:px-2 sm:pb-2"
      >
        <div className="space-y-1">
          <p className="line-clamp-2 text-[12px] font-black leading-snug text-white transition group-hover:text-[#ffb0a3] sm:text-[13px]">
            {getTitle(credit)}
          </p>
          {credit.character ? (
            <p className="line-clamp-1 text-[10px] font-medium text-zinc-400 sm:text-[11px]">
              as {credit.character}
            </p>
          ) : (
            <p className="text-[10px] text-zinc-600 sm:text-[11px]">Tap to open</p>
          )}
        </div>
      </Link>
    </article>
  );
}

function getVideoTypeLabel(video: RelatedVideo) {
  const type = video.video_type?.trim() || "Video";
  if (type.toLowerCase() === "featurette") return "Featurette";
  return type;
}

function getVideoFilterGroup(video: RelatedVideo): Exclude<VideoFilter, "all"> {
  const type = getVideoTypeLabel(video).toLowerCase();
  const label = video.relevance_label?.toLowerCase() || "";

  if (type === "trailer" || type === "teaser" || type.includes("preview")) {
    return "trailer";
  }
  if (type === "clip") return "clip";
  if (type.includes("interview")) return "interview";
  if (type.includes("behind") || type === "featurette") return "behind";
  if (
    type.includes("variety") ||
    type.includes("appearance") ||
    label.includes("variety") ||
    label.includes("show") ||
    video.media_type === "tv"
  ) {
    return "show";
  }

  return "behind";
}

function getVideoContextLabel(video: RelatedVideo) {
  const type = getVideoTypeLabel(video).toLowerCase();
  const label = video.relevance_label || "";

  if (type === "trailer" && video.official) return "Official Trailer";
  if (type === "teaser" && video.official) return "Official Teaser";
  if (type.includes("interview")) return "Interview";
  if (type.includes("behind")) return "Behind the Scenes";
  if (type === "featurette") return "Featurette";
  if (type.includes("variety") || label.includes("Variety")) {
    return "Variety Appearance";
  }
  if (label.includes("Known")) return "Known For";
  if (label.includes("Main")) return "Main Cast Work";
  if (label.includes("Featured")) return "Featured Role";
  if (type === "clip") return "Clip";
  return video.official ? "Official Video" : "Video";
}

function getVideoRoleLabel(video: RelatedVideo) {
  if (!video.role) return null;
  const role = video.role.trim();
  if (!role) return null;
  const normalized = role.toLowerCase();
  if (["self", "himself", "herself", "guest"].includes(normalized)) {
    return "Appearance";
  }
  return `as ${role}`;
}

function VideoPlayButton({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-white text-black shadow-2xl transition group-hover:scale-105 ${
        compact ? "h-9 w-9" : "h-12 w-12 sm:h-14 sm:w-14"
      }`}
    >
      <Play
        className={`fill-current ${compact ? "h-3.5 w-3.5" : "h-5 w-5"}`}
      />
    </span>
  );
}

function VideoSectionSkeleton() {
  return (
    <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 mobile-native-scroll sm:mx-0 sm:px-0">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="w-[72vw] min-w-[228px] max-w-[270px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] sm:w-[236px] sm:min-w-[236px] md:w-[252px] md:min-w-[252px]"
        >
          <div className="aspect-video animate-pulse bg-zinc-900" />
          <div className="space-y-2 p-3">
            <div className="flex gap-1.5">
              <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-800" />
              <div className="h-5 w-12 animate-pulse rounded-full bg-zinc-800" />
            </div>
            <div className="h-4 w-full animate-pulse rounded bg-zinc-800" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function VideoCarouselCard({
  video,
  onPlay,
}: {
  video: RelatedVideo;
  onPlay: (video: RelatedVideo) => void;
}) {
  const role = getVideoRoleLabel(video);

  return (
    <button
      type="button"
      onClick={() => onPlay(video)}
      className="group flex h-full w-[72vw] min-w-[228px] max-w-[270px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07] sm:w-[236px] sm:min-w-[236px] md:w-[252px] md:min-w-[252px]"
    >
      <div className="relative aspect-video overflow-hidden bg-zinc-950">
        <Image
          src={
            video.thumbnail_url ||
            getImageUrl(video.media_backdrop_path, "w780")
          }
          alt={video.video_title}
          fill
          sizes="(max-width: 640px) 76vw, 260px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
        <div className="absolute left-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap gap-1.5">
          <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-black">
            {getVideoContextLabel(video)}
          </span>
          <span className="rounded-full bg-black/65 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur">
            {video.media_type === "tv" ? "TV" : "Movie"}
          </span>
        </div>
        {video.official && (
          <span className="absolute right-2 top-2 rounded-full bg-[#e94f37]/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-black">
            Official
          </span>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <VideoPlayButton compact />
        </div>
      </div>

      <div className="flex min-h-[104px] flex-1 flex-col justify-between p-3">
        <div>
          <h3 className="line-clamp-2 text-sm font-black leading-snug text-white transition group-hover:text-[#ffb0a3]">
            {video.video_title}
          </h3>
          <p className="mt-1 line-clamp-1 text-xs font-semibold text-zinc-400">
            {video.media_title}
          </p>
        </div>
        <div className="mt-3 flex min-w-0 items-center gap-2 text-[11px] font-semibold text-zinc-500">
          <span>{video.release_year || "TBA"}</span>
          <span className="h-1 w-1 rounded-full bg-zinc-700" />
          <span>{getVideoTypeLabel(video)}</span>
          {role && (
            <>
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              <span className="line-clamp-1 min-w-0">{role}</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function VideoEmptyPanel({
  error,
  hasFilteredVideos,
}: {
  error?: string | null;
  hasFilteredVideos?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70 p-5 shadow-2xl shadow-black/20 sm:p-7">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#ff8b78]">
          <Play className="h-5 w-5 fill-current" />
        </div>
        <h3 className="text-lg font-black text-white">
          {error
            ? "The video room is offline"
            : hasFilteredVideos
              ? "No videos in this lane"
              : "No related videos yet"}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
          {error ||
            (hasFilteredVideos
              ? "Try another video type to browse trailers, interviews, clips, and show appearances."
              : "Moodies could not find trailers, interviews, clips, or behind-the-scenes videos connected to this profile yet.")}
        </p>
      </div>
    </div>
  );
}

function PersonCard({ person }: { person: SimilarPerson }) {
  return (
    <Link
      href={`/celeb/${person.id}`}
      className="group block min-w-[124px] sm:min-w-0"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] transition group-hover:-translate-y-1 group-hover:border-white/30 sm:rounded-2xl">
        <Image
          src={getProfileUrl(person.profile_path, "w342")}
          alt={person.name}
          fill
          sizes="(max-width: 640px) 36vw, 190px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      </div>
      <h3 className="mt-2 line-clamp-2 text-xs font-bold leading-snug text-white transition group-hover:text-zinc-200 sm:mt-3 sm:text-sm">
        {person.name}
      </h3>
      <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500 sm:mt-1 sm:text-xs">
        {person.known_for_department || "Entertainment"}
      </p>
    </Link>
  );
}

function ExternalProfileLinks({ person }: { person: Person }) {
  const links = [
    person.external_ids?.instagram_id && {
      label: "Instagram",
      href: `https://instagram.com/${person.external_ids.instagram_id}`,
      icon: Instagram,
    },
    person.external_ids?.twitter_id && {
      label: "X",
      href: `https://twitter.com/${person.external_ids.twitter_id}`,
      icon: ExternalLink,
    },
    person.external_ids?.facebook_id && {
      label: "Facebook",
      href: `https://facebook.com/${person.external_ids.facebook_id}`,
      icon: Facebook,
    },
    person.external_ids?.imdb_id && {
      label: "IMDb",
      href: `https://www.imdb.com/name/${person.external_ids.imdb_id}`,
      icon: Star,
    },
    person.homepage && {
      label: "Website",
      href: person.homepage,
      icon: Globe,
    },
  ].filter(Boolean) as Array<{
    label: string;
    href: string;
    icon: ElementType;
  }>;

  if (links.length === 0) {
    return (
      <a
        href={`https://www.google.com/search?q=${encodeURIComponent(person.name)}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:border-white/30 hover:bg-white hover:text-black"
      >
        <ExternalLink className="h-4 w-4" />
        Search web profile
      </a>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {links.slice(0, 4).map(({ label, href, icon: Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-white/30 hover:bg-white hover:text-black"
        >
          <Icon className="h-4 w-4" />
          {label}
        </a>
      ))}
    </div>
  );
}

export default function CelebrityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { add, remove, isInWatchlist, ready } = useWatchlist();
  const [person, setPerson] = useState<Person | null>(null);
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [similarPeople, setSimilarPeople] = useState<SimilarPerson[]>([]);
  const [upcomingProjects, setUpcomingProjects] = useState<Credit[]>([]);
  const [relatedVideos, setRelatedVideos] = useState<RelatedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(false);
  const [collaborationsLoading, setCollaborationsLoading] = useState(false);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [videosError, setVideosError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<FilmographyTab>("all");
  const [sortMode, setSortMode] = useState<SortMode>("notable");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [videoFilter, setVideoFilter] = useState<VideoFilter>("all");
  const [bioExpanded, setBioExpanded] = useState(false);
  const [showAllCredits, setShowAllCredits] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<RelatedVideo | null>(null);
  const [galleryPage, setGalleryPage] = useState(0);
  const [shouldLoadVideos, setShouldLoadVideos] = useState(false);
  const relatedVideosSectionRef = useRef<HTMLElement | null>(null);
  const videoCarouselRef = useRef<HTMLDivElement | null>(null);
  const similarCarouselRef = useRef<HTMLDivElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const [loadingStates, setLoadingStates] = useState<
    Record<string | number, boolean>
  >({});
  const [videoCarouselState, setVideoCarouselState] = useState({
    canScrollPrev: false,
    canScrollNext: false,
  });
  const [similarCarouselState, setSimilarCarouselState] = useState({
    canScrollPrev: false,
    canScrollNext: false,
  });

  useEffect(() => {
    const controller = new AbortController();

    const fetchPerson = async () => {
      setLoading(true);
      setError(null);
      setVideosError(null);
      setPerson(null);
      setRelatedVideos([]);
      setShouldLoadVideos(false);
      setVideosLoading(false);
      setCollaborationsLoading(false);
      setSimilarLoading(false);
      setUpcomingLoading(false);
      setCollaborations([]);
      setSimilarPeople([]);
      setUpcomingProjects([]);
      try {
        const base = API_BASE;
        const personRes = await fetch(`${base}/people/${resolvedParams.id}`, {
          signal: controller.signal,
        });

        if (!personRes.ok)
          throw new Error("Unable to load this celebrity profile.");

        const personData = await personRes.json();
        if (controller.signal.aborted) return;

        setPerson(personData);
        setLoading(false);

        setSimilarLoading(true);
        fetch(`${base}/people/${resolvedParams.id}/similar`, {
          signal: controller.signal,
        })
          .then(async (similarRes) => (similarRes.ok ? similarRes.json() : []))
          .then((similarData) => {
            if (!controller.signal.aborted) {
              setSimilarPeople(Array.isArray(similarData) ? similarData : []);
            }
          })
          .catch((sectionError) => {
            if (!controller.signal.aborted) {
              console.error(
                "Error fetching similar celebrities:",
                sectionError,
              );
              setSimilarPeople([]);
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) setSimilarLoading(false);
          });

        setUpcomingLoading(true);
        fetch(`${base}/people/${resolvedParams.id}/upcoming`, {
          signal: controller.signal,
        })
          .then(async (upcomingRes) =>
            upcomingRes.ok ? upcomingRes.json() : { movies: [], tv: [] },
          )
          .then((upcomingData) => {
            if (!controller.signal.aborted) {
              setUpcomingProjects([
                ...(upcomingData?.movies || []),
                ...(upcomingData?.tv || []),
              ]);
            }
          })
          .catch((sectionError) => {
            if (!controller.signal.aborted) {
              console.error("Error fetching upcoming projects:", sectionError);
              setUpcomingProjects([]);
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) setUpcomingLoading(false);
          });

        setCollaborationsLoading(true);
        fetch(`${base}/people/${resolvedParams.id}/collaborations`, {
          signal: controller.signal,
        })
          .then(async (collabRes) => (collabRes.ok ? collabRes.json() : []))
          .then((collabData) => {
            if (!controller.signal.aborted) {
              setCollaborations(Array.isArray(collabData) ? collabData : []);
            }
          })
          .catch((sectionError) => {
            if (!controller.signal.aborted) {
              console.error("Error fetching collaborations:", sectionError);
              setCollaborations([]);
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) setCollaborationsLoading(false);
          });
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        console.error("Error fetching celebrity:", fetchError);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Something went wrong while loading this profile.",
        );
        setPerson(null);
        setVideosLoading(false);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchPerson();

    return () => controller.abort();
  }, [resolvedParams.id]);

  useEffect(() => {
    const closeSortMenu = (event: PointerEvent) => {
      if (
        sortMenuRef.current &&
        !sortMenuRef.current.contains(event.target as Node)
      ) {
        setSortMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeSortMenu);
    return () => document.removeEventListener("pointerdown", closeSortMenu);
  }, []);

  useEffect(() => {
    if (!person) return;

    const section = relatedVideosSectionRef.current;
    if (!section || !("IntersectionObserver" in window)) {
      setShouldLoadVideos(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoadVideos(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [person, resolvedParams.id]);

  useEffect(() => {
    if (!person || !shouldLoadVideos) return;

    const controller = new AbortController();
    const base = API_BASE;

    setVideosLoading(true);
    setVideosError(null);
    fetch(`${base}/people/${resolvedParams.id}/videos`, {
      signal: controller.signal,
    })
      .then(async (videoRes) => {
        if (!videoRes.ok) {
          throw new Error("Related videos are unavailable right now.");
        }
        const videoData = await videoRes.json();
        if (!controller.signal.aborted) {
          setRelatedVideos(Array.isArray(videoData) ? videoData : []);
        }
      })
      .catch((videoError) => {
        if (controller.signal.aborted) return;
        console.error("Error fetching celebrity videos:", videoError);
        setVideosError(
          videoError instanceof Error
            ? videoError.message
            : "Related videos are unavailable right now.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setVideosLoading(false);
      });

    return () => controller.abort();
  }, [person, resolvedParams.id, shouldLoadVideos]);

  const credits = useMemo(() => person?.combined_credits?.cast || [], [person]);
  const movieCredits = useMemo(
    () => credits.filter((credit) => credit.media_type === "movie"),
    [credits],
  );
  const tvCredits = useMemo(
    () => credits.filter((credit) => credit.media_type === "tv"),
    [credits],
  );
  const releasedCredits = useMemo(() => credits.filter(hasReleased), [credits]);
  const topRatedWorks = useMemo(
    () =>
      [...releasedCredits]
        .filter((credit) => (credit.vote_average || 0) > 0)
        .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0)),
    [releasedCredits],
  );
  const notableWorks = useMemo(
    () =>
      [...releasedCredits].sort((a, b) => {
        const ratingDelta = (b.vote_average || 0) - (a.vote_average || 0);
        if (Math.abs(ratingDelta) > 0.5) return ratingDelta;
        return (getYear(b) || 0) - (getYear(a) || 0);
      }),
    [releasedCredits],
  );
  const latestWork = useMemo(
    () =>
      [...releasedCredits].sort((a, b) =>
        getDate(b) > getDate(a) ? 1 : -1,
      )[0],
    [releasedCredits],
  );
  const filteredCredits = useMemo(() => {
    const byTab =
      selectedTab === "movies"
        ? movieCredits
        : selectedTab === "tv"
          ? tvCredits
          : credits;

    return [...byTab].sort((a, b) => {
      if (sortMode === "rating")
        return (b.vote_average || 0) - (a.vote_average || 0);
      if (sortMode === "oldest")
        return (getYear(a) || 9999) - (getYear(b) || 9999);
      if (sortMode === "latest") return getDate(b) > getDate(a) ? 1 : -1;
      const notableDelta = (b.vote_average || 0) - (a.vote_average || 0);
      if (Math.abs(notableDelta) > 0.5) return notableDelta;
      return (getYear(b) || 0) - (getYear(a) || 0);
    });
  }, [credits, movieCredits, selectedTab, sortMode, tvCredits]);

  const filteredVideos = useMemo(() => {
    return relatedVideos.filter((video) => {
      if (videoFilter === "all") return true;
      return getVideoFilterGroup(video) === videoFilter;
    });
  }, [relatedVideos, videoFilter]);

  useEffect(() => {
    const carousel = videoCarouselRef.current;
    if (!carousel) return;

    const updateVideoCarouselState = () => {
      const { scrollLeft, scrollWidth, clientWidth } = carousel;
      const atStart = scrollLeft <= 1;
      const atEnd = Math.ceil(scrollLeft + clientWidth) >= scrollWidth - 1;
      setVideoCarouselState({
        canScrollPrev: !atStart,
        canScrollNext: !atEnd,
      });
    };

    updateVideoCarouselState();
    carousel.addEventListener("scroll", updateVideoCarouselState, {
      passive: true,
    });
    window.addEventListener("resize", updateVideoCarouselState);

    return () => {
      carousel.removeEventListener("scroll", updateVideoCarouselState);
      window.removeEventListener("resize", updateVideoCarouselState);
    };
  }, [relatedVideos.length, videoFilter, videosLoading, shouldLoadVideos]);

  useEffect(() => {
    const carousel = similarCarouselRef.current;
    if (!carousel) return;

    const updateSimilarCarouselState = () => {
      const { scrollLeft, scrollWidth, clientWidth } = carousel;
      const atStart = scrollLeft <= 1;
      const atEnd = Math.ceil(scrollLeft + clientWidth) >= scrollWidth - 1;
      setSimilarCarouselState({
        canScrollPrev: !atStart,
        canScrollNext: !atEnd,
      });
    };

    updateSimilarCarouselState();
    carousel.addEventListener("scroll", updateSimilarCarouselState, {
      passive: true,
    });
    window.addEventListener("resize", updateSimilarCarouselState);

    return () => {
      carousel.removeEventListener("scroll", updateSimilarCarouselState);
      window.removeEventListener("resize", updateSimilarCarouselState);
    };
  }, [similarPeople.length, similarLoading]);

  if (loading) return <AppLoading />;

  if (!person) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-black via-zinc-950 to-black px-4 text-white">
        <div className="max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
            <SearchX className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold">Celebrity not found</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {error ||
              "This profile is unavailable or the data provider did not return enough information."}
          </p>
          <button
            onClick={() => router.back()}
            className="mt-6 rounded-full bg-[#e94f37] px-5 py-2.5 text-sm font-bold text-black transition hover:bg-[#ff6b58]"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const age = calculateAge(person.birthday, person.deathday);
  const profiles = person.images?.profiles || [];
  const hasExternalLinks = Boolean(
    person.external_ids?.instagram_id ||
    person.external_ids?.twitter_id ||
    person.external_ids?.facebook_id ||
    person.external_ids?.imdb_id ||
    person.homepage,
  );
  const genreEntries = Object.entries(
    credits.reduce<Record<string, number>>((acc, credit) => {
      credit.genre_ids?.forEach((genreId) => {
        const genre = genreMap[genreId] || "Other";
        acc[genre] = (acc[genre] || 0) + 1;
      });
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const topGenres = genreEntries.slice(0, 5);
  const totalGenreWorks = genreEntries.reduce(
    (total, [, count]) => total + count,
    0,
  );
  const heroBackdrop = getImageUrl(
    notableWorks.find((credit) => credit.backdrop_path)?.backdrop_path ||
      latestWork?.poster_path,
  );
  const knownForSummary = [
    person.known_for_department &&
      `${person.known_for_department.toLowerCase()} work`,
    topGenres[0]?.[0] && `${topGenres[0][0].toLowerCase()} titles`,
    topRatedWorks[0] && getTitle(topRatedWorks[0]),
  ].filter(Boolean);
  const filmographyLimit = showAllCredits ? 36 : 12;
  const visibleCredits = filteredCredits.slice(0, filmographyLimit);
  const galleryItems =
    profiles.length > 0
      ? profiles
      : person.profile_path
        ? [{ file_path: person.profile_path }]
        : [];
  const galleryPages = Math.max(1, Math.ceil(galleryItems.length / 8));
  const currentGalleryItems = galleryItems.slice(
    galleryPage * 8,
    galleryPage * 8 + 8,
  );
  const biographyLead =
    person.biography?.split(/(?<=[.!?])\s+/).find((sentence) => sentence) ||
    (knownForSummary.length > 0
      ? `${person.name} is known for ${knownForSummary.join(", ")}.`
      : `${person.name}'s Moodies profile gathers career highlights, collaborators, genres, and credits in one place.`);
  const topFilmographyCredits = visibleCredits;
  const selectedSortOption =
    sortOptions.find((option) => option.value === sortMode) ?? sortOptions[0];
  const SelectedSortIcon = selectedSortOption.icon;
  const heroFeature = latestWork || notableWorks[0] || topRatedWorks[0];

  const scrollVideoCarousel = (direction: "prev" | "next") => {
    const carousel = videoCarouselRef.current;
    if (!carousel) return;
    const distance = Math.min(carousel.clientWidth * 0.86, 720);
    carousel.scrollBy({
      left: direction === "next" ? distance : -distance,
      behavior: "smooth",
    });
  };
  const scrollSimilarCarousel = (direction: "prev" | "next") => {
    const carousel = similarCarouselRef.current;
    if (!carousel) return;
    const distance = Math.min(carousel.clientWidth * 0.86, 720);
    carousel.scrollBy({
      left: direction === "next" ? distance : -distance,
      behavior: "smooth",
    });
  };

  const toggleWatchlist = async (credit: Credit) => {
    if (!ready) {
      router.push("/auth/login");
      return;
    }

    const itemType = credit.media_type === "tv" ? "series" : "movie";
    const itemId = credit.id;
    setLoadingStates((prev) => ({ ...prev, [itemId]: true }));

    try {
      const title = getTitle(credit);
      const posterUrl = credit.poster_path
        ? getPosterUrl(credit.poster_path)
        : null;
      if (isInWatchlist(String(itemId), itemType)) {
        await remove(String(itemId), itemType, { title, posterUrl });
      } else {
        await add(String(itemId), itemType, { title, posterUrl });
      }
    } catch (watchlistError) {
      console.error("toggle watchlist error", watchlistError);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-b from-black via-zinc-950 to-black text-white">
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-[460px] opacity-35">
          <Image
            src={heroBackdrop}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover blur-sm"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/75 to-black" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-black/90" />
        </div>

        <main className="relative mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 sm:pb-16 sm:pt-12 lg:pt-18">
          <header className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-[1.25rem] border border-white/10 bg-black/55 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-4 sm:rounded-2xl sm:p-4 lg:grid-cols-[148px_minmax(0,1fr)_270px]">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full lg:block"
            >
              <button
                onClick={() =>
                  setSelectedImage(
                    getProfileUrl(person.profile_path, "original"),
                  )
                }
                className="group relative block aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-xl shadow-black/40 sm:rounded-2xl"
              >
                <Image
                  src={getProfileUrl(person.profile_path)}
                  alt={person.name}
                  fill
                  priority
                  sizes="(max-width: 640px) 88px, (max-width: 1024px) 128px, 148px"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute bottom-1.5 left-1.5 hidden rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur min-[430px]:block">
                  Portrait
                </div>
              </button>

              <div className="mt-2 hidden grid-cols-3 gap-1.5 self-start lg:grid">
                {profiles.slice(1, 4).map((image, index) => (
                  <button
                    key={`${image.file_path}-${index}`}
                    onClick={() =>
                      setSelectedImage(getImageUrl(image.file_path))
                    }
                    className="relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-zinc-900 transition hover:border-white/30"
                  >
                    <Image
                      src={getProfileUrl(image.file_path, "w185")}
                      alt={`${person.name} portrait ${index + 2}`}
                      fill
                      sizes="110px"
                      className="object-cover"
                    />
                  </button>
                ))}
                {profiles.length <= 1 && (
                  <div className="col-span-3 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/70 p-2 text-[11px] text-zinc-500">
                    More portraits will appear when available.
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="min-w-0 text-left"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white sm:px-2.5 sm:py-1 sm:text-[10px]">
                  {person.known_for_department || "Celebrity"}
                </span>
                {topGenres[0] && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-zinc-300 sm:px-2.5 sm:py-1 sm:text-[10px]">
                    {topGenres[0][0]} identity
                  </span>
                )}
              </div>

              <h1 className="mt-1.5 text-2xl font-black leading-[1.04] tracking-tight text-white sm:text-4xl lg:text-[2.65rem]">
                {person.name}
              </h1>
              {person.also_known_as?.[0] && (
                <p className="mt-1 line-clamp-1 text-xs text-zinc-500 sm:text-sm">
                  Also known as {person.also_known_as[0]}
                </p>
              )}

              <p className="mt-2 line-clamp-3 max-w-3xl text-[12px] leading-5 text-zinc-300 sm:text-sm sm:leading-6">
                {person.biography ||
                  (knownForSummary.length > 0
                    ? `${person.name} is known for ${knownForSummary.join(", ")}. Explore the career highlights, collaborators, and standout credits below.`
                    : `${person.name}'s profile is ready to explore, with credits and related recommendations gathered from Moodies data.`)}
              </p>

              <div className="col-span-2 mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat
                  label="Projects"
                  value={credits.length}
                  icon={Briefcase}
                />
                <MiniStat
                  label="Movies"
                  value={movieCredits.length}
                  icon={Film}
                />
                <MiniStat label="TV" value={tvCredits.length} icon={Tv} />
                <MiniStat
                  label="Score"
                  value={Math.round(person.popularity || 0)}
                  icon={Sparkles}
                />
              </div>

              <div className="col-span-2 mt-3 grid grid-cols-2 gap-2 min-[430px]:flex min-[430px]:flex-wrap sm:justify-start">
                <a
                  href="#filmography"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#e94f37] px-4 py-2.5 text-xs font-bold text-black transition hover:bg-[#ff6b58] sm:min-h-10 sm:px-3.5 sm:py-2 sm:text-sm"
                >
                  <Clapperboard className="h-4 w-4" />
                  Filmography
                </a>
                <a
                  href="#biography"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-white/30 hover:bg-white/10 hover:text-white sm:min-h-10 sm:px-3.5 sm:py-2 sm:text-sm"
                >
                  <Sparkles className="h-4 w-4 text-zinc-300" />
                  Biography
                </a>
                <a
                  href="#gallery"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-white/30 hover:bg-white/10 hover:text-white sm:min-h-10 sm:px-3.5 sm:py-2 sm:text-sm"
                >
                  <Sparkles className="h-4 w-4 text-zinc-300" />
                  Photos
                </a>
                <a
                  href="#genre-identity"
                  className="hidden min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-white/30 hover:bg-white/10 hover:text-white min-[430px]:inline-flex sm:min-h-10 sm:px-3.5 sm:py-2 sm:text-sm"
                >
                  <Sparkles className="h-4 w-4 text-zinc-300" />
                  Genres
                </a>
              </div>
            </motion.div>

            <motion.aside
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="col-span-2 grid gap-2 sm:grid-cols-3 lg:col-span-1 lg:grid-cols-1"
            >
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3.5 sm:p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      <Calendar className="h-3.5 w-3.5 text-zinc-300" />
                      {person.deathday ? "Lived" : "Age"}
                    </div>
                    <p className="text-lg font-black text-white">
                      {age !== null ? age : "Unknown"}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                      {formatDate(person.birthday)}
                    </p>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      <MapPin className="h-3.5 w-3.5 text-zinc-300" />
                      Born
                    </div>
                    <p className="line-clamp-1 text-lg font-black text-white">
                      {person.place_of_birth
                        ? person.place_of_birth.split(",")[0]
                        : "Unknown"}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                      {person.place_of_birth || "Birthplace unavailable"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3.5 sm:p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Links
                  </span>
                  <ExternalLink className="h-4 w-4 text-zinc-300" />
                </div>
                <ExternalProfileLinks person={person} />
                {!hasExternalLinks && (
                  <p className="mt-3 text-xs text-zinc-500">
                    No official social links were returned.
                  </p>
                )}
              </div>

              <div className="sm:col-span-1 lg:col-span-1">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <SpotlightWorkCard
                    label={latestWork ? "Latest work" : "Featured work"}
                    credit={heroFeature}
                  />
                </div>
              </div>
            </motion.aside>
          </header>

          <section
            id="biography"
            className="mt-6 scroll-mt-24 sm:mt-8"
          >
            <div className="overflow-hidden rounded-[1.25rem] border border-zinc-800 bg-zinc-900/55 shadow-2xl shadow-black/20 sm:rounded-2xl">
              <div className="border-b border-white/10 bg-white/[0.025] p-3.5 sm:p-4">
                <SectionHeader
                  icon={Sparkles}
                  title="Profile Story"
                  subtitle="A concise read on the career, identity, and context."
                />
                <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#ff8b78]">
                    Career read
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white sm:text-base sm:leading-7">
                    {biographyLead}
                  </p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <ProfilePill
                    label="Department"
                    value={person.known_for_department || "Entertainment"}
                  />
                  <ProfilePill
                    label="Latest"
                    value={latestWork ? getTitle(latestWork) : "Pending"}
                  />
                  <ProfilePill
                    label="Top rated"
                    value={
                      topRatedWorks[0]
                        ? getTitle(topRatedWorks[0])
                        : "Pending"
                    }
                  />
                  <ProfilePill
                    label="Top genre"
                    value={topGenres[0]?.[0] || "Pending"}
                  />
                </div>
              </div>

              <div className="grid gap-3 p-3.5 sm:p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                {person.biography ? (
                  <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(233,79,55,0.1),transparent_38%),rgba(255,255,255,0.035)] p-3 shadow-xl shadow-black/15 sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff8b78]">
                          Biography
                        </p>
                        <p className="mt-1 text-xs font-semibold text-zinc-500">
                          {bioExpanded
                            ? "Scroll inside the story to keep the page compact."
                            : "A compact profile read with more available."}
                        </p>
                      </div>
                      {person.biography.length > 520 && (
                        <span className="shrink-0 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-400">
                          {bioExpanded ? "Expanded" : "Preview"}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <p
                        className={`whitespace-pre-line rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-zinc-200 shadow-inner shadow-black/25 sm:text-[15px] ${
                          bioExpanded
                            ? "max-h-[320px] overflow-y-auto pr-3 [scrollbar-color:rgba(233,79,55,0.55)_rgba(255,255,255,0.08)] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#e94f37]/60 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/10"
                            : "line-clamp-5 sm:line-clamp-4"
                        }`}
                      >
                        {person.biography}
                      </p>
                      {!bioExpanded && person.biography.length > 520 && (
                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 rounded-b-xl bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
                      )}
                    </div>
                    {person.biography.length > 520 && (
                      <button
                        onClick={() => setBioExpanded((value) => !value)}
                        className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-[#ff8b78]/50 hover:bg-white hover:text-black sm:w-auto"
                      >
                        {bioExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        {bioExpanded ? "Show less" : "Read more"}
                      </button>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon={SearchX}
                    title="No biography yet"
                    text="Moodies did not receive a biography from TMDB, so this page leans on credits, genres, and related people instead."
                  />
                )}
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  <ProfilePill label="Credits" value={`${credits.length} total`} />
                  <ProfilePill
                    label="Movies"
                    value={movieCredits.length}
                  />
                  <ProfilePill label="TV" value={tvCredits.length} />
                </div>
              </div>
            </div>
          </section>

          {notableWorks.length > 0 && (
            <section className="mt-10 space-y-4 sm:mt-12">
              <SectionHeader
                icon={Star}
                title="Known For"
                subtitle="A quick path into the works that best explain this celebrity's screen identity."
                action={
                  <a
                    href="#filmography"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-400 transition hover:text-white"
                  >
                    Full filmography <ChevronRight className="h-4 w-4" />
                  </a>
                }
              />
              <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-3 pb-2 mobile-native-scroll sm:mx-0 sm:grid sm:grid-cols-6 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0">
                {notableWorks.slice(0, 5).map((credit) => (
                  <div
                    key={`${credit.media_type}-${credit.id}`}
                    className="w-[30vw] min-w-[100px] max-w-[128px] shrink-0 snap-start sm:w-auto sm:min-w-0 sm:max-w-none"
                  >
                    <WorkCard credit={credit} compact />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section
            ref={relatedVideosSectionRef}
            className="mt-10 scroll-mt-24 space-y-4 sm:mt-12"
          >
            <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-zinc-950/55 shadow-2xl shadow-black/25 backdrop-blur sm:rounded-2xl">
              <div className="border-b border-white/10 p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <SectionHeader
                    icon={Play}
                    title="On-Screen Moments"
                    subtitle="Trailers, clips, interviews, behind-the-scenes videos, and appearances."
                    action={
                      relatedVideos.length > 0 && (
                        <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-zinc-300 sm:inline-flex">
                          {relatedVideos.length} moments
                        </span>
                      )
                    }
                  />

                  {relatedVideos.length > 0 && (
                    <div className="-mx-1 flex max-w-[calc(100vw-2rem)] overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-1 mobile-native-scroll sm:mx-0 sm:max-w-full">
                      {videoFilters.map((filter) => {
                        const count =
                          filter.value === "all"
                            ? relatedVideos.length
                            : relatedVideos.filter(
                                (video) =>
                                  getVideoFilterGroup(video) === filter.value,
                              ).length;

                        return (
                          <button
                            key={filter.value}
                            type="button"
                            onClick={() => setVideoFilter(filter.value)}
                            className={`min-h-9 cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-black transition ${
                              videoFilter === filter.value
                                ? "bg-white text-black shadow-lg shadow-black/30"
                                : "text-zinc-400 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            {filter.label}
                            {count > 0 && (
                              <span className="ml-1.5 text-[10px] opacity-65">
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-visible p-3.5 sm:p-4">
                {!shouldLoadVideos || videosLoading ? (
                  <VideoSectionSkeleton />
                ) : videosError ? (
                  <VideoEmptyPanel error={videosError} />
                ) : filteredVideos.length > 0 ? (
                  <>
                    <div className="group/video-carousel relative isolate">
                      {filteredVideos.length > 1 && (
                        <>
                          {videoCarouselState.canScrollPrev && (
                            <button
                              type="button"
                              onClick={() => scrollVideoCarousel("prev")}
                              className="absolute left-0 top-1/2 z-30 hidden h-11 w-11 -translate-x-4 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-zinc-950/90 text-white shadow-2xl shadow-black/50 backdrop-blur transition hover:scale-105 hover:border-[#ff8b78]/50 hover:bg-[#e94f37] hover:text-black group-hover/video-carousel:opacity-100 sm:flex"
                              aria-label="Previous videos"
                            >
                              <ChevronLeft className="h-5 w-5" />
                            </button>
                          )}
                          {videoCarouselState.canScrollNext && (
                            <button
                              type="button"
                              onClick={() => scrollVideoCarousel("next")}
                              className="absolute right-0 top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 translate-x-4 items-center justify-center rounded-full border border-white/15 bg-zinc-950/90 text-white shadow-2xl shadow-black/50 backdrop-blur transition hover:scale-105 hover:border-[#ff8b78]/50 hover:bg-[#e94f37] hover:text-black group-hover/video-carousel:opacity-100 sm:flex"
                              aria-label="Next videos"
                            >
                              <ChevronRight className="h-5 w-5" />
                            </button>
                          )}
                        </>
                      )}
                      <div
                        ref={videoCarouselRef}
                        className="-mx-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-2 pb-1.5 mobile-native-scroll sm:mx-0 sm:gap-3 sm:px-1 sm:pb-2"
                      >
                        {filteredVideos.slice(0, 12).map((video) => (
                          <VideoCarouselCard
                            key={video.id}
                            video={video}
                            onPlay={setSelectedVideo}
                          />
                        ))}
                        {filteredVideos.length > 12 && (
                          <div className="flex w-[180px] min-w-[180px] snap-start items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-center text-xs font-semibold leading-5 text-zinc-500">
                            {filteredVideos.length - 12} more videos available
                            in this lane.
                          </div>
                        )}
                      </div>
                      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-10 bg-gradient-to-r from-zinc-950/80 to-transparent sm:block" />
                      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-10 bg-gradient-to-l from-zinc-950/80 to-transparent sm:block" />
                    </div>
                    <div className="mt-2 px-1 text-[11px] font-semibold text-zinc-600">
                      <span>{filteredVideos.length} videos</span>
                    </div>
                  </>
                ) : (
                  <VideoEmptyPanel
                    hasFilteredVideos={relatedVideos.length > 0}
                  />
                )}
              </div>
            </div>
          </section>

          <section
            id="genre-identity"
            className="mt-10 grid scroll-mt-24 gap-5 sm:mt-12 lg:grid-cols-[0.9fr_1.1fr]"
          >
            <div className="overflow-hidden rounded-[1.25rem] border border-zinc-800 bg-zinc-900/55 p-4 sm:rounded-2xl">
              <SectionHeader
                icon={Layers}
                title="Genre Identity"
                subtitle="The strongest genre signals across known credits."
              />
              {topGenres.length > 0 ? (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/25 p-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff8b78]">
                        Signature lane
                      </p>
                      <h3 className="mt-1 line-clamp-2 text-xl font-black text-white">
                        {topGenres[0][0]}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">
                        The strongest signal across available genre-tagged
                        credits.
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center sm:min-w-[84px]">
                      <p className="text-lg font-black text-white">
                        {Math.round(
                          ((topGenres[0]?.[1] || 0) /
                            Math.max(totalGenreWorks, 1)) *
                            100,
                        )}
                        %
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                        mix
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {topGenres.slice(0, 5).map(([genre, count], index) => {
                      const pct =
                        totalGenreWorks > 0
                          ? Math.round((count / totalGenreWorks) * 100)
                          : 0;
                      return (
                        <div
                          key={genre}
                          className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-white/25 hover:bg-white/[0.06]"
                        >
                          <div className="mb-1.5 flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/10 text-[10px] font-black text-zinc-200">
                                {index + 1}
                              </span>
                              <span className="truncate text-xs font-bold text-white sm:text-sm">
                                {genre}
                              </span>
                            </div>
                            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                              {pct}%
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#ff8b78] via-white to-zinc-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[10px] text-zinc-500">
                            {count} tagged
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Layers}
                  title="No genre pattern yet"
                  text="Genre data was not included with these credits."
                />
              )}
            </div>

            <div className="rounded-[1.25rem] border border-zinc-800 bg-zinc-900/55 p-4 sm:rounded-2xl sm:p-5">
              <SectionHeader
                icon={Users}
                title="Frequent Collaborators"
                subtitle="Repeated creative pairings, with shared projects at a glance."
              />
              {collaborationsLoading ? (
                <div className="mt-3 flex flex-col gap-3 sm:grid sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.035] p-3"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="h-16 w-16 animate-pulse rounded-2xl bg-zinc-800" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800" />
                          <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2">
                        <div className="h-8 animate-pulse rounded-xl bg-zinc-800/80" />
                        <div className="h-8 animate-pulse rounded-xl bg-zinc-800/60" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : collaborations.length > 0 ? (
                <div className="mt-3 flex flex-col gap-3 sm:grid sm:grid-cols-2">
                  {collaborations.slice(0, 4).map((collab) => (
                    <div
                      key={collab.id}
                      className="group w-full rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(233,79,55,0.12),transparent_42%),rgba(255,255,255,0.035)] p-3 transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.06]"
                    >
                      <div className="flex items-start gap-3.5">
                        <Link
                          href={`/celeb/${collab.id}`}
                          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-800 ring-1 ring-white/10"
                        >
                          <Image
                            src={getProfileUrl(collab.profile_path, "w185")}
                            alt={collab.name}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/celeb/${collab.id}`}
                            className="mt-1 line-clamp-1 text-base font-black text-white transition hover:text-zinc-200"
                          >
                            {collab.name}
                          </Link>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[11px] font-black text-zinc-200">
                              {collab.count} shared {collab.count === 1 ? "credit" : "credits"}
                            </span>
                            <Link
                              href={`/celeb/${collab.id}`}
                              className="inline-flex min-h-8 items-center gap-1 rounded-full px-1 text-[11px] font-bold text-zinc-500 transition group-hover:text-zinc-300"
                            >
                              Profile <ChevronRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      </div>
                      {collab.projects && collab.projects.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {collab.projects.slice(0, 2).map((project) => (
                            <div
                              key={project}
                              className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-full bg-zinc-950/70 px-2.5 py-1.5 text-xs text-zinc-400 ring-1 ring-white/10"
                            >
                              <Film className="h-3 w-3 shrink-0 text-zinc-300" />
                              <span className="line-clamp-1">{project}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Users}
                  title="No collaborators listed"
                  text="Collaboration data is unavailable for this profile right now."
                />
              )}
            </div>
          </section>

          {(upcomingLoading || upcomingProjects.length > 0) && (
            <section className="mt-10 space-y-4 sm:mt-12">
              <SectionHeader
                icon={Calendar}
                title="Upcoming Projects"
                subtitle="Future releases and announced credits when available."
              />
              {upcomingLoading ? (
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 mobile-native-scroll sm:mx-0 sm:grid sm:grid-cols-6 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="w-[34vw] min-w-[116px] max-w-[148px] shrink-0 snap-start space-y-3 sm:w-auto sm:min-w-0 sm:max-w-none"
                    >
                      <div className="aspect-[2/3] animate-pulse rounded-2xl bg-zinc-800" />
                      <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-800" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 mobile-native-scroll sm:mx-0 sm:grid sm:grid-cols-6 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0">
                  {upcomingProjects.slice(0, 6).map((credit) => (
                    <div
                      key={`upcoming-${credit.media_type}-${credit.id}`}
                      className="w-[34vw] min-w-[116px] max-w-[148px] shrink-0 snap-start sm:w-auto sm:min-w-0 sm:max-w-none"
                    >
                      <WorkCard credit={credit} compact />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="mt-10 space-y-4 sm:mt-12">
            <SectionHeader
              icon={Camera}
              title="Photo Gallery"
              subtitle="Portraits and profile imagery from TMDB."
              action={
                galleryItems.length > 8 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setGalleryPage((page) => Math.max(0, page - 1))
                      }
                      disabled={galleryPage === 0}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
                      aria-label="Previous gallery page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-semibold text-zinc-500">
                      {galleryPage + 1} / {galleryPages}
                    </span>
                    <button
                      onClick={() =>
                        setGalleryPage((page) =>
                          Math.min(galleryPages - 1, page + 1),
                        )
                      }
                      disabled={galleryPage >= galleryPages - 1}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
                      aria-label="Next gallery page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )
              }
            />
            {galleryItems.length > 0 ? (
              <div
                id="gallery"
                className="flex snap-x snap-mandatory scroll-mt-24 gap-2.5 overflow-x-auto px-3 pb-2 mobile-native-scroll sm:mx-0 sm:grid sm:grid-cols-8 sm:overflow-visible sm:px-0 sm:pb-0"
              >
                {currentGalleryItems.map((image, index) => (
                  <button
                    key={`${image.file_path}-${index}`}
                    onClick={() =>
                      setSelectedImage(getImageUrl(image.file_path))
                    }
                    className="group relative aspect-[2/3] w-[29vw] min-w-[96px] max-w-[126px] shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-1 transition hover:-translate-y-1 hover:border-white/30 sm:w-auto sm:min-w-0 sm:max-w-none"
                  >
                    <Image
                      src={getProfileUrl(image.file_path)}
                      alt={`${person.name} photo ${index + 1}`}
                      fill
                      sizes="(max-width: 640px) 29vw, 126px"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/45">
                      <ExternalLink className="h-5 w-5 opacity-0 transition group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Camera}
                title="No gallery images"
                text="This profile does not include additional images yet."
              />
            )}
          </section>

          <section
            className="mt-10 scroll-mt-24 rounded-[1.25rem] border border-zinc-800 bg-zinc-900/45 p-4 shadow-2xl shadow-black/20 sm:mt-12 sm:rounded-2xl sm:p-5"
            id="filmography"
          >
            <div className="space-y-3 sm:space-y-4">
              <SectionHeader
                icon={Clapperboard}
                title="Filmography"
                subtitle={`${filteredCredits.length} credits matched. Browse compact poster cards by format and sort.`}
              />

              <div className="flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-black/25 p-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex max-w-full overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-1 mobile-native-scroll">
                  {[
                    { value: "all", label: "All", count: credits.length },
                    {
                      value: "movies",
                      label: "Movies",
                      count: movieCredits.length,
                    },
                    { value: "tv", label: "TV", count: tvCredits.length },
                  ].map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => {
                        setSelectedTab(tab.value as FilmographyTab);
                        setShowAllCredits(false);
                      }}
                      className={`inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition sm:text-sm ${
                        selectedTab === tab.value
                          ? "border border-[#ff8b78]/40 bg-[#e94f37] text-black shadow-lg shadow-[#e94f37]/15"
                          : "border border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none ${
                          selectedTab === tab.value
                            ? "bg-black/20 text-black"
                            : "bg-white/10 text-zinc-300"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
                <div ref={sortMenuRef} className="relative z-30 w-full sm:w-[260px]">
                  <button
                    type="button"
                    onClick={() => setSortMenuOpen((open) => !open)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setSortMenuOpen(false);
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={sortMenuOpen}
                    className="group flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(233,79,55,0.16),transparent_42%),rgba(9,9,11,0.92)] px-3 py-2 text-left shadow-xl shadow-black/25 outline-none transition hover:border-white/25 hover:bg-zinc-900 focus:border-[#ff8b78]/60 focus:ring-2 focus:ring-[#e94f37]/20"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[#ff9b8a] transition group-hover:border-[#ff8b78]/40">
                        <SelectedSortIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                          Sort credits
                        </span>
                        <span className="block truncate text-sm font-black text-white">
                          {selectedSortOption.label}
                        </span>
                      </span>
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-zinc-500 transition ${
                        sortMenuOpen ? "rotate-180 text-[#ff9b8a]" : ""
                      }`}
                    />
                  </button>

                  {sortMenuOpen && (
                    <div
                      role="listbox"
                      className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl sm:w-[290px]"
                    >
                      {sortOptions.map((option) => {
                        const OptionIcon = option.icon;
                        const isActive = sortMode === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onClick={() => {
                              setSortMode(option.value);
                              setSortMenuOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                              isActive
                                ? "bg-[#e94f37] text-black"
                                : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                            }`}
                          >
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                isActive
                                  ? "bg-black/15 text-black"
                                  : "bg-white/[0.06] text-[#ff9b8a]"
                              }`}
                            >
                              <OptionIcon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-black">
                                {option.label}
                              </span>
                              <span
                                className={`mt-0.5 block truncate text-[11px] font-semibold ${
                                  isActive ? "text-black/60" : "text-zinc-500"
                                }`}
                              >
                                {option.description}
                              </span>
                            </span>
                            {isActive && (
                              <span className="h-2.5 w-2.5 rounded-full bg-black/35" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                    Showing
                  </p>
                  <p className="mt-1 text-xl font-black text-white">
                    {topFilmographyCredits.length}
                  </p>
                  <p className="text-xs text-zinc-500">
                    of {filteredCredits.length} matched credits
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                    Top rated
                  </p>
                  <p className="mt-1 line-clamp-1 text-xl font-black text-white">
                    {topRatedWorks[0]
                      ? topRatedWorks[0].vote_average?.toFixed(1)
                      : "Pending"}
                  </p>
                  <p className="line-clamp-1 text-xs text-zinc-500">
                    {topRatedWorks[0]
                      ? getTitle(topRatedWorks[0])
                      : "More ratings needed"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                    Current view
                  </p>
                  <p className="mt-1 text-xl font-black capitalize text-white">
                    {selectedTab === "all" ? "All credits" : selectedTab}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Sorted by {sortMode.replace("-", " ")}
                  </p>
                </div>
              </div>
            </div>
            {visibleCredits.length > 0 ? (
              <div className="mt-4 space-y-4 sm:mt-5">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {topFilmographyCredits.map((credit) => {
                    const itemType =
                      credit.media_type === "tv" ? "series" : "movie";
                    return (
                      <FilmographyGridCard
                        key={`${credit.media_type}-${credit.id}`}
                        credit={credit}
                        onWatchlistToggle={toggleWatchlist}
                        inWatchlist={isInWatchlist(String(credit.id), itemType)}
                        isLoading={loadingStates[credit.id]}
                      />
                    );
                  })}
                </div>
                {filteredCredits.length > 12 && (
                  <div className="text-center">
                    <button
                      onClick={() => setShowAllCredits((value) => !value)}
                      className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#e94f37] px-5 py-3 text-sm font-bold text-black transition hover:bg-[#ff6b58] sm:mt-7 sm:px-6"
                    >
                      {showAllCredits ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      {showAllCredits
                        ? "Show fewer credits"
                        : `View more credits`}
                    </button>
                    {filteredCredits.length > 36 && showAllCredits && (
                      <p className="mt-3 text-xs text-zinc-500">
                        Showing the top 36 credits to keep the page quick and readable.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={Clapperboard}
                title="No credits found"
                text="There are no credits for the selected filter yet."
              />
            )}
          </section>

          <section className="mt-10 space-y-4 sm:mt-12">
            <SectionHeader
              icon={Sparkles}
              title="You May Also Like"
              subtitle="Similar people to keep exploring across Moodies."
              action={
                similarPeople.length > 6 && (
                  <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-zinc-300 sm:inline-flex">
                    {similarPeople.length} profiles
                  </span>
                )
              }
            />
            {similarLoading ? (
              <div className="relative overflow-hidden border-y border-zinc-800 bg-zinc-900/35 px-2 py-3 sm:mx-0 sm:rounded-2xl sm:border sm:p-3">
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 mobile-native-scroll">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="w-[32vw] min-w-[108px] max-w-[138px] shrink-0 snap-start space-y-3 sm:w-[136px] sm:min-w-[136px] md:w-[148px] md:min-w-[148px]"
                    >
                      <div className="aspect-[2/3] animate-pulse rounded-2xl bg-zinc-800" />
                      <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-800" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
                    </div>
                  ))}
                </div>
              </div>
            ) : similarPeople.length > 0 ? (
              <div className="relative overflow-visible border-y border-zinc-800 bg-zinc-900/35 px-2 py-2.5 sm:mx-0 sm:rounded-2xl sm:border sm:p-3">
                <div className="group/carousel relative isolate">
                  {similarPeople.length > 6 && (
                    <>
                      {similarCarouselState.canScrollPrev && (
                        <button
                          type="button"
                          onClick={() => scrollSimilarCarousel("prev")}
                          className="absolute left-1 top-[43%] z-30 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-zinc-950/90 text-white shadow-2xl shadow-black/50 backdrop-blur transition hover:scale-105 hover:border-[#ff8b78]/50 hover:bg-[#e94f37] hover:text-black sm:-left-4 sm:flex sm:h-11 sm:w-11"
                          aria-label="Previous similar celebrities"
                        >
                          <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                      )}
                      {similarCarouselState.canScrollNext && (
                        <button
                          type="button"
                          onClick={() => scrollSimilarCarousel("next")}
                          className="absolute right-1 top-[43%] z-30 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-zinc-950/90 text-white shadow-2xl shadow-black/50 backdrop-blur transition hover:scale-105 hover:border-[#ff8b78]/50 hover:bg-[#e94f37] hover:text-black sm:-right-4 sm:flex sm:h-11 sm:w-11"
                          aria-label="Next similar celebrities"
                        >
                          <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                      )}
                    </>
                  )}
                  <div
                    ref={similarCarouselRef}
                    className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-3 pb-1.5 mobile-native-scroll sm:gap-3 sm:px-1 sm:pb-2"
                  >
                    {similarPeople.slice(0, 18).map((similar) => (
                      <div
                        key={similar.id}
                        className="w-[34vw] min-w-[112px] max-w-[138px] shrink-0 snap-start sm:w-[136px] sm:min-w-[136px] md:w-[148px] md:min-w-[148px]"
                      >
                        <PersonCard person={similar} />
                      </div>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-zinc-900/95 to-transparent sm:w-12" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-zinc-900/95 to-transparent sm:w-12" />
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="No similar people yet"
                text="Moodies could not find related celebrity profiles for this person."
              />
            )}
          </section>
        </main>
      </div>

      <AnimatePresence>
        {selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-end justify-center overflow-hidden bg-black/90 p-3 backdrop-blur-md sm:items-center sm:p-6"
            onClick={() => setSelectedVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative w-full max-w-5xl sm:pt-0"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/60 ring-1 ring-white/5 sm:rounded-3xl">
                <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3 sm:px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-[#e94f37] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-black">
                          {getVideoContextLabel(selectedVideo)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-200">
                          {selectedVideo.media_type === "tv" ? "TV" : "Movie"}
                        </span>
                        {selectedVideo.official && (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-200">
                            Official
                          </span>
                        )}
                      </div>
                      <h3 className="line-clamp-1 text-sm font-black text-white sm:text-base">
                        {selectedVideo.video_title}
                      </h3>
                      <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-zinc-500">
                        {selectedVideo.media_title}
                        {selectedVideo.release_year
                          ? ` | ${selectedVideo.release_year}`
                          : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedVideo(null)}
                      className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-xl shadow-black/40 backdrop-blur transition hover:border-white/40 hover:bg-white/20"
                      aria-label="Close video"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div className="aspect-video max-h-[80dvh] min-h-0 w-full shrink bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${selectedVideo.video_key}?autoplay=1&rel=0`}
                    title={selectedVideo.video_title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 p-3 backdrop-blur sm:p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative max-h-[86svh] w-full max-w-4xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -right-2 -top-12 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-white transition hover:border-white/30"
                aria-label="Close image"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="relative h-[78svh] w-full sm:h-[80vh]">
                <Image
                  src={selectedImage}
                  alt={`${person.name} enlarged`}
                  fill
                  sizes="(max-width: 1024px) 94vw, 896px"
                  className="rounded-2xl object-contain"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
