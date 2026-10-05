"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Shuffle, X } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { tmdbImage } from "@/lib/tmdb";
import type { CelebrityPhoto } from "@/types/celebrityMedia";

type Profile = {
  id: number;
  name: string;
  profile_path?: string | null;
  images?: {
    profiles?: Array<{
      file_path: string;
      aspect_ratio?: number;
      width?: number;
      height?: number;
    }>;
  };
};

export default function CelebrityPortrait({
  person,
  extraPhotos,
}: {
  person: Profile;
  extraPhotos: CelebrityPhoto[];
}) {
  const [rejected, setRejected] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = useRef<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const pool = useMemo(() => {
    const profiles = (person.images?.profiles || []).filter(
      (image) =>
        (!image.aspect_ratio ||
          (image.aspect_ratio >= 0.5 && image.aspect_ratio <= 0.85)) &&
        (!image.width || image.width >= 300),
    );
    const paths = [
      ...new Set([
        ...profiles.map((image) => image.file_path),
        ...(person.profile_path ? [person.profile_path] : []),
      ]),
    ];
    const photos: CelebrityPhoto[] = paths.map((path) => ({
      id: `tmdb:${path}`,
      url: tmdbImage(path, "original")!,
      thumbnail: tmdbImage(path, "w500")!,
      title: `${person.name} portrait`,
      width: profiles.find((image) => image.file_path === path)?.width || 0,
      height: profiles.find((image) => image.file_path === path)?.height || 0,
      source: "tmdb",
      sourceUrl: `https://www.themoviedb.org/person/${person.id}`,
      attribution: "TMDB",
      license: "TMDB image",
      relevanceScore: 1,
    }));
    // Group performances and landscapes belong in the gallery, not the profile portrait.
    const usablePhotos = photos.filter((photo) => !rejected.has(photo.url));
    const candidates = usablePhotos.length
      ? usablePhotos
      : extraPhotos.filter(
          (photo) =>
            photo.width > 0 &&
            photo.height / photo.width >= 1.15 &&
            photo.height / photo.width <= 2,
        );
    return candidates.filter((photo) => !rejected.has(photo.url));
  }, [person, extraPhotos, rejected]);
  const photo = pool.find((candidate) => candidate.url === selected);
  const storageKey = `moodies:portrait:${person.id}`;

  useEffect(() => {
    if (!pool.length || pool.some((photo) => photo.url === chosen.current))
      return;
    let previous: string | null = null;
    try {
      previous = localStorage.getItem(storageKey);
    } catch {
      /* Portraits also work with storage disabled. */
    }
    const choices =
      pool.length > 1 ? pool.filter((photo) => photo.url !== previous) : pool;
    const next = choices[Math.floor(Math.random() * choices.length)];
    chosen.current = next.url;
    setSelected(next.url);
    try {
      localStorage.setItem(storageKey, next.url);
    } catch {
      /* Optional visit history. */
    }
  }, [pool, storageKey]);

  function shuffle() {
    const choices = pool.filter((candidate) => candidate.url !== selected);
    if (!choices.length) return;
    const next = choices[Math.floor(Math.random() * choices.length)];
    chosen.current = next.url;
    setSelected(next.url);
    try {
      localStorage.setItem(storageKey, next.url);
    } catch {
      /* Optional visit history. */
    }
  }

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (expanded && !element.open) element.showModal();
    if (!expanded && element.open) element.close();
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setExpanded(true)}
        disabled={!photo}
        aria-label={`View ${person.name}'s portrait`}
        className="relative block aspect-[3/4] w-full overflow-hidden rounded-lg bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral-strong)]"
      >
        <Image
          key={photo?.url || "placeholder"}
          src={photo?.thumbnail || "/placeholder-person.svg"}
          alt={person.name}
          fill
          priority
          unoptimized
          sizes="(max-width: 639px) 104px, (max-width: 1023px) 180px, 240px"
          className="object-cover"
          onError={() => {
            if (photo)
              setRejected((previous) => new Set(previous).add(photo.url));
          }}
        />
      </button>
      {pool.length > 1 && (
        <button
          type="button"
          onClick={shuffle}
          aria-label={`Shuffle ${person.name}'s profile photo`}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-md text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
        >
          <Shuffle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Change photo
        </button>
      )}
      {photo && photo.source !== "tmdb" && (
        <a
          href={photo.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block break-words text-xs leading-5 text-[var(--ink-muted)] underline"
        >
          {photo.attribution} · {photo.license}
        </a>
      )}
      <dialog
        ref={dialog}
        aria-label={`${person.name} portrait`}
        onCancel={() => setExpanded(false)}
        onClose={() => setExpanded(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setExpanded(false);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-lg border border-[var(--surface-border)] bg-[var(--surface-0)] p-0 text-[var(--ink)] backdrop:bg-black/85"
      >
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-[var(--surface-border)] px-4">
          <h2 className="min-w-0 truncate text-xl font-bold">{person.name}</h2>
          <button
            type="button"
            autoFocus
            aria-label="Close portrait"
            onClick={() => setExpanded(false)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        {photo && (
          <>
            <div className="relative h-[65dvh] bg-black">
              <Image
                src={photo.url}
                alt={person.name}
                fill
                unoptimized
                sizes="(max-width: 767px) 90vw, 768px"
                className="object-contain"
              />
            </div>
            <a
              href={photo.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 text-xs leading-5 text-[var(--ink-muted)] underline"
            >
              {photo.attribution} · {photo.license}
            </a>
          </>
        )}
      </dialog>
    </div>
  );
}
