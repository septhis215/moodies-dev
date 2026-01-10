import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchActionMovies(page: number = 1) {
  const res = await fetch(
    `${BASE_URL}/movies/action-movies?page=${page}&limit=20`,
    {
      cache: "no-store",
    }
  );
  if (!res.ok) return { data: [], total: 0, page: 1, totalPages: 0 };
  return await res.json();
}

export const metadata = {
  title: "Action Movies",
  description: "Discover explosive action-packed movies",
  keywords: "action movies, action films, thriller movies, adventure movies",
};

export default async function ActionMoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const actionMovies = await fetchActionMovies(page);

  return (
    <main>
      <CategoryContent
        data={actionMovies.data}
        currentPage={actionMovies.page}
        totalPages={actionMovies.totalPages}
        total={actionMovies.total}
        title="Action-Packed Movies"
        subtitle="Explosive thrills and high-octane adventures"
      />
    </main>
  );
}
