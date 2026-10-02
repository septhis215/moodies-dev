"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { All } from "@/types/all";
import CardCarousel from "./CardCarousel";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";

async function fetchTrending(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE}/all/trending`, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load trending titles (${response.status})`);
  }
  return (await response.json()) as All[];
}

interface TrendingSectionProps {
  data?: All[];
  title?: string;
  subtitle?: string;
  endpoint?: string;
}

export default function TrendingSection({
  data,
  title = "Trending now",
  subtitle = "The titles Moodies members are opening and saving most this week.",
  endpoint,
}: TrendingSectionProps) {
  const [trending, setTrending] = useState<All[]>(data ?? []);
  const [loading, setLoading] = useState(!data);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (data) {
      setTrending(data);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const request = endpoint
      ? fetch(`${API_BASE}${endpoint}`, { signal: controller.signal }).then(
          async (response) => {
            if (!response.ok) {
              throw new Error(
                `Failed to load trending titles (${response.status})`,
              );
            }
            return (await response.json()) as All[];
          },
        )
      : fetchTrending(controller.signal);

    request
      .then(setTrending)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Error fetching trending data:", error);
        setTrending([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [data, endpoint, retryKey]);

  if (loading) {
    return (
      <section
        className="ui-shell border-b border-[var(--surface-border)] py-8 sm:py-10"
        aria-labelledby="trending-loading-heading"
        aria-busy="true"
      >
        <h2
          id="trending-loading-heading"
          className="text-3xl font-bold text-[var(--ink)] sm:text-4xl"
        >
          {title}
        </h2>
        <p className="sr-only" role="status">
          Loading trending picks
        </p>
        <div className="mt-5 flex gap-3 overflow-hidden sm:gap-4">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="aspect-[2/3] w-36 shrink-0 animate-pulse rounded-md bg-[var(--surface-2)] sm:w-44"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!trending.length) {
    return (
      <section
        className="ui-shell border-b border-[var(--surface-border)] py-8 sm:py-10"
        aria-labelledby="trending-empty-heading"
      >
        <h2
          id="trending-empty-heading"
          className="text-3xl font-bold text-[var(--ink)] sm:text-4xl"
        >
          {title}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">
          Trending picks could not be loaded right now.
        </p>
        <div className="mt-4 flex flex-wrap gap-5 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
            className="min-h-11 text-[var(--brand-coral-strong)] hover:text-[var(--ink)]"
          >
            Try again
          </button>
          <Link
            href="/trending"
            className="inline-flex min-h-11 items-center text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            Browse all trending titles
          </Link>
        </div>
      </section>
    );
  }

  return (
    <CardCarousel
      title={title}
      subtitle={subtitle}
      items={trending}
      sectionId="trending"
      titleLink="/trending"
    />
  );
}
