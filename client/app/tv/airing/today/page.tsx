import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchAiringToday(page: number = 1) {
  const res = await fetch(`${BASE_URL}/tv/airing/today?page=${page}&limit=20`, {
    cache: "no-store",
  });
  if (!res.ok) return { data: [], total: 0, page: 1, totalPages: 0 };
  return await res.json();
}

export const metadata = {
  title: "Airing Today - TV Shows",
  description: "Discover TV shows airing today",
  keywords:
    "tv shows airing today, live tv, current episodes, new episodes today",
};

export default async function AiringTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const airingToday = await fetchAiringToday(page);

  return (
    <main>
      <CategoryContent
        data={airingToday.data}
        currentPage={airingToday.page}
        totalPages={airingToday.totalPages}
        total={airingToday.total}
        title="Airing Today"
        subtitle="TV shows with new episodes today"
      />
    </main>
  );
}
