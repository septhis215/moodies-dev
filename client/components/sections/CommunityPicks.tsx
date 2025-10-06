"use client";

import { useEffect, useState } from "react";
import { InfiniteMovingCards } from "../ui/infinite-moving-cards";

export type ReviewItem = {
    quote: string;
    name: string;
    title: string;
    avatar: string;
    rating?: number;
};

interface CommunityPicksProps {
    data?: ReviewItem[];
    title?: string;
    subtitle?: string;
    endpoint?: string; // Custom API endpoint
}

export default function CommunityPicks({
    data,
    title = "Moodies Crew Reviews",
    subtitle = "The hottest takes and top reviews from your fellow Moodies — real opinions, real vibes.",
    endpoint
}: CommunityPicksProps) {
    const [reviews, setReviews] = useState<ReviewItem[]>(data || []);
    const [loading, setLoading] = useState(!data);

    useEffect(() => {
        if (data) {
            setReviews(data);
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                let result: ReviewItem[];

                if (endpoint) {
                    const base = process.env.NEXT_PUBLIC_NEST_API_URL || "http://localhost:4000";
                    const res = await fetch(`${base}${endpoint}`, { next: { revalidate: 60 } });
                    if (!res.ok) throw new Error("Failed to fetch reviews");
                    result = await res.json();
                } else {
                    // Default endpoint
                    const base = process.env.NEXT_PUBLIC_NEST_API_URL || "http://localhost:4000";
                    const res = await fetch(`${base}/all/trending-reviews`, { next: { revalidate: 60 } });
                    if (!res.ok) throw new Error("Failed to fetch reviews");
                    result = await res.json();
                }

                setReviews(result);
            } catch (error) {
                console.error("Error fetching reviews:", error);
                setReviews([]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [data, endpoint]);

    if (loading) {
        return (
            <section className="relative w-full px-6 py-12 max-w-7xl mx-auto">
                <div className="mb-6">
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{title}</h2>
                    <p className="text-gray-400 text-sm mt-1">Loading reviews...</p>
                </div>
                <div className="flex gap-4 overflow-hidden">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex-shrink-0 w-64 h-36 bg-gray-800 animate-pulse rounded-lg" />
                    ))}
                </div>
            </section>
        );
    }

    if (reviews.length === 0) return null;

    return (
        <section className="relative w-full px-6 py-12 mx-auto max-w-7xl">
            <div className="mb-6">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{title}</h2>
                <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
            </div>
            <InfiniteMovingCards items={reviews} direction="left" speed="very-slow" />
        </section>
    );
}
