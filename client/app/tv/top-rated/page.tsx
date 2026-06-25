import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";
import { fetchPaginatedPage } from "@/lib/serverFetch";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchTopRatedTV(page: number = 1) {
  return fetchPaginatedPage(`${BASE_URL}/tv/favorites?page=${page}&limit=20`, {
    cache: "no-store",
  });
}

export const metadata = {
  title: "Top Rated TV Shows",
  description: "Discover the highest-rated TV shows of all time",
  keywords:
    "top rated tv shows, best series, highest rated shows, critically acclaimed series",
};

export default async function TopRatedTVPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const topRated = await fetchTopRatedTV(page);

  return (
    <main>
      <CategoryContent
        data={topRated.data}
        currentPage={topRated.page}
        totalPages={topRated.totalPages}
        total={topRated.total}
        title="Top Rated Series"
        subtitle="The highest-rated TV shows"
      />
    </main>
  );
}
