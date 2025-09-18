"use client";

import MovieCarousel from "./MovieCarousel";
import { useEffect, useState } from "react";
import type { All } from "@/types/all";

async function fetchTrending() {
    const base = process.env.NEST_API_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/all/trending`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json as All[];
}

export default function TrendingSection() {
    const [trending, setTrending] = useState<All[]>([]);

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