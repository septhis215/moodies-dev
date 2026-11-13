// src/components/Hero/HeroThumbnail.tsx
"use client";
import React from "react";
import { useIsPresent } from "framer-motion";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import type { All } from "@/types/all";
import { tmdbImage } from "@/lib/tmdb";

type Props = {
  all: All;
  active?: boolean;
  trail: number;
  onClick?: () => void;
};

export default function HeroThumbnail({
  all,
  active,
  trail,
  onClick,
}: Props) {
  const isPresent = useIsPresent();
  const src =
    tmdbImage(all.poster_path, "w342") ||
    tmdbImage(all.backdrop_path, "w500") || "/placeholder-poster.svg";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isPresent}
      aria-hidden={!isPresent}
      className={`relative block aspect-[2/3] cursor-pointer overflow-hidden rounded-md border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
        active ? "w-[72px] border-transparent lg:w-[min(12vw,24svh,10rem)]" : "border-white/20 hover:border-white/60"
      } ${active ? "" : trail === 1 ? "w-14 lg:w-20" : trail === 2 ? "w-12 lg:w-16" : "w-11 lg:w-12"}`}
      aria-pressed={!!active}
      aria-label={`Show ${all.title ?? all.name ?? "featured title"}`}
    >
      <Image src={src} alt="" fill className="object-cover" sizes={active ? "160px" : trail > 0 ? "80px" : "48px"} />

      <div aria-hidden="true" className={`absolute inset-0 bg-linear-to-t from-black/55 to-transparent to-65% motion-safe:transition-opacity ${active ? "opacity-0" : "opacity-70 hover:opacity-20"}`} />
    </button>
  );
}
