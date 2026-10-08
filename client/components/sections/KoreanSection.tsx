"use client";

import CardCarousel from "./CardCarousel";
import { useEffect, useState } from "react";
import type { All } from "@/types/all";

// Default fetch function for backwards compatibility
async function fetchKoreaTrending() {
  const base = process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
  const res = await fetch(`${base}/all/koreaTrending`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json as All[];
}

interface KoreaTrendingSectionProps {
  data?: All[];
  title?: string;
  subtitle?: string;
  endpoint?: string; // Custom endpoint for fetching
}

export default function KoreaTrendingSection({
  data,
  title = "K-Moods",
  subtitle = "From heart-fluttering romances to gripping thrillers, explore what's trending in Korea, tailored for your mood.",
  endpoint,
}: KoreaTrendingSectionProps) {
  const [koreaTrending, setKoreaTrending] = useState<All[]>(data || []);
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    // If data is passed as props, use it directly
    if (data) {
      setKoreaTrending(data);
      setLoading(false);
      return;
    }

    // Otherwise fetch data
    const fetchData = async () => {
      try {
        setLoading(true);
        let result: All[];

        if (endpoint) {
          const base =
            process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
          const res = await fetch(`${base}${endpoint}`, {
            next: { revalidate: 60 },
          });
          if (!res.ok) throw new Error("Failed to fetch");
          result = await res.json();
        } else {
          result = await fetchKoreaTrending();
        }

        setKoreaTrending(result);
      } catch (error) {
        console.error("Error fetching Korea trending data:", error);
        setKoreaTrending([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [data, endpoint]);

  if (loading) {
    return (
      <section className="ui-shell py-8 sm:py-10" aria-busy="true">
        <div className="mb-5">
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            {title}
          </h2>
          <p className="sr-only" role="status">
            Loading Korean picks
          </p>
        </div>
        <div className="flex gap-3 overflow-hidden sm:gap-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] w-36 shrink-0 moodies-skeleton rounded-xl bg-white/[0.07] sm:w-44"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <CardCarousel
      title={title}
      subtitle={subtitle}
      items={koreaTrending}
      sectionId="korea-trending"
      titleLink="/korean-hits"
    />
  );
}
