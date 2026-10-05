"use client";

import { useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import { ArrowRight, Brain, Film, Tv } from "lucide-react";

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

const landingMoods = [
  {
    id: "easy",
    label: "Easy",
    mascot: "cozy",
    mascotName: "Cozy",
    note: "Low-stakes, comforting watches for a quiet night.",
  },
  {
    id: "tense",
    label: "Tense",
    mascot: "thrilling",
    mascotName: "Thrilling",
    note: "Pressure, suspense, and stories that keep moving.",
  },
  {
    id: "tender",
    label: "Tender",
    mascot: "romantic",
    mascotName: "Romantic",
    note: "Warm, intimate stories with something human at the center.",
  },
  {
    id: "strange",
    label: "Strange",
    mascot: "mind-bending",
    mascotName: "Mind-Bending",
    note: "Unfamiliar worlds, odd turns, and singular ideas.",
  },
  {
    id: "electric",
    label: "Electric",
    mascot: "epic",
    mascotName: "Epic",
    note: "Fast, loud, kinetic picks for a high-energy watch.",
  },
];

export default function MoodDiscoverySection({
  variant = "full",
}: MoodDiscoverySectionProps) {
  const [activeLandingMood, setActiveLandingMood] = useState(
    landingMoods[0].id,
  );
  const activeMood =
    landingMoods.find((mood) => mood.id === activeLandingMood) ??
    landingMoods[0];

  if (variant === "teaser") {
    return (
      <section
        id="your-moods"
        className="ui-shell scroll-mt-24 border-b border-[var(--surface-border)] py-8 sm:py-10"
        aria-labelledby="mood-shelf-heading"
      >
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.28fr)] lg:gap-12">
          <div>
            <p className="ui-kicker">Choose by mood</p>
            <h2
              id="mood-shelf-heading"
              className="mt-3 max-w-lg text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
            >
              What kind of night is this?
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-[var(--ink-muted)]">
              Pick a feeling first. Moodies will take you to a focused set of
              movies and series instead of another endless catalogue.
            </p>
          </div>

          <div className="min-w-0">
            <div
              className="grid grid-cols-5 gap-1 border-b border-[var(--surface-border)] pb-2 sm:gap-4"
              role="group"
              aria-label="Choose a mood"
            >
              {landingMoods.map((mood) => {
                const isActive = mood.id === activeMood.id;
                return (
                  <button
                    key={mood.id}
                    type="button"
                    onClick={() => setActiveLandingMood(mood.id)}
                    aria-controls="landing-mood-preview"
                    className={`min-h-11 min-w-0 rounded-sm border-b-2 px-1 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] motion-reduce:transition-none sm:text-xl ${
                      isActive
                        ? "border-[var(--brand-coral)] text-[var(--ink)]"
                        : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    }`}
                    aria-pressed={isActive}
                  >
                    {mood.label}
                  </button>
                );
              })}
            </div>

            <div
              id="landing-mood-preview"
              className="mt-5 grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-x-4 gap-y-3 sm:min-h-36 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center sm:gap-5"
            >
              <div className="relative h-20 w-20 sm:h-32 sm:w-32">
                <Image
                  src={`/images/moods/${activeMood.mascot}.png`}
                  alt={`${activeMood.mascotName} mood mascot`}
                  width={160}
                  height={160}
                  sizes="(max-width: 639px) 80px, 128px"
                  unoptimized
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="contents sm:block">
                <div aria-live="polite" aria-atomic="true">
                  <h3 className="text-base font-bold text-[var(--ink)] sm:text-lg">
                    {activeMood.id === "easy" || activeMood.id === "electric"
                      ? "An"
                      : "A"}{" "}
                    {activeMood.label.toLowerCase()} night
                  </h3>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">
                    {activeMood.note}
                  </p>
                </div>
                <Link
                  href="/moods"
                  className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-[var(--surface-border)] px-3 text-sm font-semibold text-[var(--brand-coral-strong)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] motion-reduce:transition-none sm:mt-3 sm:justify-start sm:border-0 sm:px-0"
                >
                  Explore the mood wheel
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

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
            <Image
              src="/images/moods/whimsy.png"
              alt="Whimsy mood mascot"
              width={240}
              height={240}
              sizes="(max-width: 639px) 96px, 192px"
              className="mx-auto h-24 w-24 object-contain sm:col-start-2 sm:row-span-3 sm:row-start-1 sm:h-48 sm:w-48"
              priority
              unoptimized
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
