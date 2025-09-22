"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Info, Plus, Check, Bookmark, BookmarkCheck } from "lucide-react";
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
    onAddToWatchlist?: (item: T) => void;
    onRemoveFromWatchlist?: (item: T) => void;
    isInWatchlist?: (item: T) => boolean;
}

export default function MovieCarousel<T extends MovieLike>({
    title,
    subtitle,
    items,
    onAddToWatchlist,
    onRemoveFromWatchlist,
    isInWatchlist,
}: MovieCarouselProps<T>) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [watchlistStates, setWatchlistStates] = useState<Record<string | number, boolean>>({});
    const [loadingStates, setLoadingStates] = useState<Record<string | number, boolean>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const [cardWidth, setCardWidth] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);

    function posterGetter(item: MovieLike): string {
        return item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : "/placeholder.jpg";
    }

    // Initialize watchlist states
    useEffect(() => {
        if (isInWatchlist) {
            const states: Record<string | number, boolean> = {};
            items.forEach(item => {
                states[item.id] = isInWatchlist(item);
            });
            setWatchlistStates(states);
        }
    }, [items, isInWatchlist]);

    // Handle watchlist toggle
    const handleWatchlistToggle = async (item: T, event: React.MouseEvent) => {
        event.stopPropagation(); // Prevent card click

        const itemId = item.id;
        const isCurrentlyInWatchlist = isInWatchlist ? isInWatchlist(item) : watchlistStates[itemId];

        // Set loading state
        setLoadingStates(prev => ({ ...prev, [itemId]: true }));

        try {
            if (isCurrentlyInWatchlist) {
                // Remove from watchlist
                if (onRemoveFromWatchlist) {
                    await onRemoveFromWatchlist(item);
                }
                setWatchlistStates(prev => ({ ...prev, [itemId]: false }));
            } else {
                // Add to watchlist
                if (onAddToWatchlist) {
                    await onAddToWatchlist(item);
                }
                setWatchlistStates(prev => ({ ...prev, [itemId]: true }));
            }
        } catch (error) {
            console.error('Error updating watchlist:', error);
            // Revert state on error
            setWatchlistStates(prev => ({ ...prev, [itemId]: isCurrentlyInWatchlist }));
        } finally {
            // Remove loading state
            setLoadingStates(prev => ({ ...prev, [itemId]: false }));
        }
    };

    // Detect card + container width dynamically
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

    // How many cards fit on screen
    const cardsPerView = cardWidth
        ? Math.floor(containerWidth / cardWidth)
        : 1;

    // Max scrollable index (so no blank space at the end)
    const maxIndex = cardWidth
        ? Math.max(0, items.length - cardsPerView)
        : 0;

    // Move one "page" (group of visible cards)
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
                    className="flex gap-4"
                    animate={{ x: -currentIndex * cardWidth }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                    {items?.length ? (
                        items.map((m) => {
                            const inWatchlist = isInWatchlist ? isInWatchlist(m) : watchlistStates[m.id];
                            const isLoading = loadingStates[m.id];

                            return (
                                <motion.div
                                    key={m.id}
                                    whileHover={{ scale: 1.05 }}
                                    className="movie-card relative w-35 sm:w-47 lg:w-60 flex-shrink-0 overflow-hidden cursor-pointer group"
                                >
                                    {/* Poster */}
                                    <div className="relative w-full rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all">
                                        <Image
                                            src={posterGetter(m)}
                                            alt={m.title}
                                            width={200}
                                            height={300}
                                            className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                                        />

                                        {/* Top Action Bar */}
                                        <div className="absolute top-2 left-2 right-2 z-30 flex justify-between items-center pointer-events-none">
                                            {/* Watchlist Button */}
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <motion.button
                                                            onClick={(e) => handleWatchlistToggle(m, e)}
                                                            disabled={isLoading}
                                                            className={`
                p-2 rounded-full shadow-lg backdrop-blur-sm border transition-all duration-200
                pointer-events-auto
                ${inWatchlist ? 'bg-green-500/90 border-green-400/50 text-white hover:bg-green-600/90'
                                                                    : 'bg-black/40 border-white/20 text-white hover:bg-black/60 hover:border-white/40'}
                ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-110'}
              `}
                                                            whileTap={{ scale: 0.95 }}
                                                        >
                                                            {isLoading ? (
                                                                <motion.div
                                                                    animate={{ rotate: 360 }}
                                                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                                                                />
                                                            ) : inWatchlist ? (
                                                                <BookmarkCheck size={16} />
                                                            ) : (
                                                                <Bookmark size={16} />
                                                            )}
                                                        </motion.button>
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                        side="bottom"
                                                        sideOffset={6}
                                                        className="rounded-lg bg-black/80 backdrop-blur-md px-3 py-2 shadow-lg border border-white/20"
                                                    >
                                                        <div className="text-sm font-medium text-white">
                                                            {isLoading ? 'Updating...' : inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>

                                            {/* Rating */}
                                            <div
                                                className={`text-xs px-2 py-1 rounded-lg font-bold shadow backdrop-blur-sm pointer-events-auto
          ${m.vote_average >= 7 ? "bg-green-500/90 text-white border border-green-400/50" :
                                                        m.vote_average >= 5 ? "bg-yellow-400/90 text-black border border-yellow-300/50" :
                                                            "bg-red-500/90 text-white border border-red-400/50"
                                                    }`}
                                            >
                                                {m.vote_average?.toFixed(1)}
                                            </div>
                                        </div>

                                        {/* Hover Overlay */}
                                        <div
                                            className="absolute inset-x-0 bottom-0 z-20
             bg-black/90 backdrop-blur-md text-white
             p-2 flex flex-col justify-start
             opacity-0 group-hover:opacity-100
             transition-opacity duration-500
             overflow-y-auto rounded-2xl
             max-h-[65%] mt-10" // don't reach top
                                        >
                                            <div className="flex flex-col gap-1">
                                                {/* Title */}
                                                <h3 className="text-sm sm:text-base font-bold line-clamp-2">{m.title}</h3>

                                                {/* Release Year / Country */}
                                                <p className="text-gray-300 text-xs flex flex-wrap gap-1 items-center">
                                                    {m.year ?? m.release_date?.slice(0, 4)}
                                                    {m.origin_country?.length ? (
                                                        <span className="text-[#e94f37]">• {m.origin_country.join(", ")}</span>
                                                    ) : null}
                                                </p>

                                                {/* Genres */}
                                                {m.genres?.length ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {m.genres.map((genre, i) => (
                                                            <span
                                                                key={i}
                                                                className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-[#e94f37] to-pink-500 text-white font-semibold shadow-sm"
                                                            >
                                                                {genre}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-gray-500 italic text-xs">No genres</p>
                                                )}

                                                {/* Watchlist Status */}
                                                {inWatchlist && (
                                                    <div className="flex items-center gap-1 text-green-400 text-xs">
                                                        <Check size={12} />
                                                        <span>In your watchlist</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-2 mt-2">
                                                <button className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-all">
                                                    <Info size={12} />
                                                    <span>Details</span>
                                                </button>
                                            </div>

                                            {/* Recommendations */}
                                            {m.recommendations?.length ? (
                                                <div className="mt-1 pt-1 border-t border-white/10">
                                                    <p className="text-gray-400 text-xs mb-1 font-medium">You might also like</p>
                                                    <div className="flex gap-1 overflow-x-auto">
                                                        {m.recommendations.slice(0, 3).map((rec) => (
                                                            <TooltipProvider key={rec.id}>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Image
                                                                            src={posterGetter(rec)}
                                                                            alt={rec.title}
                                                                            width={40}
                                                                            height={60}
                                                                            sizes="40px"
                                                                            className="rounded-md object-cover hover:scale-105 transition cursor-pointer"
                                                                        />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent
                                                                        side="bottom"
                                                                        sideOffset={6}
                                                                        className="rounded-lg bg-white/30 backdrop-blur-md px-2 py-1 shadow-md border border-white/20 animate-in fade-in zoom-in-95 duration-200"
                                                                    >
                                                                        <TooltipArrow className="fill-white/30 stroke-white/20" />
                                                                        <div className="text-xs font-medium text-white drop-shadow max-w-[150px] truncate">
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

                            );
                        })
                    ) : (
                        <p className="text-center text-gray-500">No items to display.</p>
                    )}
                </motion.div>
            </div>
        </section>
    );
}