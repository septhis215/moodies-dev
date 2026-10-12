"use client";

import { ChevronLeft, ChevronRight, Expand, Play, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isPoster = activeTab === "posters";

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
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxOpen]);

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
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            Explore the artwork, stills, and videos.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-[var(--ink-muted)]">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Media type">
            {(["posters", "backdrops", "videos"] as Tab[]).map((tab) =>
              counts[tab] > 0 ? (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={activeTab === tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setSelectedIndex(0);
                    setLightboxOpen(false);
                  }}
                  className={`min-h-11 rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral)] ${
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
        </div>
      </header>

      <div
        className={`mt-6 grid min-w-0 items-start gap-4 ${
          totalItems > 1
            ? isPoster ? "lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-6" : "lg:grid-cols-[16rem_minmax(0,1fr)]"
            : "lg:grid-cols-1"
        }`}
      >
        <div
          className={`min-w-0 ${
            isPoster ? "mx-auto w-full max-w-64 sm:max-w-80" : "w-full lg:order-last"
          }`}
        >
          <div
            className={`relative overflow-hidden rounded-xl bg-black ${
              isPoster ? "aspect-[2/3]" : "aspect-video"
            }`}
          >
            {activeTab === "videos" ? (
              currentVideo && isYoutube ? (
                <iframe
                  key={currentVideo.key}
                  src={youtubeEmbed(currentVideo.key)}
                  title={currentVideo.name || "Video"}
                  className="absolute inset-0 h-full w-full border-0"
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
                className="relative block h-full w-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand-coral)]"
                onClick={() => setLightboxOpen(true)}
                aria-label={`Open ${activeLabel.toLowerCase()} ${selectedIndex + 1}`}
              >
                <Image
                  src={imageUrl(images[selectedIndex], activeTab === "posters" ? "w500" : "w1280")}
                  alt={`${activeLabel} ${selectedIndex + 1}`}
                  fill
                  sizes={isPoster ? "(min-width: 640px) 320px, 256px" : "(min-width: 1024px) 960px, 100vw"}
                  className="object-contain"
                />
                <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-lg bg-black/70 text-white" aria-hidden="true"><Expand size={16} /></span>
              </button>
            ) : null}

          </div>
        </div>

        {totalItems > 1 ? (
          <div className={`flex min-w-0 gap-3 overflow-x-auto overflow-y-hidden overscroll-contain py-1 max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden lg:max-h-[32rem] lg:overflow-x-hidden lg:overflow-y-auto lg:p-2 ${isPoster ? "lg:grid lg:grid-cols-3 xl:grid-cols-4 lg:content-start" : "lg:block lg:space-y-3"}`}
            tabIndex={0} role="region" aria-label={`Browse ${activeTab}, scroll for more`}>
            {(activeTab === "videos" ? normalizedVideos : images).map((item, index) => {
              const video = activeTab === "videos" ? (item as VideoItem) : null;
              const selected = selectedIndex === index;
              return (
                <button
                  key={video ? `${video.id ?? video.key}-${index}` : `${item}-${index}`}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  className={`relative block shrink-0 overflow-hidden rounded-xl bg-black text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral)] ${isPoster ? "aspect-[2/3] w-20 sm:w-24 lg:w-full" : "aspect-video w-56 lg:w-full"} ${
                    selected
                      ? "ring-2 ring-inset ring-[var(--brand-coral)]"
                      : "opacity-70 hover:opacity-100"
                  }`}
                  aria-pressed={selected}
                  aria-label={`Select ${activeLabel.toLowerCase()} ${index + 1}`}
                >
                  <Image
                    src={video ? youtubeThumb(video.key) : imageUrl(item as string, activeTab === "posters" ? "w500" : "w1280")}
                    alt=""
                    fill
                    sizes={isPoster ? "(min-width: 1024px) 220px, 96px" : "256px"}
                    unoptimized={Boolean(video)}
                    className={isPoster ? "object-contain" : "object-cover"}
                  />
                  {video ? (
                    <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">
                      <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                    </span>
                  ) : null}
                  {selected && <span className="pointer-events-none absolute inset-0 rounded-xl border-2 border-[var(--brand-coral)]" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {lightboxOpen && activeTab !== "videos" && images[selectedIndex] ? (
        <dialog
          ref={dialogRef}
          className="fixed inset-0 m-auto h-[min(86dvh,48rem)] max-h-none w-[calc(100%_-_2rem)] max-w-6xl overflow-hidden rounded-xl bg-black p-4 text-white backdrop:bg-black/90"
          aria-label={`${activeLabel} viewer`}
          onCancel={(event) => { event.preventDefault(); setLightboxOpen(false); }}
          onClick={(event) => { if (event.target === event.currentTarget) setLightboxOpen(false); }}
        >
          <div
            className="relative h-full w-full"
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
              autoFocus
              onClick={() => setLightboxOpen(false)}
              className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-xl border border-white/15 bg-black/60 text-white focus-visible:outline-2 focus-visible:outline-[var(--brand-coral)] hover:text-[var(--brand-coral-strong)]"
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
        </dialog>
      ) : null}
    </section>
  );
}
