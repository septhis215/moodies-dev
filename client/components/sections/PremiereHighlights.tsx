"use client";

import { LoadingRegion, RailSkeleton } from "@/components/loading/PageSkeleton";
import React, { useEffect, useState } from "react";
import { tmdbImage } from "@/lib/tmdb";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Star, Tv, Film } from "lucide-react";
import { CarouselNavButton } from "@/components/ui/CarouselNavButton";
import dynamic from "next/dynamic";
import type { All } from "@/types/all";
import Link from "next/link";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const TrailerModal = dynamic(() => import("./TrailerModal"), { ssr: false });

async function fetchPremiereTrailers(): Promise<All[]> {
  const base =
    process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
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
  id: number,
): Promise<All[]> {
  const base =
    process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
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
  const isSm = useMediaQuery("(min-width: 640px)");
  const isLg = useMediaQuery("(min-width: 1024px)");
  const itemsPerView = isLg ? 3 : isSm ? 2 : 1;

  const uniqueTrailers = Array.from(
    new Map(trailers.map((item) => [item.id, item])).values(),
  );
  const mobileItems = uniqueTrailers;

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
          const base =
            process.env.NEXT_PUBLIC_API_URL ||
            "https://dev.api.moodies.tech/api";
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

  const scrollLeft = () =>
    setStartIndex((prev) => Math.max(0, prev - itemsPerView));
  const scrollRight = () =>
    setStartIndex((prev) =>
      Math.min(
        Math.max(0, uniqueTrailers.length - itemsPerView),
        prev + itemsPerView,
      ),
    );

  const visibleItems = uniqueTrailers.slice(
    startIndex,
    startIndex + itemsPerView,
  );

  if (loading) {
    return <section className="ui-shell border-b border-[var(--surface-border)] py-8 sm:py-10" aria-label={title}>
      <LoadingRegion label={`Loading ${title}`}><RailSkeleton landscape /></LoadingRegion>
    </section>;
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
      className="ui-shell scroll-mt-24 border-b border-[var(--surface-border)] py-8 sm:py-10"
    >
      <div className="mb-4 flex items-end justify-between gap-4 sm:mb-8">
        <div className="min-w-0">
          <Link href="/fresh-off-the-screen" className="group">
            <h2 className="text-3xl font-bold leading-none text-[var(--ink)] transition-colors group-hover:text-[var(--brand-coral-strong)] sm:text-4xl">
              {title}
            </h2>
          </Link>

          {subtitle && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="relative group/carousel">
        <div role="group" aria-label={`${title} navigation`}>
          <CarouselNavButton
            direction="previous"
            onClick={scrollLeft}
            disabled={!canScrollLeft}
            aria-label={`Previous ${title}`}
            className="absolute -left-5 top-1/2 z-30 -translate-y-1/2 opacity-0 group-hover/carousel:opacity-100 group-focus-within/carousel:opacity-100 xl:-left-6"
          />

          <CarouselNavButton
            direction="next"
            onClick={scrollRight}
            disabled={!canScrollRight}
            aria-label={`Next ${title}`}
            className="absolute -right-5 top-1/2 z-30 -translate-y-1/2 opacity-0 group-hover/carousel:opacity-100 group-focus-within/carousel:opacity-100 xl:-right-6"
          />
        </div>
        <div
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [overscroll-behavior-x:contain] [scrollbar-width:none] sm:gap-4 lg:hidden [&::-webkit-scrollbar]:hidden"
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
                      ? tmdbImage(item.backdrop_path, "original")
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
                  <div className="flex items-center gap-1 rounded-sm border border-white/20 bg-black/75 px-2 py-1 text-xs font-medium text-white">
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
                    <Play
                      size={16}
                      className="ml-0.5 text-black sm:h-[18px] sm:w-[18px]"
                      fill="black"
                    />
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
                      <span className="truncate">
                        {item.genres.slice(0, 2).join(", ")}
                      </span>
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
                        ? tmdbImage(item.backdrop_path, "original")
                        : "/placeholder-backdrop.svg"
                    }
                    alt={item.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover"
                    priority={index === 0}
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>

                  {/* Top Badges */}
                  <div className="absolute top-4 left-4 right-4 flex items-start justify-between z-20">
                    <div className="flex items-center gap-1 rounded-sm border border-white/20 bg-black/75 px-2 py-1 text-xs font-medium text-white transition-opacity duration-150 group-hover:opacity-0">
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
