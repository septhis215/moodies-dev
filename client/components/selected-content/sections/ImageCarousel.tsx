"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

type ImageCarouselProps = {
  posters?: string[];
  backdrops?: string[];
};

const DEFAULT_IMAGE_BASE = "https://image.tmdb.org/t/p/"; // we'll append sizes per type

function ChevronLeftIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={props.className}
      aria-hidden
    >
      <path
        d="M15 6L9 12L15 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ChevronRightIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={props.className}
      aria-hidden
    >
      <path
        d="M9 6L15 12L9 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function CloseIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={props.className}
      aria-hidden
    >
      <path
        d="M6 6L18 18M6 18L18 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ImageCarouselUnique({
  posters = [],
  backdrops = [],
}: ImageCarouselProps) {
  const [tab, setTab] = useState<"posters" | "backdrops">(
    posters.length > 0 ? "posters" : "backdrops"
  );
  const items = tab === "posters" ? posters : backdrops;
  const size = tab === "posters" ? "w342" : "w780"; // choose sizes: posters smaller, backdrops wider
  const [index, setIndex] = useState(0);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const lightboxIndexRef = useRef<number>(0);

  useEffect(() => {
    // Reset index when switching tabs or items change
    setIndex(0);
  }, [tab, posters, backdrops]);

  // keyboard handlers for lightbox
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!isLightboxOpen) return;
      if (e.key === "Escape") {
        setIsLightboxOpen(false);
      } else if (e.key === "ArrowLeft") {
        prevLightbox();
      } else if (e.key === "ArrowRight") {
        nextLightbox();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLightboxOpen]);

  const prev = () =>
    setIndex((i) => (i - 1 + items.length) % Math.max(1, items.length));
  const next = () => setIndex((i) => (i + 1) % Math.max(1, items.length));

  const openLightbox = (i: number) => {
    lightboxIndexRef.current = i;
    setIsLightboxOpen(true);
  };

  const prevLightbox = () => {
    lightboxIndexRef.current =
      (lightboxIndexRef.current - 1 + Math.max(1, items.length)) %
      Math.max(1, items.length);
    // trigger re-render
    setIndex(lightboxIndexRef.current);
  };
  const nextLightbox = () => {
    lightboxIndexRef.current =
      (lightboxIndexRef.current + 1) % Math.max(1, items.length);
    setIndex(lightboxIndexRef.current);
  };

  // compute src builder (append size + path). If item already looks like a full URL, return it unchanged.
  const buildSrc = (path: string | undefined) => {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return `${DEFAULT_IMAGE_BASE}${size}${path}`;
  };

  if (!posters.length && !backdrops.length) return null;

  return (
    <section className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 items-end">
          <div
            className={`cursor-pointer pb-2 text-sm sm:text-base font-semibold ${
              tab === "posters" ? "text-white" : "text-slate-400"
            }`}
            onClick={() => setTab("posters")}
            role="button"
            tabIndex={0}
            aria-pressed={tab === "posters"}
            onKeyDown={(e) => (e.key === "Enter" ? setTab("posters") : null)}
          >
            Posters
          </div>
          <div
            className={`cursor-pointer pb-2 text-sm sm:text-base font-semibold ${
              tab === "backdrops" ? "text-white" : "text-slate-400"
            }`}
            onClick={() => setTab("backdrops")}
            role="button"
            tabIndex={0}
            aria-pressed={tab === "backdrops"}
            onKeyDown={(e) => (e.key === "Enter" ? setTab("backdrops") : null)}
          >
            Backdrops
          </div>

          {/* Animated underline */}
          <div className="relative ml-3">
            <div className="absolute left-0 -bottom-1 h-0.5 w-20 bg-transparent" />
            <div
              className="absolute -bottom-1 h-0.5 bg-indigo-500 transition-all duration-300"
              style={{
                width: tab === "posters" ? 56 : 80,
                transform:
                  tab === "posters" ? "translateX(0px)" : "translateX(72px)",
              }}
            />
          </div>
        </div>

        {/* index / total */}
        <div className="text-sm text-slate-400">
          {items.length > 0 ? (
            <span>
              {index + 1} / {items.length}
            </span>
          ) : (
            <span>0</span>
          )}
        </div>
      </div>

      {/* Main carousel */}
      <div className="relative">
        {/* Slider */}
        <div className="overflow-hidden rounded-2xl bg-slate-900/30">
          <div
            ref={sliderRef}
            className="flex transition-transform duration-500 ease-out"
            style={{
              transform: `translateX(-${index * 100}%)`,
              width: `${Math.max(1, items.length) * 100}%`,
            }}
          >
            {items.length > 0 ? (
              items.map((p, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-full flex items-center justify-center relative"
                  onClick={() => openLightbox(i)}
                >
                  {/* Gradient overlay to give unique look */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none rounded-2xl" />

                  <div className="relative w-full max-w-6xl h-[420px] sm:h-[480px] md:h-[520px]">
                    <Image
                      src={buildSrc(p)}
                      alt={`Image ${i + 1}`}
                      fill
                      sizes="(min-width: 1024px) 1000px, (min-width: 640px) 800px, 600px"
                      style={{ objectFit: "cover", borderRadius: 12 }}
                      className="rounded-2xl"
                      priority={i === index}
                      loading={i === index ? "eager" : "lazy"}
                    />
                  </div>

                  {/* subtle caption area */}
                  <div className="absolute left-6 bottom-6 text-sm text-slate-200/90 bg-black/30 px-3 py-1 rounded-md backdrop-blur-sm">
                    {tab === "posters" ? "Poster" : "Backdrop"} {i + 1}
                  </div>
                </div>
              ))
            ) : (
              <div className="w-full py-16 text-center text-slate-400">
                No images
              </div>
            )}
          </div>
        </div>

        {/* Prev / Next buttons */}
        <button
          onClick={prev}
          aria-label="Previous"
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 sm:p-3 backdrop-blur transition"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>

        <button
          onClick={next}
          aria-label="Next"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 sm:p-3 backdrop-blur transition"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Dots + Thumbnails */}
      <div className="flex items-center justify-between gap-4">
        {/* Dots */}
        <div className="flex items-center gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to image ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === index ? "scale-125 bg-indigo-500" : "bg-slate-600/60"
              }`}
            />
          ))}
        </div>

        {/* Thumbnails */}
        <div className="hidden sm:flex gap-2 overflow-x-auto max-w-[60%]">
          {items.map((p, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`flex-shrink-0 rounded-md overflow-hidden ring-2 ring-transparent transition-all ${
                i === index ? "ring-indigo-500/60 scale-105" : "hover:scale-105"
              }`}
              aria-label={`Select thumbnail ${i + 1}`}
            >
              <div className="relative w-24 h-14">
                <Image
                  src={buildSrc(p)}
                  alt={`Thumb ${i + 1}`}
                  fill
                  style={{ objectFit: "cover" }}
                  sizes="96px"
                  loading="lazy"
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {isLightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="w-full max-w-5xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="absolute right-2 top-2 z-50 bg-black/50 p-2 rounded-md"
              aria-label="Close"
            >
              <CloseIcon className="w-5 h-5 text-white" />
            </button>

            <div className="relative w-full h-[70vh] sm:h-[80vh]">
              <Image
                src={buildSrc(items[index])}
                alt={`Lightbox ${index + 1}`}
                fill
                style={{ objectFit: "contain" }}
                sizes="(min-width: 1024px) 1200px, 100vw"
                className="select-none"
              />
            </div>

            {/* Lightbox controls */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <button
                onClick={prevLightbox}
                aria-label="Previous image"
                className="bg-black/40 p-2 rounded-full"
              >
                <ChevronLeftIcon className="w-6 h-6 text-white" />
              </button>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <button
                onClick={nextLightbox}
                aria-label="Next image"
                className="bg-black/40 p-2 rounded-full"
              >
                <ChevronRightIcon className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* caption */}
            <div className="mt-4 text-center text-slate-200 text-sm">
              {tab === "posters" ? "Poster" : "Backdrop"} {index + 1} of{" "}
              {items.length}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
