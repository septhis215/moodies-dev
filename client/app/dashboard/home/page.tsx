// src/app/page.tsx
import React from 'react';
import type { All } from '@/types/all';
import HeroCarousel from '@/components/hero/heroCarousel';

async function fetchFeatured() {
  const base = process.env.NEST_API_URL || 'http://localhost:4000';
  // cache policy: change revalidate per your needs
  const res = await fetch(`${base}/all/featured`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as All[];
}

export default async function HomePage() {
  const all = await fetchFeatured();

  return (
    <main>
      <HeroCarousel all={all} />
      {/* rest of home */}
    </main>
  );
}