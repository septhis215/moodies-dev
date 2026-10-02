"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { tmdbImage } from "@/lib/tmdb";

export type Episode = {
  episode_number: number;
  name: string;
  overview: string;
  air_date?: string | null;
  runtime?: number | null;
  still_path?: string | null;
  vote_average?: number | null;
};

export type SeasonWithEpisodes = {
  season_number: number;
  name?: string;
  overview?: string | null;
  air_date?: string | null;
  poster_path?: string | null;
  episode_count?: number;
  episodes: Episode[];
};

type Props = {
  seasons: SeasonWithEpisodes[];
  className?: string;
};

const PAGE_SIZE = 30;

function formatDate(value?: string | null): string {
  if (!value) return "Date unknown";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function truncate(value: string | undefined, length: number): string {
  if (!value) return "";
  return value.length > length ? `${value.slice(0, length).trim()}…` : value;
}

export default function TvSeasonsEpisodes({ seasons, className = "" }: Props) {
  const [openSeason, setOpenSeason] = useState<number | null>(
    seasons[0]?.season_number ?? null,
  );
  const [pages, setPages] = useState<Record<number, number>>({});

  if (!seasons.length) {
    return (
      <section
        className={`ui-shell scroll-mt-24 py-8 sm:py-10 ${className}`}
        aria-labelledby="seasons-heading"
      >
        <h2
          id="seasons-heading"
          className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
        >
          Seasons
        </h2>
        <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">
          No season information was returned for this title.
        </p>
      </section>
    );
  }

  return (
    <section
      className={`ui-shell scroll-mt-24 py-8 sm:py-10 ${className}`}
      aria-labelledby="seasons-heading"
    >
      <header className="max-w-2xl">
        <h2
          id="seasons-heading"
          className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
        >
          Seasons and episodes
        </h2>
        <p className="mt-3 text-base leading-7 text-[var(--ink-muted)]">
          Browse the run in order, with enough context to decide where to
          start.
        </p>
      </header>

      <div className="mt-8">
        {seasons.map((season) => {
          const isOpen = openSeason === season.season_number;
          const episodes = [...(season.episodes ?? [])].sort(
            (a, b) => a.episode_number - b.episode_number,
          );
          const currentPage = pages[season.season_number] ?? 1;
          const totalPages = Math.max(1, Math.ceil(episodes.length / PAGE_SIZE));
          const start = (currentPage - 1) * PAGE_SIZE;
          const visibleEpisodes = episodes.slice(start, start + PAGE_SIZE);

          return (
            <article
              key={season.season_number}
              className="border-t border-[var(--surface-border)]"
            >
              <button
                type="button"
                onClick={() =>
                  setOpenSeason(isOpen ? null : season.season_number)
                }
                aria-expanded={isOpen}
                className="grid w-full gap-4 py-5 text-left sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="relative aspect-[2/3] w-20 overflow-hidden rounded-xl bg-[var(--surface-1)] sm:w-20">
                  <Image
                    src={
                      season.poster_path
                        ? tmdbImage(season.poster_path, "w185")
                        : "/placeholder-poster.svg"
                    }
                    alt={season.name ?? `Season ${season.season_number}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
                    Season {season.season_number}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold leading-6 text-[var(--ink)]">
                    {season.name ?? `Season ${season.season_number}`}
                  </h3>
                  {season.overview ? (
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
                      {truncate(season.overview, 180)}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
                    {season.episode_count ?? episodes.length} episodes
                    {season.air_date ? ` · ${formatDate(season.air_date)}` : ""}
                  </p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-[var(--ink-muted)] transition-transform ${isOpen ? "rotate-180 text-brand-coral-strong" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {isOpen ? (
                <div className="border-t border-[var(--surface-border)] pb-5 pt-2">
                  {visibleEpisodes.length > 0 ? (
                    <div className="divide-y divide-[var(--surface-border)]">
                      {visibleEpisodes.map((episode) => (
                        <article
                          key={episode.episode_number}
                          className="grid gap-4 py-4 sm:grid-cols-[9rem_minmax(0,1fr)]"
                        >
                          <div className="relative aspect-video overflow-hidden rounded-xl bg-[var(--surface-1)] sm:aspect-[16/9]">
                            <Image
                              src={
                                episode.still_path
                                  ? tmdbImage(episode.still_path, "w300")
                                  : "/placeholder-backdrop.svg"
                              }
                              alt={episode.name}
                              fill
                              sizes="144px"
                              className="object-cover"
                            />
                            <span className="absolute bottom-2 left-2 bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              E{episode.episode_number}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base font-semibold leading-5 text-[var(--ink)]">
                              {episode.name}
                            </h4>
                            <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                              {formatDate(episode.air_date)}
                              {episode.runtime ? ` · ${episode.runtime}m` : ""}
                              {episode.vote_average
                                ? ` · ${episode.vote_average.toFixed(1)}/10`
                                : ""}
                            </p>
                            {episode.overview ? (
                              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--ink-muted)]">
                                {episode.overview}
                              </p>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="py-5 text-sm leading-6 text-[var(--ink-muted)]">
                      Episode details are not available yet.
                    </p>
                  )}

                  {totalPages > 1 ? (
                    <div className="mt-3 flex items-center justify-between border-t border-[var(--surface-border)] pt-4">
                      <p className="text-xs text-[var(--ink-muted)]">
                        {start + 1}–{Math.min(start + PAGE_SIZE, episodes.length)} of {episodes.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={currentPage === 1}
                          onClick={() =>
                            setPages((current) => ({
                              ...current,
                              [season.season_number]: currentPage - 1,
                            }))
                          }
                          className="ui-secondary-action disabled:opacity-35"
                          aria-label="Previous episodes"
                        >
                          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <span className="text-xs text-[var(--ink-muted)]">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          type="button"
                          disabled={currentPage === totalPages}
                          onClick={() =>
                            setPages((current) => ({
                              ...current,
                              [season.season_number]: currentPage + 1,
                            }))
                          }
                          className="ui-secondary-action disabled:opacity-35"
                          aria-label="Next episodes"
                        >
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
