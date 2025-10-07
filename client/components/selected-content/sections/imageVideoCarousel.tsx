"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Props = {
  posters?: string[];
  backdrops?: string[];
  videos?: any[]; // accept arrays of TMDb video objects or simple keys for backwards compat
};

const DEFAULT_IMAGE_BASE = "https://image.tmdb.org/t/p/";

// small helper to build youtube thumbnail if site is YouTube
const youtubeThumb = (key: string) =>
  `https://img.youtube.com/vi/${key}/hqdefault.jpg`;
const youtubeEmbed = (key: string) =>
  `https://www.youtube.com/embed/${key}?rel=0&modestbranding=1`;

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({
  direction,
  className,
}: {
  direction: "left" | "right";
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ImageVideoCarousel({
  posters = [],
  backdrops = [],
  videos = [],
}: Props) {
  const [activeTab, setActiveTab] = useState<
    "posters" | "backdrops" | "videos"
  >(
    posters.length > 0
      ? "posters"
      : backdrops.length > 0
      ? "backdrops"
      : "videos"
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [hoveredThumb, setHoveredThumb] = useState<number | null>(null);

  // ensure videos is always an array
  const safeVideos = Array.isArray(videos) ? videos : [];
  const normalizedVideos = safeVideos.map((v) =>
    typeof v === "string"
      ? { id: v, key: v, name: "Video", official: false }
      : v
  );

  const images = activeTab === "posters" ? posters : backdrops;
  const imageSize = activeTab === "posters" ? "w500" : "w1280";

  {
    /* Compact thumbnail strip (shows up to VISIBLE_THUMBS, +N overlay when more) */
  }
  const VISIBLE_THUMBS = 8;
  const allThumbs = activeTab === "videos" ? normalizedVideos : images;
  const visibleThumbs = allThumbs.slice(0, VISIBLE_THUMBS);
  const hiddenCount = Math.max(0, allThumbs.length - visibleThumbs.length);

  useEffect(() => {
    const maxIndex =
      activeTab === "videos" ? normalizedVideos.length - 1 : images.length - 1;

    if (selectedIndex > maxIndex) {
      setSelectedIndex(Math.max(0, maxIndex));
    } else {
      setSelectedIndex(0);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") navigate("prev");
      if (e.key === "ArrowRight") navigate("next");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen, selectedIndex, images.length, normalizedVideos.length]);

  const buildImageUrl = (path: string | undefined) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return `${DEFAULT_IMAGE_BASE}${imageSize}${path}`;
  };

  const navigate = (direction: "prev" | "next") => {
    if (activeTab === "videos") {
      setSelectedIndex((prev) => {
        const len = Math.max(1, normalizedVideos.length);
        return direction === "prev"
          ? prev === 0
            ? len - 1
            : prev - 1
          : prev === len - 1
          ? 0
          : prev + 1;
      });
    } else {
      setSelectedIndex((prev) => {
        const len = Math.max(1, images.length);
        return direction === "prev"
          ? prev === 0
            ? len - 1
            : prev - 1
          : prev === len - 1
          ? 0
          : prev + 1;
      });
    }
  };

  if (!posters.length && !backdrops.length && !normalizedVideos.length)
    return null;

  // counts for header
  const postersCount = posters.length;
  const backdropsCount = backdrops.length;
  const videosCount = normalizedVideos.length;

  return (
    <div className="w-full space-y-8">
      {/* Header with tabs (added Videos tab) */}
      <div className="flex items-center justify-between">
        <div className="relative inline-flex gap-1 p-1 bg-slate-800/50 rounded-xl backdrop-blur-sm">
          <button
            onClick={() => setActiveTab("posters")}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 cursor-pointer ${
              activeTab === "posters"
                ? " bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white shadow-lg"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Posters
            <span className="ml-2 text-xs opacity-70">({postersCount})</span>
          </button>

          <button
            onClick={() => setActiveTab("backdrops")}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 cursor-pointer ${
              activeTab === "backdrops"
                ? " bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white shadow-lg"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Backdrops
            <span className="ml-2 text-xs opacity-70">({backdropsCount})</span>
          </button>

          <button
            onClick={() => setActiveTab("videos")}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 cursor-pointer ${
              activeTab === "videos"
                ? " bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white shadow-lg"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Videos
            <span className="ml-2 text-xs opacity-70">({videosCount})</span>
          </button>
        </div>

        <div className="text-sm font-medium text-slate-300">
          {selectedIndex + 1} <span className="text-slate-500">/</span>{" "}
          {activeTab === "videos"
            ? Math.max(1, videosCount)
            : Math.max(1, images.length)}
        </div>
      </div>

      {/* Main display */}
      <div className="relative group">
        <div
          className="relative w-full max-w-4xl mx-auto rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 cursor-zoom-in"
          style={{ aspectRatio: "16/7", maxHeight: "500px" }}
          onClick={() => setLightboxOpen(true)}
        >
          {activeTab === "videos" ? (
            normalizedVideos.length > 0 && normalizedVideos[selectedIndex] ? (
              <div className="absolute inset-0">
                {/* show an iframe for YouTube, or fallback to thumbnail + link if unknown site */}
                {normalizedVideos[selectedIndex]?.site?.toLowerCase() ===
                "youtube" ? (
                  <iframe
                    src={youtubeEmbed(normalizedVideos[selectedIndex].key)}
                    title={normalizedVideos[selectedIndex].name || "Video"}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <>
                    <Image
                      src={youtubeThumb(normalizedVideos[selectedIndex].key)}
                      alt={normalizedVideos[selectedIndex].name ?? "Video"}
                      fill
                      className="object-cover"
                      sizes="100vw"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Link
                        href={
                          normalizedVideos[
                            selectedIndex
                          ].site?.toLowerCase() === "vimeo"
                            ? `https://vimeo.com/${normalizedVideos[selectedIndex].key}`
                            : `https://www.youtube.com/watch?v=${normalizedVideos[selectedIndex].key}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 rounded-md bg-black/60 text-white"
                      >
                        Open video
                      </Link>
                    </div>
                  </>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                No videos available
              </div>
            )
          ) : images.length > 0 ? (
            <>
              <Image
                src={buildImageUrl(images[selectedIndex])}
                alt={`${activeTab} ${selectedIndex + 1}`}
                fill
                className="object-contain transition-transform duration-500 group-hover:scale-105"
                sizes="(min-width: 1024px) 1200px, 100vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500">
              No images available
            </div>
          )}
        </div>

        {/* Navigation arrows */}
        {((activeTab === "videos" && normalizedVideos.length > 1) ||
          (activeTab !== "videos" && images.length > 1)) && (
          <>
            <button
              onClick={() => navigate("prev")}
              className="absolute left-6 top-1/2 -translate-y-1/2
                w-12 h-12 flex items-center justify-center rounded-full
                bg-gradient-to-br from-zinc-900/70 via-neutral-800/50 to-zinc-700/40
                backdrop-blur-md border border-white/10
                text-white shadow-lg shadow-black/40
                hover:scale-110 hover:bg-gradient-to-br hover:from-zinc-800/80 hover:via-neutral-700/60 hover:to-zinc-600/50
                transition-all duration-300 cursor-pointer"
              aria-label="Previous"
            >
              <ChevronIcon direction="left" className="w-6 h-6" />
            </button>

            <button
              onClick={() => navigate("next")}
              className="absolute right-6 top-1/2 -translate-y-1/2
                w-12 h-12 flex items-center justify-center rounded-full
                bg-gradient-to-br from-zinc-900/70 via-neutral-800/50 to-zinc-700/40
                backdrop-blur-md border border-white/10
                text-white shadow-lg shadow-black/40
                hover:scale-110 hover:bg-gradient-to-br hover:from-zinc-800/80 hover:via-neutral-700/60 hover:to-zinc-600/50
                transition-all duration-300 cursor-pointer"
              aria-label="Next"
            >
              <ChevronIcon direction="right" className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Badge */}
        <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-medium text-white">
          {activeTab === "posters"
            ? "Poster"
            : activeTab === "backdrops"
            ? "Backdrop"
            : "Video"}
        </div>
      </div>

      {/* Thumbnail grid */}
      <div className="overflow-x-auto py-2">
        <div className="flex gap-3 items-start px-1">
          {visibleThumbs.map((item: any, idx: number) => {
            const globalIdx = idx;
            const isSelected = selectedIndex === globalIdx;

            return (
              <button
                key={
                  (activeTab === "videos" ? item.id ?? item.key : item) +
                  "-" +
                  idx
                }
                onClick={() => {
                  const absoluteIdx = (
                    activeTab === "videos" ? normalizedVideos : images
                  ).indexOf(item);
                  setSelectedIndex(absoluteIdx >= 0 ? absoluteIdx : idx);
                }}
                onMouseEnter={() => setHoveredThumb(idx)}
                onMouseLeave={() => setHoveredThumb(null)}
                aria-label={
                  activeTab === "videos"
                    ? `Play video ${idx + 1}`
                    : `View image ${idx + 1}`
                }
                style={{
                  width: 120,
                  height: activeTab === "videos" ? 68 : 120,
                }}
                className={`relative rounded-lg overflow-hidden transition-all duration-200 flex-shrink-0
        // base glassy gradient theme (subtle)
        bg-gradient-to-r from-[#e94f37]/30 to-[#ff6b58]/30
        backdrop-blur-sm border border-white/8 shadow-md

        // interactive states
        ${
          isSelected
            ? "ring-2 ring-[#ff6b58]/60 shadow-lg shadow-[#ff6b58]/20 scale-105"
            : "ring-1 ring-white/10 hover:ring-[#ff6b58]/30 hover:scale-105"
        }
      `}
              >
                {/* image (fills the container) */}
                {activeTab === "videos" ? (
                  <Image
                    src={youtubeThumb(item.key)}
                    alt={item.name ?? `Video ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="120px"
                    unoptimized
                  />
                ) : (
                  <Image
                    src={buildImageUrl(item)}
                    alt={`Thumbnail ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="120px"
                  />
                )}

                {/* subtle top-to-bottom darken so UI elements are legible */}
                <div
                  className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent transition-opacity duration-200
          ${hoveredThumb === idx || isSelected ? "opacity-100" : "opacity-0"}
        `}
                />

                {/* small label (keeps same style but slightly translucent) */}
                <div className="absolute left-2 bottom-2 px-2 py-0.5 rounded-md bg-black/50 text-xs text-white">
                  {activeTab === "videos" ? item.type ?? "Video" : ""}
                </div>

                {/* selected indicator (dot) — use the warm gradient glass for the indicator */}
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#e94f37]/90 to-[#ff6b58]/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
          
          {hiddenCount > 0 && (
            <button
              onClick={() => {
                const absoluteIdx = VISIBLE_THUMBS;
                setSelectedIndex(
                  absoluteIdx < allThumbs.length
                    ? absoluteIdx
                    : allThumbs.length - 1
                );
                setLightboxOpen(true);
              }}
              className="relative rounded-lg overflow-hidden flex-shrink-0 transition-all duration-200
      bg-gradient-to-r from-[#e94f37]/20 to-[#ff6b58]/20 backdrop-blur-sm border border-white/8 hover:from-[#e94f37]/30 hover:to-[#ff6b58]/30 hover:scale-105 ring-1 ring-white/10"
              style={{ width: 120, height: 120 }}
              aria-label={`Show ${hiddenCount} more`}
            >
              {allThumbs[VISIBLE_THUMBS] ? (
                activeTab === "videos" ? (
                  <Image
                    src={youtubeThumb(allThumbs[VISIBLE_THUMBS].key)}
                    alt={`+${hiddenCount} more`}
                    fill
                    className="object-cover"
                    sizes="120px"
                    unoptimized
                  />
                ) : (
                  <Image
                    src={buildImageUrl(allThumbs[VISIBLE_THUMBS])}
                    alt={`+${hiddenCount} more`}
                    fill
                    className="object-cover"
                    sizes="120px"
                  />
                )
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900" />
              )}

              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-sm font-semibold">
                +{hiddenCount}
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative w-full h-full max-w-6xl max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute -top-10 right-0 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all z-10"
              aria-label="Close lightbox"
            >
              <XIcon className="w-5 h-5" />
            </button>

            <div className="relative w-full h-full rounded-2xl overflow-hidden">
              {activeTab === "videos" ? (
                normalizedVideos[selectedIndex] &&
                normalizedVideos[selectedIndex]?.site?.toLowerCase() ===
                  "youtube" ? (
                  <iframe
                    src={
                      youtubeEmbed(normalizedVideos[selectedIndex].key) +
                      "&autoplay=1"
                    }
                    title={normalizedVideos[selectedIndex].name || "Video"}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Link
                      href={
                        normalizedVideos[selectedIndex].site?.toLowerCase() ===
                        "vimeo"
                          ? `https://vimeo.com/${normalizedVideos[selectedIndex].key}`
                          : `https://www.youtube.com/watch?v=${normalizedVideos[selectedIndex].key}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-md bg-white text-black"
                    >
                      Open video in new tab
                    </Link>
                  </div>
                )
              ) : (
                <Image
                  src={buildImageUrl(images[selectedIndex])}
                  alt={`Lightbox ${selectedIndex + 1}`}
                  fill
                  className="object-contain"
                  sizes="100vw"
                  priority
                />
              )}
            </div>

            {/* Lightbox navigation */}
            {((activeTab === "videos" && normalizedVideos.length > 1) ||
              (activeTab !== "videos" && images.length > 1)) && (
              <>
                <button
                  onClick={() => navigate("prev")}
                  className="absolute left-7 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 hover:scale-110 transition-all"
                  aria-label="Previous"
                >
                  <ChevronIcon direction="left" className="w-7 h-7" />
                </button>
                <button
                  onClick={() => navigate("next")}
                  className="absolute right-7 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 hover:scale-110 transition-all"
                  aria-label="Next"
                >
                  <ChevronIcon direction="right" className="w-7 h-7" />
                </button>
              </>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-sm font-medium text-white">
              {selectedIndex + 1} of{" "}
              {activeTab === "videos" ? videosCount : images.length} ·{" "}
              {activeTab === "posters"
                ? "Poster"
                : activeTab === "backdrops"
                ? "Backdrop"
                : "Video"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
