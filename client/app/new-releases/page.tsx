import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchNewReleases(page: number = 1) {
  const res = await fetch(
    `${BASE_URL}/category/new-releases?page=${page}&limit=20`,
    {
      cache: "no-store",
    }
  );
  if (!res.ok) return { data: [], total: 0, page: 1, totalPages: 0 };
  const json = await res.json();
  console.log("Upcoming data:", json);
  return json;
}

export default async function NewReleasePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const upcoming = await fetchNewReleases(page);
  return (
    <main>
      <CategoryContent
        data={upcoming.data}
        currentPage={upcoming.page}
        totalPages={upcoming.totalPages}
        total={upcoming.total}
        title={"New Releases"}
        subtitle={"Latest Movies and TV Shows"}
      />
    </main>
  );
}
