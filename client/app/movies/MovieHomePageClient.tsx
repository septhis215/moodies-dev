"use client";

import Link from "next/link";
import { Ticket } from "lucide-react";
import type { All } from "@/types/all";
import type { ReviewItem } from "@/components/sections/CommunityPicks";
import { tmdbImage } from "@/lib/tmdb";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import RatingBadge from "@/components/ui/rating-badge";
import { HomepageMediaHero } from "@/components/hero/HomepageMediaHero";
import { MediaShelf } from "@/components/media/MediaShelf";
import MoodRecommendationsSection from "@/components/sections/MoodRecommendationSection";
import CommunityPicks from "@/components/sections/CommunityPicks";
import { DeferredSection } from "@/components/sections/DeferredSection";
import { DeferredSectionData } from "@/components/sections/DeferredSectionData";
import { DeferredMediaShelf } from "@/components/sections/DeferredMediaShelf";
import {
  CommunityPulseClient,
  UpcomingReleasesClient,
} from "@/components/sections/HomepageSectionsClient";
import { readHomepageTitles } from "@/lib/homepage-sections";
import { useScrollToHash } from "@/hooks/useScrollToHash";

type MoviesHomePageClientProps = {
  trendingMovies: All[];
  popularMovies: All[];
};

type DbCriticReview = {
  tmdbId: number;
  rating?: number;
  content?: string;
  movie?: {
    title?: string | null;
    posterPath?: string | null;
    backdropPath?: string | null;
    releaseDate?: string | null;
  };
  user?: ReviewItem["user"];
};

function readMovieReviews(payload: unknown): ReviewItem[] {
  if (!Array.isArray(payload)) throw new Error("Invalid movie reviews");
  return (payload as DbCriticReview[]).map((review) => ({
    quote: review.content || "No review available",
    name: review.user?.name || review.user?.username || "Moodies critic",
    title: review.movie?.title || `Movie #${review.tmdbId}`,
    avatar: review.user?.avatarUrl || "",
    rating: review.rating,
    user: review.user,
    tmdbId: review.tmdbId,
    movieTitle: review.movie?.title || `Movie #${review.tmdbId}`,
    moviePoster: review.movie?.posterPath || null,
    movieBackdrop: review.movie?.backdropPath || null,
    movieYear: review.movie?.releaseDate?.split("-")[0] || null,
  }));
}

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
          href="/movies/box-office"
          className="border-b border-[var(--surface-border)] pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)] transition-colors hover:text-[var(--brand-coral-strong)] hover:underline underline-offset-4"
        >
          View chart
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Link
          href={`/movies/${winner.id}`}
          className="group relative isolate flex min-h-80 items-end overflow-hidden rounded-md bg-[var(--surface-1)] focus-visible:-outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)]"
        >
          <Image
            src={tmdbImage(winner.backdrop_path, "backdropCard") ?? posterFor(winner)}
            alt=""
            fill
            sizes="(min-width: 1024px) 640px, 100vw"
            className="-z-10 object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
          />
          <div className="absolute inset-0 -z-10 bg-linear-to-t from-black via-black/65 to-black/15" />
          <div className="flex w-full min-w-0 flex-col p-5 sm:p-6">
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
            <p className="mt-2 text-xs text-white/75">
              {yearFor(winner)} · Current chart leader
            </p>
            <p className="mt-3 line-clamp-3 max-w-lg text-sm leading-6 text-white/80">
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
}: MoviesHomePageClientProps) {
  useScrollToHash(100);

  return (
    <main className="min-h-screen overflow-x-clip bg-[var(--surface-0)] text-[var(--ink)]">
      <HomepageMediaHero
        items={trendingMovies.length ? trendingMovies : popularMovies}
        mediaType="movie"
        title="Movies"
        mediaLabel="Movie"
        primaryCta="View movie"
      />
      <div className="homepage-browse">
        <div className="ui-shell homepage-chapter">
          <DeferredMediaShelf
            id="new-release-movies"
            title="New releases"
            endpoint="/movies/new-releases?page=1&limit=30"
            hrefBase="/movies"
            watchType="movie"
            viewAllHref="/movies/new-releases"
          />

          {popularMovies.length ? (
            <DeferredSection id="popular-movies" label="Box office ranking">
              <BoxOfficeRanking items={popularMovies} />
            </DeferredSection>
          ) : (
            <DeferredSectionData
              id="popular-movies"
              label="Box office ranking"
              endpoint="/movies/trending?limit=25"
              decode={readHomepageTitles}
            >
              {(items) => <BoxOfficeRanking items={items} />}
            </DeferredSectionData>
          )}

          <DeferredSection id="trending-movies" label="Featured now">
            <MediaShelf
              id="trending-movies"
              title="Featured now"
              items={trendingMovies}
              hrefBase="/movies"
              watchType="movie"
              viewAllHref="/movies/featured"
            />
          </DeferredSection>
        </div>

        <div className="ui-shell homepage-chapter">
          <DeferredSection id="upcoming" label="Coming to Theaters">
            <UpcomingReleasesClient initialData={null} mediaType="movie" />
          </DeferredSection>
        </div>

        <div className="ui-shell homepage-chapter">
          <DeferredMediaShelf
            id="korean-movies"
            eyebrow="International spotlight"
            title="Korean cinema"
            description="Contemporary Korean films spanning thrillers, dramas, comedy and action."
            endpoint="/movies/koreaTrending?limit=25"
            hrefBase="/movies"
            watchType="movie"
            viewAllHref="/movies/korean-cinema"
          />

          <DeferredMediaShelf
            id="action-movies"
            eyebrow="High velocity"
            title="Action-packed"
            endpoint="/movies/action-movies?limit=20"
            hrefBase="/movies"
            watchType="movie"
            viewAllHref="/movies/action"
          />

          <DeferredMediaShelf
            id="award-winners"
            eyebrow="Recognised work"
            title="Award winners"
            endpoint="/movies/award-winners?limit=25"
            hrefBase="/movies"
            watchType="movie"
            viewAllHref="/movies/award-winners"
          />

          <DeferredMediaShelf
            id="animated-movies"
            eyebrow="Illustrated worlds"
            title="Animated magic"
            endpoint="/movies/animated-movies?limit=20"
            hrefBase="/movies"
            watchType="movie"
            viewAllHref="/movies/animated"
          />

          <DeferredMediaShelf
            id="indie-movies"
            eyebrow="Beyond the mainstream"
            title="Indie spotlight"
            description="Independent films with distinctive voices and smaller-scale stories."
            endpoint="/movies/indie-movies?limit=20"
            hrefBase="/movies"
            watchType="movie"
            viewAllHref="/movies/indie"
          />

          <DeferredSection id="moods" label="Find a movie for your mood">
            <MoodRecommendationsSection mediaType="movie" />
          </DeferredSection>
        </div>

        <div className="homepage-chapter">
          <div className="ui-shell">
            <DeferredSection id="movie-community-pulse" label="Community pulse">
              <CommunityPulseClient initialData={null} mediaType="movie" />
            </DeferredSection>
          </div>
          <DeferredSectionData
            id="community"
            label="Critics corner"
            endpoint="/reviews/critics-corner/movies?limit=12"
            decode={readMovieReviews}
          >
            {(reviews) => (
              <CommunityPicks
                data={reviews}
                title="Critics corner"
                subtitle="Recent member reviews, paired with the films they watched."
              />
            )}
          </DeferredSectionData>
        </div>
      </div>
    </main>
  );
}
