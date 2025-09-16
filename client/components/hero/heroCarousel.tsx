// src/components/Hero/HeroCarousel.tsx
'use client';
import React, { useEffect } from 'react';
import Image from 'next/image';
import type { General } from '@/types/general';
import { tmdbImage } from '@/lib/tmdb';
import useCarousel from '@/hooks/useCarousel';
import HeroThumbnail from './heroThumbnail';
import './hero.css';

type Props = { generals: General[]; cycleMs?: number };

function getThumbnailWindow<T>(items: T[], index: number, windowSize = 5): T[] {
    const half = Math.floor(windowSize / 2);
    const start = Math.max(0, Math.min(index - half, items.length - windowSize));
    return items.slice(start, start + windowSize);
}

export default function HeroCarousel({ generals = [], cycleMs = 7000 }: Props) {
    const { index, setIndex, pause, resume } = useCarousel({
        length: generals.length,
        intervalMs: cycleMs,
    });

    // preload current + next (use browser Image object; not next/image)
    useEffect(() => {
        if (!generals || generals.length === 0) return;
        const indices = [index, (index + 1) % generals.length];
        indices.forEach((i) => {
            const m = generals[i];
            if (!m) return;
            const b = tmdbImage(m.backdrop_path, 'w1280') || tmdbImage(m.poster_path, 'w1280');
            const p = tmdbImage(m.poster_path, 'w342');
            if (b) {
                const img = new window.Image();
                img.src = b;
            }
            if (p) {
                const img = new window.Image();
                img.src = p;
            }
        });
    }, [index, generals]);

    if (!generals || generals.length === 0) {
        return (
            <section className="h-[60vh] flex items-center justify-center bg-gray-900 text-white">
                No featured generals
            </section>
        );
    }
    const thumbnailWindow = getThumbnailWindow(generals, index, 5);

    return (
        <section
            className="relative w-full overflow-hidden h-screen" onMouseEnter={pause}
            onMouseLeave={resume}
            aria-roledescription="carousel"
        >
            {/* Stacked background images */}
            <div className="absolute inset-0">
                {generals.map((m, i) => {
                    const active = i === index;
                    // prefer backdrop, fallback to poster; fall back to placeholder in public/
                    const src = tmdbImage(m.backdrop_path || m.poster_path, active ? 'w1280' : 'w780') ?? '/images/placeholder-backdrop.jpg';

                    return (
                        <div
                            key={m.id}
                            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${active ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                }`}
                            aria-hidden={!active}
                        >
                            <Image
                                src={src}
                                alt={m.title ?? 'Featured general backdrop'}
                                className="w-full h-full object-cover"
                                style={{ filter: 'brightness(0.72) contrast(1.05)' }}
                                fill
                                // only mark active image as priority to avoid forcing all images to load
                                priority={active}
                                sizes="100vw"
                            />
                        </div>
                    );
                })}

                {/* Gradient overlay to focus left content */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background:
                            "radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0.6) 70%)",
                    }}
                />
            </div>

            {/* Foreground content + Thumbnails in one row */}
            <div className="absolute bottom-8 left-0 right-0 z-20 px-6 w-full">
                <div className="flex flex-col md:flex-row justify-between items-center md:items-end w-full gap-6">
                    {/* Foreground Content */}
                    <div className="flex-1 text-white relative z-10 max-w-3xl">
                        {/* Title */}
                        <h1 className="font-bold leading-tight drop-shadow-2xl text-[clamp(1.75rem,5vw,3rem)] tracking-tight">
                            {generals[index].title}
                        </h1>

                        {/* Overview */}
                        <p className="mt-4 text-[clamp(0.9rem,1.4vw,1.35rem)] text-gray-200/90 drop-shadow-lg max-w-2xl line-clamp-3">
                            {generals[index].overview}
                        </p>

                        {/* Buttons */}
                        <div className="mt-6 flex flex-wrap gap-4">
                            {/* Primary CTA */}
                            <button className="px-[clamp(1rem,2.5vw,1.75rem)] py-[clamp(0.5rem,1vw,0.9rem)] 
      text-[clamp(0.9rem,1.2vw,1rem)] font-semibold
      bg-gradient-to-r from-red-600 to-pink-600 text-white 
      rounded-lg shadow-lg shadow-red-900/40
      hover:from-red-700 hover:to-pink-700 transition-all duration-200">
                                More Info
                            </button>

                            {/* Secondary CTA */}
                            <button className="px-[clamp(1rem,2.5vw,1.75rem)] py-[clamp(0.5rem,1vw,0.9rem)]
      text-[clamp(0.9rem,1.2vw,1rem)] font-medium
      bg-white/10 border border-white/20 text-white 
      rounded-lg backdrop-blur-md hover:bg-white/20 
      transition-all duration-200">
                                + Playlist
                            </button>
                        </div>
                    </div>



                    {/* Right: Thumbnails */}
                    <div className="flex-1 flex flex-wrap md:flex-nowrap gap-3 justify-center md:justify-end">
                        {thumbnailWindow.map((m) => {
                            const i = generals.findIndex((g) => g.id === m.id);
                            return (
                                <HeroThumbnail
                                    key={m.id}
                                    general={m}
                                    active={i === index}
                                    onClick={() => setIndex(i)}
                                    width={110}
                                    height={160}
                                />
                            );
                        })}
                    </div>

                </div>
            </div>
        </section>
    );
}
