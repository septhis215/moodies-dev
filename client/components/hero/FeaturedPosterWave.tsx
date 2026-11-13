"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { All } from "@/types/all";
import HeroThumbnail from "./heroThumbnail";

export function FeaturedPosterWave({ items: all, index, onSelect }: { items: All[]; index: number; onSelect: (index: number) => void }) {
  const reduceMotion = useReducedMotion();
  const [posterTrack, setPosterTrack] = useState({ items: all, index, position: 0, direction: 1 });
  if (posterTrack.items !== all) {
    setPosterTrack({ items: all, index, position: 0, direction: 1 });
  } else if (posterTrack.index !== index) {
    const forward = (index - posterTrack.index + all.length) % all.length;
    const delta = forward <= all.length / 2 ? forward : forward - all.length;
    setPosterTrack({ items: all, index, position: posterTrack.position + delta, direction: Math.sign(delta) });
  }

  if (!all[index]) return null;

  const passedCount = Math.min(3, Math.max(0, posterTrack.position), all.length - 1);
  const previousCount = Math.min(2, passedCount);
  const upcomingCount = Math.min(4 - previousCount, all.length - 1 - passedCount);
  const railWidth = [0, 88, 160, 216, 272][Math.min(all.length - 1, 4)];
  const thumbnailWindow = Array.from({ length: previousCount + 1 + upcomingCount }, (_, position) => {
    const slideIndex = (index + position - previousCount + all.length) % all.length;
    return { item: all[slideIndex], slideIndex };
  });
  return (
    <div data-hero-selector role="group" aria-label="Featured posters" className="relative flex min-h-[108px] items-end gap-1.5 lg:min-h-[min(18vw,36svh,15rem)] lg:w-(--poster-rail-width) lg:gap-2" style={{ "--poster-rail-width": `calc(min(12vw, 24svh, 10rem) + ${railWidth}px)` } as React.CSSProperties}>
      <AnimatePresence initial={false} mode="popLayout" custom={posterTrack.direction}>
        {thumbnailWindow.map(({ item, slideIndex }, position) => (
            <motion.div
              key={`${item.type}-${item.id}`}
              layout={!reduceMotion}
              initial={{ opacity: 0, x: reduceMotion ? 0 : posterTrack.direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit="exit"
              variants={{ exit: (direction: number) => ({ opacity: 0, x: reduceMotion ? 0 : direction * -32 }) }}
              transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
              className="shrink-0"
            >
              <HeroThumbnail
                all={item}
                active={slideIndex === index}
                trail={previousCount - position}
                onClick={() => onSelect(slideIndex)}
              />
            </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
