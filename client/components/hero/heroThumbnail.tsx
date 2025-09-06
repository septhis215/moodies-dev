// src/components/Hero/HeroThumbnail.tsx
'use client';
import React from 'react';
import Image from 'next/image';
import type { General } from '@/types/general';
import { tmdbImage } from '@/lib/tmdb';

type Props = {
    general: General;
    active?: boolean;
    onClick?: () => void;
    width?: number;
    height?: number;
};

export default function HeroThumbnail({
    general,
    active,
    onClick,
    width = 110,
    height = 160,
}: Props) {
    const src = tmdbImage(general.poster_path, 'w342') || tmdbImage(general.backdrop_path, 'w500');

    return (
        <button
            onClick={onClick}
            className={`relative flex-shrink-0 rounded-md overflow-hidden transition-transform transform focus:outline-none ${active ? 'scale-105 ring-2 ring-white' : 'scale-100'
                }`}
            aria-pressed={!!active}
            aria-label={`Show ${general.title ?? 'general'}`}
            style={{ width, height }}
        >
            {/* Image with fill requires a positioned parent (the button is relative) */}
            {src ? (
                <Image
                    src={src}
                    alt={general.title ?? 'general poster'}
                    fill
                    style={{ objectFit: 'cover' }}
                    // thumbnails shouldn't be priority to avoid many preloads
                    sizes={`${width}px`}
                />
            ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center text-sm text-gray-400">
                    No image
                </div>
            )}

            {/* dark overlay when not active */}
            <div className={`absolute inset-0 ${active ? 'opacity-0' : 'opacity-30'} bg-black`} />
        </button>
    );
}

