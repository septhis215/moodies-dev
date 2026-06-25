import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";
import { fetchPaginatedPage } from "@/lib/serverFetch";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchKoreanHits(page: number = 1) {
  return fetchPaginatedPage(`${BASE_URL}/category/korean-hits?page=${page}&limit=20`, {
    cache: "no-store",
  });
}
export default async function KoreanHitsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const koreanHits = await fetchKoreanHits(page);
  return (
    <main>
      <CategoryContent
        data={koreanHits.data}
        currentPage={koreanHits.page}
        totalPages={koreanHits.totalPages}
        total={koreanHits.total}
        title={"Korean Hits"}
        subtitle={"Trending Korean Movies and TV Shows"}
      />
    </main>
  );
}
