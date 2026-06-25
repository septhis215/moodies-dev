import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";
import { fetchPaginatedPage } from "@/lib/serverFetch";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchKoreanCinema(page: number = 1) {
  return fetchPaginatedPage(`${BASE_URL}/movies/koreaTrending?page=${page}&limit=20`, {
    cache: "no-store",
  });
}

export const metadata = {
  title: "Korean Cinema",
  description: "Discover the best of Korean movies",
  keywords: "korean movies, k-movies, korean cinema, korean films",
};

export default async function KoreanCinemaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const koreanMovies = await fetchKoreanCinema(page);

  return (
    <main>
      <CategoryContent
        data={koreanMovies.data}
        currentPage={koreanMovies.page}
        totalPages={koreanMovies.totalPages}
        total={koreanMovies.total}
        title="Korean Cinema"
        subtitle="Award-winning storytelling from Korea"
      />
    </main>
  );
}
