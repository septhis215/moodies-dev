// src/app/page.tsx
import React from 'react';
import type { All } from '@/types/all';
import HeroCarousel from '@/components/hero/heroCarousel';
import TrendingSection from "@/components/sections/TrendingSection";
import PremiereHighlights from "@/components/sections/PremiereHighlights";
import FavoritesSection from "@/components/sections/FavoriteSection";
import KoreaTrendingSection from '@/components/sections/KoreanSection';
import CelebSection from '@/components/sections/CelebsSection';
import CommunityPicks from '@/components/sections/CommunityPicks';
import { UpcomingTrailers } from '@/components/sections/UpcomingTrailers';
import MoodDiscoverySection from '@/components/sections/MoodDiscoverySection';
import ImmersiveFeedSection from '@/components/sections/ImmersiveFeedSection';
import FootballStoriesSection from '@/components/sections/FootballStoriesSection';
import Link from 'next/link';
import { Brain, Clapperboard, Heart, Sparkles, Tv } from 'lucide-react';

async function fetchFeatured() {
  const base = process.env.NEST_API_URL || 'http://localhost:4000';
  try {
    const res = await fetch(`${base}/all/featured`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json as All[];
  } catch {
    return [];
  }
}

const mobileActions = [
  {
    label: "Movies",
    href: "/movies",
    description: "Cinema picks",
    icon: Clapperboard,
  },
  { label: "Series", href: "/tv", description: "Binge-worthy shows", icon: Tv },
  {
    label: "Moods",
    href: "/moods/explore",
    description: "Choose a vibe",
    icon: Heart,
  },
  { label: "Quiz", href: "/quiz", description: "Get matched fast", icon: Brain },
];

export default async function LandingPage() {
  const all = await fetchFeatured();
  return (
    <main className="min-h-screen overflow-x-hidden bg-black [scroll-padding-top:var(--mobile-nav-safe)]">
      <HeroCarousel all={all} />
      <section className="mx-auto -mt-6 max-w-7xl px-4 pb-2 pt-9 sm:hidden">
        <div className="relative z-30 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 p-3 shadow-2xl shadow-black/60">
          <div className="mb-3 flex items-center gap-2 px-1">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#e94f37]/15 text-[#ff6b58]">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black leading-tight text-white">
                Start your Moodies night
              </p>
              <p className="truncate text-xs text-zinc-500">
                Jump into a path that matches your mood.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {mobileActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex min-h-16 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-white transition active:scale-[0.98]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e94f37]/15 text-[#ff6b58]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black leading-tight">
                      {action.label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">
                      {action.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      <TrendingSection />
      <PremiereHighlights />
      <FavoritesSection />
      <FootballStoriesSection />
      <ImmersiveFeedSection />
      <KoreaTrendingSection />
      <MoodDiscoverySection variant="teaser" />
      <CelebSection />
      <CommunityPicks />
      <UpcomingTrailers />
    </main>
  );
}
