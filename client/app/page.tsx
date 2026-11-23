// src/app/page.tsx
import { Suspense } from "react";
import type { All } from "@/types/all";
import HeroCarousel from "@/components/hero/heroCarousel";
import TrendingSection from "@/components/sections/TrendingSection";
import PremiereHighlights from "@/components/sections/PremiereHighlights";
import CommunityPicks from "@/components/sections/CommunityPicks";
import { UpcomingTrailers } from "@/components/sections/UpcomingTrailers";
import MoodDiscoverySection from "@/components/sections/MoodDiscoverySection";
import LandingPersonalSection from "@/components/sections/LandingPersonalSection";
import { HeroSkeleton, LoadingRegion } from "@/components/loading/PageSkeleton";
import DeferredSection from "@/components/sections/DeferredSection";

async function fetchFeatured() {
  const base = process.env.NEST_API_URL || "https://dev.api.moodies.tech/api";
  try {
    const res = await fetch(`${base}/all/featured?limit=25`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json as All[];
  } catch {
    return [];
  }
}

async function FeaturedHero() {
  const all = await fetchFeatured();
  return <HeroCarousel all={all} />;
}

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--surface-0)] text-[var(--ink)] [scroll-padding-top:var(--mobile-nav-safe)]">
      <Suspense fallback={<LoadingRegion label="Loading featured titles"><HeroSkeleton /></LoadingRegion>}>
        <FeaturedHero />
      </Suspense>
      <div className="homepage-browse">
        <div className="homepage-chapter">
          <TrendingSection />
        </div>
        <div className="homepage-chapter">
          <DeferredSection id="curated-picks" label="Curated for you" keepAnchor><LandingPersonalSection /></DeferredSection>
          <MoodDiscoverySection variant="teaser" />
        </div>
        <div className="homepage-chapter">
          <DeferredSection id="premiere" label="Fresh Off the Screen"><PremiereHighlights /></DeferredSection>
          <DeferredSection id="upcoming" label="Coming Soon"><UpcomingTrailers /></DeferredSection>
          <DeferredSection id="community" label="Community picks worth a look"><CommunityPicks /></DeferredSection>
        </div>
      </div>
    </main>
  );
}
