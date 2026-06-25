import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";
import { fetchPaginatedPage } from "@/lib/serverFetch";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchTrending(page: number = 1) {
  return fetchPaginatedPage(`${BASE_URL}/category/trending?page=${page}&limit=20`, {
    cache: "no-store",
  });
}

export default async function TrendingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const trending = await fetchTrending(page);

  return (
    <main>
      <CategoryContent
        data={trending.data}
        currentPage={trending.page}
        totalPages={trending.totalPages}
        total={trending.total}
        title={"Top Trending"}
        subtitle={"Most trending movies and TV shows right now"}
      />
    </main>
  );
}
