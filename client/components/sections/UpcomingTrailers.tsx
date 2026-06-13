"use client";

import React, { useEffect, useState } from "react";
import type { All } from "@/types/all";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Film,
  Tv,
  Clock,
  Play,
  Star,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";

const TrailerModal = dynamic(() => import("./TrailerModal"), { ssr: false });

async function fetchUpcomingTrailers(): Promise<All[]> {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  try {
    const res = await fetch(`${base}/all/upcoming-trailers`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch upcoming trailers:", err);
    return [];
  }
}

async function fetchRecommendations(
  type: "movie" | "tv",
  id: number
): Promise<All[]> {
  if (!type || !id) return [];
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  try {
    const res = await fetch(`${base}/all/${type}/${id}/recommendations`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Failed to fetch recommendations for ${type}/${id}:`, err);
    return [];
  }
}

interface UpcomingTrailersProps {
  data?: All[];
  title?: string;
  subtitle?: string;
  endpoint?: string;
}

export const UpcomingTrailers: React.FC<UpcomingTrailersProps> = ({
  data,
  title = "Coming Soon",
  subtitle = "Get a sneak peek at what's dropping next",
  endpoint,
}) => {
  const [trailers, setTrailers] = useState<All[]>(data || []);
  const [selectedTrailer, setSelectedTrailer] = useState<All | null>(null);
  const [recommendationsCache, setRecommendationsCache] = useState<
    Record<number, All[]>
  >({});
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const [startIndex, setStartIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(3);

  const uniqueTrailers = Array.from(
    new Map(trailers.map((item) => [item.id, item])).values()
  );

  useEffect(() => {
    const updateLayout = () => {
      const w = window.innerWidth;
      if (w < 640) setItemsPerView(1);
      else if (w < 1024) setItemsPerView(2);
      else setItemsPerView(3);
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    if (data) {
      setTrailers(data);
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        let result: All[];
        if (endpoint) {
          const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
          const res = await fetch(`${base}${endpoint}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          result = await res.json();
        } else {
          result = await fetchUpcomingTrailers();
        }

        if (result.length === 0) {
          setError("No trailers available right now.");
        } else {
          setTrailers(result);
        }
      } catch (err) {
        console.error("Error loading upcoming trailers:", err);
        setError("Failed to load trailers. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [data, endpoint]);

  useEffect(() => {
    setStartIndex((prev) => {
      const maxStart = Math.max(0, uniqueTrailers.length - itemsPerView);
      return Math.min(prev, maxStart);
    });
  }, [uniqueTrailers.length, itemsPerView]);

  const handleSelectTrailer = async (trailer: All) => {
    const type = (trailer.type as "movie" | "tv") || "movie";
    const id = trailer.id;
    if (!id) return;

    try {
      let recs = recommendationsCache[id];
      if (!recs) {
        recs = await fetchRecommendations(type, id);
        setRecommendationsCache((prev) => ({ ...prev, [id]: recs }));
      }
      setSelectedTrailer({ ...trailer, recommendations: recs || [] });
    } catch {
      setSelectedTrailer({ ...trailer, recommendations: [] });
    }
  };

  const canScrollLeft = startIndex > 0;
  const canScrollRight =
    startIndex < Math.max(0, uniqueTrailers.length - itemsPerView);

  const scrollLeft = () => {
    setStartIndex((prev) => Math.max(0, prev - itemsPerView));
  };

  const scrollRight = () => {
    setStartIndex((prev) =>
      Math.min(Math.max(0, uniqueTrailers.length - itemsPerView), prev + itemsPerView)
    );
  };

  const visibleItems = uniqueTrailers.slice(
    startIndex,
    startIndex + itemsPerView
  );

  function getDaysUntilRelease(releaseDate: string) {
    const days = Math.ceil(
      (new Date(releaseDate).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24)
    );

    if (days < 0) return "Now Showing";
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days <= 7) return `${days} Days`;
    if (days <= 30) return `In ${days} Days`;

    return new Date(releaseDate).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }
  if (loading) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
              {title}
            </h2>
            <p className="text-gray-400 text-base mt-2">
              Loading upcoming content...
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="aspect-[16/9] bg-gray-800 animate-pulse rounded-2xl"
            />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-8">
          {title}
        </h2>
        <div className="p-12 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl text-center border border-gray-700">
          <p className="text-gray-400 text-lg mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-semibold"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (uniqueTrailers.length === 0) return null;

  return (
    <section
      id="upcoming"
      className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative"
    >
      <div className="flex items-end justify-between mb-8">
        <div>
          <Link href="/coming-soon" className="group">
            <h2
              className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-transparent bg-clip-text"
              style={{
                backgroundImage: "linear-gradient(to right, #e94f37, #ff6b58)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {title}
            </h2>
          </Link>

          {subtitle && (
            <p className="text-gray-400 text-xs sm:text-sm mt-2">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="relative group/carousel">
        {canScrollLeft && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-50 w-12 h-12 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 shadow-2xl ring-2 ring-white/10"
            aria-label="Previous"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute  right-0 top-1/2 translate-x-6 -translate-y-1/2 z-50 w-12 h-12 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 shadow-2xl ring-2 ring-white/10"
            aria-label="Next"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(e, info) => {
            const swipe = info.offset.x;
            if (Math.abs(swipe) > 80) {
              if (swipe > 0 && canScrollLeft) scrollLeft();
              else if (swipe < 0 && canScrollRight) scrollRight();
            }
          }}
          className="flex gap-5 overflow-hidden"
        >
          <AnimatePresence mode="popLayout">
            {visibleItems.map(
              (item, index) =>
                item.trailer_key && (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3, delay: index * 0.08 }}
                    className="relative group cursor-pointer flex-shrink-0 w-full sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]"
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => handleSelectTrailer(item)}
                  >
                    <div className="relative aspect-[16/11] rounded-3xl overflow-hidden bg-gray-900 shadow-2xl border border-white/10 group">

                      {/* Image */}
                      <Image
                        src={
                          item.backdrop_path
                            ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
                            : "/placeholder-backdrop.svg"
                        }
                        alt={item.title}
                        fill
                        sizes="(max-width: 1024px) 100vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        priority={index === 0}
                      />

                      {/* Cinematic overlay */}
                      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.95),rgba(0,0,0,0.55),rgba(0,0,0,0.1))]" />

                      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">

                        {/* LEFT: Countdown (old style restored) */}
                        {item.release_date && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-medium">
                            <Clock size={12} />
                            <span>{getDaysUntilRelease(item.release_date)}</span>
                          </div>
                        )}

                        {/* RIGHT: Type Badge */}
                        <div
                          className={`
      flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium shadow-lg
      ${item.type === "tv"
                              ? "bg-blue-500/90 text-white border border-blue-300/40"
                              : "bg-purple-500/90 text-white border border-purple-300/40"}
    `}
                        >
                          {item.type === "tv" ? <Tv size={12} /> : <Film size={12} />}
                          {item.type === "tv" ? "Series" : "Movie"}
                        </div>

                      </div>
                      <motion.div
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{
                          scale: hoveredId === item.id ? 1 : 0.6,
                          opacity: hoveredId === item.id ? 1 : 0,
                        }}
                        transition={{ duration: 0.25 }}
                        className="absolute inset-0 flex items-center justify-center z-10"
                      >
                        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-2xl">
                          <Play size={24} className="text-black ml-1" fill="black" />
                        </div>
                      </motion.div>

                      <div className="absolute bottom-0 left-0 right-0 p-5 z-10">

                        <h3 className="text-white font-black text-lg sm:text-xl mb-2 line-clamp-2">
                          {item.title}
                        </h3>

                        <div className="flex items-center gap-3 text-sm text-gray-300">
                          {item.release_date && (
                            <span className="font-medium">
                              {new Date(item.release_date).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          )}
                          {item.genres && item.genres.length > 0 && (
                            <>
                              <span className="text-gray-500">•</span>
                              <span>{item.genres.slice(0, 2).join(", ")}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <motion.div
                        initial={false}
                        animate={{ opacity: hoveredId === item.id ? 1 : 0 }}
                        className="absolute inset-0 rounded-3xl ring-2 ring-[#ff6b58]/60 pointer-events-none"
                      />
                    </div>
                  </motion.div>
                )
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Modal */}
      {selectedTrailer && (
        <TrailerModal
          trailer={selectedTrailer}
          onClose={() => setSelectedTrailer(null)}
          onSelectTrailer={handleSelectTrailer}
        />
      )}
    </section>
  );
};
