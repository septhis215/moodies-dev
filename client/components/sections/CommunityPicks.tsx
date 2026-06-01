"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Sparkles, Star, UsersRound } from "lucide-react";
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
  endpoint?: string;
}

export default function CommunityPicks({
  data,
  title = "Moodies Crew Reviews",
  subtitle = "Fresh reactions from the community: real opinions, real watch-night energy.",
  endpoint,
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
        const base =
          process.env.NEXT_PUBLIC_NEST_API_URL || "http://localhost:4000";
        const path = endpoint || "/all/trending-reviews";
        const res = await fetch(`${base}${path}`, {
          next: { revalidate: 60 },
        });

        if (!res.ok) throw new Error("Failed to fetch reviews");
        const result = (await res.json()) as ReviewItem[];
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
      <section className="relative mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-white/10 bg-neutral-950/75 p-5 sm:p-7">
          <div className="mb-6 space-y-3">
            <div className="h-5 w-36 animate-pulse rounded-full bg-white/10" />
            <div className="h-8 w-72 max-w-full animate-pulse rounded-lg bg-white/10" />
            <div className="h-4 w-96 max-w-full animate-pulse rounded bg-white/5" />
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-40 w-72 shrink-0 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (reviews.length === 0) return null;

  const ratedCount = reviews.filter((review) => review.rating !== undefined).length;
  const averageRating =
    ratedCount > 0
      ? reviews.reduce((sum, review) => sum + (review.rating ?? 0), 0) / ratedCount
      : null;

  return (
    <section
      id="community"
      className="relative mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
    >
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/75 py-6 shadow-2xl shadow-black/30 sm:py-8">
        <div className="px-5 sm:px-7 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">


              <h2
                className="mt-4 text-xl font-bold tracking-tight text-transparent bg-clip-text sm:text-2xl lg:text-3xl"
                style={{
                  backgroundImage: "linear-gradient(to right, #e94f37, #ff6b58)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {title}
              </h2>

              {subtitle && (
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  {subtitle}
                </p>
              )}
            </div>

          </div>
        </div>

        <div className="mt-4 border-t border-white/10 pt-1">
          <InfiniteMovingCards
            items={reviews}
            direction="left"
            speed="very-slow"
            className="px-0 sm:px-4"
          />
        </div>
      </div>
    </section>
  );
}
