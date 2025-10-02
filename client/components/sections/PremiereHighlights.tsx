"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Star, Tv, Film } from "lucide-react";
import dynamic from "next/dynamic";
import type { All } from "@/types/all";

// Lazy load modal
const TrailerModal = dynamic(() => import("./TrailerModal"), { ssr: false });

// Fetch trailers
async function fetchPremiereTrailers(): Promise<All[]> {
  const base = process.env.NEST_API_URL || "http://localhost:4000";
  try {
    const res = await fetch(`${base}/all/trailers`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch trailers:", error);
    return [];
  }
}

// Fetch recommendations
async function fetchRecommendations(type: "movie" | "tv", id: number): Promise<All[]> {
  const base = process.env.NEST_API_URL || "http://localhost:4000";
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
  endpoint
}: PremiereHighlightsProps) {
  const [trailers, setTrailers] = useState<All[]>(data || []);
  const [selectedTrailer, setSelectedTrailer] = useState<All | null>(null);
  const [recommendationsCache, setRecommendationsCache] = useState<Record<number, All[]>>({});
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);

  // Carousel state
  const [startIndex, setStartIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(4);

  // Unique trailers
  const uniqueTrailers = Array.from(new Map(trailers.map(item => [item.id, item])).values());

  useEffect(() => {
    // Responsive layout
    const updateLayout = () => {
      const w = window.innerWidth;
      if (w < 640) setItemsPerView(1);
      else if (w < 768) setItemsPerView(2);
      else if (w < 1024) setItemsPerView(3);
      else setItemsPerView(4);
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
          const base = process.env.NEST_API_URL || "http://localhost:4000";
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
        setRecommendationsCache(prev => ({ ...prev, [id]: recs }));
      }
      setSelectedTrailer({ ...trailer, recommendations: recs || [] });
    } catch {
      setSelectedTrailer({ ...trailer, recommendations: [] });
    }
  };

  // Carousel navigation
  const canScrollLeft = startIndex > 0;
  const canScrollRight = startIndex < uniqueTrailers.length - itemsPerView;

  const scrollLeft = () => setStartIndex(prev => Math.max(0, prev - itemsPerView));
  const scrollRight = () =>
    setStartIndex(prev => Math.min(uniqueTrailers.length - itemsPerView, prev + itemsPerView));

  const visibleItems = uniqueTrailers.slice(startIndex, startIndex + itemsPerView);

  if (loading) {
    return (
      <section className="px-6 py-12 mx-auto relative">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{title}</h2>
        <p className="text-gray-400 text-sm mt-1">Loading...</p>
        <div className="flex gap-4 mt-6 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-80 h-52 bg-gray-800 animate-pulse rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="px-6 py-12 mx-auto relative">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{title}</h2>
        <div className="mt-6 p-8 bg-gray-800 rounded-lg text-center">
          <p className="text-gray-400 text-lg">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (trailers.length === 0) return null;

  return (
    <section className="px-6 py-12 max-w-7xl mx-auto relative mb-16">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{title}</h2>
        <div className="text-sm text-gray-500">{trailers.length} shows available</div>
      </div>
      <p className="text-gray-400 text-sm mt-1">{subtitle}</p>

      {/* Carousel */}
      <div className="relative mt-6 group/carousel">
        {canScrollLeft && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-50 w-12 h-12 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white rounded-full flex items-center justify-center hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 shadow-lg"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 translate-x-4 -translate-y-1/2 z-50 w-12 h-12 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white rounded-full flex items-center justify-center hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 shadow-lg"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {visibleItems.map((item) => (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.05 }}
              className="relative group flex-shrink-0 w-full h-54 cursor-pointer rounded-lg overflow-hidden bg-gray-800 shadow-lg"
              onClick={() => handleSelectTrailer(item)}
            >
              <Image
                src={
                  item.backdrop_path
                    ? `https://image.tmdb.org/t/p/w500${item.backdrop_path}`
                    : "/placeholder.jpg"
                }
                alt={item.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3">
                <h3 className="text-white font-semibold text-sm line-clamp-2">{item.title}</h3>
              </div>
              {item.trailer_key && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                    <Play size={32} className="text-white ml-1" fill="white" />
                  </div>
                </div>
              )}
              <div className="absolute bottom-3 right-3">
                <div
                  className={[
                    "flex items-center gap-1 px-2 py-0.5 rounded-lg font-medium text-xs shadow-lg backdrop-blur-md border",
                    item.type === "tv"
                      ? "bg-blue-500/90 text-white border-blue-400/50"
                      : "bg-purple-500/90 text-white border-purple-400/50",
                  ].join(" ")}
                >
                  {item.type === "tv" ? <Tv size={12} /> : <Film size={12} />}
                  {item.type === "tv" ? "Series" : "Movie"}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
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
