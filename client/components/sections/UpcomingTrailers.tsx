"use client";

import React, { useEffect, useState, useRef } from "react";
import type { All } from "@/types/all";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Film, Tv } from "lucide-react";
import { motion } from "framer-motion";
import { IconCalendar, IconClock, IconDeviceTv, IconTags, IconX } from "@tabler/icons-react";

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

            {selectedTrailer && (() => {
                const trailerItem = selectedTrailer;

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                        <div
                            className="absolute inset-0 cursor-pointer"
                            onClick={() => setSelectedTrailer(null)}
                        />

                        {/* Main container with proper responsive layout */}
                        <div className="relative w-full max-w-[90vw] mx-auto h-[85vh] max-h-[90vh] flex flex-col xl:flex-row gap-6 items-stretch">

                            {/* Trailer Container - 2/3 width */}
                            <div className=" w-full xl:flex-[2] flex justify-center items-center min-h-0">
                                <div className="w-full h-full max-h-[60vh] xl:max-h-full flex justify-center items-center">
                                    <iframe
                                        className="w-full h-full rounded-xl shadow-2xl border border-gray-700 bg-black"
                                        src={`https://www.youtube.com/embed/${selectedTrailer.trailer_key}?autoplay=0&controls=1`}
                                        title="Trailer"
                                        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                        style={{ aspectRatio: "16/9" }}
                                    />
                                </div>
                            </div>

                            {/* Details Panel */}
                            {trailerItem && (
                                <div
                                    ref={panelRef}
                                    className="
     w-full xl:flex-[1]
    bg-gradient-to-b from-black/95 to-black/85 backdrop-blur-xl
    rounded-l-2xl  /* only round left side */
    border border-gray-600/50 shadow-2xl
    flex flex-col
    min-h-0 xl:h-full
     xl:max-h-full
  "
                                >
                                    {/* Scrollable Content */}
                                    <div
                                        className="
        flex-1 overflow-y-auto overflow-x-hidden
        scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800
        hover:scrollbar-thumb-gray-400
        scrollbar-thumb-rounded-lg
        scrollbar-track-rounded-lg
        px-1
      "
                                    >
                                        {/* Header Section */}
                                        <div className="flex-shrink-0 p-4 xl:p-6 border-b border-gray-700/50 relative">
                                            <div className="flex gap-4 xl:gap-6 items-start">
                                                {/* Poster */}
                                                {trailerItem.poster_path && (
                                                    <div className="w-20 xl:w-32 flex-shrink-0">
                                                        <img
                                                            src={`https://image.tmdb.org/t/p/w300${trailerItem.poster_path}`}
                                                            alt={trailerItem.title}
                                                            className="rounded-lg shadow-xl object-cover w-full h-auto"
                                                        />
                                                    </div>
                                                )}

                                                {/* Cinematic Title + Info Panel */}
                                                <div className="flex flex-col flex-1 min-w-0 relative z-10">
                                                    {/* Title */}
                                                    <h2 className="text-xl xl:text-2xl 2xl:text-3xl font-extrabold text-white drop-shadow-2xl leading-tight">
                                                        {trailerItem.title}
                                                    </h2>

                                                    {/* Top Badges Row */}
                                                    <div className="flex flex-wrap gap-2 mt-3">
                                                        {/* Release Date Badge */}
                                                        {trailerItem.release_date && (
                                                            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-600/90 shadow-lg text-xs xl:text-xs font-medium text-white">
                                                                <IconCalendar size={14} />
                                                                {new Date(trailerItem.release_date).toLocaleDateString(undefined, {
                                                                    month: "short",
                                                                    day: "numeric",
                                                                    year: "numeric",
                                                                })}
                                                            </span>
                                                        )}

                                                        {/* Runtime Badge */}
                                                        {trailerItem.runtime && (
                                                            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-purple-600/90 shadow-lg text-xs xl:text-xs font-medium text-white">
                                                                <IconClock size={14} />
                                                                {Math.floor(trailerItem.runtime / 60)}h {trailerItem.runtime % 60}m
                                                            </span>
                                                        )}

                                                        {/* Episodes Badge */}
                                                        {trailerItem.number_of_episodes && (
                                                            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-purple-500/90 shadow-lg text-xs xl:text-xs font-medium text-white">
                                                                <IconDeviceTv size={14} />
                                                                {trailerItem.number_of_episodes} Episodes
                                                            </span>
                                                        )}
                                                        {trailerItem.genres?.slice(0, 3).map((genre, i) => (
                                                            <span
                                                                key={i}
                                                                className="relative px-3 py-1 rounded-full text-white font-semibold text-xs shadow-lg overflow-hidden"
                                                            >
                                                                {/* Animated gradient overlay */}
                                                                <span className="absolute inset-0 bg-gradient-to-r from-[#e94f37] via-pink-500 to-orange-500 opacity-40 animate-gradient-x rounded-full"></span>
                                                                <span className="relative z-10">{genre}</span>
                                                            </span>
                                                        ))}
                                                        {/* Content Type Badge */}
                                                        <div
                                                            className={[
                                                                "flex items-center gap-1.5 px-2 py-1 rounded-full font-medium text-xs text-white shadow-md backdrop-blur-md border"
                                                            ].join(" ")}
                                                        >
                                                            {trailerItem.type === "tv" ? <Tv size={12} /> : <Film size={12} />}
                                                            <span>{trailerItem.type === "tv" ? "Series" : "Movie"}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                        </div>

                                        {/* Synopsis */}
                                        {trailerItem.overview && (
                                            <div className="flex-shrink-0 px-4 xl:px-6 py-3 xl:py-4 border-b border-gray-700/30">
                                                <h3 className="text-gray-400 font-semibold text-sm xl:text-base mb-2 xl:mb-3 uppercase tracking-wide">
                                                    Synopsis
                                                </h3>
                                                {trailerItem.overview && (
                                                    <p className="text-gray-300 text-sm leading-relaxed break-words">
                                                        {isExpanded
                                                            ? trailerItem.overview
                                                            : trailerItem.overview.slice(0, 150) +
                                                            (trailerItem.overview.length > 150
                                                                ? "..."
                                                                : "")}
                                                        {trailerItem.overview.length > 150 && (
                                                            <button
                                                                onClick={() => setIsExpanded(!isExpanded)}
                                                                className="ml-2 text-blue-400 hover:text-blue-500 text-xs font-semibold"
                                                            >
                                                                {isExpanded ? "Show less" : "Read more"}
                                                            </button>
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Recommendations */}
                                        {trailerItem.recommendations?.length > 0 && (
                                            <div className="p-2 xl:p-4">
                                                <div className="flex items-center justify-between mb-2 xl:mb-3">
                                                    <h3 className="text-gray-400 font-semibold text-sm xl:text-base uppercase tracking-wide">
                                                        You Might Also Like
                                                    </h3>
                                                    <span className="text-sm xl:text-base text-gray-500 bg-gray-800/50 px-2 py-1 rounded-full">
                                                        {trailerItem.recommendations.length}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-3 xl:gap-4">
                                                    {trailerItem.recommendations.slice(0, 3).map((rec) => (
                                                        <div
                                                            key={rec.id}
                                                            className="group relative cursor-pointer rounded-2xl overflow-hidden border border-gray-700/40 bg-gray-900/40 backdrop-blur-sm transition-all duration-500 hover:scale-105 hover:border-blue-500/40 hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)]"
                                                            onClick={() => handleSelectTrailer(rec)}
                                                            title={rec.title}
                                                        >
                                                            {/* Poster Image */}
                                                            <div className="aspect-[2/3] relative overflow-hidden">
                                                                <Image
                                                                    src={`https://image.tmdb.org/t/p/w300${rec.poster_path}`}
                                                                    alt={rec.title}
                                                                    width={300}
                                                                    height={450}
                                                                    className="object-cover w-full h-full transform transition-transform duration-500 group-hover:scale-110"
                                                                />

                                                                {/* Gradient Overlay */}
                                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-70 group-hover:opacity-80 transition-opacity duration-500" />

                                                                {/* Example Badge (optional) */}
                                                                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-blue-500/80 text-white text-[10px] font-semibold tracking-wide shadow-md">
                                                                    {rec.vote_average?.toFixed(1) ?? "N/A"}
                                                                </span>
                                                            </div>

                                                            {/* Title */}
                                                            <div className="p-2 text-center">
                                                                <p className="text-white text-sm font-semibold line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors duration-300">
                                                                    {rec.title}
                                                                </p>
                                                            </div>
                                                        </div>

                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Close Button */}
                        <button
                            onClick={() => setSelectedTrailer(null)}
                            className="absolute top-4 right-4 rounded-full bg-white/20 p-2 hover:bg-white/40 focus:outline-none"
                            style={{ backdropFilter: "blur(6px)" }}
                        >
                            <IconX className="text-white w-5 h-5" />
                        </button>

                    </div>
                );
            })()}
        </section>
    );
};