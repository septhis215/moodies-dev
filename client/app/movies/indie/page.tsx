import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";
import { fetchPaginatedPage } from "@/lib/serverFetch";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchIndieMovies(page: number = 1) {
  return fetchPaginatedPage(`${BASE_URL}/movies/indie-movies?page=${page}&limit=20`, {
    cache: "no-store",
  });
}

export const metadata = {
  title: "Indie Movies",
  description:
    "Discover hidden gems and festival favorites from independent cinema",
  keywords:
    "indie movies, independent films, art house cinema, festival films, hidden gems",
};

export default async function IndieMoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const indieMovies = await fetchIndieMovies(page);

  return (
    <main>
      <CategoryContent
        data={indieMovies.data}
        currentPage={indieMovies.page}
        totalPages={indieMovies.totalPages}
        total={indieMovies.total}
        title="Indie Spotlight"
        subtitle="Hidden gems & festival favorites"
      />
    </main>
  );
}
