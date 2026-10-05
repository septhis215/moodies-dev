"use client";

import { tmdbImage } from "@/lib/tmdb";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  Calendar,
  Film,
  Flame,
  Heart,
  Medal,
  Sparkles,
  Star,
  Tv,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import { fetchMediaSummary } from "@/lib/mediaApi";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
const PUBLIC_IMAGE_PATH_PATTERN =
  /^\/images\/.+\.(?:png|jpe?g|webp|gif|svg)(?:[?#].*)?$/i;
const REVIEW_MOOD_LABELS: Record<string, string> = {
  amazing: "Amazing",
  "loved-it": "Loved it",
  "enjoyed-it": "Enjoyed",
  "its-okay": "It's okay",
  meh: "Meh",
  "skip-it": "Disliked",
};

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
  return tmdbImage(avatarUrl, "w185");
}

function posterSrc(path?: string | null) {
  return path ? tmdbImage(path, "w342") : null;
}

function isPublicImagePath(value: string) {
  return PUBLIC_IMAGE_PATH_PATTERN.test(value.trim());
}

function moodKeyFromValue(value: string) {
  const cleanValue = value.trim().split(/[?#]/)[0] ?? "";
  const fileName = cleanValue.split("/").pop() ?? cleanValue;
  return fileName.replace(/\.[^.]+$/, "").toLowerCase();
}

function titleCaseMoodKey(key: string) {
  return key
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function moodLabelFromValue(value?: string | null) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return "Mood";

  const key = moodKeyFromValue(trimmedValue);
  if (REVIEW_MOOD_LABELS[key]) return REVIEW_MOOD_LABELS[key];

  return isPublicImagePath(trimmedValue)
    ? titleCaseMoodKey(key)
    : trimmedValue;
}

function MoodBadge({
  value,
  count,
  compact = false,
}: {
  value: string;
  count?: number;
  compact?: boolean;
}) {
  const trimmedValue = value.trim();
  const hasImage = isPublicImagePath(trimmedValue);
  const label = moodLabelFromValue(trimmedValue);

  return (
    <span
      title={label}
      className={`inline-flex max-w-full items-center gap-2 border border-[var(--surface-border)] bg-[var(--surface-1)] ${
        compact ? "py-1 pl-1 pr-2" : "py-1.5 pl-1.5 pr-3"
      } text-white/80`}
    >
      {hasImage ? (
        <span
          className={`flex shrink-0 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/[0.08] ${
            compact ? "h-6 w-6" : "h-7 w-7"
          }`}
        >
          <Image
            src={trimmedValue}
            alt=""
            aria-hidden="true"
            width={compact ? 20 : 24}
            height={compact ? 20 : 24}
            className="h-5 w-5 object-contain"
          />
        </span>
      ) : (
        <span className={compact ? "text-sm leading-none" : "text-base"}>
          {trimmedValue}
        </span>
      )}
      {hasImage && (
        <span
          className={`truncate font-semibold text-[var(--ink)] ${
            compact ? "max-w-[7rem] text-xs" : "max-w-[9rem] text-xs"
          }`}
        >
          {label}
        </span>
      )}
      {typeof count === "number" && (
        <span className="text-xs text-[var(--ink-muted)]">{count}</span>
      )}
    </span>
  );
}

async function fetchTmdbDetail(
  review: PublicReview,
): Promise<TmdbDetail | null> {
  const type = review.mediaType === "TV" ? "tv" : "movie";
  const summary = await fetchMediaSummary(type, review.tmdbId);
  if (!summary) return null;
  return {
    title: summary.title,
    name: summary.title,
    poster_path: summary.poster_path,
    release_date: summary.release_date ?? undefined,
    first_air_date: summary.first_air_date ?? undefined,
  };
}

async function fetchTmdbListItem(
  mediaType: "MOVIE" | "TV",
  id: string,
): Promise<PublicListItem> {
  const type = mediaType === "TV" ? "tv" : "movie";
  const fallback = `${mediaType === "TV" ? "TV" : "Movie"} #${id}`;
  try {
    const detail = await fetchMediaSummary(type, id);
    if (!detail) return { id, mediaType, title: fallback };
    const title = detail.title || fallback;
    const date = detail.release_date || detail.first_air_date;
    return {
      id,
      mediaType,
      title,
      poster: detail.poster_path,
      year: date ? date.slice(0, 4) : undefined,
    };
  } catch {
    return { id, mediaType, title: fallback };
  }
}

function getMoodPersona(profile: PublicProfile): MoodPersona {
  const { movieReviews, tvReviews, totalReviews, averageRating, topMoods } =
    profile.stats;
  const favoriteMood = topMoods[0]?.emoji
    ? moodLabelFromValue(topMoods[0].emoji)
    : null;
  const rating = averageRating / 2;

  if (totalReviews === 0) {
    return {
      title: "Quiet Curator",
      description:
        "They are still shaping their public taste profile, so every new review will move the needle.",
      signal: "Fresh profile",
    tone: "text-[var(--ink-muted)]",
    };
  }

  if (rating >= 4.2 && totalReviews >= 8) {
    return {
      title: "Joy Hunter",
      description:
        "This viewer gravitates toward titles that land well and leaves a warm trail of high-confidence picks.",
      signal: `${rating.toFixed(1)} avg score`,
      tone: "text-[var(--brand-coral-strong)]",
    };
  }

  if (tvReviews > movieReviews * 1.25) {
    return {
      title: "Arc Follower",
      description:
        "They lean into long-form stories, character turns, and the slow burn of a good season.",
      signal: `${tvReviews} TV reviews`,
      tone: "text-[var(--brand-coral-strong)]",
    };
  }

  if (movieReviews > tvReviews * 1.25) {
    return {
      title: "Momentum Seeker",
      description:
        "They move through films with pace, chasing strong premises, memorable scenes, and quick emotional payoff.",
      signal: `${movieReviews} movie reviews`,
      tone: "text-[var(--brand-coral-strong)]",
    };
  }

  return {
    title: favoriteMood ? "Mood Cartographer" : "Balanced Explorer",
    description: favoriteMood
      ? `Their reviews cluster around ${favoriteMood}, with a balanced spread across movies and TV.`
      : "They sample across formats and let the story decide where their attention goes next.",
    signal: favoriteMood ? `Top mood ${favoriteMood}` : "Balanced taste",
    tone: "text-[var(--brand-coral-strong)]",
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
          tone: "text-[var(--ink-muted)]",
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
  const visibleDisclosureCount = disclosureItems.filter(
    ([key]) => disclosure[key],
  ).length;
  const sharedListCount =
    (disclosure.watchlist
      ? (profile?.watchlist.movieId.length ?? 0) +
        (profile?.watchlist.seriesId.length ?? 0)
      : 0) +
    (disclosure.liked
      ? (profile?.liked.movieId.length ?? 0) +
        (profile?.liked.seriesId.length ?? 0)
      : 0);
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
      <main className="min-h-screen bg-[var(--surface-0)] text-[var(--ink)]">
        <div className="ui-shell flex min-h-[72vh] items-center justify-center">
          <div className="h-8 w-40 animate-pulse rounded bg-[var(--surface-2)]" aria-label="Loading profile" />
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="min-h-screen bg-[var(--surface-0)] text-[var(--ink)]">
        <div className="ui-shell flex min-h-[72vh] items-center justify-center">
          <div className="w-full max-w-lg border border-[var(--surface-border)] bg-[var(--surface-1)] p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center text-[var(--ink-muted)]">
              <UserRound size={24} />
            </div>
            <h1 className="text-3xl font-bold leading-none">Profile unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{error}</p>
            <Link
              href="/"
              className="ui-primary-action mt-6 inline-flex items-center gap-2"
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
    <main className="min-h-screen bg-[var(--surface-0)] pb-10 text-[var(--ink)]">
      <section>
        <div className="ui-shell py-5 sm:py-10">
          <Link
            href="/"
            className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] sm:mb-8"
          >
            <ArrowLeft size={16} />
            Back to Moodies
          </Link>

          <div className="border-b border-[var(--surface-border)] pb-8 sm:pb-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-start gap-4 sm:gap-6">
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden border border-[var(--surface-border)] bg-[var(--surface-2)] sm:h-28 sm:w-28">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={displayName}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--brand-coral)] text-3xl font-extrabold text-white">
                      {initials || "M"}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="ui-kicker">Public profile · {visiblePersona?.title ?? "Moodies user"}</p>
                  <h1 className="mt-2 break-words text-3xl font-bold leading-none text-[var(--ink)] sm:text-5xl">
                    {displayName}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm leading-6 text-[var(--ink-muted)]">
                    <span>@{profile.user.username}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {visibleDisclosureCount}/{disclosureItems.length} sections
                      shared
                    </span>
                  </div>
                  {profile.user.createdAt && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-[var(--ink-muted)]">
                      <Calendar size={14} />
                      Joined{" "}
                      {new Date(profile.user.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              {ownProfile && (
                <Link href="/profile" className="ui-secondary-action inline-flex min-h-11 items-center justify-center sm:self-auto">
                  View my profile
                </Link>
              )}
            </div>

            <div className="mt-8 max-w-2xl border-l-2 border-[var(--brand-coral)] pl-4">
              <p className="text-xl font-bold leading-tight text-[var(--ink)]">A window into their taste</p>
              <div>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                    {visiblePersona?.description ?? "A public view of this member's Moodies taste."}
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--brand-coral-strong)]">
                    {visiblePersona?.signal ?? "Public taste profile"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-b border-[var(--surface-border)] py-6 sm:grid-cols-4 sm:py-8">
            <StatTile
              label="Reviews"
              value={disclosure.reviews ? profile.stats.totalReviews : "Hidden"}
              icon={<Star size={18} />}
            />
            <StatTile
              label="Shared lists"
              value={sharedListCount}
              icon={<Bookmark size={18} />}
            />
            <StatTile
              label="Badges"
              value={
                disclosure.badges
                  ? profile.achievements.length || earnedBadges.length
                  : "Hidden"
              }
              icon={<Medal size={18} />}
            />
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

      <section className="ui-shell">
        <div className="grid gap-5 sm:gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-8 sm:space-y-10">
            {disclosure.reviews && (
              <section className="border-t border-[var(--surface-border)] pt-5" aria-labelledby="mood-pattern-heading">
                <p className="ui-kicker">Community signal</p>
                <h2 id="mood-pattern-heading" className="mt-2 text-2xl font-bold leading-tight text-[var(--ink)]">
                  Mood pattern
                </h2>
                {profile.stats.topMoods.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.stats.topMoods.map((mood) => (
                      <MoodBadge
                        key={mood.emoji}
                        value={mood.emoji}
                        count={mood.count}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">
                    No public mood tags yet.
                  </p>
                )}
              </section>
            )}

            {disclosure.badges && (
              <section className="border-t border-[var(--surface-border)] pt-5" aria-labelledby="achievements-heading">
                <p className="ui-kicker">Progress earned</p>
                <h2 id="achievements-heading" className="mt-2 text-2xl font-bold leading-tight text-[var(--ink)]">
                  Achievements
                </h2>
                <div className="mt-4 space-y-2">
                  {profile.achievements.length > 0
                    ? profile.achievements.slice(0, 6).map((row) => (
                        <div
                          key={row.achievement.key}
                          className="border-b border-[var(--surface-border)] py-3 text-sm text-[var(--ink)]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold">
                              {row.badge?.badgeName ?? row.achievement.title}
                            </span>
                            <span className="text-xs font-semibold text-[var(--brand-coral-strong)]">
                              {row.badge?.rarity ?? "Common"}
                            </span>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                            {row.achievement.reasoningTemplate}
                          </p>
                        </div>
                      ))
                    : badges.map((badge) => (
                        <div
                          key={badge.name}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                            badge.earned
                              ? "border-[var(--brand-coral)]/25 bg-[var(--brand-coral)]/10 text-[var(--ink)]"
                              : "border-[var(--surface-border)] bg-[var(--surface-1)] text-[var(--ink-muted)]"
                          }`}
                        >
                          <span
                            className={
                              badge.earned ? "text-[var(--brand-coral-strong)]" : "text-[var(--ink-muted)]"
                            }
                          >
                            {badge.icon}
                          </span>
                          <span className="font-semibold">{badge.name}</span>
                        </div>
                      ))}
                  {profile.badges.length > 0 && (
                    <p className="pt-2 text-sm text-[var(--ink-muted)]">
                      {profile.badges.length} account badge
                      {profile.badges.length === 1 ? "" : "s"} shared
                    </p>
                  )}
                </div>
              </section>
            )}

            {(disclosure.watchlist || disclosure.liked) && (
              <section className="border-t border-[var(--surface-border)] pt-5" aria-labelledby="shared-lists-heading">
                <p className="ui-kicker">Shared archive</p>
                <h2 id="shared-lists-heading" className="mt-2 text-2xl font-bold leading-tight text-[var(--ink)]">
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
              </section>
            )}

            {(disclosure.badges || disclosure.recentActivity) && (
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
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
              <section className="border-t border-[var(--surface-border)] pt-5" aria-labelledby="recent-activity-heading">
                <p className="ui-kicker">Latest signal</p>
                <h2 id="recent-activity-heading" className="mt-2 text-2xl font-bold leading-tight text-[var(--ink)]">
                  Recent activity
                </h2>
                <div className="mt-4 space-y-2">
                  {profile.recentActivity.map((activity, index) => (
                    <div
                      key={`${activity.type}-${index}`}
                      className="border-b border-[var(--surface-border)] py-3"
                    >
                      <p className="text-sm font-semibold text-[var(--ink)]">
                        {activity.label}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                        {new Date(activity.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </aside>

          <div className="space-y-8 sm:space-y-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-3xl font-bold leading-none sm:text-4xl">
                  {disclosure.reviews
                    ? "Public reviews"
                    : "Reviews are private"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                  {disclosure.reviews
                    ? "Recent thoughts this user shared with the community."
                    : "This user has chosen not to show reviews on their public profile."}
                </p>
              </div>
              {disclosure.reviews && (
                <div className="inline-flex w-full border border-[var(--surface-border)] bg-[var(--surface-1)] p-1 sm:w-auto">
                  {(["all", "MOVIE", "TV"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setReviewFilter(filter)}
                      className={`min-h-9 flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition sm:flex-none ${
                        reviewFilter === filter
                          ? "bg-[var(--brand-coral)] text-white"
                          : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
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
              <div className="border-y border-[var(--surface-border)] p-10 text-center text-sm text-[var(--ink-muted)]">
                Hidden by this user&apos;s disclosure settings.
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="border-y border-[var(--surface-border)] p-10 text-center text-sm text-[var(--ink-muted)]">
                No reviews in this filter yet.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReviews.map((review) => (
                  <ReviewRow key={review.id} review={review} />
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
    <div>
      <div className="flex items-center gap-2 text-[var(--brand-coral-strong)]">
        {icon}
      </div>
      <p className="mt-2 text-2xl font-bold leading-none text-[var(--ink)]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[var(--ink-muted)]">
        {label}
      </p>
    </div>
  );
}

function InsightMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-[var(--surface-border)] px-4 py-2 first:border-l-0">
      <p className="text-xl font-bold text-[var(--ink)]">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
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
    <section className="border-t border-[var(--surface-border)] py-6 sm:py-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">
            <span className="flex h-9 w-9 items-center justify-center text-[var(--brand-coral-strong)]">
              {icon}
            </span>
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{description}</p>
        </div>
        {items.length > 0 && (
          <span className="w-fit text-xs font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
            {items.length} shown
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="border border-[var(--surface-border)] bg-[var(--surface-1)] p-8 text-center text-sm text-[var(--ink-muted)]">
          {emptyText}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((item) => (
            <PublicListCard key={`${item.mediaType}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function PublicListCard({ item }: { item: PublicListItem }) {
  const href =
    item.mediaType === "TV" ? `/tv/${item.id}` : `/movies/${item.id}`;
  const poster = posterSrc(item.poster);

  return (
    <Link
      href={href}
      className="group min-w-0 border border-[var(--surface-border)] bg-[var(--surface-1)] p-2 transition-[border-color,background-color] hover:border-[var(--brand-coral)] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)]"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-[var(--surface-2)]">
        {poster ? (
          <img
            src={poster}
            alt={item.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--ink-muted)]">
            {item.mediaType === "TV" ? <Tv size={24} /> : <Film size={24} />}
          </div>
        )}
        <span className="absolute left-2 top-2 bg-black/70 px-2 py-1 text-xs font-semibold text-white/88">
          {item.mediaType === "TV" ? "TV" : "Movie"}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)] group-hover:text-[var(--brand-coral-strong)]">
        {item.title}
      </p>
      {item.year && <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{item.year}</p>}
    </Link>
  );
}

function ReviewRow({ review }: { review: PublicReview }) {
  const type = review.mediaType === "TV" ? "tv" : "movies";
  const poster = posterSrc(review.tmdbPoster);

  return (
    <article className="border-t border-[var(--surface-border)] py-4 transition-colors hover:border-[var(--brand-coral)] sm:py-5">
      <div className="flex gap-3 sm:gap-4">
        <Link
          href={`/${type}/${review.tmdbId}`}
          className="h-24 w-16 flex-shrink-0 overflow-hidden bg-[var(--surface-2)] sm:h-28 sm:w-20"
        >
          {poster ? (
            <img
              src={poster}
              alt={review.tmdbTitle}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--ink-muted)]">
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
                className="line-clamp-2 block text-sm font-semibold text-[var(--ink)] transition hover:text-[var(--brand-coral-strong)] sm:truncate sm:text-base"
              >
                {review.tmdbTitle}
              </Link>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                {review.mediaType === "TV" ? "TV Show" : "Movie"}
                {review.tmdbYear ? ` - ${review.tmdbYear}` : ""}
                {" - "}
                {new Date(review.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-1 border border-[var(--surface-border)] bg-[var(--surface-1)] px-2 py-1">
              <Star size={12} className="fill-[var(--brand-coral)] text-[var(--brand-coral)]" />
              <span className="text-xs font-bold">
                {(review.rating / 2).toFixed(1)}
              </span>
            </div>
          </div>

          {review.moodEmojis.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {review.moodEmojis.slice(0, 4).map((mood, moodIndex) => (
                <MoodBadge
                  key={`${mood}-${moodIndex}`}
                  value={mood}
                  compact
                />
              ))}
            </div>
          )}

          <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--ink-muted)]">
            {review.content}
          </p>
        </div>
      </div>
    </article>
  );
}
