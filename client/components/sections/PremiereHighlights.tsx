"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Star, Tv, Film } from "lucide-react";
import dynamic from "next/dynamic";
import type { All } from "@/types/all";

// Lazy load modal (SSR disabled)
const TrailerModal = dynamic(() => import("./TrailerModal"), { ssr: false });

// Default fetch function for backwards compatibility
async function fetchTrailer(): Promise<All[]> {
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
  endpoint?: string; // Custom endpoint for fetching
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
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If data is passed as props, use it directly
    if (data) {
      setTrailers(data);
      setLoading(false);
      return;
    }

    // Otherwise fetch data
    const loadTrailers = async () => {
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
          result = await fetchTrailer();
        }

        if (result.length === 0) {
          setError("No content available at the moment");
        } else {
          setTrailers(result);
        }
      } catch (err) {
        setError("Failed to load content. Please try again later.");
        console.error("Error loading trailers:", err);
      } finally {
        setLoading(false);
      }
    };

    loadTrailers();
  }, [data, endpoint]);

  const scroll = (direction: "left" | "right") => {
    if (!carouselRef.current) return;
    const { scrollLeft, clientWidth } = carouselRef.current;
    const scrollAmount = direction === "left" ? -clientWidth * 0.8 : clientWidth * 0.8;
    carouselRef.current.scrollTo({
      left: scrollLeft + scrollAmount,
      behavior: "smooth"
    });
  };

  const handleSelectTrailer = async (trailer: All) => {
    const type = trailer.type || "tv";
    const id = trailer.id;

    if (!id) {
      console.warn("No ID found for trailer:", trailer.title);
      return;
    }

    try {
      let recs = recommendationsCache[id];

      if (!recs && type !== "person") {
        // Show loading state
        setSelectedTrailer({ ...trailer, recommendations: [] });

        // Fetch recommendations
        recs = await fetchRecommendations(type, id);

        // Update cache
        setRecommendationsCache(prev => ({ ...prev, [id]: recs }));
      }

      setSelectedTrailer({ ...trailer, recommendations: recs });
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      // Still show modal even if recommendations fail
      setSelectedTrailer({ ...trailer, recommendations: [] });
    }
  };

  const formatRating = (rating: number) => {
    return rating ? rating.toFixed(1) : "N/A";
  };

  const formatCountryFlags = (countries: string[]) => {
    const flagMap: Record<string, string> = {
      'KR': '🇰🇷',
      'US': '🇺🇸',
      'GB': '🇬🇧',
      'JP': '🇯🇵',
      'CN': '🇨🇳',
      'FR': '🇫🇷',
      'DE': '🇩🇪',
      'IT': '🇮🇹',
      'ES': '🇪🇸'
    };

    return countries.slice(0, 2).map(country => flagMap[country] || country).join(' ');
  };

  if (loading) {
    return (
      <section className="px-6 py-12 mx-auto relative">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{title}</h2>
        <p className="text-gray-400 text-sm mt-1">Loading...</p>

        <div className="flex gap-4 mt-6 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-80 h-52 bg-gray-800 animate-pulse rounded-lg" />
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
    <section className="px-6 py-12 max-w-7xl mx-auto relative">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{title}</h2>
        <div className="text-sm text-gray-500">
          {trailers.length} shows available
        </div>
      </div>
      <p className="text-gray-400 text-sm mt-1">{subtitle}</p>

      {/* Carousel */}
      <div className="relative mt-6">
        {/* Navigation Buttons */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/70 text-white hover:bg-black/90 transition-all duration-200 shadow-lg"
          aria-label="Scroll left"
        >
          <ChevronLeft size={24} />
        </button>

        <div
          ref={carouselRef}
          className="flex gap-4 overflow-x-auto scroll-smooth scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {trailers.map((item) => (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="relative flex-shrink-0 w-80 h-52 cursor-pointer rounded-lg overflow-hidden shadow-lg group"
              onClick={() => handleSelectTrailer(item)}
            >
              {/* Background Image */}
              <Image
                src={
                  item.backdrop_path
                    ? `https://image.tmdb.org/t/p/w500${item.backdrop_path}`
                    : "/placeholder.jpg"
                }
                alt={item.title}
                width={500}
                height={280}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                priority={trailers.indexOf(item) < 3}
              />

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

              {/* Play Button Overlay */}
              {item.trailer_key && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                    <Play size={32} className="text-white ml-1" fill="white" />
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-white font-semibold text-lg line-clamp-2 flex-1 pr-2">
                    {item.title}
                  </h3>
                  {item.vote_average && item.vote_average > 0 && (
                    <div className="flex items-center gap-1 bg-black/50 rounded px-2 py-1">
                      <Star size={14} className="text-yellow-400" fill="currentColor" />
                      <span className="text-white text-sm font-medium">
                        {formatRating(item.vote_average)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-3 text-xs text-gray-300">
                  {item.origin_country && item.origin_country.length > 0 && (
                    <span>{formatCountryFlags(item.origin_country)}</span>
                  )}
                  {item.type === "tv" && item.number_of_seasons && (
                    <span>{item.number_of_seasons} Season{item.number_of_seasons > 1 ? 's' : ''}</span>
                  )}
                  {item.genres && item.genres.length > 0 && (
                    <span className="truncate">{item.genres.slice(0, 2).join(', ')}</span>
                  )}

                </div>

                <div className="absolute bottom-3 right-3 z-20 opacity-100 group-hover:opacity-0 transition-opacity duration-300">
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

                {/* No Trailer Warning */}
                {!item.trailer_key && (
                  <div className="mt-1 text-xs text-amber-400">
                    Preview not available
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/70 text-white hover:bg-black/90 transition-all duration-200 shadow-lg"
          aria-label="Scroll right"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Lazy modal */}
      {selectedTrailer && (
        <TrailerModal
          trailer={selectedTrailer}
          onClose={() => setSelectedTrailer(null)}
          onSelectTrailer={handleSelectTrailer}
        />
      )}

      {/* Custom scrollbar styles */}
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}