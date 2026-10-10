"use client";

import { ChevronDown, ChevronUp, Eye, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

type Props = { seasons: SeasonWithEpisodes[]; className?: string };

// Keep independent limits so resizing does not unexpectedly expand either layout.
const MOBILE_BATCH_SIZE = 4;
const DESKTOP_BATCH_SIZE = 12;

function formatDate(value?: string | null): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function seasonLabel(season: SeasonWithEpisodes): string {
  return season.name || (season.season_number === 0 ? "Specials" : `Season ${season.season_number}`);
}

export default function TvSeasonsEpisodes({ seasons, className = "" }: Props) {
  const orderedSeasons = [...seasons].sort((a, b) => a.season_number - b.season_number);
  const defaultSeason = orderedSeasons.find((season) => season.season_number > 0) ?? orderedSeasons[0];
  const [seasonNumber, setSeasonNumber] = useState(defaultSeason?.season_number ?? null);
  const [visibleCount, setVisibleCount] = useState(MOBILE_BATCH_SIZE);
  const [desktopVisibleCount, setDesktopVisibleCount] = useState(DESKTOP_BATCH_SIZE);
  const [episodeNumber, setEpisodeNumber] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const season = orderedSeasons.find((item) => item.season_number === seasonNumber) ?? defaultSeason;
  const episodes = [...(season?.episodes ?? [])].sort((a, b) => a.episode_number - b.episode_number);
  const selectedEpisode = episodes.find((episode) => episode.episode_number === episodeNumber);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!selectedEpisode || !dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedEpisode]);

  return (
    <section className={`ui-shell scroll-mt-24 py-8 sm:py-10 ${className}`} aria-labelledby="seasons-heading">
      <header className="mb-5 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="seasons-heading" className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">Seasons and episodes</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">Choose a season. Open an episode for its story and details.</p>
        </div>
        {season && (
          <div className="relative w-full sm:w-56">
            <select
              aria-label="Choose season"
              value={season.season_number}
              onChange={(event) => {
                setSeasonNumber(Number(event.target.value));
                setVisibleCount(MOBILE_BATCH_SIZE);
                setDesktopVisibleCount(DESKTOP_BATCH_SIZE);
                setEpisodeNumber(null);
              }}
              className="ui-secondary-action h-11 w-full appearance-none pr-10 leading-none [&>option]:bg-[var(--surface-1)]"
            >
              {orderedSeasons.map((item) => <option key={item.season_number} value={item.season_number}>{seasonLabel(item)}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" aria-hidden="true" />
          </div>
        )}
      </header>

      {season ? (
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8">
          <aside className="min-w-0">
            <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-4 lg:grid-cols-1 lg:gap-5">
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-[var(--surface-1)] ring-1 ring-[var(--surface-border)]">
                <Image src={season.poster_path ? tmdbImage(season.poster_path, "w500") : "/placeholder-poster.svg"} alt={`${seasonLabel(season)} poster`} fill sizes="(min-width: 1024px) 224px, 128px" className="object-cover" />
              </div>
              <div className="min-w-0">
                <h3 className="break-words text-base font-bold leading-tight text-[var(--ink)] sm:text-lg">{seasonLabel(season)}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{season.episode_count ?? episodes.length} episodes</p>
                {season.air_date && <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{formatDate(season.air_date)}</p>}
                {season.overview && (
                  <details key={season.season_number} className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
                    <summary className="cursor-pointer rounded text-sm font-semibold text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral)]">Season overview</summary>
                    <p className="mt-2 max-w-3xl">{season.overview}</p>
                  </details>
                )}
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            {episodes.length ? (
              <>
                <div id="season-episode-grid" className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4" aria-label="Episodes">
                  {episodes.map((episode, index) => (
                    <button
                      key={`${season.season_number}-${episode.episode_number}`}
                      type="button"
                      aria-label={`View episode ${episode.episode_number}: ${episode.name || "Untitled episode"}`}
                      aria-haspopup="dialog"
                      onClick={() => setEpisodeNumber(episode.episode_number)}
                      className={`group min-w-0 self-start rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral)] ${index >= visibleCount ? "hidden" : "block"} ${index >= desktopVisibleCount ? "lg:hidden" : "lg:block"}`}
                    >
                      <span className="relative block aspect-video overflow-hidden rounded-xl bg-[var(--surface-1)]">
                        <Image src={episode.still_path ? tmdbImage(episode.still_path, "w500") : "/placeholder-backdrop.svg"} alt="" fill sizes="(min-width: 1280px) 304px, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw" className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" />
                        <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10 transition-colors group-hover:ring-[var(--brand-coral)]/60" />
                      </span>
                      <span className="mt-2.5 flex items-start gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-[var(--ink)] transition-colors group-hover:text-[var(--brand-coral-strong)]">
                            <span className="lg:hidden">EP{episode.episode_number}: </span>
                            <span className="hidden lg:inline">Episode {episode.episode_number}: </span>
                            {episode.name || "Untitled episode"}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4 text-[var(--ink-muted)]">
                            {episode.runtime ? <span>{episode.runtime} min</span> : null}
                            {episode.vote_average ? <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 text-[var(--brand-gold)]" aria-hidden="true" />{episode.vote_average.toFixed(1)}</span> : null}
                          </span>
                        </span>
                        <Eye className="mt-0.5 hidden h-4 w-4 shrink-0 text-[var(--ink-muted)] group-hover:text-[var(--brand-coral)] sm:block" aria-hidden="true" />
                      </span>
                    </button>
                  ))}
                </div>
                {episodes.length > MOBILE_BATCH_SIZE && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--surface-border)] pt-4 lg:hidden">
                    <p className="text-xs text-[var(--ink-muted)]" role="status">{Math.min(visibleCount, episodes.length)} of {episodes.length} episodes</p>
                    <div className="flex items-center gap-2">
                      {visibleCount > MOBILE_BATCH_SIZE && <button type="button" aria-label="Show fewer episodes" aria-controls="season-episode-grid" onClick={() => setVisibleCount(MOBILE_BATCH_SIZE)} className="ui-secondary-action leading-none">Less <ChevronUp className="h-4 w-4" aria-hidden="true" /></button>}
                      <button type="button" aria-label="Show more episodes" aria-controls="season-episode-grid" disabled={visibleCount >= episodes.length} onClick={() => setVisibleCount(Math.min(visibleCount + MOBILE_BATCH_SIZE, episodes.length))} className="ui-secondary-action leading-none disabled:cursor-not-allowed disabled:opacity-35">More <ChevronDown className="h-4 w-4" aria-hidden="true" /></button>
                    </div>
                  </div>
                )}
                {episodes.length > DESKTOP_BATCH_SIZE && (
                  <div className="mt-5 hidden items-center justify-between gap-3 border-t border-[var(--surface-border)] pt-4 lg:flex">
                    <p className="text-xs text-[var(--ink-muted)]" role="status">{Math.min(desktopVisibleCount, episodes.length)} of {episodes.length} episodes</p>
                    <div className="flex items-center gap-2">
                      {desktopVisibleCount > DESKTOP_BATCH_SIZE && <button type="button" aria-label="Show fewer desktop episodes" aria-controls="season-episode-grid" onClick={() => setDesktopVisibleCount(DESKTOP_BATCH_SIZE)} className="ui-secondary-action leading-none">Less <ChevronUp className="h-4 w-4" aria-hidden="true" /></button>}
                      <button type="button" aria-label="Show more desktop episodes" aria-controls="season-episode-grid" disabled={desktopVisibleCount >= episodes.length} onClick={() => setDesktopVisibleCount(Math.min(desktopVisibleCount + DESKTOP_BATCH_SIZE, episodes.length))} className="ui-secondary-action leading-none disabled:cursor-not-allowed disabled:opacity-35">More <ChevronDown className="h-4 w-4" aria-hidden="true" /></button>
                    </div>
                  </div>
                )}
              </>
            ) : <p className="py-8 text-sm leading-6 text-[var(--ink-muted)]">Episode details are not available yet.</p>}
          </div>
        </div>
      ) : <p className="text-sm leading-6 text-[var(--ink-muted)]">No season information was returned for this title.</p>}

      <dialog
        ref={dialogRef}
        aria-labelledby="episode-dialog-title"
        onCancel={(event) => { event.preventDefault(); setEpisodeNumber(null); }}
        onClick={(event) => { if (event.target === event.currentTarget) setEpisodeNumber(null); }}
        className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto overscroll-contain rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        {selectedEpisode && (
          <div>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--surface-border)] px-5 py-3">
              <p className="text-sm font-semibold text-[var(--ink-muted)]">{season && seasonLabel(season)} · Episode {selectedEpisode.episode_number}</p>
              <button type="button" autoFocus onClick={() => setEpisodeNumber(null)} aria-label="Close episode details" className="ui-secondary-action shrink-0 px-3"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
            <div className="p-5">
              {selectedEpisode.still_path && <div className="relative mb-5 aspect-video overflow-hidden rounded-xl"><Image src={tmdbImage(selectedEpisode.still_path, "w780")} alt="" fill sizes="(min-width: 640px) 520px, 90vw" className="object-cover" /></div>}
              <h2 id="episode-dialog-title" className="text-xl font-bold leading-tight sm:text-2xl">{selectedEpisode.name || "Untitled episode"}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{formatDate(selectedEpisode.air_date)}{selectedEpisode.runtime ? ` · ${selectedEpisode.runtime} min` : ""}{selectedEpisode.vote_average ? ` · ${selectedEpisode.vote_average.toFixed(1)} / 10` : ""}</p>
              <p className="mt-4 whitespace-pre-line break-words text-sm leading-6 text-[var(--ink-muted)]">{selectedEpisode.overview || "A synopsis is not available for this episode yet."}</p>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
