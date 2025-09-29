"use client";

import { useState, useRef, useEffect } from "react";
import type { All } from "@/types/all";
import {
  IconCalendar,
  IconClock,
  IconDeviceTv,
  IconX,
} from "@tabler/icons-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

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
  const panelRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();

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
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      {/* Close on background click */}
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      <div className="relative w-full max-w-[90vw] mx-auto h-[85vh] max-h-[90vh] bg-black/80 backdrop-blur-md flex flex-col xl:flex-row gap-6 items-stretch">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-3 -right-3 z-50 rounded-full bg-[#e94f37]/70 hover:bg-[#e94f37]/100 p-2 drop-shadow-lg focus:outline-none focus:ring-2 focus:ring-[#e94f37]/40 cursor-pointer"
          style={{ backdropFilter: "blur(6px)" }}
        >
          <IconX className="w-5 h-5 text-white" />
        </button>

        {/* Trailer player */}
        <div className="flex-none w-full xl:flex-[2] flex justify-center items-center min-h-0">
          <div className="w-full h-full max-h-[60vh] xl:max-h-full flex justify-center items-center">
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
          className="flex-none w-full xl:flex-[1] bg-gradient-to-b from-black/95 to-black/85 backdrop-blur-xl rounded-l-2xl border border-gray-600/50 shadow-2xl flex flex-col min-h-0 h-[35vh] xl:h-full max-h-[35vh] xl:max-h-full"
        >
          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 hover:scrollbar-thumb-gray-400 px-1">
            {/* Header */}
            <div className="flex-shrink-0 p-4 xl:p-6 border-b border-gray-700/50 relative">
              <div className="flex gap-4 xl:gap-6 items-start">
                {trailer.poster_path && (
                  <div
                    className="w-20 xl:w-32 flex-shrink-0 cursor-pointer"
                    onClick={() => handleClick(trailer)}
                  >
                    <img
                      src={`https://image.tmdb.org/t/p/w300${trailer.poster_path}`}
                      alt={trailer.title}
                      className="rounded-lg shadow-xl object-cover w-full h-auto"
                    />
                  </div>
                )}

                <div className="flex flex-col flex-1 min-w-0 relative z-10">
                  <h2
                    className="text-xl xl:text-2xl 2xl:text-3xl font-extrabold text-white drop-shadow-2xl leading-tight cursor-pointer"
                    onClick={() => handleClick(trailer)}
                  >
                    {trailer.title}
                  </h2>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {trailer.release_date && (
                      <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-600/90 shadow-lg text-xs font-medium text-white">
                        <IconCalendar size={14} />
                        {new Date(trailer.release_date).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </span>
                    )}

                    {trailer.runtime && (
                      <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-purple-600/90 shadow-lg text-xs font-medium text-white">
                        <IconClock size={14} />
                        {Math.floor(trailer.runtime / 60)}h{" "}
                        {trailer.runtime % 60}m
                      </span>
                    )}

                    {trailer.number_of_episodes && (
                      <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-purple-500/90 shadow-lg text-xs font-medium text-white">
                        <IconDeviceTv size={14} />
                        {trailer.number_of_episodes} Episodes
                      </span>
                    )}

                    {trailer.genres?.slice(0, 3).map((genre, i) => (
                      <span
                        key={i}
                        className="relative px-3 py-1 rounded-full text-white font-semibold text-xs shadow-lg overflow-hidden"
                      >
                        <span className="absolute inset-0 bg-gradient-to-r from-[#e94f37] via-pink-500 to-orange-500 opacity-40 animate-gradient-x rounded-full"></span>
                        <span className="relative z-10">{genre}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Synopsis */}
            {trailer.overview && (
              <div className="flex-shrink-0 px-4 xl:px-6 py-3 xl:py-4 border-b border-gray-700/30">
                <h3 className="text-gray-400 font-semibold text-sm mb-2 uppercase tracking-wide">
                  Synopsis
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed break-words">
                  {isExpanded
                    ? trailer.overview
                    : trailer.overview.slice(0, 200) +
                      (trailer.overview.length > 200 ? "..." : "")}
                  {trailer.overview.length > 200 && (
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="ml-2 text-blue-400 hover:text-blue-500 text-xs font-semibold"
                    >
                      {isExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </p>
              </div>
            )}

            {/* Recommendations */}
            {trailer.recommendations?.length > 0 && (
              <div className="p-4 xl:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-gray-400 font-semibold text-sm uppercase tracking-wide">
                    You Might Also Like
                  </h3>
                  <span className="text-sm text-gray-500 bg-gray-800/50 px-2 py-1 rounded-full">
                    {trailer.recommendations.length}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {trailer.recommendations.slice(0, 20).map((rec) => (
                    <div
                      key={rec.id}
                      className="group relative cursor-pointer rounded-2xl overflow-hidden border border-gray-700/40 bg-gray-900/40 backdrop-blur-sm transition-all duration-500 hover:scale-105 hover:border-blue-500/40 hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)]"
                      onClick={() => onSelectTrailer(rec)}
                      title={rec.title}
                    >
                      <div className="aspect-[2/3] relative overflow-hidden cursor-pointer">
                        <Image
                          src={`https://image.tmdb.org/t/p/w300${rec.poster_path}`}
                          alt={rec.title}
                          width={300}
                          height={450}
                          className="object-cover w-full h-full transform transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-70 group-hover:opacity-80 transition-opacity duration-500" />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-blue-500/80 text-white text-[10px] font-semibold shadow-md">
                          {rec.vote_average?.toFixed(1) ?? "N/A"}
                        </span>
                      </div>
                      <div className="p-2 text-center">
                        <p className="text-white text-sm font-semibold line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors duration-300">
                          {rec.title}
                        </p>
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
