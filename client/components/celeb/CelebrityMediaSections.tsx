"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { tmdbImage } from "@/lib/tmdb";
import CustomSelect from "@/components/ui/custom-select";
import CelebrityVideoCard from "./CelebrityVideoCard";
import CelebrityVideoPlayer from "./CelebrityVideoPlayer";
import styles from "./celebrity-hub.module.css";
import type {
  MediaSource,
  CelebrityMedia,
  CelebrityPhoto,
  CelebrityVideo,
  VideoCategory,
} from "@/types/celebrityMedia";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
const categories: Record<VideoCategory, string> = {
  trailer: "Trailers",
  clip: "Clips",
  interview: "Interviews",
  performance: "Performances",
  "music-video": "Music videos",
  "behind-scenes": "Behind the scenes",
  appearance: "TV appearances",
  event: "Events",
  fancam: "Fan content",
  live: "Live & radio",
  other: "Other",
};
const sourceNames: Record<MediaSource, string> = {
  tmdb: "TMDB",
  youtube: "YouTube",
  wikimedia: "Wikimedia Commons",
  openverse: "Openverse",
};
type Profile = {
  id: number;
  name: string;
  profile_path?: string | null;
  images?: { profiles?: Array<{ file_path: string; aspect_ratio?: number }> };
};
type Selection =
  | { kind: "photo"; photo: CelebrityPhoto }
  | { kind: "video"; video: CelebrityVideo };
function fallbackPhotos(person: Profile): CelebrityPhoto[] {
  const images = person.images?.profiles?.length
    ? person.images.profiles
    : person.profile_path
      ? [{ file_path: person.profile_path }]
      : [];
  return [
    ...new Map(images.map((photo) => [photo.file_path, photo])).values(),
  ].map((photo) => ({
    id: `tmdb:${photo.file_path}`,
    url: tmdbImage(photo.file_path, "original")!,
    thumbnail: tmdbImage(photo.file_path, "w500")!,
    title: `${person.name} portrait`,
    width: 500,
    height: Math.round(500 / (photo.aspect_ratio || 2 / 3)),
    source: "tmdb",
    sourceUrl: `https://www.themoviedb.org/person/${person.id}/images/profiles`,
    attribution: "TMDB",
    license: "TMDB image",
    relevanceScore: 1,
  }));
}
export default function CelebrityMediaSections({
  person,
  onPhotosReady,
  view = "all",
  latest = false,
}: {
  person: Profile;
  onPhotosReady?: (photos: CelebrityPhoto[]) => void;
  view?: "all" | "videos" | "photos";
  latest?: boolean;
}) {
  const [response, setResponse] = useState<{
    personId: number;
    data: CelebrityMedia;
  } | null>(null);
  const media = response?.personId === person.id ? response.data : null;
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(
    Boolean(onPhotosReady) || view !== "all",
  );
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [category, setCategory] = useState<VideoCategory | "all">("all");
  const [photoSource, setPhotoSource] = useState<MediaSource | "all">("all");
  const [photoLimit, setPhotoLimit] = useState(5);
  const [videoLimit, setVideoLimit] = useState(8);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [brokenPhotos, setBrokenPhotos] = useState<Set<string>>(new Set());
  const section = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!section.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(section.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!started) return;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    fetch(
      `${API_BASE}/people/${person.id}/${latest ? "latest-videos" : "media"}`,
      {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(30000),
        ]),
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Celebrity media unavailable");
        const data = (await response.json()) as CelebrityMedia;
        if (
          !Array.isArray(data.photos) ||
          !Array.isArray(data.videos) ||
          !data.sources
        )
          throw new Error("Invalid media response");
        if (!controller.signal.aborted) {
          setResponse({ personId: person.id, data });
          onPhotosReady?.(
            data.photos.length ? data.photos : fallbackPhotos(person),
          );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true);
          onPhotosReady?.(fallbackPhotos(person));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [person, started, retry, onPhotosReady, latest]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (selection && !element.open) element.showModal();
    if (!selection && element.open) element.close();
  }, [selection]);
  useEffect(() => {
    if (!selection) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [selection]);

  const allPhotos = (
    media?.photos.length ? media.photos : fallbackPhotos(person)
  ).filter((photo) => !brokenPhotos.has(photo.id));
  const photoSources = [...new Set(allPhotos.map((photo) => photo.source))];
  const activeSource =
    photoSource === "all" || photoSources.includes(photoSource)
      ? photoSource
      : "all";
  const photos = allPhotos.filter(
    (photo) => activeSource === "all" || photo.source === activeSource,
  );
  const videos = (media?.videos || []).filter(
    (video) => category === "all" || video.category === category,
  );
  const shownVideos = videos.slice(0, videoLimit);
  const unavailable =
    failed ||
    (media &&
      Object.values(media.sources).some(
        (value) => value === "unavailable" || value === "stale",
      ));
  function movePhoto(direction: number) {
    if (selection?.kind !== "photo" || photos.length < 2) return;
    const index = photos.findIndex((photo) => photo.id === selection.photo.id);
    setSelection({
      kind: "photo",
      photo: photos[(index + direction + photos.length) % photos.length],
    });
  }
  return (
    <>
      {view !== "photos" && (
        <section
          ref={section}
          id="on-screen-moments"
          aria-labelledby="celebrity-moments-heading"
          className="mt-10 min-w-0 scroll-mt-24 space-y-5 border-t border-[var(--surface-border)] pt-8 sm:mt-12 sm:pt-10"
        >
          <header>
            <h2
              id="celebrity-moments-heading"
              className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
            >
              {latest ? "Recent videos" : "On-Screen Moments"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
              {latest
                ? `Interviews, trailers and appearances featuring ${person.name} from the last 90 days. Title videos may feature an ensemble cast.`
                : `Interviews, performances and stories from ${person.name}’s world.`}
            </p>
            {latest && media && (
              <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
                {media.sources.youtube === "disabled"
                  ? "YouTube discovery is unavailable. Showing title videos from TMDB where available."
                  : "YouTube search can take time to index new uploads."}
                {Object.values(media.sources).includes("stale") &&
                  " Some results are from a saved snapshot."}
                {Object.values(media.sources).some(
                  (status) => status === "ready" || status === "stale",
                ) &&
                  ` Last fetched ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(media.updatedAt))} UTC.`}
              </p>
            )}
          </header>
          {unavailable && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--ink-muted)]">
              <p>
                Some photos and videos couldn’t load. You can still browse the
                moments available below.
              </p>
              <button
                type="button"
                disabled={loading}
                className="ui-secondary-action"
                onClick={() => setRetry((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          )}
          <div
            role="group"
            aria-label="Filter on-screen moments"
            className="mobile-native-scroll flex gap-2 overflow-x-auto pb-1"
          >
            {(
              [
                "all",
                ...Object.keys(categories).filter((key) =>
                  media?.videos.some((video) => video.category === key),
                ),
              ] as Array<VideoCategory | "all">
            ).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={category === value}
                onClick={() => {
                  setCategory(value);
                  setVideoLimit(8);
                }}
                className="ui-filter-chip shrink-0"
              >
                {value === "all" ? "All moments" : categories[value]}
              </button>
            ))}
          </div>
          {!started || (loading && !media) ? (
            <div
              role="status"
              aria-label="Loading celebrity videos"
              className="grid gap-4 sm:grid-cols-2"
            >
              <div className="ui-panel aspect-video moodies-skeleton" />
              <div className="ui-panel aspect-video moodies-skeleton" />
            </div>
          ) : shownVideos.length > 0 ? (
            <>
              <div className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 xl:grid-cols-3">
                {shownVideos.map((video) => (
                  <CelebrityVideoCard
                    key={video.id}
                    video={video}
                    onPlay={() => setSelection({ kind: "video", video })}
                  />
                ))}
              </div>
              {videos.length > videoLimit && (
                <button
                  type="button"
                  className="ui-secondary-action"
                  onClick={() => setVideoLimit((value) => value + 8)}
                >
                  View more moments ({videos.length - videoLimit})
                </button>
              )}
            </>
          ) : (
            <div className="ui-panel p-5 text-sm leading-6 text-[var(--ink-muted)]">
              {failed
                ? "We couldn’t load these moments. You can still explore the profile and photos."
                : "No moments are available yet. Explore the filmography for more of their work."}
              {latest && (
                <Link
                  href={`/celeb/${person.id}#on-screen-moments`}
                  className="ui-secondary-action mt-4"
                >
                  Browse all screen moments
                </Link>
              )}
            </div>
          )}
        </section>
      )}
      {view !== "videos" && (
        <section
          ref={view === "photos" ? section : undefined}
          id="gallery"
          aria-labelledby="celebrity-gallery-heading"
          className="mt-10 scroll-mt-24 space-y-5 border-t border-[var(--surface-border)] pt-8 sm:mt-12 sm:pt-10"
        >
          <header>
            <h2
              id="celebrity-gallery-heading"
              className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
            >
              Photo Gallery
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
              Portraits and public appearances. Open a photo for the full view
              and source credits.
            </p>
          </header>
          {view === "photos" && unavailable && (
            <div
              className="flex flex-wrap items-center gap-3 text-sm leading-6 text-[var(--ink-muted)]"
              role="status"
            >
              <p>
                Some photo sources couldn’t load. Available portraits are shown
                below.
              </p>
              <button
                type="button"
                disabled={loading}
                className="ui-secondary-action"
                onClick={() => setRetry((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          )}
          {allPhotos.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--surface-border)] pb-4">
              <p role="status" className="text-sm text-[var(--ink-muted)]">
                {photos.length} {photos.length === 1 ? "photo" : "photos"}
              </p>
              {photoSources.length > 1 && (
                <CustomSelect
                  label="Photo source"
                  value={activeSource}
                  onChange={(value) => {
                    setPhotoSource(value);
                    setPhotoLimit(5);
                  }}
                  options={[
                    {
                      value: "all" as MediaSource | "all",
                      label: "All sources",
                    },
                    ...photoSources.map((source) => ({
                      value: source,
                      label: sourceNames[source],
                    })),
                  ]}
                  widthClass="w-56 max-w-full"
                />
              )}
            </div>
          )}
          {photos.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">
                {photos.slice(0, photoLimit).map((photo, index) => (
                  <article key={photo.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelection({ kind: "photo", photo })}
                      className="group relative block aspect-[3/4] w-full overflow-hidden rounded-lg bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral-strong)]"
                      aria-label={
                        "Open photo " + (index + 1) + ": " + photo.title
                      }
                    >
                      <Image
                        src={photo.thumbnail}
                        alt={photo.title}
                        fill
                        unoptimized
                        sizes="(max-width: 639px) 45vw, (max-width: 1023px) 30vw, 240px"
                        className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
                        onError={() =>
                          setBrokenPhotos(
                            (previous) => new Set([...previous, photo.id]),
                          )
                        }
                      />
                    </button>
                    <a
                      href={photo.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={photo.attribution + " · " + photo.license}
                      className="mt-2 flex min-h-11 items-start gap-1.5 rounded-sm py-1 text-xs leading-5 text-[var(--ink-muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {photo.attribution}
                        </span>
                        <span className="block truncate">
                          {sourceNames[photo.source]} · {photo.license}
                        </span>
                      </span>
                      <ArrowUpRight
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    </a>
                  </article>
                ))}
              </div>
              {photos.length > photoLimit && (
                <button
                  type="button"
                  className="ui-secondary-action"
                  onClick={() => setPhotoLimit((value) => value + 5)}
                >
                  Load more photos ({photos.length - photoLimit})
                </button>
              )}
            </>
          ) : loading || !started ? (
            <div
              role="status"
              aria-label="Loading celebrity photos"
              className="ui-panel h-64 moodies-skeleton"
            />
          ) : (
            <div className="ui-panel p-5 text-sm text-[var(--ink-muted)]">
              No confidently matched photos are available yet.
            </div>
          )}
        </section>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="celebrity-media-dialog-title"
        onCancel={() => setSelection(null)}
        onClose={() => setSelection(null)}
        onClick={(event) => {
          if (event.target === dialog.current) setSelection(null);
        }}
        onKeyDown={(event) => {
          if (
            selection?.kind === "photo" &&
            ["ArrowLeft", "ArrowRight"].includes(event.key)
          ) {
            event.preventDefault();
            movePhoto(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
        className={`${styles.mediaDialog} fixed m-auto max-h-[94dvh] w-[94vw] max-w-5xl overflow-y-auto rounded-xl border border-[var(--surface-border)] bg-[var(--surface-0)] p-0 text-[var(--ink)] backdrop:bg-black/90`}
      >
        {selection && (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-[var(--surface-border)] p-4">
              <h2
                id="celebrity-media-dialog-title"
                className="text-xl font-bold leading-tight"
              >
                {selection.kind === "video"
                  ? selection.video.title
                  : selection.photo.title}
              </h2>
              <button
                type="button"
                onClick={() => setSelection(null)}
                aria-label="Close media viewer"
                className="ui-secondary-action h-11 w-11 shrink-0 px-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {selection.kind === "video" ? (
              <>
                <CelebrityVideoPlayer
                  key={selection.video.id}
                  video={selection.video}
                  autoplay
                  initialMuted={false}
                />
                <div className="p-4">
                  <p className="text-sm text-[var(--ink-muted)]">
                    {selection.video.channel}
                  </p>
                  <a
                    href={selection.video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--brand-coral-strong)]"
                  >
                    YouTube <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
              </>
            ) : (
              <>
                <div className="relative h-[60dvh] w-full bg-black/30">
                  <Image
                    key={selection.photo.id}
                    src={selection.photo.url}
                    alt={selection.photo.title}
                    fill
                    unoptimized
                    sizes="94vw"
                    className="object-contain"
                  />
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/75 px-3 py-1 text-xs text-white">
                    {photos.findIndex(
                      (photo) => photo.id === selection.photo.id,
                    ) + 1}{" "}
                    of {photos.length}
                  </span>
                  {photos.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="ui-secondary-action absolute left-2 top-1/2 h-11 w-11 bg-black/80 px-0"
                        aria-label="Previous photo"
                        onClick={() => movePhoto(-1)}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        className="ui-secondary-action absolute right-2 top-1/2 h-11 w-11 bg-black/80 px-0"
                        aria-label="Next photo"
                        onClick={() => movePhoto(1)}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
                <footer className="border-t border-[var(--surface-border)] p-4 text-sm leading-6 text-[var(--ink-muted)]">
                  <p>{selection.photo.attribution}</p>
                  <a
                    href={selection.photo.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1 text-[var(--brand-coral-strong)]"
                  >
                    Source: {sourceNames[selection.photo.source]}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                  {selection.photo.licenseUrl ? (
                    <a
                      href={selection.photo.licenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 inline-flex min-h-11 items-center text-[var(--brand-coral-strong)]"
                    >
                      {selection.photo.license}
                    </a>
                  ) : (
                    <p>{selection.photo.license}</p>
                  )}
                </footer>
              </>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
