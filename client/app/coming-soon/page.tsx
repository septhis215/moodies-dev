import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";
import { fetchPaginatedPage } from "@/lib/serverFetch";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchComingSoon(page: number = 1) {
  return fetchPaginatedPage(`${BASE_URL}/category/coming-soon?page=${page}&limit=20`, {
    cache: "no-store",
  });
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
