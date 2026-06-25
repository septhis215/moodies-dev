import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";
import { fetchPaginatedPage } from "@/lib/serverFetch";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchAnimatedMovies(page: number = 1) {
  return fetchPaginatedPage(`${BASE_URL}/movies/animated-movies?page=${page}&limit=20`, {
    cache: "no-store",
  });
}

export const metadata = {
  title: "Animated Movies",
  description: "Discover enchanting animated films for all ages",
  keywords:
    "animated movies, animation, family movies, cartoon films, pixar, disney",
};

export default async function AnimatedMoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const animatedMovies = await fetchAnimatedMovies(page);

  return (
    <main>
      <CategoryContent
        data={animatedMovies.data}
        currentPage={animatedMovies.page}
        totalPages={animatedMovies.totalPages}
        total={animatedMovies.total}
        title="Animated Magic"
        subtitle="Enchanting stories for all ages"
      />
    </main>
  );
}
