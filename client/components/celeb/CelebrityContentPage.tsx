"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { tmdbImage } from "@/lib/tmdb";
import useCelebrityResource from "./useCelebrityResource";
import CelebrityProfileNav from "./CelebrityProfileNav";
import CelebrityNewsFeed from "./CelebrityNewsFeed";
import CelebrityMediaSections from "./CelebrityMediaSections";

type Person = {
  id: number;
  name: string;
  profile_path?: string | null;
  known_for_department?: string;
  images?: { profiles?: { file_path: string }[] };
};
export default function CelebrityContentPage({
  id,
  section,
}: {
  id: number;
  section: "news" | "videos" | "photos";
}) {
  const {
    data: person,
    error,
    loading,
    retry,
  } = useCelebrityResource<Person>(`/people/${id}`);
  return (
    <div className="min-h-screen bg-[var(--surface-0)] pb-12 text-[var(--ink)]">
      <div className="ui-shell pt-6 sm:pt-8 lg:pt-24">
        <Link
          href={`/celeb/${id}`}
          className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to profile
        </Link>
        {loading ? (
          <div
            className="ui-panel moodies-skeleton h-48 motion-reduce:animate-none"
            role="status"
            aria-label="Loading celebrity"
          />
        ) : error || !person?.id || !person.name ? (
          <div className="ui-panel p-6" role="status">
            <h1 className="text-3xl font-bold">This profile couldn’t load</h1>
            <p className="mt-3 text-sm text-[var(--ink-muted)]">
              Try again or find another person in the directory.
            </p>
            <button
              type="button"
              className="ui-secondary-action mt-4"
              onClick={retry}
            >
              Try again
            </button>
            <Link
              href="/celeb/explore"
              className="ui-secondary-action ml-3 mt-4"
            >
              Explore people
            </Link>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-5">
              <Image
                src={
                  tmdbImage(person.profile_path, "w185") ||
                  "/placeholder-person.svg"
                }
                alt={person.name}
                width={80}
                height={104}
                className="h-26 w-20 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0">
                <p className="ui-kicker">
                  {person.known_for_department || "Celebrity hub"}
                </p>
                <h1 className="mt-3 break-words text-4xl font-bold leading-tight sm:text-5xl">
                  {person.name}
                  <span className="block text-[var(--ink-muted)]">
                    {section === "news"
                      ? "In the news"
                      : section === "videos"
                        ? "Recent videos"
                        : "Photo gallery"}
                  </span>
                </h1>
              </div>
            </header>
            <CelebrityProfileNav id={id} active={section} />
            {section === "news" ? (
              <section
                className="py-8 sm:py-10"
                aria-label={`${person.name} news`}
              >
                <p className="mb-5 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
                  Recent headlines matched to {person.name}, with the original
                  publisher and publication date.
                </p>
                <CelebrityNewsFeed personId={id} />
              </section>
            ) : (
              <CelebrityMediaSections
                key={`${id}-${section}`}
                person={person}
                view={section}
                latest={section === "videos"}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
