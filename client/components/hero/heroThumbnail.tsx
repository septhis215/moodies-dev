// src/components/Hero/HeroThumbnail.tsx
"use client";
import React from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import type { All } from "@/types/all";
import { tmdbImage } from "@/lib/tmdb";

type Props = {
  all: All;
  active?: boolean;
  onClick?: () => void;
  width?: number;
  height?: number;
};

export default function HeroThumbnail({
  all,
  active,
  onClick,
  width = 110,
  height = 160,
}: Props) {
  const src =
    tmdbImage(all.poster_path, "w342") || tmdbImage(all.backdrop_path, "w500");

  return (
    <button
      onClick={onClick}
      className={`relative flex-shrink-0 cursor-pointer overflow-hidden rounded-sm border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
        active ? "border-[#ff725e]" : "border-white/15 hover:border-white/50"
      }`}
      aria-pressed={!!active}
      aria-label={`Show ${all.title ?? all.name ?? "featured title"}`}
      style={{ width, height }}
    >
      {src ? (
        <Image
          src={src}
          alt={all.title ?? all.name ?? "Featured poster"}
          fill
          style={{ objectFit: "cover" }}
          sizes={`${width}px`}
        />
      ) : (
        <Image
          src="/placeholder-poster.svg"
          alt="No image"
          fill
          style={{ objectFit: "cover" }}
          sizes={`${width}px`}
        />
      )}

      <div
        className={`absolute inset-0 bg-black transition-opacity ${active ? "opacity-0" : "opacity-35 hover:opacity-10"}`}
      />
      {active ? (
        <span className="absolute inset-x-0 bottom-0 h-1 bg-[#ff725e]" />
      ) : null}
    </button>
  );
}
