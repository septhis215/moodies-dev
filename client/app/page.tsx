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
import QuickStartSection from '@/components/sections/QuickStartSection';

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

export default async function LandingPage() {
  const all = await fetchFeatured();
  return (
    <main className="min-h-screen overflow-x-hidden bg-black [scroll-padding-top:var(--mobile-nav-safe)]">
      <HeroCarousel all={all} />
      <QuickStartSection />
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
