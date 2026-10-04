"use client";

import Link from "next/link";
import { useState } from "react";
import type { HeroMoodRequest } from "@/components/hero/HeroMoodGuide";
import { CalendarDays, Tv } from "lucide-react";
import type { All } from "@/types/all";
import type { ReviewItem } from "@/components/sections/CommunityPicks";
import type { CommunityPulseData } from "@/types/communityPulse";
import { tmdbImage } from "@/lib/tmdb";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import RatingBadge from "@/components/ui/rating-badge";
import { HomepageMediaHero } from "@/components/hero/HomepageMediaHero";
import { MediaShelf } from "@/components/media/MediaShelf";
import MoodRecommendationsSection from "@/components/sections/MoodRecommendationSection";
import CommunityPicks from "@/components/sections/CommunityPicks";
import { ComingSoonSection } from "@/components/sections/ComingSoon";
import { CommunityPulseSection } from "@/components/sections/CommunityPulseSection";
import { useScrollToHash } from "@/hooks/useScrollToHash";

type TVHomePageClientProps = {
  trendingTV: All[];
  popularTV: All[];
  topRatedTV: All[];
  TVTrailer: All[];
  NewTVTrailer: All[];
  KoreanTV: All[];
  TVReview: ReviewItem[];
  newReleaseTV: All[];
  airingToday?: All[];
  airingThisWeek?: All[];
  moods?: unknown[];
  communityPulse?: CommunityPulseData;
};

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
          New episodes scheduled for today, arranged as a compact programming
          list instead of another poster wall.
        </p>
      </div>
      <ScheduleColumn
        label="Today"
        description="Episodes currently scheduled"
        items={todayItems}
      />
    </section>
  );
}

export default function TVHomePageClient({
  trendingTV,
  popularTV,
  topRatedTV,
  NewTVTrailer,
  KoreanTV,
  TVReview,
  newReleaseTV,
  airingToday = [],
  airingThisWeek = [],
  moods,
  communityPulse,
}: TVHomePageClientProps) {
  useScrollToHash(100);
  const [moodRequest, setMoodRequest] = useState<HeroMoodRequest | null>(null);
  const selectHeroMood = (name: string) =>
    setMoodRequest((previous) => ({
      name,
      revision: (previous?.revision ?? 0) + 1,
    }));
  const marqueeItems = popularTV.length ? popularTV : trendingTV;

  return (
    <main className="min-h-screen overflow-x-clip bg-[var(--surface-0)] text-[var(--ink)]">
      <HomepageMediaHero
        items={marqueeItems}
        mediaType="tv"
        icon={<Tv className="h-5 w-5" />}
        eyebrow="Series"
        title="A series for your kind of night"
        description="Settle into something comforting or get caught up in a thriller. Let your mood choose the next episode."
        onMoodSelect={selectHeroMood}
        spotlightLabel="Selected series"
        mediaLabel="Series"
        primaryCta="View series"
      />

      <div className="ui-shell space-y-12 py-10 sm:space-y-16 sm:py-14">
        <MoodRecommendationsSection
          mediaType="tv"
          initialMoods={moods}
          requestedMood={moodRequest}
        />
        <AiringSchedule today={airingToday} />

        <MediaShelf
          id="trending-tv"
          eyebrow="Most saved this week"
          title="Trending series"
          description="Series currently receiving the strongest audience attention on Moodies."
          items={trendingTV}
          hrefBase="/tv"
          watchType="series"
          viewAllHref="/tv/trending"
        />

        <MediaShelf
          id="new-release-tv"
          eyebrow="Recently premiered"
          title="New releases"
          description="Series that have recently started or returned with new episodes."
          items={newReleaseTV}
          hrefBase="/tv"
          watchType="series"
          viewAllHref="/tv/new-releases"
        />

        <MediaShelf
          id="top-rated-tv"
          eyebrow="Audience favourites"
          title="Top rated series"
          description="High-scoring series with enough audience votes to earn attention."
          items={topRatedTV}
          hrefBase="/tv"
          watchType="series"
          viewAllHref="/tv/top-rated"
        />

        <MediaShelf
          id="airing-this-week"
          eyebrow="Weekly schedule"
          title="Airing this week"
          description="Continuing series with episodes scheduled across the next several days."
          items={airingThisWeek}
          hrefBase="/tv"
          watchType="series"
          viewAllHref="/tv/airing/week"
        />

        <MediaShelf
          id="korean-tv"
          eyebrow="International spotlight"
          title="K-drama collection"
          description="Korean dramas, thrillers, romances and continuing series."
          items={KoreanTV}
          hrefBase="/tv"
          watchType="series"
          viewAllHref="/tv/k-drama"
        />

        <CommunityPulseSection data={communityPulse} mediaType="tv" />
      </div>

      <CommunityPicks
        data={TVReview}
        title="Critics corner"
        subtitle="Recent member reviews, paired with the shows they watched."
      />

      <div className="ui-shell space-y-12 pb-14 pt-10 sm:space-y-16">
        <ComingSoonSection
          title="Premiering Soon"
          items={NewTVTrailer}
          type="tv"
        />
      </div>
    </main>
  );
}
