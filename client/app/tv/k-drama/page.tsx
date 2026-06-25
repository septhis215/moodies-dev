import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";
import { fetchPaginatedPage } from "@/lib/serverFetch";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchKoreanTV(page: number = 1) {
  return fetchPaginatedPage(`${BASE_URL}/tv/koreaTrending?page=${page}&limit=20`, {
    cache: "no-store",
  });
}

export const metadata = {
  title: "K-Drama Collection",
  description: "Discover the best Korean dramas and TV shows",
  keywords: "korean drama, k-drama, korean tv shows, korean series, hallyu",
};

export default async function KoreanTVPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const koreanTV = await fetchKoreanTV(page);

  return (
    <main>
      <CategoryContent
        data={koreanTV.data}
        currentPage={koreanTV.page}
        totalPages={koreanTV.totalPages}
        total={koreanTV.total}
        title="K-Drama Collection"
        subtitle="The best of Korean television"
      />
    </main>
  );
}
