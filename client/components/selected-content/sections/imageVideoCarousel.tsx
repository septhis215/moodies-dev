"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Props = {
  posters?: string[];
  backdrops?: string[];
  videos?: Array<string | VideoItem>;
};

type VideoItem = {
  id?: string;
  key: string;
  name?: string;
  site?: string;
  official?: boolean;
};

const DEFAULT_IMAGE_BASE = "https://image.tmdb.org/t/p/";
const youtubeThumb = (key: string) =>
  `https://img.youtube.com/vi/${key}/hqdefault.jpg`;
const youtubeEmbed = (key: string) =>
  `https://www.youtube.com/embed/${key}?rel=0&modestbranding=1`;

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      style={{ width: "1rem", height: "1rem" }}
    >
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      style={{ width: "1.1rem", height: "1.1rem" }}
    >
      <path
        d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ width: "1.5rem", height: "1.5rem" }}
    >
      <path d="M5 3v18l15-9L5 3z" />
    </svg>
  );
}

type Tab = "posters" | "backdrops" | "videos";

export default function ImageVideoCarousel({
  posters = [],
  backdrops = [],
  videos = [],
}: Props) {
  const safeVideos = Array.isArray(videos) ? videos : [];
  const normalizedVideos = safeVideos.map((v) =>
    typeof v === "string"
      ? { id: v, key: v, name: "Video", official: false }
      : v,
  );

  const firstTab: Tab =
    posters.length > 0
      ? "posters"
      : backdrops.length > 0
        ? "backdrops"
        : "videos";
  const [activeTab, setActiveTab] = useState<Tab>(firstTab);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const images = activeTab === "posters" ? posters : backdrops;
  const imageSize = activeTab === "posters" ? "w500" : "w1280";
  const allThumbs = activeTab === "videos" ? normalizedVideos : images;
  const totalItems =
    activeTab === "videos" ? normalizedVideos.length : images.length;

  const thumbsContainerRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const navigate = useCallback((dir: "prev" | "next") => {
    setSelectedIndex((prev) => {
      const len = Math.max(1, totalItems);
      return dir === "prev"
        ? prev === 0
          ? len - 1
          : prev - 1
        : prev === len - 1
          ? 0
          : prev + 1;
    });
  }, [totalItems]);

  useEffect(() => {
    setSelectedIndex((prev) =>
      Math.max(0, Math.min(prev, Math.max(0, totalItems - 1))),
    );
  }, [activeTab, totalItems]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") navigate("prev");
      if (e.key === "ArrowRight") navigate("next");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen, navigate]);

  useEffect(() => {
    const ref = thumbRefs.current[selectedIndex];
    const container = thumbsContainerRef.current;
    if (!ref || !container) return;
    const refCenter = ref.offsetLeft + ref.offsetWidth / 2;
    container.scrollTo({
      left: Math.max(0, refCenter - container.clientWidth / 2),
      behavior: "smooth",
    });
  }, [selectedIndex, activeTab]);

  const buildImageUrl = (path: string | undefined) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return `${DEFAULT_IMAGE_BASE}${imageSize}${path}`;
  };

  if (!posters.length && !backdrops.length && !normalizedVideos.length)
    return null;

  const counts = {
    posters: posters.length,
    backdrops: backdrops.length,
    videos: normalizedVideos.length,
  };

  /* ─── inline styles (same clamp-based fluid approach as hero) ─── */
  const css = `
    .ivc-root { font-family: var(--font-inter, 'Inter', system-ui, sans-serif); }
    .ivc-tabs { display: flex; gap: 0.25rem; padding: 0.25rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; }
    .ivc-tab {
      padding: clamp(0.35rem, 1vw, 0.5rem) clamp(0.75rem, 2.5vw, 1.25rem);
      border-radius: 7px; border: none; cursor: pointer;
      font-size: clamp(0.7rem, 1.5vw, 0.8rem);
      font-weight: 600; letter-spacing: 0.03em;
      transition: background 0.2s, color 0.2s;
      color: rgba(255,255,255,0.45); background: transparent;
      white-space: nowrap;
    }
    .ivc-tab:hover { color: rgba(255,255,255,0.75); }
    .ivc-tab.active { background: #e94f37; color: #fff; }
    .ivc-tab .cnt { opacity: 0.6; font-size: 0.85em; margin-left: 0.3em; }

    .ivc-main {
      position: relative;
      width: 100%;
      border-radius: clamp(8px, 1.5vw, 16px);
      overflow: hidden;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
    }
    .ivc-main-inner {
      position: relative;
      width: 100%;
      cursor: zoom-in;
    }

    .ivc-nav-btn {
      position: absolute;
      top: 50%; transform: translateY(-50%);
      width: clamp(32px, 5vw, 44px); height: clamp(32px, 5vw, 44px);
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%;
      background: rgba(0,0,0,0.55);
      border: 1px solid rgba(255,255,255,0.12);
      color: #fff; cursor: pointer;
      transition: background 0.15s, transform 0.15s;
      z-index: 2;
    }
    .ivc-nav-btn:hover { background: rgba(233,79,55,0.7); transform: translateY(-50%) scale(1.08); }
    .ivc-nav-btn.left { left: clamp(0.5rem, 2vw, 1rem); }
    .ivc-nav-btn.right { right: clamp(0.5rem, 2vw, 1rem); }

    .ivc-badge {
      position: absolute; bottom: clamp(0.5rem, 1.5vw, 0.75rem); right: clamp(0.5rem, 1.5vw, 0.75rem);
      padding: 0.2rem 0.6rem; border-radius: 99px;
      background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1);
      font-size: clamp(0.6rem, 1.2vw, 0.7rem); font-weight: 600;
      letter-spacing: 0.08em; text-transform: uppercase;
      color: rgba(255,255,255,0.7); pointer-events: none;
    }

    .ivc-counter {
      font-size: clamp(0.7rem, 1.4vw, 0.8rem);
      color: rgba(255,255,255,0.4);
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.05em;
    }
    .ivc-counter strong { color: rgba(255,255,255,0.85); font-weight: 600; }

    .ivc-thumbs-wrap {
      overflow-x: auto; padding: 0.25rem 0 0.5rem;
      scrollbar-width: none; -ms-overflow-style: none;
      -webkit-overflow-scrolling: touch;
    }
    .ivc-thumbs-wrap::-webkit-scrollbar { display: none; }
    .ivc-thumbs { display: flex; gap: clamp(0.35rem, 1vw, 0.6rem); align-items: flex-start; padding: 0 0.1rem; }

    .ivc-thumb {
      position: relative; flex-shrink: 0;
      border-radius: clamp(5px, 1vw, 8px); overflow: hidden;
      border: 2px solid transparent;
      cursor: pointer; transition: transform 0.2s cubic-bezier(.2,.9,.2,1), border-color 0.2s, box-shadow 0.2s;
      background: rgba(255,255,255,0.05);
    }
    .ivc-thumb.selected { border-color: #e94f37; box-shadow: 0 0 0 1px rgba(233,79,55,0.3); }
    .ivc-thumb:hover:not(.selected) { border-color: rgba(255,255,255,0.2); }

    .ivc-thumb-dot {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      pointer-events: none;
    }

    /* Lightbox */
    .ivc-lightbox {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(0,0,0,0.94);
      backdrop-filter: blur(16px);
      display: flex; align-items: center; justify-content: center;
      padding: clamp(1rem, 4vw, 2rem);
    }
    .ivc-lightbox-inner {
      position: relative;
      width: 100%; height: 100%;
      max-width: 1100px;
      max-height: 80svh;
    }
    .ivc-lightbox-close {
      position: absolute; top: clamp(-2.2rem, -4vw, -2.5rem); right: 0;
      width: clamp(28px, 4vw, 36px); height: clamp(28px, 4vw, 36px);
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
      color: #fff; cursor: pointer; transition: background 0.15s;
    }
    .ivc-lightbox-close:hover { background: #e94f37; }
    .ivc-lightbox-nav {
      position: absolute; top: 50%; transform: translateY(-50%);
      width: clamp(36px, 5vw, 52px); height: clamp(36px, 5vw, 52px);
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
      color: #fff; cursor: pointer; transition: background 0.15s, transform 0.15s;
    }
    .ivc-lightbox-nav:hover { background: rgba(233,79,55,0.7); transform: translateY(-50%) scale(1.06); }
    .ivc-lightbox-nav.left { left: clamp(0.25rem, 2vw, 0.75rem); }
    .ivc-lightbox-nav.right { right: clamp(0.25rem, 2vw, 0.75rem); }
    .ivc-lightbox-pill {
      position: absolute; bottom: clamp(0.75rem, 2vw, 1rem); left: 50%; transform: translateX(-50%);
      padding: 0.3rem 1rem; border-radius: 99px;
      background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.12);
      font-size: clamp(0.65rem, 1.3vw, 0.75rem); font-weight: 500;
      color: rgba(255,255,255,0.7); white-space: nowrap;
    }

    /* play overlay on video thumb */
    .ivc-play-overlay {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.3);
      color: #fff;
    }

    @media (max-width: 640px) {
      .ivc-tabs {
        max-width: 100%;
        overflow-x: auto;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
      }
      .ivc-tabs::-webkit-scrollbar { display: none; }
      .ivc-tab {
        min-height: 2.5rem;
        flex: 0 0 auto;
      }
      .ivc-main-inner {
        aspect-ratio: 16 / 10 !important;
        max-height: none !important;
      }
      .ivc-nav-btn {
        width: 40px;
        height: 40px;
      }
      .ivc-badge {
        display: none;
      }
      .ivc-lightbox {
        padding: 0.75rem;
      }
      .ivc-lightbox-inner {
        max-height: calc(100svh - 1.5rem);
      }
      .ivc-lightbox-close {
        top: 0.5rem;
        right: 0.5rem;
        z-index: 3;
        background: rgba(0,0,0,0.7);
      }
    }
  `;

  const thumbW = "clamp(80px, 13vw, 120px)";
  const thumbH = (tab: Tab) =>
    tab === "videos" ? "clamp(46px, 7.5vw, 68px)" : "clamp(80px, 13vw, 120px)";

  const currentVideo =
    activeTab === "videos" ? normalizedVideos[selectedIndex] : null;
  const isYoutube = currentVideo?.site?.toLowerCase() === "youtube";

  return (
    <div
      className="ivc-root"
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "clamp(0.75rem, 2vw, 1.25rem)",
      }}
    >
      <style>{css}</style>

      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div className="ivc-tabs">
          {(["posters", "backdrops", "videos"] as Tab[]).map(
            (tab) =>
              counts[tab] > 0 && (
                <button
                  key={tab}
                  className={`ivc-tab${activeTab === tab ? " active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  <span className="cnt">({counts[tab]})</span>
                </button>
              ),
          )}
        </div>

        <span className="ivc-counter">
          <strong>{selectedIndex + 1}</strong> / {Math.max(1, totalItems)}
        </span>
      </div>

      {/* Main viewer */}
      <div className="ivc-main">
        <div
          className="ivc-main-inner"
          style={{
            aspectRatio: "16/7",
            maxHeight: "clamp(160px, 28vw, 347px)",
          }}
          onClick={() => setLightboxOpen(true)}
        >
          {activeTab === "videos" ? (
            currentVideo ? (
              isYoutube ? (
                <iframe
                  src={youtubeEmbed(currentVideo.key)}
                  title={currentVideo.name || "Video"}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    display: "block",
                  }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                  }}
                >
                  <Image
                    src={youtubeThumb(currentVideo.key)}
                    alt={currentVideo.name ?? "Video"}
                    fill
                    style={{ objectFit: "cover" }}
                    sizes="100vw"
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0,0,0,0.4)",
                    }}
                  >
                    <Link
                      href={`https://www.youtube.com/watch?v=${currentVideo.key}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: "0.5rem 1.25rem",
                        borderRadius: 8,
                        background: "#e94f37",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        textDecoration: "none",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open video
                    </Link>
                  </div>
                </div>
              )
            ) : (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.3)",
                  fontSize: "0.85rem",
                }}
              >
                No videos available
              </div>
            )
          ) : images.length > 0 ? (
            <Image
              src={buildImageUrl(images[selectedIndex])}
              alt={`${activeTab} ${selectedIndex + 1}`}
              fill
              style={{ objectFit: "contain", transition: "opacity 0.3s" }}
              sizes="(min-width: 1024px) 1100px, 100vw"
              priority
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.3)",
                fontSize: "0.85rem",
              }}
            >
              No images available
            </div>
          )}

          {/* Gradient overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 40%)",
              pointerEvents: "none",
            }}
          />

          {/* Badge */}
          <div className="ivc-badge">
            {activeTab === "posters"
              ? "Poster"
              : activeTab === "backdrops"
                ? "Backdrop"
                : "Video"}
          </div>
        </div>

        {/* Nav arrows */}
        {totalItems > 1 && (
          <>
            <button
              className="ivc-nav-btn left"
              onClick={() => navigate("prev")}
              aria-label="Previous"
            >
              <ChevronIcon direction="left" />
            </button>
            <button
              className="ivc-nav-btn right"
              onClick={() => navigate("next")}
              aria-label="Next"
            >
              <ChevronIcon direction="right" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      <div className="ivc-thumbs-wrap" ref={thumbsContainerRef}>
        <div className="ivc-thumbs">
          {allThumbs.map((item, idx: number) => {
            const isSelected = selectedIndex === idx;
            const dist = Math.abs(idx - selectedIndex);
            const videoItem = item as VideoItem;
            return (
              <button
                key={
                  (activeTab === "videos" ? (videoItem.id ?? videoItem.key) : item) +
                  "-" +
                  idx
                }
                ref={(el) => {
                  thumbRefs.current[idx] = el;
                }}
                className={`ivc-thumb${isSelected ? " selected" : ""}`}
                style={{
                  width: thumbW,
                  height: thumbH(activeTab),
                  transform: `scale(${isSelected ? 1.05 : Math.max(0.93, 1 - dist * 0.025)})`,
                }}
                onClick={() => setSelectedIndex(idx)}
                aria-label={
                  activeTab === "videos"
                    ? `Video ${idx + 1}`
                    : `Image ${idx + 1}`
                }
              >
                {activeTab === "videos" ? (
                  <>
                    <Image
                      src={youtubeThumb(videoItem.key)}
                      alt={videoItem.name ?? `Video ${idx + 1}`}
                      fill
                      style={{ objectFit: "cover" }}
                      sizes="120px"
                      unoptimized
                    />
                    {!isSelected && (
                      <div className="ivc-play-overlay">
                        <PlayIcon />
                      </div>
                    )}
                  </>
                ) : (
                  <Image
                    src={buildImageUrl(item as string)}
                    alt={`Thumbnail ${idx + 1}`}
                    fill
                    style={{ objectFit: "cover" }}
                    sizes="120px"
                  />
                )}

                {/* distance dimming */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "#000",
                    opacity: Math.min(0.65, dist * 0.1),
                    pointerEvents: "none",
                    transition: "opacity 0.2s",
                  }}
                />

                {/* selected dot */}
                {isSelected && (
                  <div className="ivc-thumb-dot">
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#e94f37",
                        boxShadow: "0 0 6px rgba(233,79,55,0.8)",
                      }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="ivc-lightbox" onClick={() => setLightboxOpen(false)}>
          <div
            className="ivc-lightbox-inner"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="ivc-lightbox-close"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close"
            >
              <XIcon />
            </button>

            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                borderRadius: "clamp(8px,1.5vw,14px)",
                overflow: "hidden",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              {activeTab === "videos" ? (
                currentVideo && isYoutube ? (
                  <iframe
                    src={youtubeEmbed(currentVideo.key) + "&autoplay=1"}
                    title={currentVideo.name || "Video"}
                    style={{ width: "100%", height: "100%", border: "none" }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Link
                      href={`https://www.youtube.com/watch?v=${currentVideo?.key}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: "0.6rem 1.5rem",
                        borderRadius: 8,
                        background: "#e94f37",
                        color: "#fff",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      Open in YouTube
                    </Link>
                  </div>
                )
              ) : (
                <Image
                  src={buildImageUrl(images[selectedIndex])}
                  alt={`Lightbox ${selectedIndex + 1}`}
                  fill
                  style={{ objectFit: "contain" }}
                  sizes="100vw"
                  priority
                />
              )}
            </div>

            {totalItems > 1 && (
              <>
                <button
                  className="ivc-lightbox-nav left"
                  onClick={() => navigate("prev")}
                  aria-label="Previous"
                >
                  <ChevronIcon direction="left" />
                </button>
                <button
                  className="ivc-lightbox-nav right"
                  onClick={() => navigate("next")}
                  aria-label="Next"
                >
                  <ChevronIcon direction="right" />
                </button>
              </>
            )}

            <div className="ivc-lightbox-pill">
              {selectedIndex + 1} of {totalItems} ·{" "}
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
