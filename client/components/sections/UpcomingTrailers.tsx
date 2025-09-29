"use client";

import React, { useEffect, useState, useRef } from "react";
import type { All } from "@/types/all";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Film, Tv } from "lucide-react";
import { motion } from "framer-motion";
import { IconCalendar, IconClock, IconDeviceTv, IconTags, IconX } from "@tabler/icons-react";
import dynamic from "next/dynamic";

async function fetchUpcomingTrailers() {
    const base = process.env.NEST_API_URL || "http://localhost:4000";
    const res = await fetch(`${base}/all/upcoming-trailers`, {
        next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return (await res.json()) as All[];
}

async function fetchRecommendations(type: "movie" | "tv", id: number) {
    if (!type || !id) return []; // early return if invalid

    const base = process.env.NEST_API_URL || "http://localhost:4000/";
    const res = await fetch(`${base}all/${type}/${id}/recommendations`, {
        next: { revalidate: 60 * 5 },
    });
    if (!res.ok) return [];
    return (await res.json()) as All[];
}


export const UpcomingTrailers = () => {
    const [trailers, setTrailers] = useState<All[]>([]);
    const [selectedTrailer, setSelectedTrailer] = useState<All | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isStacked, setIsStacked] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const carouselRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const trailerItem = selectedTrailer;
    const [recommendationsCache, setRecommendationsCache] = useState<Record<number, All[]>>({});
    const TrailerModal = dynamic(() => import("./TrailerModal"), { ssr: false });

    // threshold (container width in px) to decide stacking
    const STACK_AT = 900;

    useEffect(() => {
        fetchUpcomingTrailers().then(setTrailers);
    }, []);

    useEffect(() => {
        if (selectedTrailer) {
            // Disable background scroll
            document.body.style.overflow = "hidden";
        } else {
            // Re-enable scroll
            document.body.style.overflow = "";
        }

        // Cleanup on unmount
        return () => {
            document.body.style.overflow = "";
        };
    }, [selectedTrailer]);

    const handleSelectTrailer = async (trailer: All) => {
        // Determine the type (fallback to parent if missing)
        const type = trailer.type || selectedTrailer?.type || 'movie';
        const id = trailer.id;

        if (!id || !type) return;

        // Check cache first
        let recs = recommendationsCache[id];
        if (!recs && type !== 'person') {
            recs = await fetchRecommendations(type, id);
            setRecommendationsCache(prev => ({ ...prev, [id]: recs }));
        }

        // Update selected trailer with recommendations
        setSelectedTrailer({ ...trailer, type, recommendations: recs || [] });
    };



    // Auto switch between side-by-side and stacked using ResizeObserver
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const ro = new ResizeObserver(() => {
            const width = container.getBoundingClientRect().width;
            setIsStacked(width < STACK_AT);
        });

        ro.observe(container);
        return () => ro.disconnect();
    }, [containerRef]);

    const scroll = (direction: "left" | "right") => {
        if (!carouselRef.current) return;
        const { scrollLeft, clientWidth } = carouselRef.current;
        const scrollAmount = direction === "left" ? -clientWidth : clientWidth;
        carouselRef.current.scrollTo({
            left: scrollLeft + scrollAmount,
            behavior: "smooth",
        });
    };

    return (
        <section className="px-6 py-12 mx-auto relative">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Upcoming Releases
            </h2>
            <p className="text-gray-400 text-sm mt-1">
                Catch the trailers before everyone else does!
            </p>

            {/* Carousel */}
            <div className="relative mt-6">
                <button
                    onClick={() => scroll("left")}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
                >
                    <ChevronLeft size={28} />
                </button>

                <div
                    ref={carouselRef}
                    className="flex gap-4 overflow-hidden scroll-smooth pb-2"
                >
                    {trailers.map(
                        (item) =>
                            item.trailer_key && (
                                <motion.div
                                    key={item.id}
                                    whileHover={{ scale: 1.05 }}
                                    className="relative group flex-shrink-0 w-84 h-52 cursor-pointer rounded-lg overflow-hidden bg-gray-800 brightness-85 hover:brightness-100 shadow-lg"
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
                                        <span className="text-gray-300 text-xs mt-1">
                                            <div className="flex items-center text-xs text-gray-300 mb-1 gap-1">
                                                <IconClock size={12} />

                                                {item.release_date
                                                    ? new Date(item.release_date).toLocaleDateString(
                                                        undefined,
                                                        {
                                                            month: "long",
                                                            day: "numeric",
                                                            year: "numeric",
                                                        }
                                                    )
                                                    : "TBA"}
                                            </div>
                                        </span>
                                    </div>
                                    <div className="absolute bottom-3 right-3 z-20 opacity-100 group-hover:opacity-0 transition-opacity duration-300">
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
                    )}
                </div>

                <button
                    onClick={() => scroll("right")}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
                >
                    <ChevronRight size={28} />
                </button>
            </div>
            {/* Lazy modal */}
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