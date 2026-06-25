import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";
import { fetchPaginatedPage } from "@/lib/serverFetch";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchAiringThisWeek(page: number = 1) {
  return fetchPaginatedPage(`${BASE_URL}/tv/airing/week?page=${page}&limit=20`, {
    cache: "no-store",
  });
}

export const metadata = {
  title: "Airing This Week - TV Shows",
  description: "Discover TV shows airing this week",
  keywords: "tv shows this week, weekly tv schedule, new episodes this week",
};

export default async function AiringThisWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const airingThisWeek = await fetchAiringThisWeek(page);

  return (
    <main>
      <CategoryContent
        data={airingThisWeek.data}
        currentPage={airingThisWeek.page}
        totalPages={airingThisWeek.totalPages}
        total={airingThisWeek.total}
        title="Airing This Week"
        subtitle="TV shows with new episodes this week"
      />
    </main>
  );
}
