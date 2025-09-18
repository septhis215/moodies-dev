"use client";

import MovieCarousel from "./MovieCarousel";
import { useEffect, useState } from "react";
import type { All } from "@/types/all";

async function fetchKoreaTrending() {
    const base = process.env.NEST_API_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/all/koreaTrending`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json as All[];
}

export default function KoreaTrendingSection() {
    const [koreaTrending, setKoreaTrending] = useState<All[]>([]);

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