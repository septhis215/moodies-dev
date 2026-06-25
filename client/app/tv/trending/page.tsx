import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";
import { fetchPaginatedPage } from "@/lib/serverFetch";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchTrendingTV(page: number = 1) {
  return fetchPaginatedPage(`${BASE_URL}/tv/trending?page=${page}&limit=20`, {
    cache: "no-store",
  });
}

export const metadata = {
  title: "Trending TV Shows",
  description: "Discover what's trending in TV shows right now",
  keywords: "trending tv shows, popular series, hot shows, trending series",
};

export default async function TrendingTVPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const trendingTV = await fetchTrendingTV(page);

  return (
    <main>
      <CategoryContent
        data={trendingTV.data}
        currentPage={trendingTV.page}
        totalPages={trendingTV.totalPages}
        total={trendingTV.total}
        title="Trending Now"
        subtitle="Most popular TV shows right now"
      />
    </main>
  );
}
