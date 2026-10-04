"use client";

import Link from "next/link";
import { useState } from "react";
import type { HeroMoodRequest } from "@/components/hero/HeroMoodGuide";
import { Film, Ticket } from "lucide-react";
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

type MoviesHomePageClientProps = {
  trendingMovies: All[];
  popularMovies: All[];
  topRatedMovies: All[];
  movieTrailers: All[];
  newMovieTrailers: All[];
  movieReviews: ReviewItem[];
  koreanMovies: All[];
  animatedMovies: All[];
  indieMovies: All[];
  awardWinners: All[];
  actionMovies: All[];
  moods?: unknown[];
  newReleaseMovies: All[];
  communityPulse?: CommunityPulseData;
};

const titleFor = (item: All) => item.title || item.name || "Untitled";
const yearFor = (item: All) =>
  (item.release_date || item.first_air_date || "").slice(0, 4) || "TBA";
const posterFor = (item: All) =>
  item.poster_path
    ? tmdbImage(item.poster_path, "posterCard")
    : "/placeholder-poster.svg";

function BoxOfficeRanking({ items }: { items: All[] }) {
  const ranked = items.slice(0, 5);
  const winner = ranked[0];
  if (!winner) return null;

  return (
    <section
      id="popular-movies"
      className="scroll-mt-24 border-t border-[var(--surface-border)] pt-8 sm:pt-10"
      aria-labelledby="box-office-heading"
    >
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--brand-coral-strong)]">
            <Ticket className="h-3.5 w-3.5" />
            Most watched this week
          </p>
          <h2
            id="box-office-heading"
            className="mt-1 text-2xl font-bold leading-none text-[var(--ink)] sm:text-[28px]"
          >
            Box office ranking
          </h2>
        </div>
        <Link
          href="/movies/popular"
          className="border-b border-[var(--surface-border)] pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-coral)] hover:text-[var(--ink)]"
        >
          View chart
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Link
          href={`/movies/${winner.id}`}
          className="group grid min-h-72 overflow-hidden rounded-md border border-[var(--surface-border)] bg-[var(--surface-1)] transition-colors hover:border-[var(--brand-coral)] sm:grid-cols-[210px_1fr]"
        >
          <div className="relative min-h-64 bg-[var(--surface-2)]">
            <Image
              src={posterFor(winner)}
              alt={titleFor(winner)}
              fill
              sizes="210px"
              className="object-cover"
            />
          </div>
          <div className="flex min-w-0 flex-col p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="text-5xl font-bold leading-none text-[var(--brand-coral-strong)]">
                01
              </span>
              <RatingBadge
                rating={winner.vote_average}
                variant="colored"
                size="sm"
              />
            </div>
            <h3 className="mt-5 text-3xl font-bold leading-none text-[var(--ink)] transition-colors group-hover:text-[var(--brand-coral-strong)]">
              {titleFor(winner)}
            </h3>
            <p className="mt-2 text-xs text-[var(--ink-muted)]">
              {yearFor(winner)} · Current chart leader
            </p>
            <p className="mt-4 line-clamp-4 text-sm leading-6 text-[var(--ink-muted)]">
              {winner.overview ||
                "The movie drawing the most attention this week."}
            </p>
          </div>
        </Link>

        <ol className="divide-y divide-[var(--surface-border)] border-y border-[var(--surface-border)]">
          {ranked.slice(1).map((movie, index) => (
            <li key={movie.id}>
              <Link
                href={`/movies/${movie.id}`}
                className="group grid grid-cols-[34px_52px_minmax(0,1fr)_auto] items-center gap-3 py-3"
              >
                <span className="text-lg font-bold text-[var(--ink-muted)]">
                  {String(index + 2).padStart(2, "0")}
                </span>
                <span className="relative aspect-[2/3] overflow-hidden rounded-sm bg-[var(--surface-2)]">
                  <Image
                    src={posterFor(movie)}
                    alt=""
                    fill
                    sizes="52px"
                    className="object-cover"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[var(--ink)] transition-colors group-hover:text-[var(--brand-coral-strong)]">
                    {titleFor(movie)}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--ink-muted)]">
                    {yearFor(movie)}
                  </span>
                </span>
                <RatingBadge
                  rating={movie.vote_average}
                  variant="colored"
                  size="sm"
                />
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default function MoviesHomePageClient({
  trendingMovies,
  popularMovies,
  newMovieTrailers,
  movieReviews,
  koreanMovies,
  animatedMovies,
  indieMovies,
  awardWinners,
  actionMovies,
  moods,
  newReleaseMovies,
  communityPulse,
}: MoviesHomePageClientProps) {
  useScrollToHash(100);
  const [moodRequest, setMoodRequest] = useState<HeroMoodRequest | null>(null);
  const selectHeroMood = (name: string) =>
    setMoodRequest((previous) => ({
      name,
      revision: (previous?.revision ?? 0) + 1,
    }));

  return (
    <main className="min-h-screen overflow-x-clip bg-[var(--surface-0)] text-[var(--ink)]">
      <HomepageMediaHero
        items={trendingMovies}
        mediaType="movie"
        icon={<Film className="h-5 w-5" />}
        eyebrow="Movies"
        title="A film for the way you feel"
        description="Comfort, laughter or a little suspense. Start with your mood, or explore tonight’s featured films."
        onMoodSelect={selectHeroMood}
        spotlightLabel="Selected feature"
        mediaLabel="Movie"
        primaryCta="View movie"
      />

      <div className="ui-shell space-y-12 py-10 sm:space-y-16 sm:py-14">
        <MoodRecommendationsSection
          mediaType="movie"
          initialMoods={moods}
          requestedMood={moodRequest}
        />
        <BoxOfficeRanking items={popularMovies} />

        <MediaShelf
          id="new-release-movies"
          eyebrow="Opened recently"
          title="New releases"
          description="Recent movies with enough audience activity to be worth checking first."
          items={newReleaseMovies}
          hrefBase="/movies"
          watchType="movie"
          viewAllHref="/movies/new-releases"
        />

        <MediaShelf
          id="trending-movies"
          eyebrow="Editorial selection"
          title="Featured now"
          description="Movies currently selected for the Moodies front row."
          items={trendingMovies}
          hrefBase="/movies"
          watchType="movie"
          viewAllHref="/movies/featured"
        />

        <MediaShelf
          id="korean-movies"
          eyebrow="International spotlight"
          title="Korean cinema"
          description="Contemporary Korean films spanning thrillers, dramas, comedy and action."
          items={koreanMovies}
          hrefBase="/movies"
          watchType="movie"
          viewAllHref="/movies/korean-cinema"
        />

        <CommunityPulseSection data={communityPulse} mediaType="movie" />

        <ComingSoonSection
          title="Coming to Theaters"
          items={newMovieTrailers}
          type="movies"
        />
      </div>

      <CommunityPicks
        data={movieReviews}
        title="Critics corner"
        subtitle="Recent member reviews, paired with the films they watched."
      />

      <div className="ui-shell space-y-12 pb-14 pt-10 sm:space-y-16">
        <MediaShelf
          id="action-movies"
          eyebrow="High velocity"
          title="Action-packed"
          description="Chases, fights and large-scale spectacle for a high-energy night."
          items={actionMovies}
          hrefBase="/movies"
          watchType="movie"
          viewAllHref="/movies/action"
        />

        <MediaShelf
          id="award-winners"
          eyebrow="Recognised work"
          title="Award winners"
          description="Celebrated performances and stories that stay with you."
          items={awardWinners}
          hrefBase="/movies"
          watchType="movie"
          viewAllHref="/movies/award-winners"
        />

        <MediaShelf
          id="animated-movies"
          eyebrow="Illustrated worlds"
          title="Animated magic"
          description="Playful adventures and imagined worlds for every age and mood."
          items={animatedMovies}
          hrefBase="/movies"
          watchType="movie"
          viewAllHref="/movies/animated"
        />

        <MediaShelf
          id="indie-movies"
          eyebrow="Beyond the mainstream"
          title="Indie spotlight"
          description="Independent films with distinctive voices and smaller-scale stories."
          items={indieMovies}
          hrefBase="/movies"
          watchType="movie"
          viewAllHref="/movies/indie"
        />
      </div>
    </main>
  );
}
