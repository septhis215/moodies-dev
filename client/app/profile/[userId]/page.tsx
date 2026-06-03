"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Calendar, Film, Star, Tv, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/app/context/AuthProvider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
const TMDB_READ_TOKEN = process.env.NEXT_PUBLIC_TMDB_READ_TOKEN || "";

type PublicUser = {
  id: string;
  username: string;
  name?: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
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
  stats: {
    totalReviews: number;
    movieReviews: number;
    tvReviews: number;
    averageRating: number;
    topMoods: Array<{ emoji: string; count: number }>;
  };
  reviews: PublicReview[];
};

type TmdbDetail = {
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
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

async function fetchTmdbDetail(review: PublicReview): Promise<TmdbDetail | null> {
  if (!TMDB_API_KEY && !TMDB_READ_TOKEN) return null;
  const type = review.mediaType === "TV" ? "tv" : "movie";
  const url = TMDB_API_KEY
    ? `https://api.themoviedb.org/3/${type}/${review.tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`
    : `https://api.themoviedb.org/3/${type}/${review.tmdbId}?language=en-US`;

  const res = await fetch(url, {
    headers: TMDB_READ_TOKEN ? { Authorization: `Bearer ${TMDB_READ_TOKEN}` } : undefined,
  });
  if (!res.ok) return null;
  return res.json();
}

export default function PublicProfilePage() {
  const params = useParams<{ userId: string }>();
  const profileId = params.userId;
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"all" | "MOVIE" | "TV">("all");

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
          throw new Error(res.status === 404 ? "This profile does not exist." : "Unable to load this profile.");
        }

        const data: PublicProfile = await res.json();
        const enriched = await Promise.all(
          data.reviews.map(async (review) => {
            const detail = await fetchTmdbDetail(review).catch(() => null);
            const title = detail?.title || detail?.name;
            const date = detail?.release_date || detail?.first_air_date;

            return {
              ...review,
              tmdbTitle: title || `${review.mediaType === "TV" ? "TV" : "Movie"} #${review.tmdbId}`,
              tmdbPoster: detail?.poster_path ?? null,
              tmdbYear: date ? date.slice(0, 4) : undefined,
            };
          }),
        );

        if (!cancelled) setProfile({ ...data, reviews: enriched });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load this profile.");
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
    return profile.reviews.filter((review) => review.mediaType === reviewFilter);
  }, [profile, reviewFilter]);

  const ownProfile = Boolean(currentUser?.id && profile?.user.id === currentUser.id);
  const displayName = profile?.user.name || profile?.user.username || "Moodies user";
  const avatar = avatarSrc(profile?.user.avatarUrl);
  const initials = displayName
    .split(" ")
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

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
      <main className="min-h-screen bg-[#12111d] text-white">
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
    <main className="min-h-screen bg-[#12111d] text-white">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(233,79,55,0.20),transparent_34%),linear-gradient(180deg,#1b1828_0%,#12111d_100%)]">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-white/55 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Back to Moodies
          </Link>

          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-5">
              <div className="h-24 w-24 overflow-hidden rounded-full border border-white/15 bg-white/[0.08] shadow-2xl shadow-black/30 sm:h-28 sm:w-28">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={displayName}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-black text-white/70">
                    {initials || "M"}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ff8a78]">
                  Public profile
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                  {displayName}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/55">
                  <span>@{profile.user.username}</span>
                  {profile.user.createdAt && (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={14} />
                      Joined {new Date(profile.user.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {ownProfile && (
              <Link
                href="/profile"
                className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.10]"
              >
                Edit my profile
              </Link>
            )}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Reviews" value={profile.stats.totalReviews} icon={<Star size={18} />} />
            <StatTile label="Movies" value={profile.stats.movieReviews} icon={<Film size={18} />} />
            <StatTile label="TV shows" value={profile.stats.tvReviews} icon={<Tv size={18} />} />
            <StatTile label="Avg rating" value={profile.stats.averageRating ? (profile.stats.averageRating / 2).toFixed(1) : "0.0"} icon={<Star size={18} />} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
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
                      <span className="text-xs text-white/45">{mood.count}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-white/45">No public mood tags yet.</p>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white/45">
                Profile read
              </h2>
              <p className="mt-4 text-sm leading-6 text-white/60">
                {displayName} tends to leave {profile.stats.movieReviews >= profile.stats.tvReviews ? "movie-first" : "TV-first"} reactions,
                with an average score of {(profile.stats.averageRating / 2 || 0).toFixed(1)} out of 5.
              </p>
            </div>
          </aside>

          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Public reviews</h2>
                <p className="mt-1 text-sm text-white/45">
                  Recent thoughts this user shared with the community.
                </p>
              </div>
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
                    {filter === "all" ? "All" : filter === "MOVIE" ? "Movies" : "TV"}
                  </button>
                ))}
              </div>
            </div>

            {filteredReviews.length === 0 ? (
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
    <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
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
            <img src={poster} alt={review.tmdbTitle} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/30">
              {review.mediaType === "TV" ? <Tv size={24} /> : <Film size={24} />}
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
              <span className="text-xs font-bold">{(review.rating / 2).toFixed(1)}</span>
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
