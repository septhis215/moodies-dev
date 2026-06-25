import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";
import { fetchPaginatedPage } from "@/lib/serverFetch";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchNewReleases(page: number = 1) {
  return fetchPaginatedPage(
    `${BASE_URL}/category/fresh-off-the-screen?page=${page}&limit=20`,
    { cache: "no-store" }
  );
}

export default async function NewReleasePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const upcoming = await fetchNewReleases(page);
  return (
    <main>
      <CategoryContent
        data={upcoming.data}
        currentPage={upcoming.page}
        totalPages={upcoming.totalPages}
        total={upcoming.total}
        title={"Fresh Off The Screen"}
        subtitle={"The latest movies and TV shows just released"}
      />
    </main>
  );
}
