"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { tmdbImage } from "@/lib/tmdb";
import type {
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
type Profile = {
  id: number;
  name: string;
  profile_path?: string | null;
  images?: { profiles?: Array<{ file_path: string; aspect_ratio?: number }> };
};
type Selection =
  | { kind: "photo"; photo: CelebrityPhoto }
  | { kind: "video"; video: CelebrityVideo };
function durationLabel(value: string | null) {
  const match = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  return hours
    ? `${hours}:${(minutes || "0").padStart(2, "0")}:${(seconds || "0").padStart(2, "0")}`
    : `${minutes || "0"}:${(seconds || "0").padStart(2, "0")}`;
}
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
function Thumbnail({ video }: { video: CelebrityVideo }) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      src={failed ? "/placeholder-backdrop.svg" : video.thumbnail}
      alt=""
      fill
      unoptimized
      sizes="(max-width: 639px) 90vw, 640px"
      className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
      onError={() => setFailed(true)}
    />
  );
}
function VideoCard({
  video,
  featured,
  onPlay,
}: {
  video: CelebrityVideo;
  featured?: boolean;
  onPlay: () => void;
}) {
  const duration = durationLabel(video.duration);
  return (
    <article
      className={`ui-panel overflow-hidden ${featured ? "" : "w-[86%] shrink-0 snap-start sm:w-80"}`}
    >
      <button
        type="button"
        className="group relative block aspect-video w-full overflow-hidden bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
        onClick={onPlay}
        aria-label={`Play ${video.title}`}
      >
        <Thumbnail key={video.id} video={video} />
        <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <span className="absolute left-3 top-3 rounded-md bg-black/80 px-2 py-1 text-xs font-semibold text-white">
          {categories[video.category]}
        </span>
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid h-12 w-12 place-items-center rounded-full border border-white/40 bg-black/50 text-white backdrop-blur">
            <Play className="h-5 w-5 fill-current" aria-hidden="true" />
          </span>
        </span>
        {duration && (
          <span className="absolute bottom-3 right-3 rounded bg-black/80 px-2 py-1 text-xs text-white">
            {duration}
          </span>
        )}
      </button>
      <div className="p-4">
        <h3
          className={`line-clamp-2 font-bold leading-tight text-[var(--ink)] ${featured ? "text-lg sm:text-xl" : "text-base"}`}
        >
          {video.title}
        </h3>
        <p className="mt-2 line-clamp-1 text-xs text-[var(--ink-muted)]">
          {video.channel}
          {video.official ? " · Official source" : ""}
        </p>
        {video.context && (
          <p className="mt-1 line-clamp-1 text-xs text-[var(--ink-muted)]">
            From {video.context}
          </p>
        )}
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--brand-coral-strong)]"
        >
          Watch on YouTube{" "}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

export default function CelebrityMediaSections({
  person,
  onPhotosReady,
}: {
  person: Profile;
  onPhotosReady?: (photos: CelebrityPhoto[]) => void;
}) {
  const [media, setMedia] = useState<CelebrityMedia | null>(null);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(Boolean(onPhotosReady));
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [category, setCategory] = useState<VideoCategory | "all">("all");
  const [photoLimit, setPhotoLimit] = useState(12);
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
    fetch(`${API_BASE}/people/${person.id}/media`, {
      signal: controller.signal,
    })
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
          setMedia(data);
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
  }, [person, started, retry, onPhotosReady]);
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

  const photos = (
    media?.photos.length ? media.photos : fallbackPhotos(person)
  ).filter((photo) => !brokenPhotos.has(photo.id));
  const videos = (media?.videos || []).filter(
    (video) => category === "all" || video.category === category,
  );
  const [featured, ...supporting] = videos.slice(0, videoLimit);
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
      <section
        ref={section}
        id="on-screen-moments"
        aria-labelledby="celebrity-moments-heading"
        className="mt-10 min-w-0 scroll-mt-24 space-y-5 border-t border-[var(--surface-border)] pt-8 sm:mt-12 sm:pt-10"
      >
        <header>
          <p className="ui-kicker">In the spotlight</p>
          <h2
            id="celebrity-moments-heading"
            className="mt-2 text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
          >
            On-Screen Moments
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
            Interviews, performances and stories from {person.name}’s world.
          </p>
        </header>
        {unavailable && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--ink-muted)]">
            <p>
              Some additional media is temporarily unavailable. Available media
              is shown below.
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
          className="mobile-native-scroll flex gap-2 overflow-x-auto pb-2"
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
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)] ${category === value ? "border-[var(--brand-coral)] bg-[var(--brand-coral)] text-white" : "border-[var(--surface-border)] text-[var(--ink-muted)]"}`}
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
            <div className="ui-panel aspect-video motion-safe:animate-pulse" />
            <div className="ui-panel aspect-video motion-safe:animate-pulse" />
          </div>
        ) : featured ? (
          <>
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <VideoCard
                video={featured}
                featured
                onPlay={() => setSelection({ kind: "video", video: featured })}
              />
              {supporting.length > 0 && (
                <div className="min-w-0">
                  <p className="mb-3 text-sm font-semibold text-[var(--ink-muted)]">
                    More moments · swipe to explore
                  </p>
                  <div className="mobile-native-scroll flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-3">
                    {supporting.map((video) => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        onPlay={() => setSelection({ kind: "video", video })}
                      />
                    ))}
                  </div>
                </div>
              )}
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
              : "No confidently matched moments are available yet. Explore the filmography below for more of their work."}
          </div>
        )}
      </section>
      <section
        id="gallery"
        aria-labelledby="celebrity-gallery-heading"
        className="mt-10 scroll-mt-24 space-y-5 border-t border-[var(--surface-border)] pt-8 sm:mt-12 sm:pt-10"
      >
        <header>
          <p className="ui-kicker">Through the lens</p>
          <h2
            id="celebrity-gallery-heading"
            className="mt-2 text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
          >
            Photo Gallery
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
            Portraits and public appearances. Open a photo for the full view and
            source credits.
          </p>
        </header>
        {photos.length > 0 ? (
          <>
            <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
              {photos.slice(0, photoLimit).map((photo, index) => (
                <article
                  key={photo.id}
                  className="ui-panel mb-3 break-inside-avoid overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setSelection({ kind: "photo", photo })}
                    className="group block w-full overflow-hidden focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
                    aria-label={`Open photo ${index + 1}: ${photo.title}`}
                  >
                    <Image
                      src={photo.thumbnail}
                      alt={photo.title}
                      width={photo.width}
                      height={photo.height}
                      unoptimized
                      sizes="(max-width: 639px) 45vw, (max-width: 1023px) 30vw, 300px"
                      className="h-auto w-full transition-transform duration-500 motion-safe:group-hover:scale-105"
                      onError={() =>
                        setBrokenPhotos(
                          (previous) => new Set([...previous, photo.id]),
                        )
                      }
                    />
                  </button>
                  <div className="p-3">
                    <p className="line-clamp-2 text-xs leading-5 text-[var(--ink-muted)]">
                      {photo.attribution}
                    </p>
                    <a
                      href={photo.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-[var(--brand-coral-strong)]"
                    >
                      {photo.source === "wikimedia" ? photo.license : "TMDB"}
                      <ArrowUpRight
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                    </a>
                  </div>
                </article>
              ))}
            </div>
            {photos.length > photoLimit && (
              <button
                type="button"
                className="ui-secondary-action"
                onClick={() => setPhotoLimit((value) => value + 12)}
              >
                Load more photos ({photos.length - photoLimit})
              </button>
            )}
          </>
        ) : loading || !started ? (
          <div
            role="status"
            aria-label="Loading celebrity photos"
            className="ui-panel h-64 motion-safe:animate-pulse"
          />
        ) : (
          <div className="ui-panel p-5 text-sm text-[var(--ink-muted)]">
            No confidently matched photos are available yet.
          </div>
        )}
      </section>
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
        className="fixed m-auto max-h-[94dvh] w-[94vw] max-w-5xl overflow-y-auto rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-0)] p-0 text-[var(--ink)] backdrop:bg-black/90"
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
                {selection.video.canEmbed ? (
                  <iframe
                    key={selection.video.id}
                    src={`https://www.youtube.com/embed/${selection.video.id}?autoplay=1&rel=0`}
                    title={selection.video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="aspect-video min-h-[200px] w-full"
                  />
                ) : (
                  <div className="p-5 text-sm text-[var(--ink-muted)]">
                    This moment opens on YouTube.
                  </div>
                )}
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
                    Playback unavailable? Watch on YouTube{" "}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
              </>
            ) : (
              <>
                <div className="relative h-[65dvh] w-full">
                  <Image
                    key={selection.photo.id}
                    src={selection.photo.url}
                    alt={selection.photo.title}
                    fill
                    unoptimized
                    sizes="94vw"
                    className="object-contain"
                  />
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
                    Source:{" "}
                    {selection.photo.source === "wikimedia"
                      ? "Wikimedia Commons"
                      : "TMDB"}
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
