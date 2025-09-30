"use client";

import React, { useEffect, useState, useRef } from "react";
import type { All } from "@/types/all";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Film, Tv } from "lucide-react";
import { motion } from "framer-motion";
import { IconClock } from "@tabler/icons-react";
import dynamic from "next/dynamic";

// Lazy-load modal (disable SSR)
const TrailerModal = dynamic(() => import("./TrailerModal"), { ssr: false });

async function fetchUpcomingTrailers(): Promise<All[]> {
    const base = process.env.NEST_API_URL || "http://localhost:4000";
    try {
        const res = await fetch(`${base}/all/upcoming-trailers`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error("Failed to fetch upcoming trailers:", err);
        return [];
    }
}

async function fetchRecommendations(type: "movie" | "tv", id: number): Promise<All[]> {
    if (!type || !id) return [];
    const base = process.env.NEST_API_URL || "http://localhost:4000";
    try {
        const res = await fetch(`${base}/all/${type}/${id}/recommendations`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error(`Failed to fetch recommendations for ${type}/${id}:`, err);
        return [];
    }
}

interface UpcomingTrailersProps {
    data?: All[];
    title?: string;
    subtitle?: string;
    endpoint?: string; // optional API endpoint override
}

export const UpcomingTrailers = ({
    data,
    title = "Upcoming Releases",
    subtitle = "Catch the trailers before everyone else does!",
    endpoint,
}: UpcomingTrailersProps) => {
    const [trailers, setTrailers] = useState<All[]>(data || []);
    const [selectedTrailer, setSelectedTrailer] = useState<All | null>(null);
    const [recommendationsCache, setRecommendationsCache] = useState<Record<number, All[]>>({});
    const [loading, setLoading] = useState(!data);
    const [error, setError] = useState<string | null>(null);

    const carouselRef = useRef<HTMLDivElement>(null);
    const uniqueTrailers = Array.from(
        new Map(trailers.map(item => [item.id, item])).values()
    );

    // Fetch if no data was passed
    useEffect(() => {
        if (data) {
            setLoading(false);
            return;
        }

        const load = async () => {
            try {
                setLoading(true);
                setError(null);

                let result: All[];
                if (endpoint) {
                    const base = process.env.NEST_API_URL || "http://localhost:4000";
                    const res = await fetch(`${base}${endpoint}`);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    result = await res.json();
                } else {
                    result = await fetchUpcomingTrailers();
                }

                if (result.length === 0) {
                    setError("No trailers available right now.");
                } else {
                    setTrailers(result);
                }
            } catch (err) {
                console.error("Error loading upcoming trailers:", err);
                setError("Failed to load trailers. Please try again later.");
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [data, endpoint]);

    const handleSelectTrailer = async (trailer: All) => {
        const type = trailer.type || "movie";
        const id = trailer.id;

        if (!id) return;

        try {
            let recs = recommendationsCache[id];
            if (!recs && type !== "person") {
                recs = await fetchRecommendations(type, id);
                setRecommendationsCache((prev) => ({ ...prev, [id]: recs }));
            }
            setSelectedTrailer({ ...trailer, recommendations: recs || [] });
        } catch {
            setSelectedTrailer({ ...trailer, recommendations: [] });
        }
    };

    const scroll = (direction: "left" | "right") => {
        if (!carouselRef.current) return;
        const { scrollLeft, clientWidth } = carouselRef.current;
        const scrollAmount = direction === "left" ? -clientWidth : clientWidth;
        carouselRef.current.scrollTo({
            left: scrollLeft + scrollAmount,
            behavior: "smooth",
        });
    };

    // =====================
    // Render States
    // =====================

    if (loading) {
        return (
            <section className="px-6 py-12 mx-auto relative">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{title}</h2>
                <p className="text-gray-400 text-sm mt-1">Loading...</p>
                <div className="flex gap-4 mt-6 overflow-hidden">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="w-80 h-52 bg-gray-800 animate-pulse rounded-lg" />
                    ))}
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="px-6 py-12 mx-auto relative">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{title}</h2>
                <div className="mt-6 p-6 bg-gray-800 rounded-lg text-center">
                    <p className="text-gray-400">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            </section>
        );
    }

    if (trailers.length === 0) return null;

    // =====================
    // Main Render
    // =====================

    return (
        <section className="px-6 py-12 mx-auto relative">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{title}</h2>
                <div className="text-sm text-gray-500">{trailers.length} trailers</div>
            </div>
            <p className="text-gray-400 text-sm mt-1">{subtitle}</p>

            {/* Carousel */}
            <div className="relative mt-6">
                <button
                    onClick={() => scroll("left")}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
                >
                    <ChevronLeft size={28} />
                </button>

                <div ref={carouselRef} className="flex gap-4 overflow-hidden scroll-smooth pb-2">
                    {uniqueTrailers.map((item) => (
                        item.trailer_key && (
                            <motion.div
                                key={item.id}
                                whileHover={{ scale: 1.05 }}
                                className="relative group flex-shrink-0 w-84 h-52 cursor-pointer rounded-lg overflow-hidden bg-gray-800 shadow-lg"
                                onClick={() => handleSelectTrailer(item)}
                            >
                                <Image
                                    src={
                                        item.backdrop_path
                                            ? `https://image.tmdb.org/t/p/w500${item.backdrop_path}`
                                            : "/placeholder.jpg"
                                    }
                                    alt={item.title}
                                    width={500}
                                    height={280}
                                    className="w-full h-full object-cover"
                                />

                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3">
                                    <h3 className="text-white font-semibold text-sm line-clamp-2">
                                        {item.title}
                                    </h3>
                                    <div className="flex items-center text-xs text-gray-300 gap-1 mt-1">
                                        <IconClock size={12} />
                                        {item.release_date
                                            ? new Date(item.release_date).toLocaleDateString(undefined, {
                                                month: "long",
                                                day: "numeric",
                                                year: "numeric",
                                            })
                                            : "TBA"}
                                    </div>
                                </div>

                                <div className="absolute bottom-3 right-3">
                                    <div
                                        className={[
                                            "flex items-center gap-1 px-2 py-0.5 rounded-lg font-medium text-xs shadow-lg backdrop-blur-md border",
                                            item.type === "tv"
                                                ? "bg-blue-500/90 text-white border-blue-400/50"
                                                : "bg-purple-500/90 text-white border-purple-400/50",
                                        ].join(" ")}
                                    >
                                        {item.type === "tv" ? <Tv size={12} /> : <Film size={12} />}
                                        {item.type === "tv" ? "Series" : "Movie"}
                                    </div>
                                </div>
                            </motion.div>
                        )
                    ))}
                </div>

                <button
                    onClick={() => scroll("right")}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
                >
                    <ChevronRight size={28} />
                </button>
            </div>

            {/* Modal */}
            {selectedTrailer && (
                <TrailerModal
                    trailer={selectedTrailer}
                    onClose={() => setSelectedTrailer(null)}
                    onSelectTrailer={handleSelectTrailer}
                />
            )}
        </section>
    );
};
