"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const heroMoods = [
  { name: "Cozy", slug: "cozy", note: "A little comfort" },
  { name: "Funny", slug: "funny", note: "Room for a laugh" },
  { name: "Thrilling", slug: "thrilling", note: "Something gripping" },
  {
    name: "Mind-Bending",
    slug: "mind-bending",
    note: "A different perspective",
  },
] as const;

export type HeroMoodRequest = { name: string; revision: number };

type Props = {
  mediaType?: "movie" | "tv" | "both";
  onMoodSelect?: (name: string) => void;
};

/** A discovery entry point, not a mood classification of the featured title. */
export function HeroMoodGuide({ mediaType = "both", onMoodSelect }: Props) {
  const destination = mediaType === "both" ? "#your-moods" : "#moods";

  return (
    <aside
      aria-label="Moodies mood discovery"
      className="min-w-0 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="ui-kicker">A watch for every mood</p>
          <p
            data-display
            className="mt-2 text-2xl font-bold leading-tight text-[var(--ink)] sm:text-3xl"
          >
            Start with a feeling.
          </p>
          <p className="mt-2 text-sm leading-5 text-[var(--ink-muted)]">
            {mediaType === "movie"
              ? "Find a film for the way you feel."
              : mediaType === "tv"
                ? "Find a series for your kind of night."
                : "Your mood comes first. The next watch follows."}
          </p>
        </div>
        <Image
          src="/images/moods/cozy.png"
          alt="Cozy mood mascot"
          width={112}
          height={112}
          sizes="(max-width: 639px) 72px, 112px"
          className="h-18 w-18 shrink-0 object-contain sm:h-28 sm:w-28"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {heroMoods.map((mood) => (
          <Link
            key={mood.slug}
            href={
              mediaType === "both"
                ? `/moods?mood=${encodeURIComponent(mood.name)}`
                : destination
            }
            onClick={() => onMoodSelect?.(mood.name)}
            className="flex min-h-14 min-w-0 items-center gap-2 rounded-lg border border-[var(--surface-border)] px-2 py-2 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brand-coral)] hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)]"
          >
            <Image
              src={`/images/moods/${mood.slug}.png`}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 object-contain"
            />
            <span className="min-w-0 leading-5">{mood.name}</span>
          </Link>
        ))}
      </div>

      <Link
        href={destination}
        className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--brand-coral-strong)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)]"
      >
        Explore all moods <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </aside>
  );
}
