import React from "react";
import { CategoryContent } from "@/components/category-content/CategoryContent";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";
const PAGE_SIZE = 25;

type SortMode = "curated" | "popular" | "recent";

function toRankingMode(sort: SortMode) {
  if (sort === "popular") return "popular";
  if (sort === "recent") return "recent";
  return "world-cup-docs";
}

async function fetchWorldCupDocs(page: number = 1, sort: SortMode = "curated") {
  const url = new URL(`${BASE_URL}/category/world-cup-docs`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("rankingMode", toRankingMode(sort));
  url.searchParams.set("language", "en-US");
  url.searchParams.set("region", "US");

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!res.ok) {
    return { data: [], total: 0, page: 1, totalPages: 0 };
  }

  return res.json();
}

export const metadata = {
  title: "World Cup Documentaries | Moodies",
  description:
    "Curated World Cup, football documentary, player journey, national team, club docuseries, and tournament story picks on Moodies.",
};

export default async function WorldCupDocsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const sort = params.sort === "popular" || params.sort === "recent" ? params.sort : "curated";
  const collection = await fetchWorldCupDocs(page, sort);

  return (
    <main>
      <CategoryContent
        data={collection.data}
        currentPage={collection.page}
        totalPages={collection.totalPages}
        total={collection.total}
        title="World Cup Documentary Collection"
        subtitle="Curated from trusted football documentary anchors, similar TV series, national-team journeys, player stories, club access, and tournament histories."
      />
    </main>
  );
}
