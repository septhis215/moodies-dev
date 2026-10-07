"use client";

import { tmdbImage } from "@/lib/tmdb";
import { useRouter } from "next/navigation";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  ChevronDown,
  Clock,
  ExternalLink,
  Film,
  Loader2,
  Play,
  Tv,
  X,
} from "lucide-react";
import RatingBadge from "../ui/rating-badge";

type TrailerItem = {
  id: number;
  title: string;
  poster_path?: string | null;
  trailer_key?: string | null;
  release_date?: string | null;
  runtime?: number | null;
  number_of_episodes?: number | null;
  genres?: string[];
  overview?: string;
  vote_average?: number;
  recommendations?: TrailerItem[];
  media_type?: string;
  type?: string;
  first_air_date?: string | null;
  name?: string;
  number_of_seasons?: number | null;
};

type TrailerSelectHandler = {
  bivarianceHack(trailer: TrailerItem): void | Promise<void>;
}["bivarianceHack"];

type Props = {
  trailer: TrailerItem;
  onClose: () => void;
  onSelectTrailer: TrailerSelectHandler;
};

export default function TrailerModal({
  trailer,
  onClose,
  onSelectTrailer,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pendingTrailerId, setPendingTrailerId] = useState<number | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const getContentType = (item: Partial<TrailerItem>): "movie" | "tv" => {
    if (item.media_type === "movie" || item.media_type === "tv") {
      return item.media_type;
    }
    if (item.type === "movies" || item.type === "movie") return "movie";
    if (item.type === "tv") return "tv";
    if (item.number_of_seasons || item.first_air_date || item.name) return "tv";
    return "movie";
  };
  const contentType = getContentType(trailer);
  const posterUrl = trailer.poster_path
    ? tmdbImage(trailer.poster_path, "w500")
    : "/placeholder-poster.svg";
  const youtubeUrl = trailer.trailer_key
    ? `https://www.youtube.com/watch?v=${trailer.trailer_key}`
    : null;
  const releaseDate = trailer.release_date || trailer.first_air_date;
  const runtimeLabel = trailer.runtime
    ? `${Math.floor(trailer.runtime / 60)}h ${trailer.runtime % 60}m`
    : trailer.number_of_episodes
      ? `${trailer.number_of_episodes} episodes`
      : null;
  const router = useRouter();
  const handleClick = async (movie: Partial<TrailerItem>) => {
    const contentType = getContentType(movie);
    const routePath = contentType === "tv" ? "tv" : "movies";
    const href = `/${routePath}/${movie.id}`;
    router.push(href);
  };

  const handleRecommendationSelect = async (rec: TrailerItem) => {
    if (pendingTrailerId !== null) return;

    setPendingTrailerId(rec.id);
    setSelectionError(null);

    try {
      await onSelectTrailer(rec);
    } catch (error) {
      console.error("Failed to load recommended trailer:", error);
      setSelectionError("Could not load that trailer. Please try another one.");
      setPendingTrailerId(null);
    }
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], iframe, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    const frameId = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    setPendingTrailerId(null);
    setSelectionError(null);
    setIsExpanded(false);
  }, [trailer.id]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/88 text-white"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trailer-modal-title"
        className="relative flex h-dvh w-full flex-col overflow-hidden bg-[var(--surface-0)]"
      >
        <header className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--surface-border)] px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6">
          <p className="min-w-0 truncate text-sm font-semibold text-[var(--ink)]">
            <span className="text-[var(--ink-muted)]">Trailer</span>
            <span aria-hidden="true" className="mx-2 text-[var(--ink-muted)]">
              /
            </span>
            {trailer.title}
          </p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close trailer"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[var(--surface-border)] text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Trailer player */}
          <div className="relative aspect-video max-h-[50dvh] w-full flex-none bg-black lg:h-full lg:max-h-none lg:min-h-0 lg:w-auto lg:flex-1 lg:aspect-auto">
            <div className="relative h-full w-full">
              {trailer.trailer_key ? (
                <iframe
                  className="h-full w-full bg-black"
                  src={`https://www.youtube.com/embed/${trailer.trailer_key}?autoplay=0&controls=1&rel=0&modestbranding=1`}
                  title={`${trailer.title} trailer`}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 bg-neutral-950 text-gray-400">
                  <Film className="h-12 w-12 text-gray-600" />
                  <p className="text-sm">Trailer unavailable</p>
                </div>
              )}

              {pendingTrailerId !== null && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3 rounded-md border border-white/15 bg-[#0b0909] px-5 py-4 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[#ff8a78]" />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Loading trailer
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        Switching to your recommendation...
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Details panel */}
          <div className="relative flex min-h-0 w-full flex-1 flex-col border-t border-white/10 bg-[#0b0909] lg:h-full lg:w-80 lg:flex-none lg:border-l lg:border-t-0 xl:w-96">
            <div className="flex-1 overflow-y-auto overflow-x-hidden mobile-native-scroll">
              {/* Header */}
              <div className="relative flex-shrink-0 border-b border-white/10 p-4 sm:p-5 lg:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div
                    className="relative aspect-[2/3] w-16 flex-shrink-0 cursor-pointer overflow-hidden rounded-sm border border-white/15 bg-white/[0.04] transition-colors hover:border-[#e94f37]/70 sm:w-24 lg:w-28"
                    onClick={() => handleClick(trailer)}
                  >
                    <Image
                      src={posterUrl}
                      alt={trailer.title}
                      fill
                      sizes="(max-width: 640px) 64px, (max-width: 1280px) 96px, 112px"
                      className="object-cover"
                    />
                  </div>

                  {/* Title + Pills */}
                  <div className="relative z-10 flex min-w-0 flex-1 flex-col">
                    <h2
                      id="trailer-modal-title"
                      className="cursor-pointer text-xl font-bold leading-[1.1] text-white transition-colors hover:text-[#ff7a66] sm:text-2xl"
                      onClick={() => handleClick(trailer)}
                    >
                      {trailer.title}
                    </h2>

                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">
                      <span className="flex items-center gap-1.5 text-white/85">
                        {contentType === "tv" ? (
                          <Tv className="h-3.5 w-3.5 text-[#ff8a78]" />
                        ) : (
                          <Film className="h-3.5 w-3.5 text-[#ff8a78]" />
                        )}
                        {contentType === "tv" ? "TV Series" : "Movie"}
                      </span>

                      {releaseDate && (
                        <>
                          <span aria-hidden="true" className="text-white/25">
                            /
                          </span>
                          <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(releaseDate).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </>
                      )}

                      {runtimeLabel ? (
                        <>
                          <span aria-hidden="true" className="text-white/25">
                            /
                          </span>
                          <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <Clock className="h-3.5 w-3.5" />
                            {runtimeLabel}
                          </span>
                        </>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {trailer.vote_average !== undefined ? (
                        <RatingBadge
                          rating={trailer.vote_average}
                          variant="colored"
                        />
                      ) : null}
                      {trailer.genres?.slice(0, 3).map((genre) => (
                        <span key={genre} className="text-xs text-white/55">
                          {genre}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
                      <button
                        onClick={() => handleClick(trailer)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#e94f37] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#ff624c]"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Details
                      </button>
                      {youtubeUrl && (
                        <a
                          href={youtubeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-gray-200 transition-colors hover:border-white/40 hover:bg-white/[0.06]"
                        >
                          <Play className="h-4 w-4 fill-current" />
                          Watch
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Synopsis */}
              {trailer.overview && (
                <div className="flex-shrink-0 border-b border-white/10 px-4 py-5 sm:px-5 lg:px-6">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                    About this title
                  </h3>

                  <p className="max-w-prose text-sm leading-6 text-gray-300">
                    {isExpanded
                      ? trailer.overview
                      : trailer.overview.length > 180
                        ? trailer.overview.slice(0, 180) + "..."
                        : trailer.overview}
                    {trailer.overview.length > 180 && (
                      <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="ml-2 inline-flex items-center gap-1 text-sm font-semibold text-[#ff8a78] hover:text-white"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? "Show less" : "Read more"}
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    )}
                  </p>
                </div>
              )}

              {/* Recommendations */}
              {trailer.recommendations &&
                trailer.recommendations?.length > 0 && (
                  <div className="p-4 sm:p-5 lg:p-6">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                        You Might Also Like
                      </h3>
                      <span className="text-xs tabular-nums text-gray-500">
                        {trailer.recommendations.length} titles
                      </span>
                    </div>

                    {selectionError && (
                      <div className="mb-3 rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                        {selectionError}
                      </div>
                    )}

                    <div
                      className={`mobile-native-scroll -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-5 sm:scroll-px-5 sm:px-5 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:scroll-px-0 lg:px-0 2xl:grid-cols-3 ${trailer.recommendations.length === 1 ? "justify-center lg:justify-normal" : ""}`}
                    >
                      {trailer.recommendations.slice(0, 20).map((rec) => {
                        const isPending = pendingTrailerId === rec.id;
                        const isBlocked =
                          pendingTrailerId !== null && !isPending;

                        return (
                          <button
                            type="button"
                            key={rec.id}
                            onClick={() => handleRecommendationSelect(rec)}
                            disabled={pendingTrailerId !== null}
                            title={rec.title}
                            className={`group w-[calc((100%-0.75rem)/2)] min-w-0 shrink-0 snap-start overflow-hidden rounded-sm border bg-white/[0.03] text-left transition-colors hover:border-[#e94f37]/65 hover:bg-white/[0.06] disabled:cursor-wait sm:w-[calc((100%-1.5rem)/3)] lg:w-auto ${isBlocked ? "border-white/10 opacity-45" : "border-white/15"} ${isPending ? "border-[#e94f37]" : ""}`}
                          >
                            {/* Poster */}
                            <div className="aspect-[2/3] relative overflow-hidden">
                              <Image
                                src={
                                  rec.poster_path
                                    ? tmdbImage(rec.poster_path, "w300")
                                    : "/placeholder-poster.svg"
                                }
                                alt={rec.title}
                                fill
                                sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 180px"
                                className="object-cover transition-transform duration-500"
                              />

                              {/* Hover dim */}
                              <div
                                className={`absolute inset-0 bg-black/45 transition-opacity duration-150 ${isPending ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}
                              />

                              {/* Play button */}
                              <div
                                className={`absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-sm border border-white/45 bg-black/75 transition-opacity duration-150 ${isPending ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}
                              >
                                {isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                                ) : (
                                  <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
                                )}
                              </div>

                              {isPending && (
                                <div className="absolute inset-x-2 bottom-2 rounded-sm bg-black/80 px-2 py-1 text-center text-[11px] font-semibold text-white">
                                  Loading...
                                </div>
                              )}

                              {/* Rating badge */}
                              <RatingBadge
                                rating={rec.vote_average}
                                variant="colored"
                                size="sm"
                                className="absolute right-2 top-2"
                              />
                            </div>

                            {/* Footer */}
                            <div className="border-t border-white/10 px-2.5 py-2.5">
                              <p className="m-0 line-clamp-2 text-sm font-semibold leading-snug text-white/75 transition-colors group-hover:text-white">
                                {rec.title}
                              </p>
                              {rec.release_date && (
                                <p className="mt-1 text-[11px] text-white/35">
                                  {new Date(rec.release_date).getFullYear()}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
