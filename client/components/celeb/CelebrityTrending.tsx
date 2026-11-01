"use client";

import Link from "next/link";
import { useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { tmdbImage } from "@/lib/tmdb";
import type { CelebrityHub } from "@/types/celebrityNews";
import useCelebrityResource from "./useCelebrityResource";

export default function CelebrityTrending() {
  const [brokenPortraits, setBrokenPortraits] = useState<Set<number>>(
    new Set(),
  );
  const { data, error, loading, retry } =
    useCelebrityResource<CelebrityHub>("/people/hub");
  const people = Array.isArray(data?.people) ? data.people : [];
  if (loading)
    return (
      <div
        role="status"
        aria-label="Loading trending celebrities"
        className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6"
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="ui-panel moodies-skeleton aspect-[3/4] motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  if (error || !people.length)
    return (
      <div
        className="ui-panel p-5 text-sm text-[var(--ink-muted)]"
        role="status"
      >
        <p>
          Trending people couldn’t load. Search the directory to find someone
          you love to watch.
        </p>
        <button
          type="button"
          onClick={retry}
          className="ui-secondary-action mt-4"
        >
          Try again
        </button>
      </div>
    );
  return (
    <>
      {data?.status === "stale" && (
        <p className="mb-4 text-sm text-[var(--ink-muted)]">
          Showing the last available TMDB trend snapshot.
        </p>
      )}
      <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-6">
        {people.map((person, index) => (
          <Link
            key={person.id}
            href={`/celeb/${person.id}`}
            className="group min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral-strong)]"
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-[var(--surface-2)]">
              <Image
                src={
                  (!brokenPortraits.has(person.id) &&
                    tmdbImage(person.profile_path, "w342")) ||
                  "/placeholder-person.svg"
                }
                alt={person.name}
                fill
                sizes="(max-width: 639px) 30vw, (max-width: 1023px) 22vw, 180px"
                className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
                onError={() =>
                  setBrokenPortraits(
                    (previous) => new Set([...previous, person.id]),
                  )
                }
              />
              <span
                className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-xs font-semibold text-white"
                aria-label={`Trending pick ${index + 1}`}
              >
                {index + 1}
              </span>
            </div>
            <h3 className="mt-3 break-words text-sm font-semibold leading-5 group-hover:text-[var(--brand-coral-strong)]">
              {person.name}
            </h3>
            <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
              {person.trending_title
                ? `From ${person.trending_title}`
                : person.known_for_department}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
