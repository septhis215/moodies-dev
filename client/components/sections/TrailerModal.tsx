"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
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
};

type Props = {
  trailer: All;
  onClose: () => void;
  onSelectTrailer: (trailer: All) => void | Promise<void>;
};

// Icon Components
const IconX = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IconCalendar = ({ size }: { size?: number }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const IconClock = ({ size }: { size?: number }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconDeviceTv = ({ size }: { size?: number }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

export default function TrailerModal({
  trailer,
  onClose,
  onSelectTrailer,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const getContentType = (item: Partial<All>): "movie" | "tv" => {
    if ((item as any).media_type) return (item as any).media_type;
    if ((item as any).type === "movies" || (item as any).type === "movie")
      return "movie";
    if ((item as any).type === "tv") return "tv";
    if (
      (item as any).number_of_seasons ||
      (item as any).first_air_date ||
      (item as any).name
    )
      return "tv";
    return "movie";
  };
  const router = useRouter();
  const handleClick = async (movie: All) => {
    const contentType = getContentType(movie);
    const routePath = contentType === "tv" ? "tv" : "movies";
    const href = `/${routePath}/${movie.id}`;
    router.push(href);
  };


  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-[999999]">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      <div className="relative w-full h-full bg-black/80 backdrop-blur-md flex flex-col xl:flex-row gap-4 items-stretch overflow-hidden ">

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-50 rounded-full bg-[#e94f37]/70 hover:bg-[#e94f37]/100 p-2 drop-shadow-lg focus:outline-none focus:ring-2 focus:ring-[#e94f37]/40 cursor-pointer"
          style={{ backdropFilter: "blur(6px)" }}
        >
          <IconX className="w-5 h-5 text-white" />
        </button>

        {/* Trailer player */}
        <div className="flex-none w-full xl:flex-[2] flex justify-center items-center min-h-0 p-4 pl-8">
          <div className="w-full h-full flex justify-center items-center">
            <iframe
              className="w-full h-full rounded-xl shadow-2xl border border-gray-700 bg-black"
              src={`https://www.youtube.com/embed/${trailer.trailer_key}?autoplay=0&controls=1`}
              title="Trailer"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{ aspectRatio: "16/9" }}
            />
          </div>
        </div>

        {/* Details panel */}
        <div
          ref={panelRef}
          className="flex-none w-full xl:flex-[1] bg-gradient-to-b from-black/95 to-black/85 backdrop-blur-xl border-l border-gray-600/50 shadow-2xl flex flex-col min-h-0 h-full"
        >
          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 hover:scrollbar-thumb-gray-400">

            {/* Header */}
            <div className="flex-shrink-0 p-3 sm:p-4 md:p-5 lg:p-6 pt-12 sm:pt-14 border-b border-gray-700/50 relative mt-6.5">
              <div className="flex gap-2 sm:gap-3 md:gap-4 lg:gap-6 items-start">
                <div
                  className="w-16 sm:w-20 md:w-28 lg:w-36 xl:w-44 flex-shrink-0 cursor-pointer transition-all"
                  onClick={() => handleClick(trailer)}
                >
                  <img
                    src={trailer.poster_path ? `https://image.tmdb.org/t/p/w500${trailer.poster_path}` : "/placeholder-poster.svg"}
                    alt={trailer.title}
                    className="rounded-lg shadow-xl object-cover w-full aspect-[2/3]"
                  />
                </div>

                {/* Title + Pills */}
                <div className="flex flex-col flex-1 min-w-0 mt-6 relative z-10 ">
                  <h2
                    // clamp ensures title never gets too big on narrow screens or too small on huge screens
                    style={{ fontSize: 'clamp(1.125rem, 3.2vw, 2rem)' }}
                    className="font-extrabold text-white drop-shadow-2xl leading-tight cursor-pointer mb-2 sm:mb-3 md:mb-4 hover:text-[#e94f37]"
                    onClick={() => handleClick(trailer)}
                  >
                    {trailer.title}
                  </h2>

                  {/* Pills */}
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-2.5 items-center">
                    {trailer.release_date && (
                      <span className="flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-blue-600/90 shadow text-[10px] sm:text-xs md:text-sm font-medium text-white">
                        <IconCalendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
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
                      <span className="flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-purple-600/90 shadow text-[10px] sm:text-xs md:text-sm font-medium text-white">
                        <IconClock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span className="whitespace-nowrap">{Math.floor(trailer.runtime / 60)}h {trailer.runtime % 60}m</span>
                      </span>
                    )}

                    {trailer.number_of_episodes && (
                      <span className="flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-purple-500/90 shadow text-[10px] sm:text-xs md:text-sm font-medium text-white">
                        <IconDeviceTv className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span className="whitespace-nowrap">{trailer.number_of_episodes} Episodes</span>
                      </span>
                    )}

                    {trailer.genres?.slice(0, 3).map((genre, i) => (
                      <span
                        key={i}
                        className="relative px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-white font-semibold text-[10px] sm:text-xs md:text-sm shadow overflow-hidden"
                      >
                        <span className="absolute inset-0 bg-gradient-to-r from-[#e94f37] via-pink-500 to-orange-500 opacity-30 rounded-full"></span>
                        <span className="relative z-10 whitespace-nowrap">{genre}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Synopsis */}
            {trailer.overview && (
              <div className="flex-shrink-0 px-4 sm:px-6 md:px-8 py-3 sm:py-4 border-b border-gray-700/30">
                <h3 className="text-gray-400 font-semibold text-xs sm:text-sm md:text-base uppercase tracking-wide mb-2">
                  Synopsis
                </h3>

                <p
                  className={
                    // responsive text sizing + constrained width for better readability
                    "text-gray-300 text-sm sm:text-base md:text-md leading-snug sm:leading-normal md:leading-relaxed max-w-full md:max-w-3xl break-words"
                  }
                >
                  {isExpanded
                    ? trailer.overview
                    : trailer.overview.length > 300
                      ? trailer.overview.slice(0, 300) + "..."
                      : trailer.overview}
                  {trailer.overview.length > 300 && (
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="ml-2 inline-block text-blue-400 hover:text-blue-500 text-xs sm:text-sm font-semibold"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </p>
              </div>
            )}


            {/* Recommendations */}
            {trailer.recommendations && trailer.recommendations?.length > 0 && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-gray-400 font-semibold text-sm sm:text-base lg:text-md uppercase tracking-wide">
                    You Might Also Like
                  </h3>
                  <span className="text-xs text-gray-400 bg-gray-800/90 px-2 py-1 rounded-full">
                    {trailer.recommendations.length}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {trailer.recommendations.slice(0, 20).map((rec) => (
                    <div
                      key={rec.id}
                      onClick={() => onSelectTrailer(rec)}
                      title={rec.title}
                      className="group relative cursor-pointer rounded-[10px] overflow-hidden bg-white/5 border border-white/8 transition-[border-color] duration-300 hover:border-white/50"
                    >
                      {/* Poster */}
                      <div className="aspect-[2/3] relative overflow-hidden">
                        <img
                          src={rec.poster_path ? `https://image.tmdb.org/t/p/w300${rec.poster_path}` : "/placeholder-poster.svg"}
                          alt={rec.title}
                          className="w-full h-full object-cover block transition-transform duration-500 group-hover:scale-105"
                        />

                        {/* Cinematic bottom fade */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

                        {/* Hover dim */}
                        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        {/* Play button */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/18 border border-white/50 flex items-center justify-center opacity-0 scale-85 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="white" className="ml-0.5">
                            <path d="M3 1.5l8 4.5-8 4.5z" />
                          </svg>
                        </div>

                        {/* Rating badge */}
                        <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md">
                          <RatingBadge rating={rec.vote_average} variant="colored" />
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="px-2.5 pt-2 pb-2.5">
                        <p className="text-[14px] font-medium text-white/60 group-hover:text-white/90 transition-colors duration-250 line-clamp-2 leading-snug m-0">
                          {rec.title}
                        </p>
                        {rec.release_date && (
                          <p className="text-[11px] text-white/35 mt-0.5">
                            {new Date(rec.release_date).getFullYear()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}