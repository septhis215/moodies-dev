import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";
import { fetchPaginatedPage } from "@/lib/serverFetch";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchFeatured(page: number = 1) {
  return fetchPaginatedPage(`${BASE_URL}/movies/featured?page=${page}&limit=20`, {
    cache: "no-store",
  });
}

export const metadata = {
  title: "Featured Movies",
  description: "Discover handpicked featured movies",
  keywords: "featured movies, top movies, must-watch films",
};

export default async function FeaturedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const featured = await fetchFeatured(page);

  return (
    <main>
      <CategoryContent
        data={featured.data}
        currentPage={featured.page}
        totalPages={featured.totalPages}
        total={featured.total}
        title="Featured Movies"
        subtitle="Handpicked selections from the last year"
      />
    </main>
  );
}
