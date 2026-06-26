"use client";

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
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";

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

interface Timeline {
  debut?: { title: string; year: number; character?: string; rating?: number };
  breakout?: {
    title: string;
    year: number;
    character?: string;
    rating?: number;
  };
  recent?: { title: string; year: number; character?: string; rating?: number };
  decades?: Array<{
    period: string;
    count: number;
    avgRating?: string;
    topWork?: Credit;
  }>;
  totalYears?: number;
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
type CareerMoment = { label: string; value: string; detail: string };
type VideoFilter = "all" | "trailer" | "clip" | "feature" | "show";

const RELATED_VIDEO_PAGE_SIZE = 4;
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_NEST_API_URL ||
  "http://localhost:4000";

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
    ? `https://image.tmdb.org/t/p/${size}${path}`
    : "/placeholder-backdrop.svg";

const getPosterUrl = (path?: string | null, size = "w500") =>
  path
    ? `https://image.tmdb.org/t/p/${size}${path}`
    : "/placeholder-poster.svg";

const getProfileUrl = (path?: string | null, size = "w500") =>
  path
    ? `https://image.tmdb.org/t/p/${size}${path}`
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
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e94f37]/20 bg-white/[0.04] shadow-lg shadow-black/20 backdrop-blur sm:h-10 sm:w-10">
          <Icon className="h-[18px] w-[18px] text-[#e94f37] sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight tracking-tight text-white sm:text-2xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-zinc-400 sm:text-sm">
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
  icon: React.ElementType;
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

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 sm:p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:gap-2 sm:text-[11px]">
        <Icon className="h-3.5 w-3.5 text-[#e94f37]" />
        {label}
      </div>
      <div className="mt-1 text-lg font-black text-white sm:text-xl">
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
                  ? "(max-width: 768px) 42vw, 170px"
                  : "(max-width: 768px) 50vw, 220px"
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
                className={`absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition hover:scale-105 sm:bottom-3 sm:right-3 sm:h-9 sm:w-9 ${
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
        <div className="mt-2.5 sm:mt-3">
          <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-white transition group-hover:text-zinc-200 sm:text-sm">
            {getTitle(credit)}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500 sm:text-xs">
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

function VideoCard({
  video,
  onPlay,
}: {
  video: RelatedVideo;
  onPlay: (video: RelatedVideo) => void;
}) {
  return (
    <button
      onClick={() => onPlay(video)}
      className="group cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] text-left shadow-lg shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-[#e94f37]/50 hover:bg-white/[0.07]"
    >
      <div className="relative aspect-video overflow-hidden bg-zinc-950">
        <Image
          src={
            video.thumbnail_url ||
            getImageUrl(video.media_backdrop_path, "w780")
          }
          alt={video.video_title}
          fill
          sizes="(max-width: 768px) 92vw, 360px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-[#e94f37] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-black">
            {video.video_type}
          </span>
          <span className="rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur">
            {video.media_type === "tv" ? "TV" : "Movie"}
          </span>
        </div>
        {video.official && (
          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-black">
            Official
          </span>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-black shadow-2xl transition group-hover:scale-110 sm:h-10 sm:w-10">
            <Play className="h-[18px] w-[18px] fill-current sm:h-4 sm:w-4" />
          </div>
        </div>
      </div>

      <div className="space-y-2 p-3">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-zinc-300">
              {video.relevance_label || "Relevant credit"}
            </span>
          </div>
          <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-white group-hover:text-zinc-200">
            {video.video_title}
          </h3>
          <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-zinc-400">
            {video.media_title}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-[11px] text-zinc-500">
            <span>{video.release_year || "TBA"}</span>
            {video.role && (
              <>
                <span className="mx-1.5 text-zinc-700">|</span>
                <span className="line-clamp-1 inline">as {video.role}</span>
              </>
            )}
          </div>
          <RatingBadge
            rating={video.media_vote_average}
            variant="colored"
            size="sm"
          />
        </div>
      </div>
    </button>
  );
}

function PersonCard({ person }: { person: SimilarPerson }) {
  return (
    <Link
      href={`/celeb/${person.id}`}
      className="group block min-w-[138px] sm:min-w-0"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition group-hover:-translate-y-1 group-hover:border-white/30">
        <Image
          src={getProfileUrl(person.profile_path, "w342")}
          alt={person.name}
          fill
          sizes="(max-width: 640px) 42vw, 190px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      </div>
      <h3 className="mt-2.5 line-clamp-2 text-sm font-bold leading-snug text-white transition group-hover:text-zinc-200 sm:mt-3">
        {person.name}
      </h3>
      <p className="mt-1 text-xs text-zinc-500">
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
    icon: React.ElementType;
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
  const [videoFilter, setVideoFilter] = useState<VideoFilter>("all");
  const [bioExpanded, setBioExpanded] = useState(false);
  const [showAllCredits, setShowAllCredits] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<RelatedVideo | null>(null);
  const [galleryPage, setGalleryPage] = useState(0);
  const [videoStartIndex, setVideoStartIndex] = useState(0);
  const [similarStartIndex, setSimilarStartIndex] = useState(0);
  const [shouldLoadVideos, setShouldLoadVideos] = useState(false);
  const relatedVideosSectionRef = useRef<HTMLElement | null>(null);
  const [loadingStates, setLoadingStates] = useState<
    Record<string | number, boolean>
  >({});

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
  const timeline = useMemo<Timeline | null>(() => {
    const datedCredits = releasedCredits.filter((credit) => getYear(credit));
    if (datedCredits.length === 0) return null;

    const debut = [...datedCredits].sort(
      (a, b) => (getYear(a) || 9999) - (getYear(b) || 9999),
    )[0];
    const breakout = [...datedCredits].sort((a, b) => {
      const ratingDelta = (b.vote_average || 0) - (a.vote_average || 0);
      if (Math.abs(ratingDelta) > 0.4) return ratingDelta;
      return (b.popularity || 0) - (a.popularity || 0);
    })[0];

    return {
      debut: { title: getTitle(debut), year: getYear(debut) || 0 },
      breakout: {
        title: getTitle(breakout),
        year: getYear(breakout) || 0,
      },
      recent: latestWork
        ? { title: getTitle(latestWork), year: getYear(latestWork) || 0 }
        : undefined,
    };
  }, [latestWork, releasedCredits]);

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

      const type = video.video_type.toLowerCase();
      if (videoFilter === "trailer") {
        return type === "trailer" || type === "teaser";
      }
      if (videoFilter === "clip") return type === "clip";
      if (videoFilter === "feature") {
        return (
          type === "interview" ||
          type === "behind the scenes" ||
          type === "featurette" ||
          type === "official preview"
        );
      }
      if (videoFilter === "show") {
        return (
          video.media_type === "tv" ||
          type === "variety appearance" ||
          video.relevance_label === "Variety Appearance" ||
          video.relevance_label === "Show Appearance"
        );
      }

      return true;
    });
  }, [relatedVideos, videoFilter]);
  const visibleVideos = filteredVideos.slice(
    videoStartIndex,
    videoStartIndex + RELATED_VIDEO_PAGE_SIZE,
  );
  const canScrollVideosLeft = videoStartIndex > 0;
  const canScrollVideosRight =
    videoStartIndex + RELATED_VIDEO_PAGE_SIZE < filteredVideos.length;
  const videoPageCount = Math.ceil(
    filteredVideos.length / RELATED_VIDEO_PAGE_SIZE,
  );

  useEffect(() => {
    const lastPageStart = Math.max(
      0,
      Math.floor((filteredVideos.length - 1) / RELATED_VIDEO_PAGE_SIZE) *
        RELATED_VIDEO_PAGE_SIZE,
    );

    setVideoStartIndex((index) => Math.min(index, lastPageStart));
  }, [filteredVideos.length]);

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
  const visibleCredits = showAllCredits
    ? filteredCredits
    : filteredCredits.slice(0, 12);
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
  const similarCarouselItems = similarPeople.slice(
    similarStartIndex,
    similarStartIndex + 6,
  );
  const canScrollSimilarLeft = similarStartIndex > 0;
  const canScrollSimilarRight =
    similarStartIndex + 6 < Math.min(similarPeople.length, 12);
  const careerMoments: CareerMoment[] = [
    timeline?.debut && {
      label: "Debut",
      value: timeline.debut.title,
      detail: String(timeline.debut.year),
    },
    timeline?.breakout && {
      label: "Breakout",
      value: timeline.breakout.title,
      detail: String(timeline.breakout.year),
    },
    timeline?.recent && {
      label: "Recent",
      value: timeline.recent.title,
      detail: String(timeline.recent.year),
    },
  ].filter((item): item is CareerMoment => Boolean(item));

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

        <main className="relative mx-auto max-w-7xl px-4 pb-12 pt-[calc(var(--mobile-nav-safe)+0.75rem)] sm:px-6 sm:pb-20 sm:pt-24 lg:pt-28">
          <header className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-black/45 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl sm:rounded-[2rem] sm:p-5 lg:grid-cols-[190px_minmax(0,1fr)_300px] xl:grid-cols-[210px_minmax(0,1fr)_320px]">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto w-full max-w-[150px] sm:grid sm:max-w-none sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-3 lg:block"
            >
              <button
                onClick={() =>
                  setSelectedImage(
                    getProfileUrl(person.profile_path, "original"),
                  )
                }
                className="group relative block aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-xl shadow-black/40"
              >
                <Image
                  src={getProfileUrl(person.profile_path)}
                  alt={person.name}
                  fill
                  priority
                  sizes="(max-width: 640px) 110px, (max-width: 1024px) 150px, 210px"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur sm:bottom-3 sm:left-3 sm:text-[11px]">
                  View portrait
                </div>
              </button>

              <div className="hidden grid-cols-2 gap-2 self-start sm:grid lg:mt-3 lg:grid-cols-3">
                {profiles.slice(1, 4).map((image, index) => (
                  <button
                    key={`${image.file_path}-${index}`}
                    onClick={() =>
                      setSelectedImage(getImageUrl(image.file_path))
                    }
                    className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-zinc-900 transition hover:border-white/30"
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
                  <div className="col-span-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/70 p-3 text-xs text-zinc-500 lg:col-span-3">
                    More portraits will appear when available.
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="min-w-0 text-center sm:text-left"
            >
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  {person.known_for_department || "Celebrity"}
                </span>
                {topGenres[0] && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300">
                    {topGenres[0][0]} identity
                  </span>
                )}
              </div>

              <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
                {person.name}
              </h1>
              {person.also_known_as?.[0] && (
                <p className="mt-1 line-clamp-1 text-sm text-zinc-500">
                  Also known as {person.also_known_as[0]}
                </p>
              )}

              <p className="mx-auto mt-3 max-w-3xl text-sm leading-6 text-zinc-300 sm:mx-0 sm:mt-4 sm:text-base sm:leading-7">
                {knownForSummary.length > 0
                  ? `${person.name} is known for ${knownForSummary.join(", ")}. Explore the career highlights, collaborators, and standout credits below.`
                  : `${person.name}'s profile is ready to explore, with credits and related recommendations gathered from Moodies data.`}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
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

              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                <a
                  href="#filmography"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#e94f37] px-4 py-2 text-sm font-bold text-black transition hover:bg-[#ff6b58]"
                >
                  <Clapperboard className="h-4 w-4" />
                  Filmography
                </a>
                <a
                  href="#biography"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
                >
                  <Sparkles className="h-4 w-4 text-zinc-300" />
                  Biography
                </a>
                <a
                  href="#gallery"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
                >
                  <Sparkles className="h-4 w-4 text-zinc-300" />
                  Photos
                </a>
                <a
                  href="#genre-identity"
                  className="hidden min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-white/30 hover:bg-white/10 hover:text-white min-[430px]:inline-flex"
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
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1"
            >
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
                <div className="grid grid-cols-2 gap-3">
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

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    External profiles
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

              <div className="sm:col-span-2 lg:col-span-1">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <SpotlightWorkCard label="Latest work" credit={latestWork} />
                </div>
              </div>
            </motion.aside>
          </header>

          <section
            id="biography"
            className="mt-8 grid gap-4 sm:mt-10 sm:gap-5 lg:grid-cols-[1.25fr_0.75fr]"
          >
            <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900/55 p-4 sm:rounded-3xl sm:p-7">
              <SectionHeader
                icon={Sparkles}
                title="Biography"
                subtitle="A readable snapshot of background, career shape, and public profile."
              />
              {person.biography ? (
                <div className="relative mt-5">
                  <p
                    className={`whitespace-pre-line text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8 ${bioExpanded ? "" : "line-clamp-6 sm:line-clamp-6"}`}
                  >
                    {person.biography}
                  </p>
                  {!bioExpanded && person.biography.length > 520 && (
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-zinc-900 to-transparent" />
                  )}
                  {person.biography.length > 520 && (
                    <button
                      onClick={() => setBioExpanded((value) => !value)}
                      className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:bg-white hover:text-black"
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
            </div>

            <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900/55 p-4 sm:rounded-3xl sm:p-7">
              <SectionHeader icon={Layers} title="Career Snapshot" />
              <div className="mt-5 space-y-4">
                {careerMoments.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-zinc-800 bg-black/25 p-4"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      {item.label}
                    </p>
                    <p className="mt-1 line-clamp-2 font-bold text-white">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{item.detail}</p>
                  </div>
                ))}
                {careerMoments.length === 0 && (
                  <EmptyState
                    icon={Clapperboard}
                    title="Timeline building"
                    text="Career milestones will appear once the timeline endpoint has enough data."
                  />
                )}
              </div>
            </div>
          </section>

          {notableWorks.length > 0 && (
            <section className="mt-10 space-y-4 sm:mt-16 sm:space-y-5">
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
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 mobile-native-scroll sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5">
                {notableWorks.slice(0, 5).map((credit) => (
                  <div
                    key={`${credit.media_type}-${credit.id}`}
                    className="w-[42vw] min-w-[142px] max-w-[180px] shrink-0 sm:w-auto sm:min-w-0 sm:max-w-none"
                  >
                    <WorkCard credit={credit} compact />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section
            ref={relatedVideosSectionRef}
            className="mt-10 space-y-4 sm:mt-16 sm:space-y-5"
          >
            <SectionHeader
              icon={Play}
              title="Related Videos"
              subtitle="Trailers, clips, interviews, and show appearances tied to meaningful credits."
              action={
                relatedVideos.length > 0 && (
                  <div className="-mx-1 flex max-w-[calc(100vw-2rem)] overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur mobile-native-scroll sm:mx-0 sm:max-w-full">
                    {[
                      ["all", `All ${relatedVideos.length}`],
                      ["trailer", "Trailers"],
                      ["clip", "Clips"],
                      ["feature", "Features"],
                      ["show", "Shows"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => {
                          setVideoFilter(value as VideoFilter);
                          setVideoStartIndex(0);
                        }}
                        className={`min-h-10 cursor-pointer whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition sm:text-sm ${
                          videoFilter === value
                            ? "bg-[#e94f37] text-black shadow-lg shadow-[#e94f37]/15"
                            : "text-zinc-400 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )
              }
            />

            {!shouldLoadVideos || videosLoading ? (
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 mobile-native-scroll sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="w-[78vw] min-w-[260px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] sm:w-auto sm:min-w-0"
                  >
                    <div className="aspect-video animate-pulse bg-zinc-800" />
                    <div className="space-y-2.5 p-3">
                      <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-800" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
                    </div>
                  </div>
                ))}
              </div>
            ) : videosError ? (
              <EmptyState
                icon={Play}
                title="Videos could not load"
                text={videosError}
              />
            ) : visibleVideos.length > 0 ? (
              <div className="space-y-4">
                <div className="relative -mx-4 overflow-hidden border-y border-white/10 bg-white/[0.025] px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-3xl sm:border sm:p-3">
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={`${videoFilter}-${videoStartIndex}`}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.25 }}
                      className="flex gap-3 overflow-x-auto pb-1 mobile-native-scroll sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4"
                    >
                      {visibleVideos.map((video) => (
                        <div
                          key={video.id}
                          className="w-[78vw] min-w-[260px] max-w-[340px] shrink-0 sm:w-auto sm:min-w-0 sm:max-w-none"
                        >
                          <VideoCard video={video} onPlay={setSelectedVideo} />
                        </div>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {videoPageCount > 1 && (
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() =>
                        setVideoStartIndex((index) =>
                          Math.max(0, index - RELATED_VIDEO_PAGE_SIZE),
                        )
                      }
                      disabled={!canScrollVideosLeft}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
                      aria-label="Previous related videos"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <div className="flex min-w-[96px] items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 backdrop-blur">
                      {Array.from({ length: videoPageCount }).map(
                        (_, index) => (
                          <button
                            key={index}
                            onClick={() =>
                              setVideoStartIndex(
                                index * RELATED_VIDEO_PAGE_SIZE,
                              )
                            }
                            className={`h-1.5 cursor-pointer rounded-full transition ${
                              Math.floor(
                                videoStartIndex / RELATED_VIDEO_PAGE_SIZE,
                              ) === index
                                ? "w-7 bg-[#e94f37]"
                                : "w-1.5 bg-zinc-700 hover:bg-zinc-500"
                            }`}
                            aria-label={`Show related videos page ${index + 1}`}
                          />
                        ),
                      )}
                    </div>

                    <button
                      onClick={() =>
                        setVideoStartIndex((index) =>
                          Math.min(
                            Math.max(
                              0,
                              filteredVideos.length - RELATED_VIDEO_PAGE_SIZE,
                            ),
                            index + RELATED_VIDEO_PAGE_SIZE,
                          ),
                        )
                      }
                      disabled={!canScrollVideosRight}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
                      aria-label="Next related videos"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={Play}
                title="No related videos found"
                text={
                  relatedVideos.length > 0
                    ? "No videos match this filter yet. Try All or another video group."
                    : "Moodies could not find trailers, teasers, clips, or official previews connected to this celebrity's known works."
                }
              />
            )}
          </section>

          <section
            id="genre-identity"
            className="mt-10 grid gap-4 sm:mt-14 lg:grid-cols-[0.82fr_1.18fr]"
          >
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/55 p-4 sm:p-5">
              <SectionHeader
                icon={Layers}
                title="Genre Identity"
                subtitle="The strongest genre signals across known credits."
              />
              {topGenres.length > 0 ? (
                <div className="mt-4 grid gap-4 min-[430px]:grid-cols-[96px_minmax(0,1fr)] sm:grid-cols-[116px_minmax(0,1fr)]">
                  <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] shadow-xl shadow-black/20 sm:h-28 sm:w-28">
                    <div
                      className="absolute inset-2.5 rounded-full"
                      style={{
                        background: `conic-gradient(#f5f5f5 0deg ${Math.round(
                          ((topGenres[0]?.[1] || 0) /
                            Math.max(totalGenreWorks, 1)) *
                            360,
                        )}deg, rgba(63,63,70,.75) 0deg)`,
                      }}
                    />
                    <div className="relative flex h-16 w-16 flex-col items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-center sm:h-20 sm:w-20">
                      <span className="text-lg font-black text-white sm:text-xl">
                        {Math.round(
                          ((topGenres[0]?.[1] || 0) /
                            Math.max(totalGenreWorks, 1)) *
                            100,
                        )}
                        %
                      </span>
                      <span className="mt-0.5 max-w-14 truncate text-[9px] font-bold uppercase tracking-wider text-zinc-300 sm:max-w-16 sm:text-[10px]">
                        {topGenres[0]?.[0]}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {topGenres.slice(0, 3).map(([genre, count], index) => {
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
                              className="h-full rounded-full bg-gradient-to-r from-white via-zinc-300 to-zinc-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            {count} genre-tagged credits
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

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/55 p-4 sm:p-5">
              <SectionHeader
                icon={Users}
                title="Frequent Collaborators"
                subtitle="Repeated creative pairings, with shared projects at a glance."
              />
              {collaborationsLoading ? (
                <div className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-2 mobile-native-scroll sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="w-[80vw] min-w-[260px] shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:w-auto sm:min-w-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 animate-pulse rounded-xl bg-zinc-800" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800" />
                          <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
                        </div>
                      </div>
                      <div className="mt-3 h-8 animate-pulse rounded-lg bg-zinc-800/80" />
                    </div>
                  ))}
                </div>
              ) : collaborations.length > 0 ? (
                <div className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-2 mobile-native-scroll sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0">
                  {collaborations.slice(0, 4).map((collab) => (
                    <div
                      key={collab.id}
                      className="group w-[80vw] min-w-[260px] shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.06] sm:w-auto sm:min-w-0"
                    >
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/celeb/${collab.id}`}
                          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-800"
                        >
                          <Image
                            src={getProfileUrl(collab.profile_path, "w185")}
                            alt={collab.name}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/celeb/${collab.id}`}
                            className="line-clamp-1 font-bold text-white transition hover:text-zinc-200"
                          >
                            {collab.name}
                          </Link>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-bold text-zinc-300">
                              {collab.count} shared
                            </span>
                            <Link
                              href={`/celeb/${collab.id}`}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 transition group-hover:text-zinc-300"
                            >
                              Profile <ChevronRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      </div>
                      {collab.projects && collab.projects.length > 0 && (
                        <div className="mt-2.5 space-y-1.5">
                          {collab.projects.slice(0, 2).map((project) => (
                            <div
                              key={project}
                              className="flex items-center gap-2 rounded-lg bg-zinc-900/70 px-2.5 py-1.5 text-xs text-zinc-400"
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
            <section className="mt-10 space-y-4 sm:mt-16 sm:space-y-5">
              <SectionHeader
                icon={Calendar}
                title="Upcoming Projects"
                subtitle="Future releases and announced credits when available."
              />
              {upcomingLoading ? (
                <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 mobile-native-scroll sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="w-[42vw] min-w-[142px] max-w-[180px] shrink-0 space-y-3 sm:w-auto sm:min-w-0 sm:max-w-none"
                    >
                      <div className="aspect-[2/3] animate-pulse rounded-2xl bg-zinc-800" />
                      <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-800" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 mobile-native-scroll sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-6">
                  {upcomingProjects.slice(0, 6).map((credit) => (
                    <div
                      key={`upcoming-${credit.media_type}-${credit.id}`}
                      className="w-[42vw] min-w-[142px] max-w-[180px] shrink-0 sm:w-auto sm:min-w-0 sm:max-w-none"
                    >
                      <WorkCard credit={credit} compact />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="mt-10 space-y-4 sm:mt-16 sm:space-y-5">
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
                className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 mobile-native-scroll sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-8"
              >
                {currentGalleryItems.map((image, index) => (
                  <button
                    key={`${image.file_path}-${index}`}
                    onClick={() =>
                      setSelectedImage(getImageUrl(image.file_path))
                    }
                    className="group relative aspect-[2/3] w-[38vw] min-w-[132px] max-w-[160px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition hover:-translate-y-1 hover:border-white/30 sm:w-auto sm:min-w-0 sm:max-w-none"
                  >
                    <Image
                      src={getProfileUrl(image.file_path)}
                      alt={`${person.name} photo ${index + 1}`}
                      fill
                      sizes="(max-width: 640px) 45vw, 150px"
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
            className="mt-12 rounded-[1.5rem] border border-zinc-800 bg-zinc-900/45 p-3 shadow-2xl shadow-black/20 sm:mt-[4.5rem] sm:rounded-3xl sm:p-6 lg:p-7"
            id="filmography"
          >
            <div className="space-y-4 sm:space-y-6">
              <SectionHeader
                icon={Clapperboard}
                title="Filmography"
                subtitle={`${filteredCredits.length} credits shown. Filter by format, then sort by what matters most.`}
              />

              <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-black/25 p-2.5 sm:flex-row sm:items-center sm:justify-between sm:p-3">
                <div className="flex max-w-full overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-1 mobile-native-scroll">
                  {[
                    ["all", `All ${credits.length}`],
                    ["movies", `Movies ${movieCredits.length}`],
                    ["tv", `TV ${tvCredits.length}`],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => {
                        setSelectedTab(value as FilmographyTab);
                        setShowAllCredits(false);
                      }}
                      className={`min-h-10 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition sm:px-4 sm:py-2.5 sm:text-sm ${
                        selectedTab === value
                          ? "bg-[#e94f37] text-black shadow-lg shadow-[#e94f37]/15"
                          : "text-zinc-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden text-xs font-semibold uppercase tracking-wider text-zinc-500 sm:inline">
                    Sort
                  </span>
                  <select
                    value={sortMode}
                    onChange={(event) =>
                      setSortMode(event.target.value as SortMode)
                    }
                    className="min-h-11 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-200 outline-none transition focus:border-white/40 sm:w-[180px]"
                  >
                    <option value="notable">Most notable</option>
                    <option value="latest">Latest first</option>
                    <option value="rating">Highest rated</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                </div>
              </div>
            </div>
            {visibleCredits.length > 0 ? (
              <div className="mt-5 space-y-6 sm:mt-7 sm:space-y-8">
                <div className="grid grid-cols-2 gap-x-3 gap-y-6 min-[430px]:grid-cols-3 sm:gap-x-4 sm:gap-y-7 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {visibleCredits.map((credit) => {
                    const itemType =
                      credit.media_type === "tv" ? "series" : "movie";
                    return (
                      <WorkCard
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
                        : `View all ${filteredCredits.length} credits`}
                    </button>
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

          <section className="mt-10 space-y-4 sm:mt-16 sm:space-y-5">
            <SectionHeader
              icon={Sparkles}
              title="You May Also Like"
              subtitle="Similar people to keep exploring across Moodies."
              action={
                similarPeople.length > 6 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setSimilarStartIndex((index) => Math.max(0, index - 6))
                      }
                      disabled={!canScrollSimilarLeft}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
                      aria-label="Previous similar celebrities"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() =>
                        setSimilarStartIndex((index) =>
                          Math.min(
                            Math.max(0, Math.min(similarPeople.length, 12) - 6),
                            index + 6,
                          ),
                        )
                      }
                      disabled={!canScrollSimilarRight}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
                      aria-label="Next similar celebrities"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )
              }
            />
            {similarLoading ? (
              <div className="relative -mx-4 overflow-hidden border-y border-zinc-800 bg-zinc-900/35 px-4 py-3 sm:mx-0 sm:rounded-3xl sm:border sm:p-4">
                <div className="flex gap-3 overflow-x-auto pb-2 mobile-native-scroll sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:pb-0 lg:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="w-[42vw] min-w-[138px] max-w-[170px] shrink-0 space-y-3 sm:w-auto sm:min-w-0 sm:max-w-none"
                    >
                      <div className="aspect-[2/3] animate-pulse rounded-2xl bg-zinc-800" />
                      <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-800" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
                    </div>
                  ))}
                </div>
              </div>
            ) : similarPeople.length > 0 ? (
              <div className="relative -mx-4 overflow-hidden border-y border-zinc-800 bg-zinc-900/35 px-4 py-3 sm:mx-0 sm:rounded-3xl sm:border sm:p-4">
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={similarStartIndex}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.25 }}
                    className="flex gap-3 overflow-x-auto pb-2 mobile-native-scroll sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:pb-0 lg:grid-cols-6"
                  >
                    {similarCarouselItems.map((similar) => (
                      <div
                        key={similar.id}
                        className="w-[42vw] min-w-[138px] max-w-[170px] shrink-0 sm:w-auto sm:min-w-0 sm:max-w-none"
                      >
                        <PersonCard person={similar} />
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
                {similarPeople.length > 6 && (
                  <div className="mt-4 hidden justify-center gap-1.5 sm:flex">
                    {Array.from({
                      length: Math.ceil(Math.min(similarPeople.length, 12) / 6),
                    }).map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setSimilarStartIndex(index * 6)}
                        className={`h-1.5 rounded-full transition ${
                          similarStartIndex / 6 === index
                            ? "w-7 bg-[#e94f37]"
                            : "w-1.5 bg-zinc-700 hover:bg-zinc-500"
                        }`}
                        aria-label={`Show similar celebrities page ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
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
                <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#e94f37] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-black">
                        {selectedVideo.video_type}
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
                    <button
                      onClick={() => setSelectedVideo(null)}
                      className="flex cursor-pointer h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-xl shadow-black/40 backdrop-blur transition hover:border-white/40 hover:bg-white/20"
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
