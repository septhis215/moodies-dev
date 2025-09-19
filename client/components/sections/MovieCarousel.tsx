"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { TooltipArrow } from "@radix-ui/react-tooltip";

type MovieLike = {
    id: string | number;
    title: string;
    poster?: string | null;
    poster_path?: string | null;
    rating?: string | number;
    vote_average?: number;
    overview?: string;
    release_date?: string;
    year?: number;
    genres?: string[];
    vote_count?: number;
    popularity?: number;
    origin_country?: string[];
    recommendations?: MovieLike[];

};


interface MovieCarouselProps<T extends MovieLike> {
    title: string;
    subtitle?: string;
    items: T[];
    getPoster?: (item: T) => string;
}

export default function MovieCarousel<T extends MovieLike>({
    title,
    subtitle,
    items,
}: MovieCarouselProps<T>) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [cardWidth, setCardWidth] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);

    function posterGetter(item: MovieLike): string {
        return item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : "/placeholder.jpg";
    }



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
                        className="px-3 py-1 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <button
                        onClick={handleNext}
                        className="px-3 py-1 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>

            {/* Carousel container */}
            <div className="overflow-hidden relative" ref={containerRef}>
                <motion.div
                    className="flex gap-1" // ✅ cards closer
                    animate={{ x: -currentIndex * cardWidth }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                    {items?.length ? (
                        items.map((m) => (
                            <motion.div
                                key={m.id}
                                whileHover={{ scale: 1.05 }}
                                className="movie-card relative w-40 sm:w-52 lg:w-60 flex-shrink-0 rounded-xl overflow-hidden cursor-pointer group"
                            >
                                <div className="relative group w-[200px] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all">
                                    {/* Poster */}
                                    <Image
                                        src={posterGetter(m)}
                                        alt={m.title}
                                        width={200}
                                        height={300}
                                        className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                                    />

                                    {/* Rating Badge */}
                                    <div
                                        className={`absolute top-2 right-2 z-20 text-xs px-2 py-1 rounded-lg font-bold shadow
      ${m.vote_average && m.vote_average >= 7
                                                ? "bg-green-500 text-white"
                                                : m.vote_average && m.vote_average >= 5
                                                    ? "bg-yellow-400 text-black"
                                                    : "bg-red-500 text-white"
                                            }`}
                                    >
                                        {m.vote_average?.toFixed(1)}
                                    </div>

                                    {/* Bottom Bar (visible until hover) */}
                                    <div
                                        className="absolute bottom-0 left-0 right-0 z-20
               bg-gradient-to-t from-black/80 to-black/40
               p-2 flex items-center justify-between
               transition-opacity duration-300
               group-hover:opacity-0 group-hover:invisible"
                                    >
                                        <h3 className="text-white text-sm font-semibold truncate">{m.title}</h3>
                                        <button
                                            className="text-white/80 hover:text-white transition"
                                            aria-label="More Info"
                                        >
                                            <Info size={16} />
                                        </button>
                                    </div>

                                    {/* Hover Overlay (slides up) */}
                                    <div
                                        className="absolute inset-x-0 bottom-0 z-10
               translate-y-full group-hover:translate-y-0
               transition-transform duration-500 ease-out
               bg-black/80 text-white p-3 text-xs space-y-2"
                                    >
                                        {/* Title */}
                                        <h3 className="text-base font-bold">{m.title}</h3>
                                        <p className="text-xs text-gray-300">
                                            {m.year ?? m.release_date} {m.origin_country?.length ? `• ${m.origin_country.join(", ")}` : ""}
                                        </p>
                                        {/* Genres */}
                                        {m.genres?.length ? (
                                            <p className="text-gray-300 text-xs">{m.genres.join(", ")}</p>
                                        ) : (
                                            <p className="text-gray-500 italic text-xs">No genres</p>
                                        )}


                                        {/* Ratings Info */}
                                        <p className="text-xs text-gray-400">
                                            {m.vote_count ? `${m.vote_count.toLocaleString()} ratings` : ""}
                                            {m.popularity ? ` • Popularity: ${Math.round(m.popularity)}` : ""}
                                        </p>
                                        {/* "You might also like" */}
                                        {m.recommendations?.length ? (
                                            <div className="mt-3 mb-3">
                                                <p className="text-xs text-gray-400 mb-1">You might also like</p>
                                                <div className="flex gap-2 overflow-hidden">
                                                    {m.recommendations.slice(0, 3).map((rec) => (
                                                        <TooltipProvider key={rec.id}>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Image
                                                                        key={rec.id}
                                                                        src={posterGetter(rec)}
                                                                        alt={rec.title}
                                                                        width={52}
                                                                        height={77}
                                                                        sizes="52px" 
                                                                        className="rounded-md object-cover hover:scale-105 transition cursor-pointer"
                                                                    />
                                                                </TooltipTrigger>
                                                                <TooltipContent
                                                                    side="bottom"
                                                                    sideOffset={6}
                                                                    className="rounded-lg bg-white/30 backdrop-blur-md px-3 py-2 shadow-lg border border-white/20 animate-in fade-in zoom-in-95 duration-200"
                                                                >
                                                                    <TooltipArrow className="fill-white/30 stroke-white/20" />
                                                                    <div className="text-sm font-medium text-white drop-shadow max-w-[220px] truncate">
                                                                        {rec.title}
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <p className="text-gray-500">No movies available.</p>
                    )}
                </motion.div>

            </div>
        </section >
    );
}
