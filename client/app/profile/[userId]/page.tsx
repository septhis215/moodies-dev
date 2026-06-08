"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  Calendar,
  Eye,
  Film,
  Flame,
  Heart,
  Medal,
  Sparkles,
  Star,
  Tv,
  UserRound,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/app/context/AuthProvider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
const TMDB_READ_TOKEN = process.env.NEXT_PUBLIC_TMDB_READ_TOKEN || "";
const MASCOT_SRC = "/images/moodies-mascot.png";
const LOGO_SRC = "/images/moodies-transparent.png";

type PublicUser = {
  id: string;
  username: string;
  name?: string | null;
  avatarUrl?: string | null;
  createdAt?: string | null;
};

type ProfileDisclosure = {
  profileInfo: boolean;
  watchlist: boolean;
  reviews: boolean;
  liked: boolean;
  badges: boolean;
  recentActivity: boolean;
};

type PublicReview = {
  id: string;
  tmdbId: number;
  mediaType: "MOVIE" | "TV";
  rating: number;
  content: string;
  moodEmojis: string[];
  status: string;
  createdAt: string;
  tmdbTitle?: string;
  tmdbPoster?: string | null;
  tmdbYear?: string;
};

type PublicProfile = {
  user: PublicUser;
  disclosure: ProfileDisclosure;
  stats: {
    totalReviews: number;
    movieReviews: number;
    tvReviews: number;
    averageRating: number;
    topMoods: Array<{ emoji: string; count: number }>;
  };
  reviews: PublicReview[];
  watchlist: { movieId: string[]; seriesId: string[] };
  liked: { movieId: string[]; seriesId: string[] };
  badges: Array<{ id: string; badgeType: string; awardedAt: string }>;
  achievements: Array<{
    achievement: {
      key: string;
      title: string;
      description: string;
      category: string;
      reasoningTemplate: string;
      lockedHint: string;
    };
    badge: {
      badgeName: string;
      icon: string;
      rarity: string;
      mascotMood: string;
      mascotMotion: string;
    } | null;
    progress: {
      currentProgress: number;
      completionPercentage: number;
      unlocked: boolean;
      unlockedAt?: string | null;
    };
  }>;
  recentActivity: Array<{ type: string; label: string; createdAt: string }>;
};

type TmdbDetail = {
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
};

type PublicListItem = {
  id: string;
  mediaType: "MOVIE" | "TV";
  title: string;
  poster?: string | null;
  year?: string;
};

type MoodPersona = {
  title: string;
  description: string;
  signal: string;
  tone: string;
};

function avatarSrc(avatarUrl?: string | null) {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("data:")) return avatarUrl;
  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
    return avatarUrl;
  }
  if (avatarUrl.startsWith("/http")) return avatarUrl.slice(1);
  return `https://image.tmdb.org/t/p/w185${avatarUrl}`;
}

function posterSrc(path?: string | null) {
  return path ? `https://image.tmdb.org/t/p/w342${path}` : null;
}

async function fetchTmdbDetail(
  review: PublicReview,
): Promise<TmdbDetail | null> {
  if (!TMDB_API_KEY && !TMDB_READ_TOKEN) return null;
  const type = review.mediaType === "TV" ? "tv" : "movie";
  const url = TMDB_API_KEY
    ? `https://api.themoviedb.org/3/${type}/${review.tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`
    : `https://api.themoviedb.org/3/${type}/${review.tmdbId}?language=en-US`;

  const res = await fetch(url, {
    headers: TMDB_READ_TOKEN
      ? { Authorization: `Bearer ${TMDB_READ_TOKEN}` }
      : undefined,
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchTmdbListItem(
  mediaType: "MOVIE" | "TV",
  id: string,
): Promise<PublicListItem> {
  const type = mediaType === "TV" ? "tv" : "movie";
  const fallback = `${mediaType === "TV" ? "TV" : "Movie"} #${id}`;
  if (!TMDB_API_KEY && !TMDB_READ_TOKEN) {
    return { id, mediaType, title: fallback };
  }

  const url = TMDB_API_KEY
    ? `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=en-US`
    : `https://api.themoviedb.org/3/${type}/${id}?language=en-US`;

  try {
    const res = await fetch(url, {
      headers: TMDB_READ_TOKEN
        ? { Authorization: `Bearer ${TMDB_READ_TOKEN}` }
        : undefined,
    });
    if (!res.ok) return { id, mediaType, title: fallback };
    const detail: TmdbDetail = await res.json();
    const title = detail.title || detail.name || fallback;
    const date = detail.release_date || detail.first_air_date;
    return {
      id,
      mediaType,
      title,
      poster: detail.poster_path ?? null,
      year: date ? date.slice(0, 4) : undefined,
    };
  } catch {
    return { id, mediaType, title: fallback };
  }
}

function getMoodPersona(profile: PublicProfile): MoodPersona {
  const { movieReviews, tvReviews, totalReviews, averageRating, topMoods } =
    profile.stats;
  const favoriteMood = topMoods[0]?.emoji;
  const rating = averageRating / 2;

  if (totalReviews === 0) {
    return {
      title: "Quiet Curator",
      description:
        "They are still shaping their public taste profile, so every new review will move the needle.",
      signal: "Fresh profile",
      tone: "text-white/70",
    };
  }

  if (rating >= 4.2 && totalReviews >= 8) {
    return {
      title: "Joy Hunter",
      description:
        "This viewer gravitates toward titles that land well and leaves a warm trail of high-confidence picks.",
      signal: `${rating.toFixed(1)} avg score`,
      tone: "text-yellow-300",
    };
  }

  if (tvReviews > movieReviews * 1.25) {
    return {
      title: "Arc Follower",
      description:
        "They lean into long-form stories, character turns, and the slow burn of a good season.",
      signal: `${tvReviews} TV reviews`,
      tone: "text-sky-300",
    };
  }

  if (movieReviews > tvReviews * 1.25) {
    return {
      title: "Momentum Seeker",
      description:
        "They move through films with pace, chasing strong premises, memorable scenes, and quick emotional payoff.",
      signal: `${movieReviews} movie reviews`,
      tone: "text-[#ff8a78]",
    };
  }

  return {
    title: favoriteMood ? "Mood Cartographer" : "Balanced Explorer",
    description: favoriteMood
      ? `Their reviews cluster around ${favoriteMood}, with a balanced spread across movies and TV.`
      : "They sample across formats and let the story decide where their attention goes next.",
    signal: favoriteMood ? `Top mood ${favoriteMood}` : "Balanced taste",
    tone: "text-emerald-300",
  };
}

function getBadges(profile: PublicProfile) {
  const { totalReviews, movieReviews, tvReviews, averageRating, topMoods } =
    profile.stats;
  return [
    {
      name: "First Impression",
      earned: totalReviews >= 1,
      icon: <Sparkles size={14} />,
    },
    {
      name: "Conversation Starter",
      earned: totalReviews >= 10,
      icon: <Flame size={14} />,
    },
    {
      name: "Movie Minded",
      earned: movieReviews >= 5,
      icon: <Film size={14} />,
    },
    {
      name: "Series Scout",
      earned: tvReviews >= 5,
      icon: <Tv size={14} />,
    },
    {
      name: "Mood Mapper",
      earned: topMoods.length >= 3,
      icon: <Heart size={14} />,
    },
    {
      name: "High Bar",
      earned: totalReviews >= 5 && averageRating / 2 >= 4,
      icon: <Medal size={14} />,
    },
  ];
}

export default function PublicProfilePage() {
  const params = useParams<{ userId: string }>();
  const profileId = params.userId;
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [watchlistItems, setWatchlistItems] = useState<PublicListItem[]>([]);
  const [likedItems, setLikedItems] = useState<PublicListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"all" | "MOVIE" | "TV">(
    "all",
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `${API_BASE}/reviews/users/${encodeURIComponent(profileId)}/profile?limit=80`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "This profile does not exist."
              : "Unable to load this profile.",
          );
        }

        const data: PublicProfile = await res.json();
        const enrichedReviews = await Promise.all(
          data.reviews.map(async (review) => {
            const detail = await fetchTmdbDetail(review).catch(() => null);
            const title = detail?.title || detail?.name;
            const date = detail?.release_date || detail?.first_air_date;

            return {
              ...review,
              tmdbTitle:
                title ||
                `${review.mediaType === "TV" ? "TV" : "Movie"} #${review.tmdbId}`,
              tmdbPoster: detail?.poster_path ?? null,
              tmdbYear: date ? date.slice(0, 4) : undefined,
            };
          }),
        );
        const watchlistIds = [
          ...(data.watchlist?.movieId ?? []).map((id) => ({
            id,
            mediaType: "MOVIE" as const,
          })),
          ...(data.watchlist?.seriesId ?? []).map((id) => ({
            id,
            mediaType: "TV" as const,
          })),
        ];
        const likedIds = [
          ...(data.liked?.movieId ?? []).map((id) => ({
            id,
            mediaType: "MOVIE" as const,
          })),
          ...(data.liked?.seriesId ?? []).map((id) => ({
            id,
            mediaType: "TV" as const,
          })),
        ];
        const [enrichedWatchlist, enrichedLiked] = await Promise.all([
          Promise.all(
            watchlistIds
              .slice(0, 12)
              .map((item) => fetchTmdbListItem(item.mediaType, item.id)),
          ),
          Promise.all(
            likedIds
              .slice(0, 12)
              .map((item) => fetchTmdbListItem(item.mediaType, item.id)),
          ),
        ]);

        if (!cancelled) {
          setProfile({ ...data, reviews: enrichedReviews });
          setWatchlistItems(enrichedWatchlist);
          setLikedItems(enrichedLiked);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load this profile.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (profileId) loadProfile();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const filteredReviews = useMemo(() => {
    if (!profile) return [];
    if (reviewFilter === "all") return profile.reviews;
    return profile.reviews.filter(
      (review) => review.mediaType === reviewFilter,
    );
  }, [profile, reviewFilter]);

  const ownProfile = Boolean(
    currentUser?.id && profile?.user.id === currentUser.id,
  );
  const displayName =
    profile?.user.name || profile?.user.username || "Moodies user";
  const avatar = avatarSrc(profile?.user.avatarUrl);
  const initials = displayName
    .split(" ")
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
  const disclosure = profile?.disclosure ?? {
    profileInfo: true,
    watchlist: false,
    reviews: true,
    liked: false,
    badges: true,
    recentActivity: true,
  };
  const persona = profile ? getMoodPersona(profile) : null;
  const visiblePersona =
    !disclosure.reviews && persona
      ? {
          title: "Private Viewer",
          description:
            "This user keeps their taste signals private, so only disclosed profile sections are shown.",
          signal: "Private taste profile",
          tone: "text-white/55",
        }
      : persona;
  const badges = profile ? getBadges(profile) : [];
  const earnedBadges = badges.filter((badge) => badge.earned);
  const disclosureItems = [
    ["profileInfo", "Profile info"],
    ["watchlist", "Watchlist"],
    ["liked", "Liked titles"],
    ["reviews", "Reviews"],
    ["badges", "Badges"],
    ["recentActivity", "Recent activity"],
  ] as const;
  const visibleDisclosureCount = disclosureItems.filter(([key]) => disclosure[key]).length;
  const sharedListCount =
    (disclosure.watchlist
      ? (profile?.watchlist.movieId.length ?? 0) + (profile?.watchlist.seriesId.length ?? 0)
      : 0) +
    (disclosure.liked
      ? (profile?.liked.movieId.length ?? 0) + (profile?.liked.seriesId.length ?? 0)
      : 0);
  const featuredAchievement = profile?.achievements[0];
  const publicScore = Math.round(([
    disclosure.profileInfo,
    disclosure.reviews && (profile?.stats.totalReviews ?? 0) > 0,
    disclosure.badges && ((profile?.achievements.length ?? 0) > 0 || earnedBadges.length > 0),
    disclosure.watchlist && watchlistItems.length > 0,
    disclosure.liked && likedItems.length > 0,
    disclosure.recentActivity && (profile?.recentActivity.length ?? 0) > 0,
  ].filter(Boolean).length / 6) * 100);
  const reviewCadence =
    profile?.reviews && profile.reviews.length > 1
      ? Math.max(
          1,
          Math.round(
            (new Date(profile.reviews[0].createdAt).getTime() -
              new Date(
                profile.reviews[profile.reviews.length - 1].createdAt,
              ).getTime()) /
              86400000 /
              Math.max(profile.reviews.length - 1, 1),
          ),
        )
      : null;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#12111d] text-white">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-5 text-sm text-white/60">
            Loading profile...
          </div>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="min-h-screen bg-[#12111d] text-white ">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
          <div className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white/50">
              <UserRound size={24} />
            </div>
            <h1 className="text-2xl font-black">Profile unavailable</h1>
            <p className="mt-2 text-sm text-white/55">{error}</p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#e94f37] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#d94432]"
            >
              <ArrowLeft size={16} />
              Back home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black pb-8 text-white">
      {/* <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(233,79,55,0.18),transparent_32%),radial-gradient(circle_at_88%_14%,rgba(255,255,255,0.07),transparent_24%),linear-gradient(180deg,#050505_0%,#000_58%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.65)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.65)_1px,transparent_1px)] [background-size:44px_44px]" /> */}

      <section className="relative">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-8 sm:py-24 lg:px-10">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm font-semibold text-white/58 transition hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to Moodies
          </Link>

          <div className="relative overflow-hidden border-b border-white/10 pb-8 sm:pb-10">
            <div className="pointer-events-none absolute right-0 top-0 hidden h-72 w-72 opacity-20 lg:block">
              <Image src={MASCOT_SRC} alt="" fill sizes="288px" className="object-contain" priority />
            </div>

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
                <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.08] shadow-2xl shadow-black/30 ring-2 ring-[#e94f37]/40 sm:h-32 sm:w-32 lg:h-36 lg:w-36">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={displayName}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#e94f37] text-3xl font-black text-white">
                      {initials || "M"}
                    </div>
                  )}
                </div>

                <div className="min-w-0 pb-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#ff8a78]">
                      <Image src={LOGO_SRC} alt="" width={18} height={18} className="h-4 w-4 object-contain" />
                      Public Profile
                    </span>
                    <span className="rounded-lg bg-[#e94f37]/20 px-3 py-1.5 text-xs font-bold uppercase text-[#ff8a78]">
                      {visiblePersona?.title ?? "Moodies user"}
                    </span>
                  </div>
                  <h1 className="break-words text-4xl font-black tracking-tight sm:text-6xl">
                    {displayName}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/55">
                    <span>@{profile.user.username}</span>
                    <span className="text-white/18">/</span>
                    <span>{visiblePersona?.signal ?? "Public taste profile"}</span>
                    <span className="text-white/18">/</span>
                    <span>{visibleDisclosureCount}/{disclosureItems.length} sections shared</span>
                  </div>
                  {profile.user.createdAt && (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-white/45">
                      <Calendar size={14} />
                      Joined {new Date(profile.user.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e94f37]/70 to-transparent" />
                <div className="flex items-start gap-3">
                  <div className="relative h-20 w-20 flex-shrink-0 rounded-2xl bg-[#e94f37]/10">
                    <Image src={MASCOT_SRC} alt="Moodies mascot" fill sizes="80px" className="object-contain p-1" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff8a78]">Taste read</p>
                    <p className="mt-1 text-lg font-black text-white">{visiblePersona?.title}</p>
                    <p className="mt-1 text-xs leading-5 text-white/48">{visiblePersona?.description}</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[#e94f37]" style={{ width: `${publicScore}%` }} />
                    </div>
                  </div>
                </div>
                {ownProfile && (
                  <Link
                    href="/profile"
                    className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.10]"
                  >
                    Edit my profile
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Reviews" value={disclosure.reviews ? profile.stats.totalReviews : "Hidden"} icon={<Star size={18} />} />
            <StatTile label="Shared lists" value={sharedListCount} icon={<Bookmark size={18} />} />
            <StatTile label="Badges" value={disclosure.badges ? profile.achievements.length || earnedBadges.length : "Hidden"} icon={<Medal size={18} />} />
            <StatTile
              label="Avg rating"
              value={
                disclosure.reviews && profile.stats.averageRating
                  ? (profile.stats.averageRating / 2).toFixed(1)
                  : disclosure.reviews
                    ? "0.0"
                    : "Hidden"
              }
              icon={<Star size={18} />}
            />
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 sm:px-8 lg:px-10">
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <PublicInsightCard
            icon={<Sparkles size={18} />}
            label="Profile pulse"
            title={visiblePersona?.title ?? "Public viewer"}
            detail={visiblePersona?.signal ?? "Public taste profile"}
          />
          <PublicInsightCard
            icon={<Medal size={18} />}
            label="Featured badge"
            title={featuredAchievement?.badge?.badgeName ?? featuredAchievement?.achievement.title ?? "No shared badge yet"}
            detail={featuredAchievement?.badge?.rarity ?? "Badge visibility follows this user's settings"}
          />
          <PublicInsightCard
            icon={<Eye size={18} />}
            label="Disclosure"
            title={`${visibleDisclosureCount}/${disclosureItems.length} sections visible`}
            detail="Only shared profile areas are shown here"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            {disclosure.reviews && (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white/45">
                  Mood pattern
                </h2>
                {profile.stats.topMoods.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.stats.topMoods.map((mood) => (
                      <span
                        key={mood.emoji}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm text-white/80"
                      >
                        <span>{mood.emoji}</span>
                        <span className="text-xs text-white/45">
                          {mood.count}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-white/45">
                    No public mood tags yet.
                  </p>
                )}
              </div>
            )}

            {disclosure.badges && (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white/45">
                  Achievements
                </h2>
                <div className="mt-4 space-y-2">
                  {profile.achievements.length > 0 ? (
                    profile.achievements.slice(0, 6).map((row) => (
                      <div
                        key={row.achievement.key}
                        className="rounded-lg border border-[#e94f37]/25 bg-[#e94f37]/10 px-3 py-2 text-sm text-white"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">{row.badge?.badgeName ?? row.achievement.title}</span>
                          <span className="text-[0.62rem] font-bold uppercase tracking-wide text-[#ff8a78]">{row.badge?.rarity ?? "Common"}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-white/50">{row.achievement.reasoningTemplate}</p>
                      </div>
                    ))
                  ) : badges.map((badge) => (
                      <div
                        key={badge.name}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                          badge.earned
                            ? "border-[#e94f37]/25 bg-[#e94f37]/10 text-white"
                            : "border-white/10 bg-white/[0.03] text-white/32"
                        }`}
                      >
                        <span
                          className={
                            badge.earned ? "text-[#ff8a78]" : "text-white/25"
                          }
                        >
                          {badge.icon}
                        </span>
                        <span className="font-semibold">{badge.name}</span>
                      </div>
                    ))}
                  {profile.badges.length > 0 && (
                    <p className="pt-2 text-xs text-white/35">
                      {profile.badges.length} account badge{profile.badges.length === 1 ? "" : "s"} shared
                    </p>
                  )}
                </div>
              </div>
            )}

            {(disclosure.watchlist || disclosure.liked) && (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white/45">
                  Shared lists
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {disclosure.watchlist && (
                    <InsightMini
                      label="Watchlist"
                      value={`${profile.watchlist.movieId.length + profile.watchlist.seriesId.length}`}
                    />
                  )}
                  {disclosure.liked && (
                    <InsightMini
                      label="Liked"
                      value={`${profile.liked.movieId.length + profile.liked.seriesId.length}`}
                    />
                  )}
                </div>
              </div>
            )}

            {(disclosure.badges || disclosure.recentActivity) && (
              <div className="grid grid-cols-2 gap-3">
                {disclosure.badges && (
                  <InsightMini
                    label="Earned"
                    value={`${earnedBadges.length}/${badges.length}`}
                  />
                )}
                {disclosure.recentActivity && (
                  <InsightMini
                    label="Cadence"
                    value={reviewCadence ? `${reviewCadence}d` : "New"}
                  />
                )}
              </div>
            )}

            {disclosure.recentActivity && profile.recentActivity.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white/45">
                  Recent activity
                </h2>
                <div className="mt-4 space-y-2">
                  {profile.recentActivity.map((activity, index) => (
                    <div key={`${activity.type}-${index}`} className="rounded-lg bg-white/[0.04] px-3 py-2">
                      <p className="text-sm font-semibold text-white/75">{activity.label}</p>
                      <p className="mt-0.5 text-xs text-white/35">
                        {new Date(activity.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">
                  {disclosure.reviews ? "Public reviews" : "Reviews are private"}
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  {disclosure.reviews
                    ? "Recent thoughts this user shared with the community."
                    : "This user has chosen not to show reviews on their public profile."}
                </p>
              </div>
              {disclosure.reviews && (
                <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.05] p-1">
                  {(["all", "MOVIE", "TV"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setReviewFilter(filter)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        reviewFilter === filter
                          ? "bg-[#e94f37] text-white"
                          : "text-white/55 hover:text-white"
                      }`}
                    >
                      {filter === "all"
                        ? "All"
                        : filter === "MOVIE"
                          ? "Movies"
                          : "TV"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!disclosure.reviews ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-10 text-center text-sm text-white/45">
                Hidden by this user&apos;s disclosure settings.
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-10 text-center text-sm text-white/45">
                No reviews in this filter yet.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReviews.map((review, index) => (
                  <ReviewRow key={review.id} review={review} index={index} />
                ))}
              </div>
            )}

            {disclosure.watchlist && (
              <PublicListSection
                title="Public watchlist"
                description="Titles this user has saved for later."
                emptyText="This user has not shared any watchlist titles yet."
                icon={<Bookmark size={18} />}
                items={watchlistItems}
              />
            )}

            {disclosure.liked && (
              <PublicListSection
                title="Liked titles"
                description="Movies and series this user marked as favorites."
                emptyText="This user has not shared any liked titles yet."
                icon={<Heart size={18} />}
                items={likedItems}
              />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function PublicInsightCard({
  icon,
  label,
  title,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-[#e94f37]/30 hover:bg-white/[0.055]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:via-[#e94f37]/60" />
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#e94f37]/14 text-[#ff8a78]">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/32">
            {label}
          </p>
          <h3 className="mt-1 truncate text-base font-black text-white">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-white/45">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] p-4 transition hover:-translate-y-0.5 hover:border-[#e94f37]/25 hover:bg-white/[0.055]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#e94f37]/15 text-[#ff8a78]">
        {icon}
      </div>
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>
    </div>
  );
}

function InsightMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-xl font-black text-white">{value}</p>
      <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-white/35">
        {label}
      </p>
    </div>
  );
}

function PublicListSection({
  title,
  description,
  emptyText,
  icon,
  items,
}: {
  title: string;
  description: string;
  emptyText: string;
  icon: React.ReactNode;
  items: PublicListItem[];
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e94f37]/15 text-[#ff8a78]">
              {icon}
            </span>
            {title}
          </h2>
          <p className="mt-1 text-sm text-white/45">{description}</p>
        </div>
        {items.length > 0 && (
          <span className="w-fit rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-white/35">
            {items.length} shown
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-8 text-center text-sm text-white/45">
          {emptyText}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((item) => (
            <PublicListCard key={`${item.mediaType}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function PublicListCard({ item }: { item: PublicListItem }) {
  const href = item.mediaType === "TV" ? `/tv/${item.id}` : `/movies/${item.id}`;
  const poster = posterSrc(item.poster);

  return (
    <Link
      href={href}
      className="group min-w-0 rounded-xl border border-white/10 bg-black/25 p-2 transition hover:-translate-y-0.5 hover:border-[#e94f37]/40 hover:bg-white/[0.06]"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-white/[0.08]">
        {poster ? (
          <img
            src={poster}
            alt={item.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/25">
            {item.mediaType === "TV" ? <Tv size={24} /> : <Film size={24} />}
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[0.62rem] font-bold text-white/80">
          {item.mediaType === "TV" ? "TV" : "Movie"}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-bold leading-5 text-white group-hover:text-[#ff8a78]">
        {item.title}
      </p>
      {item.year && <p className="mt-0.5 text-xs text-white/35">{item.year}</p>}
    </Link>
  );
}

function ReviewRow({ review, index }: { review: PublicReview; index: number }) {
  const type = review.mediaType === "TV" ? "tv" : "movies";
  const poster = posterSrc(review.tmdbPoster);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.035, 0.25) }}
      className="rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/20 hover:bg-white/[0.06]"
    >
      <div className="flex gap-4">
        <Link
          href={`/${type}/${review.tmdbId}`}
          className="h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-white/[0.08]"
        >
          {poster ? (
            <img
              src={poster}
              alt={review.tmdbTitle}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/30">
              {review.mediaType === "TV" ? (
                <Tv size={24} />
              ) : (
                <Film size={24} />
              )}
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <Link
                href={`/${type}/${review.tmdbId}`}
                className="block truncate text-base font-bold text-white transition hover:text-[#ff8a78]"
              >
                {review.tmdbTitle}
              </Link>
              <p className="mt-1 text-xs text-white/40">
                {review.mediaType === "TV" ? "TV Show" : "Movie"}
                {review.tmdbYear ? ` - ${review.tmdbYear}` : ""}
                {" - "}
                {new Date(review.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1">
              <Star size={12} className="fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-bold">
                {(review.rating / 2).toFixed(1)}
              </span>
            </div>
          </div>

          {review.moodEmojis.length > 0 && (
            <div className="mt-3 flex gap-1">
              {review.moodEmojis.slice(0, 4).map((mood, moodIndex) => (
                <span key={`${mood}-${moodIndex}`} className="text-base">
                  {mood}
                </span>
              ))}
            </div>
          )}

          <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/68">
            {review.content}
          </p>
        </div>
      </div>
    </motion.article>
  );
}
