"use client";

import MovieCarousel from "./MovieCarousel";
import { useEffect, useState } from "react";
import type { General } from "@/types/general";

async function fetchKoreaTrending() {
    const base = process.env.NEST_API_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/api/general/koreaTrending`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json as General[];
}

export default function KoreaTrendingSection() {
    const [koreaTrending, setKoreaTrending] = useState<General[]>([]);

    useEffect(() => {
        fetchKoreaTrending().then(setKoreaTrending);
    }, []);

    return (
        <MovieCarousel
            title="Korean Trending"
            subtitle="Fan favorites straight from Korea."
            items={koreaTrending}
        />
    );
}