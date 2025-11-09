import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchKoreanHits(page: number = 1) {
  const res = await fetch(
    `${BASE_URL}/category/korean-hits?page=${page}&limit=20`,
    {
      cache: "no-store",
    }
  );
  if (!res.ok) return { data: [], total: 0, page: 1, totalPages: 0 };
  const json = await res.json();
  console.log("Korean Hits data:", json);
  return json;
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
