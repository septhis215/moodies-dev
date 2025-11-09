// src/components/Hero/HeroCarousel.tsx
"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import type { All } from "@/types/all";
import { tmdbImage } from "@/lib/tmdb";
import useCarousel from "@/hooks/useCarousel";
import HeroThumbnail from "./heroThumbnail";
import {
  IconClock,
  IconInfoCircle,
  IconPlus,
  IconTags,
} from "@tabler/icons-react";
import "./hero.css";
import { Film, Tv } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = { all: All[]; cycleMs?: number };

function getThumbnailWindow<T>(items: T[], index: number, windowSize = 5): T[] {
  const half = Math.floor(windowSize / 2);
  const start = Math.max(0, Math.min(index - half, items.length - windowSize));
  return items.slice(start, start + windowSize);
}

export default function HeroCarousel({ all = [], cycleMs = 7000 }: Props) {
  const { index, setIndex, pause, resume } = useCarousel({
    length: all.length,
    intervalMs: cycleMs,
  });

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

  // preload current + next (use browser Image object; not next/image)
  useEffect(() => {
    if (!all || all.length === 0) return;
    const indices = [index, (index + 1) % all.length];
    indices.forEach((i) => {
      const m = all[i];
      if (!m) return;
      const b =
        tmdbImage(m.backdrop_path, "w1280") ||
        tmdbImage(m.poster_path, "w1280");
      const p = tmdbImage(m.poster_path, "w342");
      if (b) {
        const img = new window.Image();
        img.src = b;
      }
      if (p) {
        const img = new window.Image();
        img.src = p;
      }
    });
  }, [index, all]);

  if (!all || all.length === 0) {
    return (
      <section className="h-[60vh] flex items-center justify-center bg-gray-900 text-white">
        No featured all
      </section>
    );
  }
 
  // Get dynamic thumbnail window size based on screen size
  const getThumbnailWindowSize = () => {
    if (typeof window !== "undefined") {
      if (window.innerWidth <= 640) return 3; // mobile: 3 thumbnails
      if (window.innerWidth <= 1024) return 4; // tablet: 4 thumbnails
      return 5; // desktop: 5 thumbnails
    }
    return 5;
  };

  const thumbnailWindow = getThumbnailWindow(
    all,
    index,
    getThumbnailWindowSize()
  );

  const goToList = () => {
    router.push("/watchlist");
  };

  return (
    <section
      className="relative w-full overflow-hidden 
        h-[70vh] sm:h-[80vh] lg:h-screen
        min-h-[500px] max-h-[1200px]"
      onMouseEnter={pause}
      onMouseLeave={resume}
      aria-roledescription="carousel"
    >
      {/* Stacked background images */}
      <div className="absolute center inset-0">
        {all.map((m, i) => {
          const active = i === index;
          // Responsive image sizing
          const getImageSize = () => {
            if (typeof window !== "undefined") {
              if (window.innerWidth < 640) return "w780"; // mobile
              if (window.innerWidth < 1024) return "w1280";
              return active ? "original" : "w780"; // desktop
            }
            return "original";
          };

          const src =
            tmdbImage(m.backdrop_path || m.poster_path, getImageSize()) ??
            "/images/placeholder-backdrop.jpg";

          return (
            <div
              key={m.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${active ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              aria-hidden={!active}
            >
              <Image
                src={src}
                alt=""
                fill
                priority
                aria-hidden
                className="w-full h-full object-cover object-center"
                style={{
                  filter: "brightness(1.2) contrast(1.15) saturate(1.15)",
                  objectPosition: "center 50%",
                }}
              />

              {/* Softer edge shading for text readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-black/50" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />

              {/* Center spotlight effect */}
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.08)_35%,transparent_80%)] mix-blend-lighten" />
            </div>

          );
        })}

        {/* Responsive gradient overlays */}
        {/* Mobile gradient - stronger bottom fade for readability */}
        <div
          className="absolute inset-0 pointer-events-none sm:hidden"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.2) 100%)",
          }}
        />

        {/* Tablet/Desktop gradient */}
        <div
          className="absolute inset-0 pointer-events-none hidden sm:block"
          style={{
            background:
              "radial-gradient(ellipse at bottom left, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.1) 100%)",
          }}
        />
      </div>

      {/* Content Container */}
      <div className="absolute inset-0 z-20 flex flex-col max-w-7xl mx-auto">
        {/* Main Content Area */}
        <div className="flex-1 flex items-end">
          <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 pb-4 sm:pb-6 lg:pb-8">
            {/* Mobile/Tablet Layout - Stack content vertically */}
            <div className="lg:hidden">
              {/* Content */}
              <div className="text-white mb-6">
                {/* Title */}
                <h1
                  className="font-bold leading-tight drop-shadow-2xl  line-clamp-2
                  text-2xl sm:text-3xl md:text-4xl
                  tracking-tight mb-3"
                >
                  {all[index].title}
                </h1>

                {/* Pills */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {/* Genres - show fewer on mobile */}
                  {all[index]?.genres?.slice(0, 2).map((genre) => (
                    <span
                      key={genre}
                      className="flex items-center gap-1 text-white font-medium 
                        px-2 py-1 rounded-full bg-[#e94f37]/90 shadow-sm 
                        text-xs sm:text-sm"
                    >
                      <IconTags size={12} />
                      {genre}
                    </span>
                  ))}

                  {/* Release Date */}
                  {all[index].release_date && (
                    <div
                      className="flex items-center gap-1 text-gray-200 font-medium 
                      px-2 py-1 rounded-full bg-gray-800/60 shadow-sm 
                      text-xs sm:text-sm"
                    >
                      <IconClock size={12} />
                      <span>
                        {new Date(all[index].release_date).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </span>
                    </div>
                  )}
                  <div
                    className={[
                      "flex items-center gap-1 px-2 py-1 rounded-full font-medium text-xs shadow-sm backdrop-blur-md border",
                      all[index].type === "tv"
                        ? "bg-blue-500/90 text-white border-blue-400/50"
                        : "bg-purple-500/90 text-white border-purple-400/50",
                    ].join(" ")}
                  >
                    {all[index].type === "tv" ? (
                      <Tv size={12} />
                    ) : (
                      <Film size={12} />
                    )}
                    {all[index].type === "tv" ? "Series" : "Movie"}
                  </div>
                </div>

                {/* Overview - shorter on mobile */}
                <p
                  className="text-sm sm:text-base text-gray-200/90 drop-shadow-lg 
                  line-clamp-2 sm:line-clamp-2 mb-4"
                >
                  {all[index].overview.slice(0, 120) +
                    (all[index].overview.length > 120 ? "..." : "")}
                </p>

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <button
                    className="px-6 py-3 text-sm font-semibold
                    bg-gradient-to-r from-[#e94f37] to-pink-600 text-white 
                    rounded-lg shadow-lg shadow-red-900/40
                    hover:from-red-700 hover:to-pink-700 transition-all duration-200
                    flex items-center justify-center gap-2 cursor-pointer"
                    onClick={() => handleClick(all[index])}
                  >
                    <IconInfoCircle className="w-5 h-5" /> More Info
                  </button>

                  <button
                    className="px-6 py-3 text-sm font-medium
                    bg-white/10 border border-white/20 text-white 
                    rounded-lg backdrop-blur-md hover:bg-white/20 
                    transition-all duration-200
                    flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <IconPlus className="w-5 h-5" />
                    My List
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop Layout - Side by side */}
            <div className="hidden lg:flex justify-between items-end gap-8 xl:gap-12">
              {/* Left: Content */}
              <div className="flex-1 text-white max-w-2xl xl:max-w-3xl">
                {/* Title */}
                <h1
                  className="font-bold leading-tight drop-shadow-2xl 
                  text-3xl xl:text-4xl 2xl:text-5xl  line-clamp-3
                  tracking-tight mb-4"
                >
                  {all[index].title}
                </h1>

                {/* Pills */}
                <div className="flex gap-3 mb-5">
                  {all[index]?.genres?.slice(0, 3).map((genre) => (
                    <span
                      key={genre}
                      className="flex-shrink-0 flex items-center gap-1 text-white font-medium 
                 px-2 py-1 rounded-full bg-[#e94f37]/90 shadow-sm text-sm"
                    >
                      <IconTags size={14} />
                      {genre}
                    </span>
                  ))}

                  {all[index].release_date && (
                    <span
                      className="flex-shrink-0 flex items-center gap-1 text-gray-200 font-medium 
                 px-1.5 py-1 rounded-full bg-gray-800/60 shadow-sm text-sm"
                    >
                      <IconClock size={14} />
                      {new Date(all[index].release_date).toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </span>
                  )}
                  <div
                    className={[
                      "flex items-center gap-1 px-2 py-1 rounded-full font-medium text-xs shadow-sm backdrop-blur-md border",
                      all[index].type === "tv"
                        ? "bg-blue-500/90 text-white border-blue-400/50"
                        : "bg-purple-500/90 text-white border-purple-400/50",
                    ].join(" ")}
                  >
                    {all[index].type === "tv" ? (
                      <Tv size={12} />
                    ) : (
                      <Film size={12} />
                    )}
                    {all[index].type === "tv" ? "Series" : "Movie"}
                  </div>
                </div>

                {/* Overview */}
                <p
                  className="text-base xl:text-lg text-gray-200/90 drop-shadow-lg 
                  max-w-2xl line-clamp-2 mb-6"
                >
                  {all[index].overview.slice(0, 180) +
                    (all[index].overview.length > 180 ? "..." : "")}
                </p>

                {/* Buttons */}
                <div className="flex flex-wrap gap-4">
                  <button
                    className="px-6 xl:px-8 py-3 xl:py-4 
                    text-base xl:text-lg font-semibold
                    bg-gradient-to-r from-[#e94f37] to-pink-600 text-white 
                    rounded-lg shadow-lg shadow-red-900/40
                    hover:from-red-700 hover:to-pink-700 transition-all duration-200
                    flex items-center gap-2 cursor-pointer"
                    onClick={() => handleClick(all[index])}
                  >
                    <IconInfoCircle className="w-5 h-5 xl:w-6 xl:h-6" /> More
                    Info
                  </button>

                  <button
                  onClick={goToList}
                    className="px-6 xl:px-8 py-3 xl:py-4
                    text-base xl:text-lg font-medium
                    bg-white/10 border border-white/20 text-white 
                    rounded-lg backdrop-blur-md hover:bg-white/20 
                    transition-all duration-200
                    flex items-center gap-2 cursor-pointer"
                    
                  >
                    <IconPlus className="w-5 h-5 xl:w-6 xl:h-6" />
                    My List
                  </button>
                </div>
              </div>

              {/* Right: Thumbnails */}
              <div className="flex-shrink-0">
                <div className="flex gap-3 xl:gap-4">
                  {thumbnailWindow.map((m) => {
                    const i = all.findIndex((g) => g.id === m.id);
                    return (
                      <HeroThumbnail
                        key={m.id}
                        all={m}
                        active={i === index}
                        onClick={() => setIndex(i)}
                        width={110} // Standard desktop size
                        height={160}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
