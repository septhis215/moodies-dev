"use client";

import { useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Compass,
  Film,
  Tv,
} from "lucide-react";

type MoodDiscoverySectionProps = {
  variant?: "full" | "teaser";
};

const cards = [
  {
    id: "wheel",
    title: "Mood Wheels",
    subtitle: "Start with a feeling",
    description: "Spin through emotional cues and land on a watchlist-ready vibe.",
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
    description: "Find shows that match your current energy, pace, and comfort zone.",
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
    description: "Move from chaos, comfort, romance, or thrills into the right film.",
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
    description: "Answer quick prompts and get recommendations tuned to your taste.",
    href: "/quiz",
    icon: Brain,
    image: "/images/moods/mind-bending.png",
    accent: "#a78bfa",
    stats: "guided match",
  },
];

export default function MoodDiscoverySection({ variant = "full" }: MoodDiscoverySectionProps) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const activeCard = cards.find((card) => card.id === hoveredCard) ?? cards[0];

  if (variant === "teaser") {
    return (
      <section
        id="your-moods"
        className="relative mx-auto max-w-7xl scroll-mt-24 overflow-hidden bg-black px-4 py-9 sm:px-6 lg:px-8"
      >
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/80 p-4 shadow-2xl shadow-black/30 sm:p-6 lg:p-7">
          <div className="absolute bottom-0 right-0 h-32 w-32 opacity-15 sm:inset-y-0 sm:h-auto sm:w-72 sm:opacity-25">
            <Image
              src="/images/moods/romantic.png"
              alt="Romantic mood mascot"
              fill
              sizes="288px"
              className="object-contain object-right-bottom opacity-25"
            />
          </div>
          <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ff8b78]">
                Mood paths
              </p>
              <h2 className="mt-2 text-[1.45rem] font-black leading-tight tracking-tight text-white sm:mt-3 sm:text-3xl">
                Start with the feeling, then choose the route.
              </h2>
              <p className="mt-2 max-w-[34ch] text-[13px] leading-6 text-zinc-400 sm:mt-3 sm:max-w-none sm:text-base">
                Spin the wheel, take the quiz, or jump straight into movie and series mood matchers.
              </p>
            </div>

            <div className="relative grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3 lg:justify-end">
              {cards.slice(0, 4).map((card) => {
                const Icon = card.icon;
                return (
                  <Link
                    key={card.id}
                    href={card.href}
                    className="group inline-flex min-h-[4.25rem] min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-3 text-white transition hover:border-white/25 hover:bg-white/[0.075] sm:min-w-[140px] sm:flex-none sm:rounded-lg"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/35"
                      style={{ color: card.accent }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">{card.title}</span>
                      <span className="block truncate text-xs text-zinc-500">{card.stats}</span>
                    </span>
                    <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-zinc-500 transition group-hover:translate-x-1 group-hover:text-white" />
                  </Link>
                );
              })}
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
              Moodies turns feelings into watchable paths: quick prompts,
              mascot cues, and recommendations that match how you actually want
              the night to feel.
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
