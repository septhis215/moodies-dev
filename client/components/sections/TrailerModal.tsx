"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState, useEffect } from "react";
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

type All = {
  id: number;
  title: string;
  poster_path?: string;
  trailer_key?: string;
  release_date?: string;
  runtime?: number;
  number_of_episodes?: number;
  genres?: string[];
  overview?: string;
  vote_average?: number;
  recommendations?: All[];
  media_type?: string;
  type?: string;
  first_air_date?: string;
  name?: string;
  number_of_seasons?: number;
};

type Props = {
  trailer: All;
  onClose: () => void;
  onSelectTrailer: (trailer: All) => void | Promise<void>;
};

export default function TrailerModal({
  trailer,
  onClose,
  onSelectTrailer,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pendingTrailerId, setPendingTrailerId] = useState<number | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const getContentType = (item: Partial<All>): "movie" | "tv" => {
    if (item.media_type === "movie" || item.media_type === "tv") {
      return item.media_type;
    }
    if (item.type === "movies" || item.type === "movie")
      return "movie";
    if (item.type === "tv") return "tv";
    if (
      item.number_of_seasons ||
      item.first_air_date ||
      item.name
    )
      return "tv";
    return "movie";
  };
  const contentType = getContentType(trailer);
  const posterUrl = trailer.poster_path
    ? `https://image.tmdb.org/t/p/w500${trailer.poster_path}`
    : "/placeholder-poster.svg";
  const youtubeUrl = trailer.trailer_key
    ? `https://www.youtube.com/watch?v=${trailer.trailer_key}`
    : null;
  const router = useRouter();
  const handleClick = async (movie: All) => {
    const contentType = getContentType(movie);
    const routePath = contentType === "tv" ? "tv" : "movies";
    const href = `/${routePath}/${movie.id}`;
    router.push(href);
  };

  const handleRecommendationSelect = async (rec: All) => {
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
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    setPendingTrailerId(null);
    setSelectionError(null);
    setIsExpanded(false);
  }, [trailer.id]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/90 text-white backdrop-blur-md z-[999999]">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#080808] xl:flex-row">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.035),transparent_42%)]" />

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-50 rounded-full border border-white/15 bg-black/60 p-2.5 text-white shadow-2xl backdrop-blur-xl transition hover:border-[#e94f37]/70 hover:bg-[#e94f37] focus:outline-none focus:ring-2 focus:ring-[#e94f37]/50"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Trailer player */}
        <div className="relative flex min-h-[36vh] flex-none bg-black pt-14 sm:min-h-[42vh] lg:min-h-[46vh] xl:h-full xl:min-h-0 xl:flex-1 xl:pt-0">
          <div className="relative h-full w-full">
            {trailer.trailer_key ? (
              <iframe
                className="h-full min-h-[36vh] w-full bg-black sm:min-h-[42vh] lg:min-h-[46vh] xl:min-h-0"
                src={`https://www.youtube.com/embed/${trailer.trailer_key}?autoplay=0&controls=1&rel=0&modestbranding=1`}
                title={`${trailer.title} trailer`}
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="flex h-full min-h-[36vh] flex-col items-center justify-center gap-3 bg-neutral-950 text-gray-400 sm:min-h-[42vh] lg:min-h-[46vh] xl:min-h-0">
                <Film className="h-12 w-12 text-gray-600" />
                <p className="text-sm">Trailer unavailable</p>
              </div>
            )}

            {pendingTrailerId !== null && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-black/70 px-5 py-4 text-center shadow-2xl">
                  <Loader2 className="h-8 w-8 animate-spin text-[#ff8a78]" />
                  <div>
                    <p className="text-sm font-semibold text-white">Loading trailer</p>
                    <p className="mt-1 text-xs text-gray-400">Switching to your recommendation...</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Details panel */}
        <div
          className="relative flex min-h-0 w-full flex-1 flex-col border-t border-white/10 bg-neutral-950/92 shadow-2xl backdrop-blur-xl xl:h-full xl:w-[460px] xl:flex-none xl:border-l xl:border-t-0 2xl:w-[520px]"
        >
          <div className="flex-1 overflow-y-auto overflow-x-hidden">

            {/* Header */}
            <div className="relative flex-shrink-0 border-b border-white/10 p-4 sm:p-5 xl:p-6 xl:pt-16">
              <div className="flex items-start gap-4">
                <div
                  className="relative aspect-[2/3] w-20 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] shadow-xl transition hover:border-[#e94f37]/60 sm:w-24 xl:w-28"
                  onClick={() => handleClick(trailer)}
                >
                  <Image
                    src={posterUrl}
                    alt={trailer.title}
                    fill
                    sizes="(max-width: 640px) 80px, (max-width: 1280px) 96px, 112px"
                    className="object-cover"
                  />
                </div>

                {/* Title + Pills */}
                <div className="relative z-10 flex min-w-0 flex-1 flex-col">
                  <h2
                    className="mb-3 cursor-pointer text-lg font-bold leading-tight text-white transition hover:text-[#ff7a66] sm:text-xl xl:text-2xl"
                    onClick={() => handleClick(trailer)}
                  >
                    {trailer.title}
                  </h2>

                  {/* Pills */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-gray-200">
                      {contentType === "tv" ? (
                        <Tv className="h-3.5 w-3.5 text-[#ff8a78]" />
                      ) : (
                        <Film className="h-3.5 w-3.5 text-[#ff8a78]" />
                      )}
                      <span className="whitespace-nowrap">
                        {contentType === "tv" ? "TV Series" : "Movie"}
                      </span>
                    </span>

                    {trailer.vote_average !== undefined && (
                      <RatingBadge rating={trailer.vote_average} variant="colored" />
                    )}

                    {trailer.release_date && (
                      <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-gray-200">
                        <Calendar className="h-3.5 w-3.5 text-[#ff8a78]" />
                        <span className="whitespace-nowrap">
                          {new Date(trailer.release_date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </span>
                    )}

                    {trailer.runtime && (
                      <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-gray-200">
                        <Clock className="h-3.5 w-3.5 text-[#ff8a78]" />
                        <span className="whitespace-nowrap">{Math.floor(trailer.runtime / 60)}h {trailer.runtime % 60}m</span>
                      </span>
                    )}

                    {trailer.number_of_episodes && (
                      <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-gray-200">
                        <Tv className="h-3.5 w-3.5 text-[#ff8a78]" />
                        <span className="whitespace-nowrap">{trailer.number_of_episodes} Episodes</span>
                      </span>
                    )}

                    {trailer.genres?.slice(0, 3).map((genre, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-[#e94f37]/25 bg-[#e94f37]/12 px-2.5 py-1 text-xs font-semibold text-[#ffb0a3]"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleClick(trailer)}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#e94f37] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#ff624c]"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Details
                    </button>
                    {youtubeUrl && (
                      <a
                        href={youtubeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-gray-200 transition hover:border-white/30 hover:bg-white/[0.09]"
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
              <div className="flex-shrink-0 border-b border-white/10 px-4 py-5 sm:px-5 xl:px-6">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Synopsis
                </h3>

                <p className="max-w-prose text-sm leading-6 text-gray-300">
                  {isExpanded
                    ? trailer.overview
                    : trailer.overview.length > 300
                      ? trailer.overview.slice(0, 300) + "..."
                      : trailer.overview}
                  {trailer.overview.length > 300 && (
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="ml-2 inline-flex items-center gap-1 text-sm font-semibold text-[#ff8a78] hover:text-white"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? "Show less" : "Read more"}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </p>
              </div>
            )}


            {/* Recommendations */}
            {trailer.recommendations && trailer.recommendations?.length > 0 && (
              <div className="p-4 sm:p-5 xl:p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    You Might Also Like
                  </h3>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-xs text-gray-400">
                    {trailer.recommendations.length}
                  </span>
                </div>

                {selectionError && (
                  <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {selectionError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                  {trailer.recommendations.slice(0, 20).map((rec) => {
                    const isPending = pendingTrailerId === rec.id;
                    const isBlocked = pendingTrailerId !== null && !isPending;

                    return (
                    <button
                      type="button"
                      key={rec.id}
                      onClick={() => handleRecommendationSelect(rec)}
                      disabled={pendingTrailerId !== null}
                      title={rec.title}
                      className={`group relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] text-left transition hover:-translate-y-0.5 hover:border-[#e94f37]/55 hover:bg-white/[0.07] disabled:cursor-wait ${isBlocked ? "opacity-45" : ""} ${isPending ? "border-[#e94f37]/70 ring-1 ring-[#e94f37]/50" : ""}`}
                    >
                      {/* Poster */}
                      <div className="aspect-[2/3] relative overflow-hidden">
                        <Image
                          src={rec.poster_path ? `https://image.tmdb.org/t/p/w300${rec.poster_path}` : "/placeholder-poster.svg"}
                          alt={rec.title}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 180px"
                          className="object-cover transition-transform duration-500"
                        />

                        {/* Cinematic bottom fade */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

                        {/* Hover dim */}
                        <div className={`absolute inset-0 bg-black/35 transition-opacity duration-300 ${isPending ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />

                        {/* Play button */}
                        <div className={`absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/50 bg-black/55 backdrop-blur transition-all duration-300 ${isPending ? "scale-100 opacity-100" : "scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100"}`}>
                          {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                          ) : (
                            <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
                          )}
                        </div>

                        {isPending && (
                          <div className="absolute inset-x-2 bottom-2 rounded-md bg-black/75 px-2 py-1 text-center text-[11px] font-semibold text-white backdrop-blur">
                            Loading...
                          </div>
                        )}

                        {/* Rating badge */}
                        <div className="absolute right-2 top-2">
                          <RatingBadge rating={rec.vote_average} variant="colored" />
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="px-2.5 pt-2 pb-2.5">
                        <p className="m-0 line-clamp-2 text-sm font-medium leading-snug text-white/70 transition-colors group-hover:text-white">
                          {rec.title}
                        </p>
                        {rec.release_date && (
                          <p className="text-[11px] text-white/35 mt-0.5">
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
  );
}
