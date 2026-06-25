import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";
import { fetchPaginatedPage } from "@/lib/serverFetch";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchNewReleases(page: number = 1) {
  return fetchPaginatedPage(`${BASE_URL}/movies/new-releases?page=${page}&limit=20`, {
    cache: "no-store",
  });
}

export const metadata = {
  title: "New Releases",
  description: "Discover the latest movie releases from the past month",
  keywords: "new movies, latest releases, recent movies, new films",
};

export default async function NewReleasesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const newReleases = await fetchNewReleases(page);

  return (
    <main>
      <CategoryContent
        data={newReleases.data}
        currentPage={newReleases.page}
        totalPages={newReleases.totalPages}
        total={newReleases.total}
        title="New Releases"
        subtitle="Latest movies released in the past year"
      />
    </main>
  );
}
