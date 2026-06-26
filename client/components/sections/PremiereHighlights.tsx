"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Star, Tv, Film } from "lucide-react";
import dynamic from "next/dynamic";
import type { All } from "@/types/all";
import Link from "next/link";

const TrailerModal = dynamic(() => import("./TrailerModal"), { ssr: false });

async function fetchPremiereTrailers(): Promise<All[]> {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  try {
    const res = await fetch(`${base}/all/trailers`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch trailers:", error);
    return [];
  }
}

async function fetchRecommendations(
  type: "movie" | "tv",
  id: number
): Promise<All[]> {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  try {
    const res = await fetch(`${base}/all/recommendations/${type}/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error(`Failed to fetch recommendations for ${type}/${id}:`, error);
    return [];
  }
}

interface PremiereHighlightsProps {
  data?: All[];
  title?: string;
  subtitle?: string;
  endpoint?: string;
}

export default function PremiereHighlights({
  data,
  title = "Fresh Off the Screen",
  subtitle = "Brand-new releases to set the mood.",
  endpoint,
}: PremiereHighlightsProps) {
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
  const mobileItems = uniqueTrailers;

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
          result = await fetchPremiereTrailers();
        }
        if (result.length === 0) {
          setError("No content available at the moment");
        } else {
          setTrailers(result);
        }
      } catch (err) {
        console.error("Error loading trailers:", err);
        setError("Failed to load content. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [data, endpoint]);

  const handleSelectTrailer = async (trailer: All) => {
    const type = trailer.type || "tv";
    const id = trailer.id;
    if (!id) return;
    try {
      let recs = recommendationsCache[id];
      if (!recs && type !== "person") {
        recs = await fetchRecommendations(type, id);
        setRecommendationsCache((prev) => ({ ...prev, [id]: recs }));
      }
      setSelectedTrailer({ ...trailer, recommendations: recs || [] });
    } catch {
      setSelectedTrailer({ ...trailer, recommendations: [] });
    }
  };

  const canScrollLeft = startIndex > 0;
  const canScrollRight = startIndex < uniqueTrailers.length - itemsPerView;

  const scrollLeft = () => setStartIndex((prev) => Math.max(0, prev - itemsPerView));
  const scrollRight = () =>
    setStartIndex((prev) =>
      Math.min(uniqueTrailers.length - itemsPerView, prev + itemsPerView)
    );

  const visibleItems = uniqueTrailers.slice(
    startIndex,
    startIndex + itemsPerView
  );

  if (loading) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
              {title}
            </h2>
            <p className="text-gray-400 text-base mt-2">
              Loading incredible content...
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

  if (trailers.length === 0) return null;

  return (
    <section
      id="premiere"
      className="relative mx-auto max-w-7xl scroll-mt-24 px-4 py-9 sm:px-6 sm:py-16 lg:px-8"
    >
      <div className="mb-4 flex items-end justify-between sm:mb-8">
        <div>
          <Link href="/fresh-off-the-screen" className="group">
            <h2
              className="bg-clip-text text-[1.35rem] font-bold leading-tight tracking-tight text-transparent transition-opacity hover:opacity-80 sm:text-2xl lg:text-3xl"
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
            <p className="mt-1.5 line-clamp-2 max-w-[34ch] text-[13px] leading-5 text-gray-400 sm:mt-2 sm:max-w-none sm:text-sm">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="relative group/carousel">
        {canScrollLeft && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 z-50 hidden h-12 w-12 -translate-x-6 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white opacity-0 shadow-xl backdrop-blur-md transition-all hover:bg-white/20 group-hover/carousel:opacity-100 lg:flex"
            aria-label="Previous"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 z-50 hidden h-12 w-12 translate-x-6 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-r from-[#e94f37] to-[#ff6b58] opacity-0 shadow-2xl ring-2 ring-white/10 backdrop-blur-sm transition-all hover:scale-110 group-hover/carousel:opacity-100 lg:flex"
            aria-label="Next"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        <div
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [overscroll-behavior-x:contain] [scrollbar-width:none] sm:-mx-6 sm:gap-4 sm:px-6 lg:hidden [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {mobileItems.map((item, index) => (
            <div
              key={item.id}
              className="group relative w-[74vw] max-w-[300px] flex-[0_0_auto] snap-start cursor-pointer sm:w-[46vw] sm:max-w-[360px]"
              onClick={() => handleSelectTrailer(item)}
            >
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-gray-900 shadow-2xl">
                <Image
                  src={
                    item.backdrop_path
                      ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
                      : "/placeholder-backdrop.svg"
                  }
                  alt={item.title}
                  fill
                  sizes="(max-width: 640px) 74vw, 46vw"
                  className="object-cover"
                  priority={index === 0}
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />

                <div className="absolute left-3 right-3 top-3 z-20 flex items-start justify-between gap-2">
                  <div
                    className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium shadow-lg backdrop-blur-md ${
                      item.type === "tv"
                        ? "border-blue-400/50 bg-blue-500/90 text-white"
                        : "border-purple-400/50 bg-purple-500/90 text-white"
                    }`}
                  >
                    {item.type === "tv" ? <Tv size={12} /> : <Film size={12} />}
                    {item.type === "tv" ? "Series" : "Movie"}
                  </div>

                  {item.vote_average && item.vote_average > 0 && (
                    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-md">
                      <Star size={12} fill="white" />
                      <span>{item.vote_average.toFixed(1) ?? "New"}</span>
                    </div>
                  )}
                </div>

                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-2xl backdrop-blur-sm sm:h-12 sm:w-12">
                    <Play size={16} className="ml-0.5 text-black sm:h-[18px] sm:w-[18px]" fill="black" />
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 z-10 p-3 sm:p-4">
                  <h3 className="mb-1.5 line-clamp-2 text-sm font-bold leading-tight text-white sm:text-base">
                    {item.title}
                  </h3>

                  <div className="flex min-w-0 items-center gap-2 text-xs text-gray-300">
                    {item.release_date && (
                      <span className="shrink-0 font-medium">
                        {new Date(item.release_date).getFullYear()}
                      </span>
                    )}
                    {item.genres && item.genres.length > 0 && (
                      <span className="truncate">{item.genres.slice(0, 2).join(", ")}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

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
          className="hidden touch-pan-y grid-cols-1 gap-4 lg:grid lg:grid-cols-3 lg:gap-6"
        >
          {" "}
          <AnimatePresence mode="popLayout">
            {visibleItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="relative group cursor-pointer"
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleSelectTrailer(item)}
              >
                <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-gray-900 shadow-2xl sm:rounded-2xl lg:aspect-[16/11]">
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
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    priority={index === 0}
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>

                  {/* Top Badges */}
                  <div className="absolute top-4 left-4 right-4 flex items-start justify-between z-20">
                    <div
                      className={`
                                             flex items-center gap-1 px-2 py-1 rounded-lg font-medium text-xs shadow-lg backdrop-blur-md border group-hover:opacity-0 transition-opacity duration-300
                                             ${item.type === "tv"
                          ? "bg-blue-500/90 text-white border-blue-400/50"
                          : "bg-purple-500/90 text-white border-purple-400/50"
                        }
                                           `}
                    >
                      {item.type === "tv" ? (
                        <Tv size={12} />
                      ) : (
                        <Film size={12} />
                      )}
                      {item.type === "tv" ? "Series" : "Movie"}
                    </div>

                    {item.vote_average && item.vote_average > 0 && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg font-medium text-xs text-white rounded-md bg-black/60 backdrop-blur-md border border-white/10">
                        <Star size={12} fill="white" />
                        <span>{item.vote_average.toFixed(1) ?? "New"}</span>
                      </div>
                    )}
                  </div>

                  {/* Play Button - Center */}
                  {item.trailer_key && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{
                        scale: hoveredId === item.id ? 1 : 0,
                        opacity: hoveredId === item.id ? 1 : 0,
                      }}
                      transition={{
                        duration: 0.2,
                        type: "spring",
                        stiffness: 200,
                      }}
                      className="absolute inset-0 flex items-center justify-center z-10"
                    >
                      <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-2xl backdrop-blur-sm">
                        <Play
                          size={24}
                          className="text-black ml-1"
                          fill="black"
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* Bottom Content */}
                  <div className="absolute bottom-0 left-0 right-0 z-10 p-4 sm:p-5">
                    <h3 className="mb-2 line-clamp-2 text-base font-bold text-white sm:text-xl">
                      {item.title}
                    </h3>

                    <div className="flex items-center gap-3 text-sm text-gray-300 mb-2">
                      {item.release_date && (
                        <span className="font-medium">
                          {new Date(item.release_date).getFullYear()}
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

                  {/* Hover Border */}
                  <motion.div
                    initial={false}
                    animate={{
                      opacity: hoveredId === item.id ? 1 : 0,
                    }}
                    className="absolute inset-0 rounded-2xl ring-2 ring-white/30 pointer-events-none"
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {selectedTrailer && (
        <TrailerModal
          trailer={selectedTrailer}
          onClose={() => setSelectedTrailer(null)}
          onSelectTrailer={handleSelectTrailer}
        />
      )}
    </section>
  );
}
