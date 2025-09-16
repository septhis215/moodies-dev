"use client";

import MovieCarousel from "./MovieCarousel";
import { useEffect, useState } from "react";
import type { General } from "@/types/general";

async function fetchTrending() {
    const base = process.env.NEST_API_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/api/general/trending`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json as General[];
}

export default function TrendingSection() {
    const [trending, setTrending] = useState<General[]>([]);

    useEffect(() => {
        fetchTrending().then(setTrending);
    }, []);

    return (
        <MovieCarousel
            title="Trending on Moodies"
            subtitle="Review the latest movies in theatres today!"
            items={trending}
        />
    );
}