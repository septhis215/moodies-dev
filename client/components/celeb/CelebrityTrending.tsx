"use client";

import type { CelebrityHub } from "@/types/celebrityNews";
import useCelebrityResource from "./useCelebrityResource";
import CelebrityPersonCard from "./CelebrityPersonCard";

export default function CelebrityTrending() {
  const { data, error, loading, retry } =
    useCelebrityResource<CelebrityHub>("/people/hub");
  const people = Array.isArray(data?.people) ? data.people : [];
  if (loading)
    return (
      <div
        role="status"
        aria-label="Loading trending celebrities"
        className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6"
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="moodies-skeleton aspect-[4/5] rounded-xl motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  if (error || !people.length)
    return (
      <div
        className="ui-panel p-6 text-sm text-[var(--ink-muted)]"
        role="status"
      >
        <p>Trending people couldn’t load.</p>
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
        <p className="mb-4 text-xs text-[var(--ink-muted)]">
          Showing the last available TMDB snapshot.
        </p>
      )}
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
        {people.slice(0, 12).map((person) => (
          <CelebrityPersonCard
            key={person.id}
            person={person}
            subtitle={person.trending_title || person.known_for_department}
          />
        ))}
      </div>
    </>
  );
}
