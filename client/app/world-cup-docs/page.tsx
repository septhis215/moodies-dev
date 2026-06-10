import React from "react";
import Link from "next/link";
import { CategoryContent } from "@/components/category-content/CategoryContent";
import type { All } from "@/types/all";

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";
const PAGE_SIZE = 24;

type SortMode = "curated" | "popular" | "recent";

type CategoryItem = {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  origin_country: string[];
  genres: string[];
  type: "movie" | "tv";
};

function toRankingMode(sort: SortMode) {
  if (sort === "popular") return "popular";
  if (sort === "recent") return "recent";
  return "world-cup-docs";
}

function normalizeItem(item: All): CategoryItem {
  const type = item.type === "tv" ? "tv" : "movie";
  return {
    id: item.id,
    title: item.title || item.name || "Untitled",
    name: item.name,
    overview: item.overview || "",
    poster_path: item.poster_path || undefined,
    backdrop_path: item.backdrop_path || undefined,
    release_date: item.release_date || undefined,
    first_air_date: item.first_air_date || undefined,
    vote_average: item.vote_average || 0,
    vote_count: 0,
    popularity: item.popularity || 0,
    origin_country: item.origin_country || [],
    genres: item.genres || [],
    type,
  };
}

async function fetchWorldCupDocs(page: number, sort: SortMode) {
  const url = new URL(`${BASE_URL}/all/football-stories`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("rankingMode", toRankingMode(sort));
  url.searchParams.set("language", "en-US");
  url.searchParams.set("region", "US");

  const res = await fetch(url.toString(), {
    next: { revalidate: 60 * 30 },
  });

  if (!res.ok) {
    return { data: [], total: 0, page, totalPages: 0 };
  }

  const json = (await res.json()) as All[];
  const data = Array.isArray(json) ? json.map(normalizeItem) : [];

  return {
    data,
    total: data.length,
    page,
    totalPages: data.length >= PAGE_SIZE ? Math.min(page + 1, 5) : page,
  };
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
    <>
      <section className="border-b border-white/10 bg-black px-6 pt-24 text-white sm:px-12">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 pb-4">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">
            Smart recommendation collection
          </div>
          <div className="flex rounded-lg border border-white/10 bg-white/[0.04] p-1">
            {[
              ["curated", "Curated"],
              ["popular", "Popular"],
              ["recent", "Latest"],
            ].map(([value, label]) => (
              <Link
                key={value}
                href={`/world-cup-docs?sort=${value}`}
                className={`rounded-md px-3 py-1.5 text-xs font-black transition ${
                  sort === value
                    ? "bg-[#e94f37] text-white"
                    : "text-white/55 hover:bg-white/10 hover:text-white"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>
      <CategoryContent
        data={collection.data}
        currentPage={collection.page}
        totalPages={collection.totalPages}
        total={collection.total}
        title="World Cup Docs"
        subtitle="Smart picks from trusted football documentary anchors, national-team journeys, player stories, club access series, and tournament histories."
      />
    </>
  );
}
