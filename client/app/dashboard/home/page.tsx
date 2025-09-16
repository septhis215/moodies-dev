// src/app/page.tsx
import React from 'react';
import type { General } from '@/types/general';
import HeroCarousel from '@/components/hero/heroCarousel';

async function fetchFeatured() {
  const base = process.env.NEST_API_URL || 'http://localhost:4000';
  // cache policy: change revalidate per your needs
  const res = await fetch(`${base}/api/general/featured`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as General[];
}

export default async function HomePage() {
  const generals = await fetchFeatured();

  return (
    <main>
      <HeroCarousel generals={generals} />
      {/* rest of home */}
    </main>
  );
}