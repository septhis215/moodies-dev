import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { All } from "@/types/all";

interface CarouselProps {
  items: All[];
  CardComponent: React.ComponentType<{
    show?: All;
    size?: "default" | "large" | "wide";
  }>;
  mobileBleed?: boolean;
}
export const Carousel = ({
  items,
  CardComponent,
  mobileBleed = true,
}: CarouselProps) => {
  const [startIndex, setStartIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(6);

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
    setStartIndex((prev) =>
      Math.min(prev, Math.max(0, items.length - itemsPerView)),
    );
  }, [items.length, itemsPerView]);

  const maxStart = Math.max(0, items.length - itemsPerView);
  const canScrollLeft = startIndex > 0;
  const canScrollRight = startIndex < maxStart;

  const scrollLeft = () =>
    setStartIndex((prev) => Math.max(0, prev - itemsPerView));
  const scrollRight = () =>
    setStartIndex((prev) => Math.min(maxStart, prev + itemsPerView));
  const visibleItems = items.slice(startIndex, startIndex + itemsPerView);

  return (
    <div className="relative group/carousel">
      {canScrollLeft && (
        <button
          onClick={scrollLeft}
          className="absolute left-0 top-1/2 z-10 hidden h-11 w-11 -translate-x-4 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-r from-[#e94f37] to-[#ff6b58] shadow-2xl ring-2 ring-white/10 transition-all hover:scale-110 group-hover/carousel:opacity-100 sm:flex md:opacity-0"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {canScrollRight && (
        <button
          onClick={scrollRight}
          className="absolute right-0 top-1/2 z-10 hidden h-11 w-11 translate-x-4 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-r from-[#e94f37] to-[#ff6b58] shadow-2xl ring-2 ring-white/10 transition-all hover:scale-110 group-hover/carousel:opacity-100 sm:flex md:opacity-0"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      <div
        className={`flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 scroll-smooth sm:hidden ${
          mobileBleed ? "-mx-4 px-4" : "px-0"
        }`}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="w-[42vw] min-w-[145px] max-w-[176px] flex-shrink-0 snap-start"
          >
            <CardComponent show={item} />
          </div>
        ))}
        <div className="w-1 flex-shrink-0 sm:hidden" aria-hidden="true" />
      </div>

      <div className="hidden sm:grid sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {visibleItems.map((item) => (
          <CardComponent key={item.id} show={item} />
        ))}
      </div>
    </div>
  );
};
