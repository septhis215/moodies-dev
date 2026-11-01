"use client";

import { useState } from "react";
import Link from "next/link";
import useCelebrityResource from "./useCelebrityResource";
import CelebrityMediaSections from "./CelebrityMediaSections";
import type { CelebrityHub } from "@/types/celebrityNews";

export default function CelebrityVideoBrowser() {
  const { data, error, loading, retry } =
    useCelebrityResource<CelebrityHub>("/people/hub");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const people = Array.isArray(data?.people) ? data.people : [];
  const person = people.find((entry) => entry.id === selectedId) || people[0];
  if (loading)
    return (
      <div
        className="ui-panel moodies-skeleton h-72 motion-reduce:animate-none"
        role="status"
        aria-label="Loading people for videos"
      />
    );
  if (error || !person)
    return (
      <div className="ui-panel p-6" role="status">
        <p>People couldn’t load right now.</p>
        <button
          type="button"
          className="ui-secondary-action mt-4"
          onClick={retry}
        >
          Try again
        </button>
      </div>
    );
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="grid max-w-full gap-2 text-sm text-[var(--ink-muted)]">
          Choose a trending person
          <select
            value={person.id}
            onChange={(event) => setSelectedId(Number(event.target.value))}
            className="min-h-11 max-w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-1)] px-3 text-base text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
          >
            {people.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <Link
          href={`/celeb/${person.id}/videos`}
          className="ui-secondary-action"
        >
          Open {person.name}’s videos
        </Link>
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">
        Looking for someone else?{" "}
        <Link
          href="/celeb/explore"
          className="text-[var(--brand-coral-strong)] underline underline-offset-4"
        >
          Search the celebrity directory
        </Link>
        .
      </p>
      <CelebrityMediaSections
        key={person.id}
        person={person}
        view="videos"
        latest
      />
    </div>
  );
}
