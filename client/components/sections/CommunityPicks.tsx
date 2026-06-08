"use client";

import { useEffect, useState } from "react";
import { InfiniteMovingCards } from "../ui/infinite-moving-cards";

export type ReviewItem = {
  quote: string;
  name: string;
  title: string;
  avatar: string;
  rating?: number;
  tmdbId?: number;
  movieTitle?: string;
  moviePoster?: string | null;
  movieBackdrop?: string | null;
  movieYear?: string | null;
  user?: {
    id: string;
    username: string;
    name?: string | null;
    avatarUrl?: string | null;
  };
};

type MoodiesReviewResponse =
  | MoodiesReview[]
  | {
      reviews?: MoodiesReview[];
    };

type MoodiesReview = {
  id?: string;
  tmdbId?: number;
  mediaType?: "MOVIE" | "TV";
  rating?: number;
  content?: string;
  quote?: string;
  title?: string;
  name?: string;
  avatar?: string;
  media?: {
    id?: number;
    type?: "MOVIE" | "TV";
    title?: string | null;
    posterPath?: string | null;
    backdropPath?: string | null;
    releaseDate?: string | null;
  };
  movie?: {
    id?: number;
    title?: string | null;
    posterPath?: string | null;
    backdropPath?: string | null;
    releaseDate?: string | null;
  };
  user?: {
    id: string;
    username: string;
    name?: string | null;
    avatarUrl?: string | null;
  };
};

interface CommunityPicksProps {
  data?: ReviewItem[];
  title?: string;
  subtitle?: string;
  endpoint?: string;
}

function normalizeAvatar(avatar?: string | null) {
  if (!avatar) return "";
  if (avatar.startsWith("http")) return `/${avatar}`;
  return avatar;
}

function normalizeMoodiesReview(review: MoodiesReview): ReviewItem {
  const displayName =
    review.user?.name ||
    review.user?.username ||
    review.name ||
    "Moodies critic";
  const media = review.media || review.movie;
  const movieTitle =
    media?.title ||
    review.title ||
    (review.tmdbId ? `Movie #${review.tmdbId}` : "Moodies review");

  return {
    quote: review.content || review.quote || "No review available",
    name: displayName,
    title: movieTitle,
    avatar: normalizeAvatar(review.user?.avatarUrl || review.avatar),
    rating: review.rating,
    tmdbId: review.tmdbId || media?.id,
    movieTitle,
    moviePoster: media?.posterPath || null,
    movieBackdrop: media?.backdropPath || null,
    movieYear: media?.releaseDate?.split("-")[0] || null,
    user: review.user,
  };
}

function normalizeReviewResponse(payload: MoodiesReviewResponse): ReviewItem[] {
  const rawReviews = Array.isArray(payload) ? payload : payload.reviews || [];
  return rawReviews.map(normalizeMoodiesReview);
}

export default function CommunityPicks({
  data,
  title = "Moodies Crew Reviews",
  subtitle = "Fresh reactions from the community: real opinions, real watch-night energy.",
  endpoint,
}: CommunityPicksProps) {
  const [reviews, setReviews] = useState<ReviewItem[]>(data || []);
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    if (data) {
      setReviews(data);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const base =
          process.env.NEXT_PUBLIC_NEST_API_URL || "http://localhost:4000";
        const path = endpoint || "/reviews/community-picks?limit=18";
        const res = await fetch(`${base}${path}`, {
          next: { revalidate: 60 },
        });

        if (!res.ok) throw new Error("Failed to fetch reviews");
        const result = (await res.json()) as MoodiesReviewResponse;
        setReviews(normalizeReviewResponse(result));
      } catch (error) {
        console.error("Error fetching reviews:", error);
        setReviews([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [data, endpoint]);

  if (loading) {
    return (
      <section className="relative mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-white/10 bg-neutral-950/75 p-5 sm:p-7">
          <div className="mb-6 space-y-3">
            <div className="h-5 w-36 animate-pulse rounded-full bg-white/10" />
            <div className="h-8 w-72 max-w-full animate-pulse rounded-lg bg-white/10" />
            <div className="h-4 w-96 max-w-full animate-pulse rounded bg-white/5" />
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-40 w-72 shrink-0 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (reviews.length === 0) return null;

  const ratedReviews = reviews.filter((review) => review.rating !== undefined);
  const averageRating =
    ratedReviews.length > 0
      ? ratedReviews.reduce((sum, review) => sum + (review.rating ?? 0), 0) /
        ratedReviews.length
      : null;

  return (
    <section
      id="community"
      className="relative mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
    >
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/80 py-6 shadow-2xl shadow-black/25 sm:py-8">
        <div className="px-5 sm:px-7 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff8b78]">
                From Moodies reviews
              </p>
              <h2
                className="mt-3 bg-clip-text text-xl font-bold tracking-tight text-transparent sm:text-2xl lg:text-3xl"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #e94f37, #ff6b58)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {title}
              </h2>

              {subtitle && (
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  {subtitle}
                </p>
              )}
            </div>

            <div className="flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-bold text-white/75">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e94f37]" />
              {reviews.length} community picks
              {averageRating !== null && (
                <span className="border-l border-white/10 pl-2 text-amber-200">
                  {averageRating.toFixed(1)} avg
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-white/10 pt-1">
          <InfiniteMovingCards
            items={reviews}
            direction="left"
            speed="very-slow"
            className="px-0 sm:px-4"
          />
        </div>
      </div>
    </section>
  );
}
