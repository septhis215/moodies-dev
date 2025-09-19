"use client";

import { cn } from "@/lib/utils";
import React, { useEffect, useState } from "react";

export const InfiniteMovingCards = ({
  items,
  direction = "left",
  speed = "very-slow", // default very slow
  pauseOnHover = true,
  className,
}: {
  items: {
    quote: string;
    name: string;
    title: string;
    avatar: string;
    rating?: number;
  }[];
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow" | "very-slow";
  pauseOnHover?: boolean;
  className?: string;
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLUListElement>(null);

  useEffect(() => {
    addAnimation();
  }, []);

  const [start, setStart] = useState(false);

  function addAnimation() {
    if (containerRef.current && scrollerRef.current) {
      const scrollerContent = Array.from(scrollerRef.current.children);

      scrollerContent.forEach((item) => {
        const duplicatedItem = item.cloneNode(true);
        if (scrollerRef.current) {
          scrollerRef.current.appendChild(duplicatedItem);
        }
      });

      getDirection();
      getSpeed();
      setStart(true);
    }
  }

  const getDirection = () => {
    if (containerRef.current) {
      containerRef.current.style.setProperty(
        "--animation-direction",
        direction === "left" ? "forwards" : "reverse"
      );
    }
  };

  const getSpeed = () => {
    if (containerRef.current) {
      let duration = "200s"; // fallback
      if (speed === "fast") duration = "40s";
      else if (speed === "normal") duration = "90s";
      else if (speed === "slow") duration = "180s";
      else if (speed === "very-slow") duration = "400s"; // 👈 super slow
      containerRef.current.style.setProperty("--animation-duration", duration);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "scroller relative z-20 w-full px-10 overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_20%,white_80%,transparent)]",
        className
      )}
    >
      <ul
        ref={scrollerRef}
        className={cn(
          "flex w-max min-w-full shrink-0 flex-nowrap gap-6 py-6 animate-scroll",
          pauseOnHover && "hover:[animation-play-state:paused]"
        )}
      >

        {items.map((item, idx) => (
          <li
            key={`${item.name}-${idx}`}
            className={cn(
              "relative w-[350px] max-w-full shrink-0 rounded-2xl border border-white/20",
              "bg-white/10 dark:bg-white/5 backdrop-blur-md shadow-lg",
              "px-8 py-6 md:w-[450px]"
            )}
          >
            <blockquote>
              {/* Review text */}
              <span className="relative z-20 text-sm leading-[1.6] font-normal text-white drop-shadow text-anti-flicker">
                {item.quote}
              </span>

              {/* Footer section */}
              <div className="relative z-20 mt-6 flex flex-row items-center gap-3">
                {/* Avatar */}
                <img
                  src={
                    item.avatar && item.avatar.startsWith("/https")
                      ? item.avatar.slice(1)
                      : item.avatar
                        ? `https://image.tmdb.org/t/p/w185${item.avatar}`
                        : "/placeholder-avatar.png"
                  }
                  alt={item.name}
                  className="w-10 h-10 rounded-full object-cover border border-white/20"
                />

                {/* Name + Title + Rating */}
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-gray-100">
                    {item.name}
                  </span>
                  <span className="text-xs text-gray-300">
                    {item.title}
                  </span>
                  {item.rating !== undefined && (
                    <span className="text-xs text-yellow-400 font-semibold">
                      ⭐ {item.rating}/10
                    </span>
                  )}
                </span>
              </div>
            </blockquote>
          </li>

        ))}
      </ul>
    </div>
  );
};
