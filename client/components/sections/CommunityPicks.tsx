"use client";

import { useEffect, useState } from "react";
import { InfiniteMovingCards } from "../ui/infinite-moving-cards";

type ReviewItem = {
    quote: string;
    name: string;
    title: string;
    avatar: string;
    rating?: number;
};

export default function CommunityPicks() {
    const [reviews, setReviews] = useState<ReviewItem[]>([]);

    useEffect(() => {
        async function fetchData() {
            const base = process.env.NEXT_PUBLIC_NEST_API_URL || "http://localhost:4000";
            const res = await fetch(`${base}/all/trending-reviews`, { next: { revalidate: 60 } });
            if (!res.ok) return [];
            const json = await res.json();
            setReviews(json);
        }
        fetchData();
    }, []);

    return (
        <section className="relative w-full px-6 py-12 mx-auto">
            {/* Section header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                        Moodies Crew Reviews
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        The hottest takes and top reviews from your fellow Moodies — real opinions, real vibes.                    
                    </p>
                </div>
            </div>            {
                reviews.length > 0 ? (
                    <InfiniteMovingCards items={reviews} direction="left" speed="very-slow" />
                ) : (
                    <p className="text-center text-gray-500">Loading reviews...</p>
                )
            }
        </section >
    );
}
