import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchBoxOffice(page: number = 1) {
  // Reuse the existing trending endpoint with pagination
  const res = await fetch(
    `${BASE_URL}/movies/trending?page=${page}&limit=20`,
    {
      cache: "no-store",
    }
  );
  if (!res.ok) return { data: [], total: 0, page: 1, totalPages: 0 };
  return await res.json();
}

export const metadata = {
  title: "Box Office Hits - Moodies",
  description: "Explore the biggest box office hits and trending movies",
  keywords: "box office, trending movies, popular movies, cinema hits",
};

export default async function BoxOfficePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const boxOffice = await fetchBoxOffice(page);

  return (
    <main>
      <CategoryContent
        data={boxOffice.data}
        currentPage={boxOffice.page}
        totalPages={boxOffice.totalPages}
        total={boxOffice.total}
        title="Box Office Hits"
        subtitle="The biggest trending movies from the last year"
      />
    </main>
  );
}
