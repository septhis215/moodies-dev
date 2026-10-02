"use client";

import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { tmdbImage } from "@/lib/tmdb";

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

type Tab = "posters" | "backdrops" | "videos";

const youtubeThumb = (key: string) =>
  `https://img.youtube.com/vi/${key}/hqdefault.jpg`;

const youtubeEmbed = (key: string) =>
  `https://www.youtube-nocookie.com/embed/${key}?rel=0&modestbranding=1&controls=1`;

function imageUrl(path: string, size: "w500" | "w1280"): string {
  return path.startsWith("http") ? path : tmdbImage(path, size);
}

export default function ImageVideoCarousel({
  posters = [],
  backdrops = [],
  videos = [],
}: Props) {
  const normalizedVideos = useMemo(
    () =>
      (Array.isArray(videos) ? videos : []).map((video) =>
        typeof video === "string"
          ? { id: video, key: video, name: "Video", site: "YouTube" }
          : video,
      ),
    [videos],
  );
  const counts = {
    posters: posters.length,
    backdrops: backdrops.length,
    videos: normalizedVideos.length,
  };
  const firstTab: Tab = posters.length
    ? "posters"
    : backdrops.length
      ? "backdrops"
      : "videos";
  const [activeTab, setActiveTab] = useState<Tab>(firstTab);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const images = activeTab === "posters" ? posters : backdrops;
  const currentVideo =
    activeTab === "videos" ? normalizedVideos[selectedIndex] : undefined;
  const totalItems = activeTab === "videos" ? normalizedVideos.length : images.length;
  const isYoutube = currentVideo?.site?.toLowerCase() === "youtube";

  const navigate = useCallback(
    (direction: "previous" | "next") => {
      setSelectedIndex((current) => {
        if (totalItems < 2) return 0;
        return direction === "previous"
          ? current === 0
            ? totalItems - 1
            : current - 1
          : current === totalItems - 1
            ? 0
            : current + 1;
      });
    },
    [totalItems],
  );

  useEffect(() => {
    setSelectedIndex((current) =>
      Math.min(current, Math.max(0, totalItems - 1)),
    );
  }, [activeTab, totalItems]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowLeft") navigate("previous");
      if (event.key === "ArrowRight") navigate("next");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen, navigate]);

  if (!posters.length && !backdrops.length && !normalizedVideos.length) {
    return null;
  }

  const activeLabel =
    activeTab === "posters"
      ? "Poster"
      : activeTab === "backdrops"
        ? "Backdrop"
        : "Video";

  return (
    <section
      className="ui-shell scroll-mt-24 py-8 sm:py-10"
      aria-labelledby="media-archive-heading"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h2
            id="media-archive-heading"
            className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
          >
            Media archive
          </h2>
          <p className="mt-3 text-base leading-7 text-[var(--ink-muted)]">
            Stills, posters, and videos kept available without competing with
            the main decision on this page.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-[var(--ink-muted)]">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Media type">
            {(["posters", "backdrops", "videos"] as Tab[]).map((tab) =>
              counts[tab] > 0 ? (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setSelectedIndex(0);
                    setLightboxOpen(false);
                  }}
                  className={`px-3 py-2 text-xs font-semibold transition-colors ${
                    activeTab === tab
                      ? "border-b-2 border-brand-coral-strong text-[var(--ink)]"
                      : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {tab[0].toUpperCase() + tab.slice(1)} {counts[tab]}
                </button>
              ) : null,
            )}
          </div>
          <span className="hidden sm:inline">
            {selectedIndex + 1} / {totalItems}
          </span>
        </div>
      </header>

      <div
        className={`mt-6 grid gap-4 ${
          totalItems > 1
            ? "lg:h-[min(32rem,calc(100dvh-14rem))] lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-stretch"
            : "lg:grid-cols-1"
        }`}
      >
        <div
          className={`relative overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] ${
            totalItems > 1 ? "lg:flex lg:h-full lg:flex-col" : ""
          }`}
        >
          <div
            className={`relative ${
              totalItems > 1
                ? "aspect-video lg:min-h-0 lg:flex-1 lg:aspect-auto"
                : "aspect-video lg:aspect-[16/8]"
            }`}
          >
            {activeTab === "videos" ? (
              currentVideo && isYoutube ? (
                <iframe
                  src={youtubeEmbed(currentVideo.key)}
                  title={currentVideo.name || "Video"}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : currentVideo ? (
                <a
                  href={`https://www.youtube.com/watch?v=${currentVideo.key}`}
                  target="_blank"
                  rel="noreferrer"
                  className="relative block h-full w-full"
                >
                  <Image
                    src={youtubeThumb(currentVideo.key)}
                    alt={currentVideo.name || "Video"}
                    fill
                    sizes="(max-width: 1024px) 100vw, 70vw"
                    unoptimized
                    className="object-cover"
                  />
                  <span className="absolute inset-0 grid place-items-center bg-black/40 text-white">
                    <span className="ui-primary-action">
                      <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                      Open video
                    </span>
                  </span>
                </a>
              ) : null
            ) : images[selectedIndex] ? (
              <button
                type="button"
                className="relative h-full w-full cursor-zoom-in"
                onClick={() => setLightboxOpen(true)}
                aria-label={`Open ${activeLabel.toLowerCase()} ${selectedIndex + 1}`}
              >
                <Image
                  src={imageUrl(images[selectedIndex], activeTab === "posters" ? "w500" : "w1280")}
                  alt={`${activeLabel} ${selectedIndex + 1}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 70vw"
                  className="object-contain"
                  priority
                />
              </button>
            ) : null}

            {totalItems > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate("previous")}
                  className="absolute left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center border border-white/15 bg-black/60 text-white transition-colors hover:border-brand-coral-strong hover:text-brand-coral-strong lg:grid"
                  aria-label={`Previous ${activeLabel.toLowerCase()}`}
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("next")}
                  className="absolute right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center border border-white/15 bg-black/60 text-white transition-colors hover:border-brand-coral-strong hover:text-brand-coral-strong lg:grid"
                  aria-label={`Next ${activeLabel.toLowerCase()}`}
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </>
            ) : null}
          </div>
          <div className="flex items-center justify-between border-t border-[var(--surface-border)] px-3 py-2 text-xs text-[var(--ink-muted)]">
            <span>{currentVideo?.name || activeLabel}</span>
            <span>{selectedIndex + 1} / {totalItems}</span>
          </div>
        </div>

        {totalItems > 1 ? (
          <div className="mobile-native-scroll scrollbar-hide flex gap-2 overflow-x-auto pb-1 lg:min-h-0 lg:overflow-y-auto lg:block lg:space-y-2 lg:overflow-x-hidden">
            {(activeTab === "videos" ? normalizedVideos : images).map((item, index) => {
              const video = activeTab === "videos" ? (item as VideoItem) : null;
              const selected = selectedIndex === index;
              return (
                <button
                  key={video ? `${video.id ?? video.key}-${index}` : `${item}-${index}`}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  className={`relative block h-20 w-32 shrink-0 overflow-hidden rounded-xl border text-left transition-colors lg:h-[4.75rem] lg:w-full ${
                    selected
                      ? "border-brand-coral-strong"
                      : "border-[var(--surface-border)] opacity-65 hover:opacity-100"
                  }`}
                  aria-label={`Select ${activeLabel.toLowerCase()} ${index + 1}`}
                >
                  <Image
                    src={video ? youtubeThumb(video.key) : imageUrl(item as string, activeTab === "posters" ? "w500" : "w1280")}
                    alt={video?.name || `${activeLabel} ${index + 1}`}
                    fill
                    sizes="(max-width: 1024px) 128px, 240px"
                    unoptimized={Boolean(video)}
                    className="object-cover"
                  />
                  {video ? (
                    <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">
                      <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {lightboxOpen && activeTab !== "videos" && images[selectedIndex] ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${activeLabel} viewer`}
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative h-[min(82vh,46rem)] w-full max-w-6xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={imageUrl(images[selectedIndex], activeTab === "posters" ? "w500" : "w1280")}
              alt={`${activeLabel} ${selectedIndex + 1}`}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute right-0 top-0 grid h-10 w-10 place-items-center border border-white/15 bg-black/60 text-white hover:border-brand-coral-strong hover:text-brand-coral-strong"
              aria-label="Close viewer"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            {totalItems > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate("previous")}
                  className="absolute left-0 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center border border-white/15 bg-black/60 text-white hover:border-brand-coral-strong hover:text-brand-coral-strong"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("next")}
                  className="absolute right-0 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center border border-white/15 bg-black/60 text-white hover:border-brand-coral-strong hover:text-brand-coral-strong"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
