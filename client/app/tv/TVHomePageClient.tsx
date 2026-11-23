"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { All } from "@/types/all";
import type { ReviewItem } from "@/components/sections/CommunityPicks";
import { tmdbImage } from "@/lib/tmdb";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import RatingBadge from "@/components/ui/rating-badge";
import { HomepageMediaHero } from "@/components/hero/HomepageMediaHero";
import { MediaShelf } from "@/components/media/MediaShelf";
import MoodRecommendationsSection from "@/components/sections/MoodRecommendationSection";
import CommunityPicks from "@/components/sections/CommunityPicks";
import { useScrollToHash } from "@/hooks/useScrollToHash";
import DeferredSection from "@/components/sections/DeferredSection";
import DeferredSectionData from "@/components/sections/DeferredSectionData";
import DeferredMediaShelf from "@/components/sections/DeferredMediaShelf";
import { CommunityPulseClient, UpcomingReleasesClient } from "@/components/sections/HomepageSectionsClient";
import { readHomepageTitles } from "@/lib/homepage-sections";

type TVHomePageClientProps = {
  trendingTV?: All[];
  popularTV: All[];
};

type DbCriticReview = {
  tmdbId: number;
  rating?: number;
  content?: string;
  tv?: {
    title?: string | null;
    posterPath?: string | null;
    backdropPath?: string | null;
    firstAirDate?: string | null;
  };
  user?: { id: string; username: string; name?: string | null; avatarUrl?: string | null };
};

function readTVReviews(payload: unknown): ReviewItem[] {
  if (!Array.isArray(payload)) throw new Error("Invalid TV reviews");
  return (payload as DbCriticReview[]).map(review => ({
    quote: review.content || "No review available",
    name: review.user?.name || review.user?.username || "Moodies critic",
    title: review.tv?.title || `Series #${review.tmdbId}`,
    avatar: review.user?.avatarUrl || "",
    rating: review.rating,
    user: review.user,
    tmdbId: review.tmdbId,
    mediaType: "TV",
    movieTitle: review.tv?.title || `Series #${review.tmdbId}`,
    moviePoster: review.tv?.posterPath || null,
    movieBackdrop: review.tv?.backdropPath || null,
    movieYear: review.tv?.firstAirDate?.split("-")[0] || null,
  }));
}

const titleFor = (item: All) => item.name || item.title || "Untitled";
const posterFor = (item: All) =>
  item.poster_path
    ? tmdbImage(item.poster_path, "posterSmall")
    : "/placeholder-poster.svg";

function ScheduleColumn({
  label,
  description,
  items,
}: {
  label: string;
  description: string;
  items: All[];
}) {
  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[var(--ink)]">{label}</h3>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            {description}
          </p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--brand-coral-strong)]">
          {items.length} shows
        </span>
      </div>
      <ol className="divide-y divide-[var(--surface-border)] border-y border-[var(--surface-border)]">
        {items.map((show, index) => (
          <li key={`${label}-${show.id}`}>
            <Link
              href={`/tv/${show.id}`}
              className="group grid grid-cols-[24px_48px_minmax(0,1fr)_auto] items-center gap-3 py-3"
            >
              <span className="text-xs font-bold text-[var(--ink-muted)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="relative aspect-[2/3] overflow-hidden rounded-sm bg-[var(--surface-2)]">
                <Image
                  src={posterFor(show)}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[var(--ink)] transition-colors group-hover:text-[var(--brand-coral-strong)]">
                  {titleFor(show)}
                </span>
                <span className="mt-1 block truncate text-xs text-[var(--ink-muted)]">
                  {label === "Today" ? "Episode today" : "Episode this week"}
                </span>
              </span>
              <RatingBadge
                rating={show.vote_average}
                variant="colored"
                size="sm"
              />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AiringSchedule({ today }: { today: All[] }) {
  const todayItems = today.slice(0, 4);
  if (!todayItems.length) return null;

  return (
    <section
      id="airing-today"
      className="scroll-mt-24 border-t border-[var(--surface-border)] pt-8 sm:pt-10"
      aria-labelledby="airing-heading"
    >
      <div className="mb-5 border-l-2 border-[var(--brand-coral)] pl-4">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--brand-coral-strong)]">
          <CalendarDays className="h-3.5 w-3.5" />
          Programming guide
        </p>
        <h2
          id="airing-heading"
          className="mt-1 text-2xl font-bold leading-none text-[var(--ink)] sm:text-[28px]"
        >
          On air
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">
          Series with new episodes scheduled today.
        </p>
      </div>
      <ScheduleColumn
        label="Today"
        description="Episodes currently scheduled"
        items={todayItems}
      />
      <Link
        href="/tv/airing/today"
        className="mt-4 inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-[var(--ink-muted)] outline-none transition-colors hover:text-[var(--brand-coral-strong)] hover:underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]"
      >
        View all airing today
      </Link>
    </section>
  );
}

export default function TVHomePageClient({
  trendingTV = [],
  popularTV,
}: TVHomePageClientProps) {
  useScrollToHash(100);
  const marqueeItems = popularTV.length ? popularTV : trendingTV;

  return (
    <main className="min-h-screen overflow-x-clip bg-[var(--surface-0)] text-[var(--ink)]">
      <HomepageMediaHero
        items={marqueeItems}
        mediaType="tv"
        title="TV shows"
        mediaLabel="Series"
        primaryCta="View series"
      />
      <div className="homepage-browse">
        <div className="ui-shell homepage-chapter">
          {trendingTV.length ? <MediaShelf
            id="trending-tv"
            title="Trending series"
            items={trendingTV}
            hrefBase="/tv"
            watchType="series"
            viewAllHref="/tv/trending"
          /> : <DeferredMediaShelf
            id="trending-tv"
            title="Trending series"
            endpoint="/tv/featured?limit=25"
            hrefBase="/tv"
            watchType="series"
            viewAllHref="/tv/trending"
          />}

          <DeferredMediaShelf
            id="new-release-tv"
            title="New releases"
            endpoint="/tv/new-releases?limit=30"
            hrefBase="/tv"
            watchType="series"
            viewAllHref="/tv/new-releases"
          />

        </div>

        <div className="ui-shell homepage-chapter">
          <DeferredSectionData id="airing-today" label="On air" endpoint="/tv/airing/today?limit=15" decode={readHomepageTitles}>
            {items => <AiringSchedule today={items} />}
          </DeferredSectionData>
          <DeferredMediaShelf
            id="airing-this-week"
            title="Airing this week"
            endpoint="/tv/airing/week?limit=20"
            hrefBase="/tv"
            watchType="series"
            viewAllHref="/tv/airing/week"
          />
          <DeferredSection id="upcoming" label="Premiering soon">
            <UpcomingReleasesClient initialData={null} mediaType="tv" />
          </DeferredSection>
        </div>

        <div className="ui-shell homepage-chapter">
          <DeferredMediaShelf
            id="top-rated-tv"
            eyebrow="Audience favourites"
            title="Top rated series"
            description="High-scoring series with enough audience votes to earn attention."
            endpoint="/tv/favorites?limit=30"
            hrefBase="/tv"
            watchType="series"
            viewAllHref="/tv/top-rated"
          />

          <DeferredMediaShelf
            id="korean-tv"
            eyebrow="International spotlight"
            title="K-drama collection"
            description="Korean dramas, thrillers, romances and continuing series."
            endpoint="/tv/koreaTrending?limit=20"
            hrefBase="/tv"
            watchType="series"
            viewAllHref="/tv/k-drama"
          />
        </div>

        <div className="ui-shell homepage-chapter">
          <DeferredSection id="moods" label="Mood matcher">
            <MoodRecommendationsSection mediaType="tv" />
          </DeferredSection>
        </div>

        <div className="homepage-chapter">
          <div className="ui-shell">
            <DeferredSection id="tv-community-pulse" label="Community pulse">
              <CommunityPulseClient initialData={null} mediaType="tv" />
            </DeferredSection>
          </div>
          <DeferredSectionData id="community" label="Critics corner" endpoint="/reviews/critics-corner/tv?limit=12" decode={readTVReviews}>
            {reviews => <CommunityPicks data={reviews} title="Critics corner" subtitle="Recent member reviews, paired with the shows they watched." />}
          </DeferredSectionData>
        </div>

      </div>
    </main>
  );
}
