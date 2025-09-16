"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { tmdbImage } from "@/lib/tmdb";
import { ChevronLeft, ChevronRight } from "lucide-react";

type MovieLike = {
    id: string | number;
    title: string;
    poster?: string | null;
    poster_path?: string | null;
    trailerUrl?: string;
    year?: number;
    genres?: string[];
};

interface MovieCarouselProps<T extends MovieLike> {
    title: string;
    subtitle?: string;
    items: T[];
    getPoster?: (item: T) => string;
    getTrailerUrl?: (item: T) => string | undefined;
}

export default function MovieCarousel<T extends MovieLike>({
    title,
    subtitle,
    items,
    getPoster,
    getTrailerUrl,
}: MovieCarouselProps<T>) {
    const [selectedTrailer, setSelectedTrailer] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [cardWidth, setCardWidth] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);

    const posterGetter = getPoster
        ? getPoster
        : (item: T) =>
            tmdbImage(item.poster_path ?? item.poster, "w342") ??
            "/placeholder.jpg";

    const trailerGetter = getTrailerUrl
        ? getTrailerUrl
        : (item: T) => item.trailerUrl;

    // detect card + container width dynamically
    useEffect(() => {
        const updateSizes = () => {
            if (containerRef.current) {
                const firstCard =
                    containerRef.current.querySelector<HTMLDivElement>(".movie-card");
                if (firstCard) {
                    setCardWidth(firstCard.offsetWidth + 16); // include gap
                }
                setContainerWidth(containerRef.current.offsetWidth);
            }
        };
        updateSizes();
        window.addEventListener("resize", updateSizes);
        return () => window.removeEventListener("resize", updateSizes);
    }, [items]);

    // how many cards fit on screen
    const cardsPerView = cardWidth
        ? Math.floor(containerWidth / cardWidth)
        : 1;

    // max scrollable index (so no blank space at the end)
    const maxIndex = cardWidth
        ? Math.max(0, items.length - cardsPerView)
        : 0;

    // move one "page" (group of visible cards)
    const handlePrev = () =>
        setCurrentIndex((prev) =>
            prev === 0
                ? maxIndex
                : Math.max(0, prev - cardsPerView)
        );

    const handleNext = () =>
        setCurrentIndex((prev) =>
            prev >= maxIndex
                ? 0
                : Math.min(maxIndex, prev + cardsPerView)
        );


    return (
        <section className="relative w-full px-6 py-12 mx-auto">
            {/* Section header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handlePrev}
                        className="px-3 py-1 rounded-full bg-gray-800 text-white hover:bg-gray-700"
                    >
                        <ChevronLeft size={28} />
                    </button>
                    <button
                        onClick={handleNext}
                        className="px-3 py-1 rounded-full bg-gray-800 text-white hover:bg-gray-700"
                    >
                        <ChevronRight size={28} />
                    </button>
                </div>
            </div>

            {/* Carousel container */}
            <div className="overflow-hidden relative" ref={containerRef}>
                <motion.div
                    className="flex gap-4"
                    animate={{ x: -currentIndex * cardWidth }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                    {items?.length ? (
                        items.map((m) => (
                            <motion.div
                                key={m.id}
                                whileHover={{ scale: 1.05 }}
                                className="movie-card relative w-40 sm:w-48 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer"
                                onClick={() => {
                                    const url = trailerGetter(m);
                                    if (url) setSelectedTrailer(url);
                                }}
                            >
                                <Image
                                    src={posterGetter(m)}
                                    alt={m.title}
                                    width={300}
                                    height={450}
                                    className="w-full h-auto object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 hover:opacity-100 transition" />
                                <div className="absolute bottom-2 left-2 text-white text-sm">
                                    {m.title}
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <p className="text-gray-500">No movies available.</p>
                    )}
                </motion.div>
            </div>

            {/* Trailer modal */}
            {selectedTrailer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
                    <div className="relative w-[90%] max-w-3xl">
                        <button
                            onClick={() => setSelectedTrailer(null)}
                            className="absolute top-2 right-2 text-white text-2xl"
                        >
                            ✕
                        </button>
                        <iframe
                            className="w-full aspect-video rounded-lg"
                            src={selectedTrailer}
                            title="Trailer"
                            allowFullScreen
                        />
                    </div>
                </div>
            )}
        </section>
    );
}
