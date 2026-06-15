import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { All } from "@/types/all";

interface CarouselProps {
    items: All[];
    CardComponent: React.ComponentType<{ show?: All; size?: "default" | "large" | "wide" }>;
}
export const Carousel = ({ items, CardComponent }: CarouselProps) => {
    const [startIndex, setStartIndex] = useState(0);
    const [itemsPerView, setItemsPerView] = useState(6);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    // Update itemsPerView on resize
    useEffect(() => {
        const updateLayout = () => {
            const w = window.innerWidth;
            if (w < 640) setItemsPerView(2);
            else if (w < 768) setItemsPerView(3);
            else if (w < 1024) setItemsPerView(4);
            else if (w < 1280) setItemsPerView(5);
            else setItemsPerView(6);
        };

        updateLayout();
        window.addEventListener("resize", updateLayout);
        return () => window.removeEventListener("resize", updateLayout);
    }, []);

    // Clamp startIndex whenever items length or itemsPerView changes
    useEffect(() => {
        setStartIndex(prev => Math.min(prev, Math.max(0, items.length - itemsPerView)));
    }, [items.length, itemsPerView]);

    const maxStart = Math.max(0, items.length - itemsPerView);
    const canScrollLeft = startIndex > 0;
    const canScrollRight = startIndex < maxStart;

    const scrollLeft = () => setStartIndex(prev => Math.max(0, prev - itemsPerView));
    const scrollRight = () => setStartIndex(prev => Math.min(maxStart, prev + itemsPerView));

    const visibleItems = isMobile ? items : items.slice(startIndex, startIndex + itemsPerView);

    return (
        <div className="relative group/carousel">
            {!isMobile && canScrollLeft && (
                <button
                    onClick={scrollLeft}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-12 h-12 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 shadow-2xl ring-2 ring-white/10"
                    aria-label="Scroll left"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
            )}

            {!isMobile && canScrollRight && (
                <button
                    onClick={scrollRight}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-12 h-12 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 shadow-2xl ring-2 ring-white/10"
                    aria-label="Scroll right"
                >
                    <ChevronRight className="w-6 h-6" />
                </button>
            )}

            {/* On mobile: horizontal scroll */}
            <div
                className={
                    isMobile
                        ? "-mx-1 flex gap-3 overflow-x-auto px-1 pb-3 mobile-native-scroll"
                        : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5"
                }
            >
                {visibleItems.map(item => (
                    <div
                        key={item.id}
                        className={isMobile ? "w-[42vw] min-w-[148px] max-w-[180px] flex-shrink-0" : ""}
                    >
                        <CardComponent show={item} />
                    </div>
                ))}
            </div>
        </div>
    );
};
