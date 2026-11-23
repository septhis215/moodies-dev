"use client";

import { useEffect, useId, useRef, useState } from "react";
import IntentPrefetchLink from "@/components/ui/IntentPrefetchLink";
import SectionHeader from "@/components/ui/SectionHeader";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { RatingBadge } from "@/components/ui/rating-badge";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { tmdbImage } from "@/lib/tmdb";
import { useCarouselScroll } from "@/hooks/useCarouselScroll";
import { CarouselNavButton } from "@/components/ui/CarouselNavButton";
import styles from "./CommunityPicks.module.css";
import { fetchSectionJson } from "@/lib/section-fetch";

function ReviewCard({ review, index, count, activeIndex }: { review: ReviewItem; index: number; count: number; activeIndex: number }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const quoteRef = useRef<HTMLParagraphElement>(null);
  const quoteId = useId();
  const mediaTitle = review.movieTitle || review.title;
  const href = reviewHref(review);
  const backdrop = review.movieBackdrop;
  const artwork = backdrop
    ? (backdrop.startsWith("http") ? backdrop : tmdbImage(backdrop, "backdropCard"))
    : reviewPoster(review);

  useEffect(() => {
    if (activeIndex !== index) setExpanded(false);
  }, [activeIndex, index]);

  useEffect(() => {
    const quote = quoteRef.current;
    if (!quote || expanded) return;
    const measure = () => setOverflows(quote.scrollHeight > quote.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(quote);
    return () => observer.disconnect();
  }, [expanded, review.quote]);

  return (
    <article className={styles.card} aria-label={`Review ${index + 1} of ${count}: ${mediaTitle}`}>
      <div className={styles.artwork}>
        <Image src={artwork || "/placeholder-backdrop.svg"} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 70vw, 33vw" className={backdrop ? styles.backdrop : styles.posterBackdrop} />
        <div className={styles.shade} />
        <div className={styles.media}>
          <span className={styles.poster}>
            <Image src={reviewPoster(review) || "/placeholder-poster.svg"} alt="" fill sizes="56px" className="object-cover" />
          </span>
          <div className={styles.mediaCopy}>
            <p className={styles.meta}>{review.mediaType === "TV" ? "Series" : "Movie"}{review.movieYear ? ` · ${review.movieYear}` : ""}</p>
            <h3 className={styles.mediaTitle}>{mediaTitle}</h3>
          </div>
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.reviewer}>
          <span className={styles.avatar}>
            {review.avatar && !avatarFailed ? (
              <Image src={review.avatar} alt="" fill sizes="36px" unoptimized onError={() => setAvatarFailed(true)} className="object-cover" />
            ) : reviewerInitials(review.name)}
          </span>
          <div className={styles.author}>
            <p>{review.name}</p>
            <span>Moodies member</span>
          </div>
          <RatingBadge rating={review.rating} variant="minimal" />
        </div>
        <blockquote className={`${styles.quote} ${expanded ? styles.quoteExpanded : ""}`} tabIndex={expanded ? 0 : undefined} aria-label={expanded ? `Full review by ${review.name}` : undefined}>
          <p ref={quoteRef} id={quoteId} className={expanded ? undefined : styles.excerpt}>“{review.quote}”</p>
        </blockquote>
        <div className={styles.actions}>
          {overflows && <button type="button" aria-expanded={expanded} aria-controls={quoteId} onClick={() => setExpanded(value => !value)}>{expanded ? "Show less" : "Read more"}</button>}
          {href && <IntentPrefetchLink href={href} aria-label={`Explore ${mediaTitle}`}>Explore title <ArrowUpRight size={16} aria-hidden="true" /></IntentPrefetchLink>}
        </div>
      </div>
    </article>
  );
}

function ReviewCarousel({ reviews }: { reviews: ReviewItem[] }) {
  const { containerRef: railRef, canScrollLeft, canScrollRight, scroll } = useCarouselScroll(reviews.length);
  const railId = useId();
  const [active, setActive] = useState(0);
  const firstDot = Math.max(0, Math.min(active - 2, reviews.length - 5));

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let frame = 0;
    const updateActive = () => {
      if (rail.scrollWidth <= rail.clientWidth + 2) {
        setActive(0);
        return;
      }
      if (rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 2) {
        setActive(reviews.length - 1);
        return;
      }
      const cards = Array.from(rail.children) as HTMLElement[];
      const first = cards[0]?.offsetLeft ?? 0;
      const nearest = cards.reduce(
        (best, card, index) =>
          Math.abs(card.offsetLeft - first - rail.scrollLeft) <
          Math.abs(cards[best].offsetLeft - first - rail.scrollLeft) ? index : best,
        0,
      );
      setActive(nearest);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateActive);
    };
    const observer = new ResizeObserver(onScroll);
    observer.observe(rail);
    updateActive();
    rail.addEventListener("scroll", onScroll, { passive: true });
    rail.addEventListener("scrollend", updateActive);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      rail.removeEventListener("scroll", onScroll);
      rail.removeEventListener("scrollend", updateActive);
    };
  }, [reviews]);

  const selectReview = (index: number) => {
    const rail = railRef.current;
    const card = rail?.children[index] as HTMLElement | undefined;
    const first = rail?.firstElementChild as HTMLElement | null;
    if (!rail || !card || !first) return;
    if (rail.scrollWidth <= rail.clientWidth + 2) {
      setActive(index);
      return;
    }
    rail.scrollTo({ left: card.offsetLeft - first.offsetLeft, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };

  return (
    <div className={styles.carouselSection}>
      <div className={styles.carousel}>
        {(canScrollLeft || canScrollRight) && <div role="group" aria-label="Community review navigation" className="pointer-events-none absolute inset-0 z-20">
          <CarouselNavButton direction="previous" aria-label="Previous community reviews" aria-controls={railId} disabled={!canScrollLeft} onClick={() => scroll(-1)} />
          <CarouselNavButton direction="next" aria-label="Next community reviews" aria-controls={railId} disabled={!canScrollRight} onClick={() => scroll(1)} />
        </div>}
        <div ref={railRef} id={railId} className={styles.rail} role="region" aria-label="Member reviews" aria-roledescription="carousel">
          {reviews.map((review, index) => <ReviewCard key={`${review.mediaType}-${review.tmdbId}-${review.user?.id || review.name}-${index}`} review={review} index={index} count={reviews.length} activeIndex={active} />)}
        </div>
      </div>
      {reviews.length > 1 && <div className={styles.navigation}>
        <span className={styles.swipeHint}>Swipe to read</span>
        <span className={styles.desktopHint}>Browse reviews</span>
        <div className={styles.dots} aria-label="Choose a review">
          {reviews.slice(firstDot, firstDot + 5).map((review, offset) => {
            const index = firstDot + offset;
            return <button key={`${review.tmdbId}-${index}`} type="button" aria-label={`Show review ${index + 1} of ${reviews.length}`} aria-controls={railId} aria-current={active === index ? "true" : undefined} onClick={() => selectReview(index)}><span /></button>;
          })}
        </div>
        <span className={styles.count} aria-live="polite" aria-atomic="true">{active + 1} / {reviews.length}</span>
      </div>}
    </div>
  );
}

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

    const controller = new AbortController();
    const fetchData = async () => {
      try {
        setLoading(true);
        const base = process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
        const path = endpoint || "/reviews/community-picks?limit=20";
        const result = await fetchSectionJson(`${base}${path}`, controller.signal) as MoodiesReviewResponse;
        if (!controller.signal.aborted) setReviews(normalizeReviewResponse(result));
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Error fetching reviews:", error);
        setReviews([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [data, endpoint]);

  if (loading) {
    return (
      <section className="ui-shell border-b border-[var(--surface-border)] py-8 sm:py-10">
        <div className="mb-6 space-y-3">
          <div className="h-3 w-32 moodies-skeleton rounded bg-[var(--surface-2)]" />
          <div className="h-9 w-72 max-w-full moodies-skeleton rounded bg-[var(--surface-2)]" />
          <div className="h-4 w-96 max-w-full moodies-skeleton rounded bg-[var(--surface-1)]" />
        </div>
        <div aria-hidden="true" className={styles.rail}>
          {[0, 1, 2].map(index => (
            <div key={index} className={`${styles.card} moodies-skeleton`} />
          ))}
        </div>
      </section>
    );
  }

  if (reviews.length === 0) return null;

  const visibleReviews = reviews.slice(0, 20);
  const ratedReviews = visibleReviews.filter((review) => review.rating !== undefined);
  const averageRating =
    ratedReviews.length > 0
      ? ratedReviews.reduce((sum, review) => sum + (review.rating ?? 0), 0) /
        ratedReviews.length
      : null;

  return (
    <section
      id="community"
      aria-labelledby="community-heading"
      className="ui-shell scroll-mt-24 border-b border-[var(--surface-border)] py-8 sm:py-10"
    >
      <div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader id="community-heading" title={title} description={subtitle} />

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--ink-muted)] lg:border-l lg:border-[var(--surface-border)] lg:pl-3">
            <MessageCircle className="h-3.5 w-3.5 text-[var(--brand-coral-strong)]" />
            {visibleReviews.length} featured reviews
            {averageRating !== null && (
              <span className="border-l border-[var(--surface-border)] pl-2 text-[var(--brand-gold)]">
                {averageRating.toFixed(1)} avg
              </span>
            )}
          </div>
        </div>

        <ReviewCarousel reviews={visibleReviews} />
      </div>
    </section>
  );
}
