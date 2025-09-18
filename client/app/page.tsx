// src/app/page.tsx
import React from 'react';
import type { All } from '@/types/all';
import HeroCarousel from '@/components/hero/heroCarousel';
import TrendingSection from "@/components/sections/TrendingSection";
import PremiereHighlights from "@/components/sections/PremiereHighlights";
import FavoritesSection from "@/components/sections/FavoriteSection";
import KoreaTrendingSection from '@/components/sections/KoreanSection';
import CelebSection from '@/components/sections/CelebsSection';

async function fetchFeatured() {
  const base = process.env.NEST_API_URL || 'http://localhost:4000';
  // cache policy: change revalidate per your needs
  const res = await fetch(`${base}/all/featured`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as All[];
}

export default async function LandingPage() {
  const all = await fetchFeatured();

  return (
    <main className="bg-black min-h-screen overflow-x-hidden">
      <HeroCarousel all={all} />
      <TrendingSection />
      <PremiereHighlights />
      <FavoritesSection />
      <KoreaTrendingSection />
      <CelebSection />
    </main>
  );
}