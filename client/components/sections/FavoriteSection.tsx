"use client";

import { useEffect, useState, useRef } from "react";
import type { General } from "@/types/general";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

async function fetchFavorites() {
    const base = process.env.NEST_API_URL || "http://localhost:4000";
    const res = await fetch(`${base}/api/general/favorites`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json as General[];
}

export default function FavoritesSection() {
    const [favorites, setFavorites] = useState<General[]>([]);
    const carouselRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchFavorites().then(setFavorites);
    }, []);

    const scroll = (direction: "left" | "right") => {
        if (!carouselRef.current) return;
        const scrollAmount = carouselRef.current.offsetWidth * 0.8; // slide ~80% width
        carouselRef.current.scrollBy({
            left: direction === "left" ? -scrollAmount : scrollAmount,
            behavior: "smooth",
        });
    };
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (!carouselRef.current) return;
            const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
        };
        const ref = carouselRef.current;
        if (ref) {
            ref.addEventListener("scroll", handleScroll);
            handleScroll();
        }
        return () => {
            if (ref) ref.removeEventListener("scroll", handleScroll);
        };
    }, [favorites]);
    if (favorites.length === 0) return null;

    return (
        <section className="relative px-6 py-6 bg-gradient-to-b from-gray-900 via-black to-gray-900">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                        Moodies Favorites
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Must-watch hits from across the world.
                    </p>
                </div>
                {/* Controls */}
                <div className="flex gap-2 mt-2 sm:mt-0">
                    <button
                        onClick={() => scroll("left")}
                        className="px-3 py-1 rounded-full bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-30"
                        disabled={!canScrollLeft}
                    >
                        <ChevronLeft size={28} />
                    </button>
                    <button
                        onClick={() => scroll("right")}
                        className="px-3 py-1 rounded-full bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-30"
                        disabled={!canScrollRight}
                    >
                        <ChevronRight size={28} />
                    </button>
                </div>
            </div>



            {/* Carousel */}
            <div
                ref={carouselRef}
                className="flex gap-6 scroll-smooth snap-x snap-mandatory overflow-x-auto whitespace-nowrap 
               scrollbar-hide py-4"
            >
                {favorites.map((item) => (
                    <div
                        key={item.id}
                        className="relative group flex-shrink-0 w-64 snap-start rounded-2xl overflow-hidden shadow-lg cursor-pointer"
                    >
                        <Image
                            src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                            alt={item.title}
                            width={342}
                            height={513}
                            className="w-full h-80 object-cover group-hover:scale-105 transition-transform duration-300"
                        />

                        {/* Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>

                        {/* Text */}
                        <div className="absolute bottom-4 left-4 right-4">
                            <h3 className="text-lg font-bold text-white">{item.title}</h3>
                            {item.genres && item.genres.length > 0 && (
                                <div className="text-xs text-blue-300 mb-1">
                                    {item.genres.join(", ")}
                                </div>
                            )}
                            {item.release_date && (
                                <div className="text-xs text-gray-300 mb-1">
                                    <span className="font-semibold">Release:</span> {item.release_date}
                                </div>
                            )}
                            {typeof item.vote_average === "number" && (
                                <div className="text-xs text-yellow-400">
                                    <span className="font-semibold">Rating:</span> {item.vote_average}/10
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </section>

    );
}
