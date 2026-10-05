"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { tmdbImage } from "@/lib/tmdb";

type CanonicalMediaType = "MOVIE" | "TV";
type MediaTypeInput = string | null | undefined;

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
  mediaType?: CanonicalMediaType;
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

type MoodiesMediaDetail = {
  id?: number;
  type?: MediaTypeInput;
  mediaType?: MediaTypeInput;
  media_type?: MediaTypeInput;
  content_type?: MediaTypeInput;
  title?: string | null;
  name?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: string | null;
  firstAirDate?: string | null;
  first_air_date?: string | null;
};

type MoodiesReview = {
  id?: string;
  tmdbId?: number;
  mediaType?: MediaTypeInput;
  media_type?: MediaTypeInput;
  type?: MediaTypeInput;
  content_type?: MediaTypeInput;
  rating?: number;
  content?: string;
  quote?: string;
  title?: string;
  name?: string;
  avatar?: string;
  media?: MoodiesMediaDetail;
  movie?: MoodiesMediaDetail;
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
  if (avatar.startsWith("http")) return avatar;
  return avatar;
}

function reviewHref(review: ReviewItem) {
  if (!review.tmdbId) return null;
  return `/${review.mediaType === "TV" ? "tv" : "movies"}/${review.tmdbId}`;
}

function reviewPoster(review: ReviewItem) {
  const artwork = review.moviePoster || review.movieBackdrop;
  if (!artwork) return "/placeholder-poster.svg";
  if (artwork.startsWith("http")) return artwork;
  return tmdbImage(artwork, review.moviePoster ? "posterCard" : "backdropCard");
}

function reviewerInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function normalizeMediaType(
  value?: MediaTypeInput,
): CanonicalMediaType | undefined {
  if (!value) return undefined;

  const normalized = value.toLowerCase().replace(/[\s_-]/g, "");

  if (["tv", "series", "show", "tvshow", "tvseries"].includes(normalized)) {
    return "TV";
  }

  if (["movie", "movies", "film", "films"].includes(normalized)) {
    return "MOVIE";
  }

  return undefined;
}

function resolveMediaType(review: MoodiesReview): CanonicalMediaType {
  const media = review.media;
  const directType = [
    media?.type,
    media?.mediaType,
    media?.media_type,
    media?.content_type,
    review.mediaType,
    review.media_type,
    review.type,
    review.content_type,
  ]
    .map(normalizeMediaType)
    .find(Boolean);

  if (directType) return directType;

  if (
    media?.firstAirDate ||
    media?.first_air_date ||
    (media?.name && !media?.title)
  ) {
    return "TV";
  }

  return "MOVIE";
}

function normalizeReviewItem(review: ReviewItem): ReviewItem {
  return {
    ...review,
    mediaType: normalizeMediaType(review.mediaType) || review.mediaType,
  };
}

function normalizeMoodiesReview(review: MoodiesReview): ReviewItem {
  const displayName =
    review.user?.name ||
    review.user?.username ||
    review.name ||
    "Moodies critic";
  const media = review.media || review.movie;
  const mediaType = resolveMediaType(review);
  const movieTitle =
    media?.title ||
    media?.name ||
    review.title ||
    (review.tmdbId
      ? `${mediaType === "TV" ? "TV" : "Movie"} #${review.tmdbId}`
      : "Moodies review");

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
    movieYear:
      (
        media?.releaseDate ||
        media?.firstAirDate ||
        media?.first_air_date
      )?.split("-")[0] || null,
    mediaType,
    user: review.user,
  };
}

function normalizeReviewResponse(payload: MoodiesReviewResponse): ReviewItem[] {
  const rawReviews = Array.isArray(payload) ? payload : payload.reviews || [];
  return rawReviews.map(normalizeMoodiesReview);
}

export default function CommunityPicks({
  data,
  title = "Community picks worth a look",
  subtitle = "Short takes from Moodies members, paired with the titles they are talking about right now.",
  endpoint,
}: CommunityPicksProps) {
  const [reviews, setReviews] = useState<ReviewItem[]>(
    data?.map(normalizeReviewItem) || [],
  );
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    if (data) {
      setReviews(data.map(normalizeReviewItem));
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const base = process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
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
      <section className="ui-shell border-b border-[var(--surface-border)] py-8 sm:py-10">
        <div className="mb-6 space-y-3">
          <div className="h-3 w-32 animate-pulse rounded bg-[var(--surface-2)]" />
          <div className="h-9 w-72 max-w-full animate-pulse rounded bg-[var(--surface-2)]" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-[var(--surface-1)]" />
        </div>
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="h-[420px] animate-pulse rounded-md bg-[var(--surface-1)] lg:col-span-5" />
          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-md bg-[var(--surface-1)]"
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
  const [featuredReview, ...supportingReviews] = reviews.slice(0, 5);

  return (
    <section
      id="community"
      aria-labelledby="community-heading"
      className="ui-shell scroll-mt-24 border-b border-[var(--surface-border)] py-8 sm:py-10"
    >
      <div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="ui-kicker">
              Community signal
            </p>
            <h2 id="community-heading" className="mt-2 text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">
              {title}
            </h2>

            {subtitle && (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--ink-muted)] lg:border-l lg:border-[var(--surface-border)] lg:pl-3">
            <MessageCircle className="h-3.5 w-3.5 text-[var(--brand-coral-strong)]" />
            {Math.min(reviews.length, 5)} featured reviews
            {averageRating !== null && (
              <span className="border-l border-[var(--surface-border)] pl-2 text-[var(--brand-gold)]">
                {averageRating.toFixed(1)} avg
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 grid min-w-0 gap-3 sm:mt-6 lg:grid-cols-12">
          {featuredReview ? (
            <Link
              href={reviewHref(featuredReview) || "#community"}
              className="group grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] items-start overflow-hidden rounded-md border border-[var(--surface-border)] bg-[var(--surface-1)] transition-colors hover:border-[var(--brand-coral)] sm:min-h-[420px] sm:grid-cols-[42%_minmax(0,1fr)] sm:items-stretch lg:col-span-5 lg:grid-cols-[44%_minmax(0,1fr)]"
              aria-label={`Read the community review for ${featuredReview.movieTitle || featuredReview.title}`}
            >
              <div className="relative ml-3 mt-4 aspect-[2/3] overflow-hidden rounded-sm bg-[var(--surface-2)] sm:m-0 sm:aspect-auto sm:min-h-full sm:rounded-none">
                <Image
                  src={reviewPoster(featuredReview)}
                  alt={`${featuredReview.movieTitle || featuredReview.title} poster`}
                  fill
                  sizes="(max-width: 639px) 68px, (max-width: 1024px) 42vw, 220px"
                  className="object-cover"
                />
              </div>
              <blockquote className="flex min-w-0 flex-col p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[var(--ink-muted)]">
                  <span>
                    {featuredReview.mediaType === "TV" ? "Series" : "Movie"}
                    {featuredReview.movieYear
                      ? ` · ${featuredReview.movieYear}`
                      : ""}
                  </span>
                  {typeof featuredReview.rating === "number" ? (
                    <span className="text-[var(--brand-gold)]">
                      {featuredReview.rating.toFixed(1)}/10
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 line-clamp-5 text-base font-semibold leading-6 text-[var(--ink)] sm:mt-5 sm:line-clamp-7 sm:text-xl sm:leading-7">
                  “{featuredReview.quote}”
                </p>
                <footer className="mt-auto pt-4 sm:pt-6">
                  <p className="line-clamp-2 text-lg font-bold leading-5 text-[var(--ink)]">
                    {featuredReview.movieTitle || featuredReview.title}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--surface-border)] pt-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[10px] font-bold text-[var(--brand-coral-strong)]">
                        {reviewerInitials(featuredReview.name)}
                      </span>
                      <span className="truncate text-xs text-[var(--ink-muted)]">
                        {featuredReview.name}
                      </span>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-colors group-hover:text-[var(--brand-coral-strong)]" />
                  </div>
                </footer>
              </blockquote>
            </Link>
          ) : null}

          <div className="mobile-native-scroll flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-2 lg:col-span-7 lg:grid lg:grid-cols-2 lg:overflow-visible lg:pb-0">
            {supportingReviews.map((review, index) => (
              <Link
                key={`${review.tmdbId || "review"}-${index}`}
                href={reviewHref(review) || "#community"}
                className="group grid min-h-48 w-[92%] min-w-0 shrink-0 snap-start grid-cols-[5rem_minmax(0,1fr)] items-start overflow-hidden rounded-md border border-[var(--surface-border)] bg-[var(--surface-1)] transition-colors hover:border-[var(--brand-coral)] sm:w-[48%] sm:grid-cols-[104px_minmax(0,1fr)] sm:items-stretch lg:w-auto"
                aria-label={`Read the community review for ${review.movieTitle || review.title}`}
              >
                <div className="relative ml-3 mt-4 aspect-[2/3] overflow-hidden rounded-sm bg-[var(--surface-2)] sm:m-0 sm:aspect-auto sm:rounded-none">
                  <Image
                    src={reviewPoster(review)}
                    alt={`${review.movieTitle || review.title} poster`}
                    fill
                    sizes="(max-width: 639px) 68px, 104px"
                    className="object-cover"
                  />
                </div>
                <blockquote className="flex min-w-0 flex-col p-4">
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--ink-muted)]">
                    <span>
                      {review.mediaType === "TV" ? "Series" : "Movie"}
                    </span>
                    {typeof review.rating === "number" ? (
                      <span className="text-[var(--brand-gold)]">
                        {review.rating.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-5 text-[var(--ink)]">
                    “{review.quote}”
                  </p>
                  <footer className="mt-auto pt-3">
                    <p className="line-clamp-1 text-sm font-bold text-[var(--ink)]">
                      {review.movieTitle || review.title}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-[var(--ink-muted)]">
                        {review.name}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)] transition-colors group-hover:text-[var(--brand-coral-strong)]" />
                    </div>
                  </footer>
                </blockquote>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
