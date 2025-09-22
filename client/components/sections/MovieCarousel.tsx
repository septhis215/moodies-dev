"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TooltipArrow } from "@radix-ui/react-tooltip";

type MovieLike = {
  id: string | number;
  title: string;
  poster?: string | null;
  poster_path?: string | null;
  vote_average?: number;
  release_date?: string;
  year?: number;
  genres?: string[];
  vote_count?: number;
  popularity?: number;
  origin_country?: string[];
  recommendations?: MovieLike[];
  type?: "movies" | "tv" | string;
};

interface MovieCarouselProps<T extends MovieLike> {
  title: string;
  subtitle?: string;
  items: T[];
  getPoster?: (item: T) => string;
}

export default function MovieCarousel<T extends MovieLike>({
  title,
  subtitle,
  items,
  getPoster,
}: MovieCarouselProps<T>) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  function posterGetter(item: MovieLike): string {
    return item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : item.poster ?? "/placeholder.jpg";
  }

  useEffect(() => {
    const updateSizes = () => {
      if (containerRef.current) {
        const firstCard =
          containerRef.current.querySelector<HTMLDivElement>(".movie-card");
        if (firstCard) setCardWidth(firstCard.offsetWidth + 16);
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateSizes();
    window.addEventListener("resize", updateSizes);
    return () => window.removeEventListener("resize", updateSizes);
  }, [items]);

  const cardsPerView = cardWidth ? Math.floor(containerWidth / cardWidth) : 1;
  const maxIndex = cardWidth ? Math.max(0, items.length - cardsPerView) : 0;

  const handlePrev = () =>
    setCurrentIndex((prev) =>
      prev === 0 ? maxIndex : Math.max(0, prev - cardsPerView)
    );
  const handleNext = () =>
    setCurrentIndex((prev) =>
      prev >= maxIndex ? 0 : Math.min(maxIndex, prev + cardsPerView)
    );

  const handleQuickInfo = (e: React.MouseEvent, movieId: string | number) => {
    e.preventDefault();
    e.stopPropagation();
    // Open modal or quick preview
    console.log("Open quick info modal for", movieId);
  };

  const handleRecommendationClick = (e: React.MouseEvent, recHref: string) => {
    e.stopPropagation();
    // Let the Link handle navigation naturally
    console.log("Open recommendation href:", recHref);
  };

  return (
    <section className="relative w-full px-6 py-12 mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {title}
          </h2>
          {subtitle && <p className="text-gray-400 text-sm mt-1">{subtitle}</p>}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrev}
            className="px-3 py-1 rounded-full bg-gray-800 text-white"
            aria-label="Previous"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={handleNext}
            className="px-3 py-1 rounded-full bg-gray-800 text-white"
            aria-label="Next"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      <div className="overflow-hidden relative" ref={containerRef}>
        <motion.div
          className="flex gap-1"
          animate={{ x: -currentIndex * cardWidth }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {items?.length ? (
            items.map((m) => {
              const type = m.type === "tv" ? "tv" : "movies";
              const href = `/${type}/${m.id}`;

              return (
                <motion.div
                  key={m.id}
                  whileHover={{ scale: 1.05 }}
                  className="movie-card relative w-40 sm:w-52 lg:w-60 flex-shrink-0 rounded-xl overflow-hidden group"
                >
                  <Link
                    href={href}
                    onClick={() => {
                      console.log("Link clicked, href:", href);
                    }}
                  >
                    <div className="relative group w-[200px] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all cursor-pointer">
                      <Image
                        src={posterGetter(m)}
                        alt={m.title}
                        width={200}
                        height={300}
                        className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                      />

                      {/* Rating Badge (non-navigating control) */}
                      <div
                        className={`absolute top-2 right-2 z-20 text-xs px-2 py-1 rounded-lg font-bold shadow
                          ${
                            m.vote_average && m.vote_average >= 7
                              ? "bg-green-500 text-white"
                              : m.vote_average && m.vote_average >= 5
                              ? "bg-yellow-400 text-black"
                              : "bg-red-500 text-white"
                          }`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        {m.vote_average?.toFixed(1)}
                      </div>

                      {/* Title bar */}
                      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-black/40 p-2 flex items-center justify-between transition-opacity duration-300 group-hover:opacity-0 group-hover:invisible">
                        <h3 className="text-white text-sm font-semibold truncate">
                          {m.title}
                        </h3>
                        <button
                          className="text-white/80 hover:text-white transition"
                          aria-label="More Info"
                          onClick={(e) => handleQuickInfo(e, m.id)}
                        >
                          <Info size={16} />
                        </button>
                      </div>

                      {/* Hover overlay content */}
                      <div className="absolute inset-x-0 bottom-0 z-10 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out bg-black/80 text-white p-3 text-xs space-y-2 pointer-events-auto">
                        <h3 className="text-base font-bold">{m.title}</h3>
                        <p className="text-xs text-gray-300">
                          {m.year ?? m.release_date}{" "}
                          {m.origin_country?.length
                            ? `• ${m.origin_country.join(", ")}`
                            : ""}
                        </p>
                        {m.genres?.length ? (
                          <p className="text-gray-300 text-xs">
                            {m.genres.join(", ")}
                          </p>
                        ) : (
                          <p className="text-gray-500 italic text-xs">
                            No genres
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {m.vote_count
                            ? `${m.vote_count.toLocaleString()} ratings`
                            : ""}
                          {m.popularity
                            ? ` • Popularity: ${Math.round(m.popularity)}`
                            : ""}
                        </p>

                        {m.recommendations?.length ? (
                          <div className="mt-3 mb-3">
                            <p className="text-xs text-gray-400 mb-1">
                              You might also like
                            </p>
                            <div className="flex gap-2 overflow-hidden">
                              {m.recommendations.slice(0, 3).map((rec) => {
                                const recType =
                                  rec.type === "tv" ? "tv" : "movies";
                                const recHref = `/${recType}/${rec.id}`;
                                return (
                                  <TooltipProvider key={rec.id}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="relative">
                                          <Link
                                            href={recHref}
                                            onClick={(e) =>
                                              handleRecommendationClick(
                                                e,
                                                recHref
                                              )
                                            }
                                          >
                                            <Image
                                              src={posterGetter(rec)}
                                              alt={rec.title}
                                              width={52}
                                              height={77}
                                              className="rounded-md object-cover hover:scale-105 transition cursor-pointer"
                                            />
                                          </Link>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="bottom"
                                        sideOffset={6}
                                        className="rounded-lg bg-white/30 backdrop-blur-md px-3 py-2 shadow-lg border border-white/20"
                                      >
                                        <TooltipArrow className="fill-white/30 stroke-white/20" />
                                        <div className="text-sm font-medium text-white drop-shadow max-w-[220px] truncate">
                                          {rec.title}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })
          ) : (
            <p className="text-gray-500">No movies available.</p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
