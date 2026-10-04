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
    <div className="min-w-0">
      <div
        className="mb-3 flex justify-end gap-2"
        role="group"
        aria-label="Card navigation"
      >
        <CarouselNavButton
          direction="previous"
          onClick={() => scroll(-1)}
          disabled={!canScrollLeft}
          aria-controls={railId}
        />
        <CarouselNavButton
          direction="next"
          onClick={() => scroll(1)}
          disabled={!canScrollRight}
          aria-controls={railId}
        />
      </div>
      <div
        id={railId}
        ref={containerRef}
        className={`mobile-native-scroll scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 sm:mx-0 sm:scroll-pl-0 sm:gap-4 sm:px-0 ${mobileBleed ? "-mx-4 scroll-pl-4 px-4" : "px-0"}`}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="w-[42vw] min-w-[145px] max-w-[176px] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] sm:min-w-0 sm:max-w-none md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-4rem)/5)] xl:w-[calc((100%-5rem)/6)]"
          >
            <CardComponent show={item} />
          </div>
        ))}
      </div>
    </div>
  );
};
