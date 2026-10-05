// src/app/page.tsx
import React from "react";
import type { All } from "@/types/all";
import HeroCarousel from "@/components/hero/heroCarousel";
import TrendingSection from "@/components/sections/TrendingSection";
import PremiereHighlights from "@/components/sections/PremiereHighlights";
import CommunityPicks from "@/components/sections/CommunityPicks";
import { UpcomingTrailers } from "@/components/sections/UpcomingTrailers";
import MoodDiscoverySection from "@/components/sections/MoodDiscoverySection";
import MoodiesIntro from "@/components/sections/MoodiesIntro";

async function fetchFeatured() {
  const base = process.env.NEST_API_URL || "https://dev.api.moodies.tech/api";
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
    <main className="min-h-screen overflow-x-hidden bg-[var(--surface-0)] text-[var(--ink)] [scroll-padding-top:var(--mobile-nav-safe)]">
      <HeroCarousel all={all} />
      <MoodiesIntro />
      <MoodDiscoverySection variant="teaser" />
      <TrendingSection />
      <PremiereHighlights />
      <CommunityPicks />
      <UpcomingTrailers />
    </main>
  );
}
