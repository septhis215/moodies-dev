"use client";

import React, { useId } from "react";
import type { All } from "@/types/all";
import { useCarouselScroll } from "@/hooks/useCarouselScroll";
import { CarouselNavButton } from "@/components/ui/CarouselNavButton";

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
  const railId = useId();
  const { containerRef, canScrollLeft, canScrollRight, scroll } =
    useCarouselScroll(items.length);

  return (
    <div className="group/carousel relative min-w-0">
      <div role="group" aria-label="Card navigation">
        <CarouselNavButton
          direction="previous"
          onClick={() => scroll(-1)}
          disabled={!canScrollLeft}
          aria-controls={railId}
          className="absolute -left-5 top-1/2 z-30 -translate-y-1/2 opacity-0 group-hover/carousel:opacity-100 group-focus-within/carousel:opacity-100 xl:-left-6"
        />
        <CarouselNavButton
          direction="next"
          onClick={() => scroll(1)}
          disabled={!canScrollRight}
          aria-controls={railId}
          className="absolute -right-5 top-1/2 z-30 -translate-y-1/2 opacity-0 group-hover/carousel:opacity-100 group-focus-within/carousel:opacity-100 xl:-right-6"
        />
      </div>
      <div
        id={railId}
        ref={containerRef}
        className={`mobile-native-scroll scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0 ${mobileBleed ? "-mx-4 scroll-px-4 px-4" : "px-0"} ${items.length === 1 ? "justify-center sm:justify-start" : ""}`}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="w-[calc((100%-0.75rem)/2)] min-w-0 shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-4rem)/5)] xl:w-[calc((100%-5rem)/6)]"
          >
            <CardComponent show={item} />
          </div>
        ))}
      </div>
    </div>
  );
};
