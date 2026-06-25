import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchComingSoon(page: number = 1) {
  const res = await fetch(
    `${BASE_URL}/category/coming-soon?page=${page}&limit=20`,
    {
      cache: "no-store",
    }
  );
  if (!res.ok) return { data: [], total: 0, page: 1, totalPages: 0 };
  const json = await res.json();
  return json;
}
export default async function ComingSoonPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const comingSoon = await fetchComingSoon(page);
  return (
    <main>
      <CategoryContent
        data={comingSoon.data}
        currentPage={comingSoon.page}
        totalPages={comingSoon.totalPages}
        total={comingSoon.total}
        title={"Coming Soon"}
        subtitle={"Movies and TV Shows Premiering Soon"}
      />
    </main>
  );
}
