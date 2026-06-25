import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";
import { fetchPaginatedPage } from "@/lib/serverFetch";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

async function fetchAwardWinners(page: number = 1) {
  return fetchPaginatedPage(`${BASE_URL}/movies/award-winners?page=${page}&limit=20`, {
    cache: "no-store",
  });
}

export const metadata = {
  title: "Award-Winning Movies",
  description: "Discover critically acclaimed and award-winning masterpieces",
  keywords:
    "award winning movies, oscar winners, critically acclaimed films, best movies",
};

export default async function AwardWinnersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const awardWinners = await fetchAwardWinners(page);

  return (
    <main>
      <CategoryContent
        data={awardWinners.data}
        currentPage={awardWinners.page}
        totalPages={awardWinners.totalPages}
        total={awardWinners.total}
        title="Award-Winning Movies"
        subtitle="Critically acclaimed masterpieces"
      />
    </main>
  );
}
