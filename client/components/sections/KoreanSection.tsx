"use client";

import CardCarousel from "./CardCarousel";
import { useEffect, useState } from "react";
import type { All } from "@/types/all";

// Default fetch function for backwards compatibility
async function fetchKoreaTrending() {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
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
          const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
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
      <div className="px-6 py-12">
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            {title}
          </h2>
          <p className="text-gray-400 text-sm mt-1">Loading...</p>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-48 h-72 bg-gray-800 animate-pulse rounded-lg"
            />
          ))}
        </div>
      </div>
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
