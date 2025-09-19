"use client";

import React from "react";
import { useEffect, useState, useRef } from "react";
import type { All } from "@/types/all";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { IconX } from "@tabler/icons-react";

async function fetchUpcomingTrailers() {
    const base = process.env.NEST_API_URL || "http://localhost:4000";
    const res = await fetch(`${base}/all/upcoming-trailers`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json as All[];
}
export const UpcomingTrailers = () => {
    const [trailers, setTrailers] = useState<All[]>([]);
    const [selectedTrailer, setSelectedTrailer] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const carouselRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [fontSize, setFontSize] = useState(14);
    const [posterSize, setPosterSize] = useState(96); // px

    useEffect(() => {
        const updateSizes = () => {
            if (panelRef.current) {
                const height = panelRef.current.clientHeight;

                // Example: adjust font and poster proportionally to panel height
                const newFontSize = Math.min(16, Math.max(12, height / 35)); // clamp between 12px and 16px
                const newPosterSize = Math.min(112, Math.max(64, height / 5)); // clamp poster between 64px and 112px

                setFontSize(newFontSize);
                setPosterSize(newPosterSize);
            }
        };

        updateSizes();
        window.addEventListener("resize", updateSizes);
        return () => window.removeEventListener("resize", updateSizes);
    }, []);



    useEffect(() => {
        fetchUpcomingTrailers().then(setTrailers);
    }, []);

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
            <p className="text-gray-400 text-sm mt-1">Catch the trailers before everyone else does!</p>


            {/* Carousel wrapper */}
            <div className="relative mt-6">
                {/* Left button */}
                <button
                    onClick={() => scroll("left")}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
                >
                    <ChevronLeft size={28} />
                </button>

                {/* Scrollable carousel */}
                <div ref={carouselRef} className="flex gap-4 overflow-hidden scroll-smooth pb-2">
                    {trailers.map(
                        (item) =>
                            item.trailer_key && (
                                <motion.div
                                    key={item.id}
                                    whileHover={{ scale: 1.05 }}
                                    className="relative flex-shrink-0 w-84 h-52 cursor-pointer rounded-lg overflow-hidden bg-gray-800 brightness-85 hover:brightness-100 shadow-lg"
                                    onClick={() => setSelectedTrailer(item.trailer_key ?? null)}
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

                                    {/* Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3">
                                        <h3 className="text-white font-semibold text-sm line-clamp-2">
                                            {item.title}
                                        </h3>
                                        <span className="text-gray-300 text-xs mt-1">
                                            {item.release_date
                                                ? new Date(item.release_date).toLocaleDateString(undefined, {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric",
                                                })
                                                : "TBA"}
                                        </span>

                                    </div>
                                </motion.div>
                            )
                    )}
                </div>

                {/* Right button */}
                <button
                    onClick={() => scroll("right")}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
                >
                    <ChevronRight size={28} />
                </button>
            </div>

            {selectedTrailer && (() => {
                const trailerItem = trailers.find(t => t.trailer_key === selectedTrailer);
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
                        {/* Dark overlay that can close modal when clicked */}
                        <div
                            className="absolute inset-0 cursor-pointer"
                            onClick={() => setSelectedTrailer(null)}
                        />

                        <div className="relative w-full h-[80vh] max-w-[95vw] sm:max-w-5xl md:max-w-6xl lg:max-w-7xl xl:max-w-[90vw] mx-auto overflow-hidden flex justify-center items-center">
                            <div className="relative w-full h-full grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch justify-items-center">

                                {/* Trailer iframe */}
                                <div ref={iframeRef} className="col-span-1 sm:col-span-2 w-full h-full flex justify-center items-center">
                                    <div className="w-full h-full max-h-full max-w-full">
                                        <iframe
                                            className="w-full h-full rounded-xl shadow-2xl border border-gray-700 bg-black aspect-video"
                                            src={`https://www.youtube.com/embed/${selectedTrailer}?autoplay=1&controls=1`}
                                            title="Trailer"
                                            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            allowFullScreen
                                        />
                                    </div>
                                </div>

                                {/* Details panel */}
                                {trailerItem && (
                                    <div
                                        ref={panelRef}
                                        className="col-span-1 w-full flex flex-col justify-start items-center sm:items-start bg-black/70 rounded-xl p-3 shadow-lg border border-gray-700 overflow-auto"
                                        style={{ transform: `scale(${scale})`, transformOrigin: "top right" }}
                                    >
                                        {/* Poster */}
                                        {trailerItem.poster_path && (
                                            <img
                                                src={`https://image.tmdb.org/t/p/w185${trailerItem.poster_path}`}
                                                alt={trailerItem.title}
                                                className="mb-3 rounded-lg shadow-md object-cover"
                                                style={{ width: posterSize, height: posterSize * 1.5 }} // poster ratio 2:3
                                            />
                                        )}

                                        {/* Title */}
                                        <h2
                                            className="font-bold text-white mb-1 text-center sm:text-left"
                                            style={{ fontSize: fontSize + 2 }}
                                        >
                                            {trailerItem.title}
                                        </h2>

                                        {/* Overview */}
                                        <p className="text-gray-300 overflow-hidden" style={{ fontSize }}>
                                            {isExpanded
                                                ? trailerItem.overview
                                                : trailerItem.overview.slice(0, 150) + (trailerItem.overview.length > 150 ? "..." : "")}
                                        </p>

                                        {/* Release and Rating */}
                                        <div className="text-gray-400" style={{ fontSize: fontSize - 2 }}>
                                            {trailerItem.release_date && (
                                                <div>
                                                    <span className="font-semibold">Release:</span> {trailerItem.release_date}
                                                </div>
                                            )}
                                            {trailerItem.vote_average && (
                                                <div className="text-yellow-400">
                                                    <span className="font-semibold">Rating:</span> {trailerItem.vote_average}/10
                                                </div>
                                            )}
                                        </div>
                                        {trailerItem.recommendations?.length > 0 && (
                                            <div className="mt-4">
                                                <h3 className="text-white font-bold mb-2">More Trailers Like This</h3>
                                                <div className="flex gap-2 overflow-x-auto">
                                                    {trailerItem.recommendations.map((rec) => (
                                                        <div
                                                            key={rec.id}
                                                            className="w-28 flex-shrink-0 cursor-pointer"
                                                            onClick={() => setSelectedTrailer(rec.trailer_key!)}
                                                        >
                                                            <Image
                                                                src={`https://image.tmdb.org/t/p/w185${rec.poster_path}`}
                                                                alt={rec.title}
                                                                width={185}
                                                                height={278}
                                                                className="rounded-md object-cover"
                                                            />
                                                            <p className="text-xs text-white line-clamp-2 mt-1">{rec.title}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                )}
                                {/* Close button */}
                                <button
                                    onClick={() => setSelectedTrailer(null)}
                                    className="absolute right-4 top-4 md:right-6 md:top-6 rounded-full bg-white/10 p-2 hover:bg-white/20 focus:outline-none"
                                    style={{ backdropFilter: "blur(6px)" }}

                                    aria-label="Close trailer"
                                >
                                    <IconX className="text-white" />
                                </button>

                            </div>

                        </div>

                    </div>
                );
            })()}



        </section>
    );
};
