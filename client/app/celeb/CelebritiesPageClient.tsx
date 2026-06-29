"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { tmdbImage } from "@/lib/tmdb";
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Film,
  Loader2,
  PenLine,
  Search,
  SearchX,
  Star,
  TrendingUp,
  Tv,
  UserRound,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_NEST_API_URL ||
  "http://localhost:4000";
const MAX_CELEBRITY_PAGES = 8;

type CelebrityCategory =
  | "trending"
  | "actors"
  | "actresses"
  | "directors"
  | "writers"
  | "popular"
  | "movie-stars"
  | "tv-stars"
  | "rising";

type KnownForWork = {
  id: number;
  title?: string;
  name?: string;
  media_type?: "movie" | "tv" | (string & {});
};

type CelebrityCard = {
  id: number;
  name: string;
  known_for_department?: string;
  profile_path?: string | null;
  popularity?: number;
  known_for_titles?: string[];
  known_for?: KnownForWork[];
  media_mix?: {
    movie?: number;
    tv?: number;
  };
};

type PeopleDiscoveryResponse = {
  results: CelebrityCard[];
  page: number;
  total_pages: number;
  total_results: number;
  category: CelebrityCategory;
  query: string;
  source: "popular" | "search" | "trending";
  has_more: boolean;
};

type LoadState = "loading" | "success" | "empty" | "error";

const categoryOptions: Array<{
  value: CelebrityCategory;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { value: "trending", label: "Trending", icon: TrendingUp },
  { value: "actors", label: "Actors", icon: Users },
  { value: "actresses", label: "Actresses", icon: UserRound },
  { value: "directors", label: "Directors", icon: Clapperboard },
  { value: "writers", label: "Writers", icon: PenLine },
  { value: "popular", label: "Popular", icon: Star },
  { value: "movie-stars", label: "Movie Stars", icon: Film },
  { value: "tv-stars", label: "TV Stars", icon: Tv },
  { value: "rising", label: "Rising", icon: WandSparkles },
];

const parseCategory = (value: string | null): CelebrityCategory =>
  categoryOptions.some((option) => option.value === value)
    ? (value as CelebrityCategory)
    : "trending";

const parsePage = (value: string | null) => {
  const page = Number.parseInt(value || "1", 10);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(page, MAX_CELEBRITY_PAGES);
};

const getProfileUrl = (path?: string | null) =>
  path
    ? tmdbImage(path, "w500") || "/placeholder-person.svg"
    : "/placeholder-person.svg";

const getWorkTitle = (work: KnownForWork) =>
  work.title || work.name || "Untitled";

const formatPopularity = (value?: number) => {
  if (!value) return "New";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return Math.round(value).toString();
};

export default function CelebritiesPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const category = parseCategory(searchParams.get("category"));
  const query = searchParams.get("q") || "";
  const page = parsePage(searchParams.get("page"));
  const [searchValue, setSearchValue] = useState(query);
  const [status, setStatus] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PeopleDiscoveryResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeCategory =
    categoryOptions.find((option) => option.value === category) ||
    categoryOptions[0];
  const hasSearch = query.trim().length > 0;

  useEffect(() => {
    setSearchValue(query);
  }, [query]);

  const updateParams = useCallback(
    (
      updates: Partial<{
        category: CelebrityCategory;
        q: string;
        page: number;
      }>,
      mode: "push" | "replace" = "push",
    ) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.category) params.set("category", updates.category);
      if (typeof updates.q === "string") {
        const trimmed = updates.q.trim();
        if (trimmed) params.set("q", trimmed);
        else params.delete("q");
      }
      if (typeof updates.page === "number") {
        params.set(
          "page",
          String(Math.min(MAX_CELEBRITY_PAGES, Math.max(1, updates.page))),
        );
      }

      if (!params.get("category")) params.set("category", category);
      if (!params.get("page")) params.set("page", "1");

      const href = `${pathname}?${params.toString()}`;
      if (mode === "replace") router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [category, pathname, router, searchParams],
  );

  useEffect(() => {
    if (searchValue === query) return;

    const timer = window.setTimeout(() => {
      updateParams({ q: searchValue, page: 1 }, "replace");
    }, 400);

    return () => window.clearTimeout(timer);
  }, [query, searchValue, updateParams]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");
    setError(null);

    async function loadCelebrities() {
      try {
        const params = new URLSearchParams({
          category,
          page: String(page),
          limit: "24",
        });
        if (query.trim()) params.set("query", query.trim());

        const response = await fetch(`${API_BASE}/people/discover?${params}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load celebrity profiles.");
        }

        const payload = (await response.json()) as PeopleDiscoveryResponse;
        if (controller.signal.aborted) return;
        setData(payload);
        setStatus(payload.results.length > 0 ? "success" : "empty");
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setData(null);
        setStatus("error");
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load celebrity profiles.",
        );
      }
    }

    void loadCelebrities();

    return () => controller.abort();
  }, [category, page, query]);

  const totalPages = Math.max(
    1,
    Math.min(data?.total_pages || page, MAX_CELEBRITY_PAGES),
  );
  const canGoPrev = page > 1;
  const canGoNext = Boolean(data?.has_more) && page < totalPages;
  const ActiveCategoryIcon = activeCategory.icon;

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="border-b border-white/10 bg-[linear-gradient(180deg,#050505_0%,#0b0b0c_45%,#000_100%)]">
        <div className="mx-auto max-w-7xl px-4 pb-7 pt-24 sm:px-6 lg:px-8 lg:pt-28">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ef775f]">
                Moodies people
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white sm:text-5xl">
                Celebrities
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/56 sm:text-base">
                Browse cast and creators connected to the movies and series in
                Moodies.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.035] p-3 lg:w-[23rem]">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-black/35 text-[#ef775f]">
                  <ActiveCategoryIcon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {activeCategory.label}
                  </p>
                  <p className="text-xs text-white/42">
                    {data?.results.length || 0} profiles on this page
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-7 space-y-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/38"
                aria-hidden
              />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search names"
                className="h-12 w-full rounded-lg border border-white/10 bg-white/[0.055] py-3 pl-12 pr-12 text-sm text-white outline-none transition placeholder:text-white/35 hover:border-white/18 focus:border-[#e94f37]/60 focus:bg-white/[0.08] focus:ring-4 focus:ring-[#e94f37]/15"
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchValue("");
                    updateParams({ q: "", page: 1 }, "replace");
                  }}
                  className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
                  aria-label="Clear celebrity search"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 mobile-native-scroll">
              {categoryOptions.map((option) => {
                const Icon = option.icon;
                const isActive = option.value === category;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      updateParams({ category: option.value, page: 1 })
                    }
                    className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
                      isActive
                        ? "border-[#e94f37]/55 bg-[#e94f37]/14 text-white"
                        : "border-white/10 bg-white/[0.03] text-white/58 hover:border-white/22 hover:bg-white/[0.06] hover:text-white"
                    }`}
                    aria-pressed={isActive}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        {status === "loading" && <CelebrityGridSkeleton />}

        {status === "error" && (
          <StatePanel
            icon={SearchX}
            title="Profiles unavailable"
            text={error || "Something went wrong while loading celebrities."}
            action={
              <button
                type="button"
                onClick={() => updateParams({ page }, "replace")}
                className="mt-5 rounded-lg bg-[#e94f37] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d7412a]"
              >
                Try again
              </button>
            }
          />
        )}

        {status === "empty" && (
          <StatePanel
            icon={SearchX}
            title={hasSearch ? "No matching names" : "No profiles found"}
            text={
              hasSearch
                ? "Try another spelling or clear the search."
                : "Try another category."
            }
            action={
              hasSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchValue("");
                    updateParams({ q: "", page: 1 }, "replace");
                  }}
                  className="mt-5 rounded-lg bg-[#e94f37] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d7412a]"
                >
                  Clear search
                </button>
              ) : null
            }
          />
        )}

        {status === "success" && data && (
          <>
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ef775f]">
                  {hasSearch ? "Search" : activeCategory.label}
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-normal text-white">
                  {hasSearch ? `"${query}"` : "Browse profiles"}
                </h2>
              </div>
              <p className="text-sm text-white/40">Page {page}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {data.results.map((person) => (
                <CelebrityCard key={person.id} person={person} />
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-5 sm:flex-row">
              <button
                type="button"
                disabled={!canGoPrev}
                onClick={() => updateParams({ page: page - 1 })}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-white/70 transition hover:border-white/22 hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Previous
              </button>
              <span className="text-sm text-white/42">
                Page {page}
                {totalPages > 1 ? ` of ${totalPages}` : ""}
              </span>
              <button
                type="button"
                disabled={!canGoNext}
                onClick={() => updateParams({ page: page + 1 })}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-white/70 transition hover:border-white/22 hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto"
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function CelebrityCard({ person }: { person: CelebrityCard }) {
  const knownTitles = person.known_for_titles?.length
    ? person.known_for_titles
    : (person.known_for || []).map(getWorkTitle).slice(0, 3);

  return (
    <Link
      href={`/celeb/${person.id}`}
      className="group block min-w-0 rounded-lg border border-white/10 bg-white/[0.028] p-2 transition duration-200 hover:-translate-y-0.5 hover:border-[#e94f37]/35 hover:bg-white/[0.055] focus:outline-none focus:ring-2 focus:ring-[#e94f37]/50"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-zinc-900">
        <Image
          src={getProfileUrl(person.profile_path)}
          alt={person.name}
          fill
          sizes="(max-width: 640px) 46vw, (max-width: 1024px) 24vw, 180px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/8 to-transparent" />
        <span className="absolute left-2 top-2 rounded-md bg-black/65 px-2 py-1 text-[10px] font-semibold text-white/82 backdrop-blur">
          {person.known_for_department || "Entertainment"}
        </span>
      </div>

      <div className="px-1 pb-1 pt-2.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white">
            {person.name}
          </h3>
          <span className="shrink-0 rounded-md border border-white/10 bg-black/35 px-1.5 py-0.5 text-[10px] font-semibold text-white/42">
            {formatPopularity(person.popularity)}
          </span>
        </div>
        {knownTitles.length > 0 ? (
          <p className="mt-2 line-clamp-2 min-h-9 text-xs leading-4 text-white/45">
            {knownTitles.join(", ")}
          </p>
        ) : (
          <p className="mt-2 line-clamp-2 min-h-9 text-xs leading-4 text-white/32">
            Open profile
          </p>
        )}
      </div>
    </Link>
  );
}

function CelebrityGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 24 }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-lg bg-white/[0.028] p-2">
          <div className="aspect-[2/3] animate-pulse rounded-md bg-white/[0.06]" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.045]" />
        </div>
      ))}
      <div className="col-span-full flex justify-center pt-2">
        <Loader2 className="h-5 w-5 animate-spin text-[#ef775f]" />
      </div>
    </div>
  );
}

function StatePanel({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-white/10 bg-white/[0.035] p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-[#ef775f]">
        <Icon className="h-7 w-7" aria-hidden />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-white/52">{text}</p>
      {action}
    </div>
  );
}
