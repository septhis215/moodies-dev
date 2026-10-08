"use client";

import { BadgeMascot } from "@/components/ui/BadgeMascot";
import Link from "next/link";
import { ArrowRight, Brain, Film, Tv } from "lucide-react";
import MoodNightPreview from "./MoodNightPreview";

type MoodDiscoverySectionProps = {
  variant?: "full" | "teaser";
};

const discoveryPaths = [
  {
    title: "Movie mood matcher",
    description: "Find a film for tonight’s feeling.",
    href: "/movies#moods",
    icon: Film,
  },
  {
    title: "TV mood matcher",
    description: "Find a series to settle into.",
    href: "/tv#moods",
    icon: Tv,
  },
  {
    title: "Personality Quiz",
    description: "Not sure? Let your taste lead the way.",
    href: "/quiz",
    icon: Brain,
  },
];

export default function MoodDiscoverySection({
  variant = "full",
}: MoodDiscoverySectionProps) {
  if (variant === "teaser") return <MoodNightPreview />;

  return (
    <section
      id="your-moods"
      className="ui-shell py-8 sm:py-10"
      aria-labelledby="mood-discovery-heading"
    >
      <header className="mb-6 max-w-3xl sm:mb-8">
        <p className="ui-kicker">Find your next watch</p>
        <h1
          id="mood-discovery-heading"
          className="mt-2 text-balance text-4xl font-bold leading-none text-[var(--ink)] sm:text-5xl"
        >
          What are you in the mood for?
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
          Find a movie or TV show that fits tonight. Let a feeling lead the way.
        </p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10">
        <section
          className="min-w-0 py-2 sm:py-4"
          aria-labelledby="mood-wheel-heading"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-x-4 gap-y-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:gap-x-6">
            <div>
              <p className="ui-kicker">Start here</p>
              <h2
                id="mood-wheel-heading"
                className="mt-2 text-2xl font-bold leading-none text-[var(--ink)] sm:text-3xl"
              >
                Mood wheel
              </h2>
            </div>
            <BadgeMascot
              name="mood-explorer"
              alt="Mood wheel explorer"
              reaction="Every feeling opens a new story."
              sizes="(max-width: 639px) 96px, 192px"
              className="mx-auto h-24 w-24 object-contain sm:col-start-2 sm:row-span-3 sm:row-start-1 sm:h-48 sm:w-48"
              priority
            />
            <p className="col-span-2 max-w-md text-sm leading-6 text-[var(--ink-muted)] sm:col-span-1">
              Cozy, thrilling, or a little out of the ordinary? Pick your mood,
              or spin the wheel when you want a surprise.
            </p>
            <div className="col-span-2 mt-2 flex flex-col items-start gap-3 sm:col-span-1 sm:mt-3">
              <Link
                href="/moods"
                className="ui-primary-action w-full justify-center text-[var(--surface-0)] shadow-none transition-colors hover:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface-0)] motion-reduce:transition-none sm:w-auto"
              >
                Find a watch by mood
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <p className="text-sm leading-6 text-[var(--ink-muted)]">
                Movie and TV recommendations. No account needed.
              </p>
            </div>
          </div>
        </section>

        <section
          className="border-t border-[var(--surface-border)] pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-4"
          aria-labelledby="discovery-paths-heading"
        >
          <h2
            id="discovery-paths-heading"
            className="mb-1 text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl"
          >
            Other ways to explore
          </h2>
          <ul>
            {discoveryPaths.map(({ title, description, href, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group flex min-h-20 items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-[var(--surface-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-strong)] motion-reduce:transition-none"
                >
                  <Icon
                    className="h-5 w-5 shrink-0 text-[var(--ink-muted)] group-hover:text-[var(--brand-coral-strong)]"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold leading-tight text-[var(--ink)] group-hover:text-[var(--brand-coral-strong)]">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-[var(--ink-muted)]">
                      {description}
                    </p>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-[var(--ink-muted)]"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="mt-8 border-t border-[var(--surface-border)] pt-5 sm:mt-10">
        <p className="max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
          <span className="font-semibold text-[var(--ink)]">
            Discover here. Watch on your favourite service.
          </span>{" "}
          Moodies recommends movies and TV shows; it does not stream full movies
          or episodes.
        </p>
      </footer>
    </section>
  );
}
