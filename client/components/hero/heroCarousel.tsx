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
            className=" h-screen md:h-[80vh] w-full overflow-hidden"
            onMouseEnter={pause}
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
                                style={{ filter: 'brightness(0.42) contrast(1.05)' }}
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
                            'linear-gradient(90deg, rgba(6,6,7,0.78) 6%, rgba(6,6,7,0.45) 28%, rgba(0,0,0,0.0) 60%)',
                    }}
                />
            </div>

            {/* Foreground content + Thumbnails in one row */}
            <div className="absolute bottom-8 left-0 right-0 z-20 px-6">
                <div className="flex justify-between items-end max-w-6xl mx-auto">
                    {/* Left: Foreground text */}
                    <div className="w-full md:w-2/3 lg:w-1/2 text-white">
                        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight drop-shadow-lg">
                            {generals[index].title}
                        </h1>
                        <p className="mt-3 text-sm sm:text-base text-gray-200 max-w-2xl line-clamp-3">
                            {generals[index].overview}
                        </p>
                        <div className="mt-6 flex gap-3">
                            <button className="px-4 py-2 bg-white text-black rounded-md shadow">
                                Watch Now
                            </button>
                            <button className="px-4 py-2 bg-transparent border border-white rounded-md">
                                + Playlist
                            </button>
                        </div>
                    </div>

                    {/* Right: Thumbnails */}
                    <div className="flex gap-3 items-end py-2 px-1">
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
