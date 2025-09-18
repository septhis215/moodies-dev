"use client";

import { useEffect, useRef, useState } from "react";
import type { All } from "@/types/all";
import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react"; // icon library

async function fetchTrailer() {
    const base = process.env.NEST_API_URL || "http://localhost:4000";
    const res = await fetch(`${base}/all/trailers`);
    if (!res.ok) return [];
    return (await res.json()) as All[];
}

export default function PremiereHighlights() {
    const [trailers, setTrailers] = useState<All[]>([]);
    const [selectedTrailer, setSelectedTrailer] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const carouselRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchTrailer().then(setTrailers);
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
                Premiere Highlights
            </h2>
            <p className="text-gray-400 text-sm mt-1">Movies and shows selected based on your mood — whether you’re up for a
                laugh, a cry, or something thrilling.</p>


            {/* Carousel wrapper */}
            <div className="relative mt-6">
                {/* Left button */}
                <button
                    onClick={() => scroll("left")}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
                >
                    <ChevronLeft size={28} />
                </button>

                {/* Scrollable content */}
                <div
                    ref={carouselRef}
                    className="flex gap-4 overflow-hidden scroll-smooth"
                >
                    {trailers.map(
                        (item) =>
                            item.trailer_key && (
                                <motion.div
                                    key={item.id}
                                    whileHover={{ scale: 1.05 }}
                                    className="relative flex-shrink-0 w-84 h-52 cursor-pointer rounded-lg overflow-hidden"
                                    onClick={() => setSelectedTrailer(item.trailer_key!)}
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
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-3">
                                        <h3 className="text-white font-semibold text-sm line-clamp-2">
                                            {item.title}
                                        </h3>
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

                        {/* Modal container */}
                        <div className="relative w-full h-screen flex flex-col sm:flex-row justify-center items-center 
    px-2 sm:px-8 lg:px-12 animate-fadeIn 
    max-w-[95vw] sm:max-w-5xl md:max-w-6xl lg:max-w-7xl xl:max-w-[90vw] mx-auto overflow-hidden">

                            {/* Trailer iframe wrapper */}
                            <div className="w-full sm:w-3/4 aspect-video rounded-xl overflow-hidden shadow-2xl border border-gray-700 bg-black 
        max-w-full max-h-[80vh] flex">
                                <iframe
                                    className="w-full h-full rounded-xl"
                                    src={`https://www.youtube.com/embed/${selectedTrailer}?autoplay=1&controls=1`}
                                    title="Trailer"
                                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                />
                            </div>

                            {trailerItem && (
                                <div className="w-full sm:w-1/3 mt-6 sm:mt-0 sm:ml-8 flex flex-col sm:flex-row items-center sm:items-start text-left
                                bg-black/60 rounded-xl p-4 sm:p-6 shadow-lg border border-gray-700 max-w-full 
                                overflow-y-auto max-h-[80vh]">
                                    {/* Poster image */}
                                    {trailerItem.poster_path && (
                                        <Image
                                            src={`https://image.tmdb.org/t/p/w342${trailerItem.poster_path}`}
                                            alt={trailerItem.title}
                                            width={342}
                                            height={513}
                                            className="mb-4 sm:mb-0 sm:mr-6 rounded-lg shadow-md w-32 sm:w-28 object-cover flex-shrink-0"
                                        />
                                    )}
                                    {/* Text content */}
                                    <div className="flex flex-col justify-start items-start w-full">
                                        <h2 className="text-base sm:text-xl md:text-2xl font-bold text-white mb-2 sm:mb-4 text-center sm:text-left">
                                            {trailerItem.title}
                                        </h2>
                                        {/* Overview with expand/collapse */}
                                        {trailerItem.overview && (
                                            <div className="mb-4 sm:mb-6 text-gray-300 text-xs sm:text-base">
                                                <p>
                                                    {isExpanded
                                                        ? trailerItem.overview
                                                        : trailerItem.overview.slice(0, 250) + (trailerItem.overview.length > 250 ? "..." : "")}
                                                </p>
                                                {trailerItem.overview.length > 250 && (
                                                    <button
                                                        onClick={() => setIsExpanded(!isExpanded)}
                                                        className="mt-1 text-blue-400 hover:text-blue-500 text-xs sm:text-sm font-semibold"
                                                    >
                                                        {isExpanded ? "Show less" : "Read more"}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        {trailerItem.release_date && (
                                            <div className="text-xs sm:text-base text-gray-400 mb-2 sm:mb-3">
                                                <span className="font-semibold">Release:</span> {trailerItem.release_date}
                                            </div>
                                        )}
                                        {trailerItem.vote_average && (
                                            <div className="text-xs sm:text-base text-yellow-400 mb-2 sm:mb-3">
                                                <span className="font-semibold">Rating:</span> {trailerItem.vote_average}/10
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {/* Close button */}
                            <button
                                onClick={() => setSelectedTrailer(null)}
                                className="absolute top-3 right-3 sm:top-4 sm:right-4 text-white hover:text-red-500 transition text-2xl sm:text-3xl z-50"
                                aria-label="Close trailer"
                            >
                                ✕
                            </button>
                        </div>


                    </div>
                );
            })()}



        </section>
    );
}
