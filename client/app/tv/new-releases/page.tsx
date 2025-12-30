import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchNewReleasesTV(page: number = 1) {
  const res = await fetch(`${BASE_URL}/tv/new-releases?page=${page}&limit=20`, {
    cache: "no-store",
  });
  if (!res.ok) return { data: [], total: 0, page: 1, totalPages: 0 };
  return await res.json();
}

export const metadata = {
  title: "New TV Releases",
  description: "Discover new TV shows releasing this week",
  keywords: "new tv shows, tv premieres, new series, latest tv releases",
};

export default async function NewReleasesTVPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const newReleases = await fetchNewReleasesTV(page);

  return (
    <main>
      <CategoryContent
        data={newReleases.data}
        currentPage={newReleases.page}
        totalPages={newReleases.totalPages}
        total={newReleases.total}
        title="New Releases"
        subtitle="TV shows premiering this week"
      />
    </main>
  );
}
