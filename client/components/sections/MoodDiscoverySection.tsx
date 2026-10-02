"use client";

import { useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import { ArrowRight, Brain, Compass, Film, Tv } from "lucide-react";

type MoodDiscoverySectionProps = {
  variant?: "full" | "teaser";
};

const cards = [
  {
    id: "wheel",
    title: "Mood Wheels",
    subtitle: "Start with a feeling",
    description:
      "Spin through emotional cues and land on a watchlist-ready vibe.",
    href: "/moods",
    icon: Compass,
    image: "/images/moods/whimsy.png",
    accent: "#e94f37",
    stats: "50+ moods",
  },
  {
    id: "tv-moods",
    title: "TV Matcher",
    subtitle: "Settle into a series",
    description:
      "Find shows that match your current energy, pace, and comfort zone.",
    href: "/tv#moods",
    icon: Tv,
    image: "/images/moods/cozy.png",
    accent: "#38bdf8",
    stats: "series picks",
  },
  {
    id: "movie-moods",
    title: "Movie Matcher",
    subtitle: "Pick tonight's tone",
    description:
      "Move from chaos, comfort, romance, or thrills into the right film.",
    href: "/movies#moods",
    icon: Film,
    image: "/images/moods/epic.png",
    accent: "#f59e0b",
    stats: "film picks",
  },
  {
    id: "quiz",
    title: "Personality Quiz",
    subtitle: "Let Moodies read the room",
    description:
      "Answer quick prompts and get recommendations tuned to your taste.",
    href: "/quiz",
    icon: Brain,
    image: "/images/moods/mind-bending.png",
    accent: "#a78bfa",
    stats: "guided match",
  },
];

const landingMoods = [
  {
    id: "easy",
    label: "Easy",
    note: "Low-stakes, comforting watches for a quiet night.",
  },
  {
    id: "tense",
    label: "Tense",
    note: "Pressure, suspense, and stories that keep moving.",
  },
  {
    id: "tender",
    label: "Tender",
    note: "Warm, intimate stories with something human at the center.",
  },
  {
    id: "strange",
    label: "Strange",
    note: "Unfamiliar worlds, odd turns, and singular ideas.",
  },
  {
    id: "electric",
    label: "Electric",
    note: "Fast, loud, kinetic picks for a high-energy watch.",
  },
];

export default function MoodDiscoverySection({
  variant = "full",
}: MoodDiscoverySectionProps) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [activeLandingMood, setActiveLandingMood] = useState(
    landingMoods[0].id,
  );
  const activeCard = cards.find((card) => card.id === hoveredCard) ?? cards[0];
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
        <div className="grid gap-6 lg:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.28fr)] lg:items-end lg:gap-12">
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

          <div>
            <div
              className="flex gap-5 overflow-x-auto border-b border-[var(--surface-border)] pb-3 mobile-native-scroll sm:gap-7"
              aria-label="Choose a mood"
            >
              {landingMoods.map((mood) => {
                const isActive = mood.id === activeMood.id;
                return (
                  <button
                    key={mood.id}
                    type="button"
                    onClick={() => setActiveLandingMood(mood.id)}
                    onMouseEnter={() => setActiveLandingMood(mood.id)}
                    onFocus={() => setActiveLandingMood(mood.id)}
                    className={`shrink-0 border-b-2 pb-2 text-lg font-semibold transition-colors sm:text-xl ${
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

            <div className="mt-4 flex min-h-12 items-start justify-between gap-5">
              <p className="max-w-xl text-sm leading-6 text-[var(--ink-muted)]">
                {activeMood.note}
              </p>
              <Link
                href="/moods"
                className="inline-flex shrink-0 items-center gap-2 border-b border-[var(--brand-coral)] pb-1 text-sm font-semibold text-[var(--ink)] transition-colors hover:text-[var(--brand-coral-strong)]"
              >
                Find my watch
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="your-moods"
      className="relative mx-auto max-w-7xl overflow-hidden bg-black px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
    >
      <div className="grid gap-8 rounded-2xl border border-white/10 bg-neutral-950/75 p-4 shadow-2xl shadow-black/30 sm:p-6 lg:grid-cols-[0.95fr_1.35fr] lg:p-8">
        <div className="flex flex-col justify-between gap-8">
          <div>
            <h2 className="mt-5 max-w-xl text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
              Find what fits the mood before you search by title.
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
              Moodies turns feelings into watchable paths: quick prompts, mascot
              cues, and recommendations that match how you actually want the
              night to feel.
            </p>
          </div>

          <div className="relative min-h-[220px] overflow-hidden rounded-xl border border-white/10 bg-black/40 sm:min-h-[260px]">
            <Image
              src={activeCard.image}
              alt="Moodies mascot"
              fill
              sizes="(max-width: 1024px) 100vw, 420px"
              className="object-contain object-right-bottom opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/65 to-transparent" />
            <div className="absolute left-4 top-4 max-w-[220px] sm:left-5 sm:top-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ff8b78]">
                Current signal
              </p>
              <h3 className="mt-2 text-xl font-bold text-white">
                {activeCard.subtitle}
              </h3>
              <p className="mt-2 text-sm leading-5 text-gray-400">
                {activeCard.description}
              </p>
            </div>
            <div
              className="absolute bottom-4 left-4 h-1.5 w-28 overflow-hidden rounded-full bg-white/10 sm:left-5"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: hoveredCard ? "100%" : "42%",
                  backgroundColor: activeCard.accent,
                }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;
            const isHovered = hoveredCard === card.id;

            return (
              <Link
                key={card.id}
                href={card.href}
                className="group relative min-h-[190px] overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] p-4 transition duration-200 hover:border-white/25 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#e94f37]/40 sm:min-h-[220px] sm:p-5"
                onMouseEnter={() => setHoveredCard(card.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div
                  className="absolute inset-x-0 top-0 h-1 transition-opacity"
                  style={{
                    backgroundColor: card.accent,
                    opacity: isHovered ? 1 : 0.55,
                  }}
                />
                <Image
                  src={card.image}
                  alt={`${card.title} mood`}
                  width={108}
                  height={108}
                  className="absolute bottom-3 right-3 h-20 w-20 object-contain opacity-25 transition duration-200 group-hover:opacity-45 sm:h-24 sm:w-24"
                />

                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-black/35"
                      style={{ color: card.accent }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-black/35 px-2 py-1 text-[11px] font-semibold text-gray-300 ring-1 ring-white/10">
                      {card.stats}
                    </span>
                  </div>

                  <div className="mt-5 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                      {card.subtitle}
                    </p>
                    <h3 className="mt-2 text-xl font-black leading-tight text-white">
                      {card.title}
                    </h3>
                    <p className="mt-2 max-w-[28ch] text-sm leading-5 text-gray-400">
                      {card.description}
                    </p>
                  </div>

                  <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-white">
                    Explore
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
