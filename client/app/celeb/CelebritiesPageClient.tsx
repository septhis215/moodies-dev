"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { tmdbImage } from "@/lib/tmdb";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
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
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    value: "trending",
    label: "Trending",
    description: "Names lighting up watchlists right now.",
    icon: TrendingUp,
  },
  {
    value: "actors",
    label: "Actors",
    description: "Performers carrying big-screen moods.",
    icon: Users,
  },
  {
    value: "actresses",
    label: "Actresses",
    description: "Leading faces across films and series.",
    icon: UserRound,
  },
  {
    value: "directors",
    label: "Directors",
    description: "The taste-makers behind the camera.",
    icon: Clapperboard,
  },
  {
    value: "writers",
    label: "Writers",
    description: "Story architects shaping every scene.",
    icon: PenLine,
  },
  {
    value: "popular",
    label: "Popular",
    description: "Familiar favorites with staying power.",
    icon: Star,
  },
  {
    value: "movie-stars",
    label: "Movie Stars",
    description: "Cinema-first icons and fan magnets.",
    icon: Film,
  },
  {
    value: "tv-stars",
    label: "TV Stars",
    description: "Small-screen standouts worth following.",
    icon: Tv,
  },
  {
    value: "rising",
    label: "Rising",
    description: "Fresh momentum and breakout energy.",
    icon: WandSparkles,
  },
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
  const featuredPeople = data?.results.slice(0, 3) || [];
  const visibleCount = data?.results.length || 0;
  const totalResultLabel =
    data && data.total_results > 0
      ? `${Math.min(data.total_results, MAX_CELEBRITY_PAGES * 24)}+`
      : "Live";

  return (
    <main className="min-h-screen bg-[#030303] text-white">
      <section className="relative isolate overflow-hidden border-b border-white/10">
        <Image
          src="/images/celeb-homepage-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#030303_0%,rgba(3,3,3,0.92)_30%,rgba(3,3,3,0.58)_63%,rgba(3,3,3,0.82)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-[#030303] to-transparent" />

        <div className="mx-auto max-w-7xl px-4 pb-8 pt-24 sm:px-6 lg:px-8 lg:pb-12 lg:pt-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/35 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#ff9a84] backdrop-blur">
              <Camera className="h-3.5 w-3.5" aria-hidden />
              Moodies Celebs
            </div>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.02] tracking-normal text-white sm:text-6xl lg:text-7xl">
              Find the faces behind every mood.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-white/68 sm:text-base">
              A people-first homepage for actors, directors, writers, icons,
              and rising talent connected to the movies and shows you already
              love on Moodies.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="relative max-w-2xl">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40"
                aria-hidden
              />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search actors, directors, writers"
                className="h-14 w-full rounded-lg border border-white/12 bg-black/45 py-3 pl-12 pr-12 text-sm text-white shadow-2xl shadow-black/30 outline-none backdrop-blur transition placeholder:text-white/38 hover:border-white/24 focus:border-[#e94f37]/70 focus:bg-black/[0.62] focus:ring-4 focus:ring-[#e94f37]/15"
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

            <div className="grid grid-cols-3 gap-2 sm:w-[22rem]">
              <HeroStat label="Profiles" value={totalResultLabel} />
              <HeroStat label="Mode" value={activeCategory.label} />
              <HeroStat label="Page" value={String(page)} />
            </div>
          </div>

          <div className="mt-7 flex gap-2 overflow-x-auto pb-1 mobile-native-scroll">
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
                      ? "border-[#e94f37]/60 bg-[#e94f37]/18 text-white shadow-lg shadow-[#e94f37]/10"
                      : "border-white/12 bg-black/35 text-white/64 backdrop-blur hover:border-white/26 hover:bg-white/[0.08] hover:text-white"
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
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-8 grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-lg border border-white/10 bg-[linear-gradient(135deg,rgba(233,79,55,0.16),rgba(255,255,255,0.04)_42%,rgba(0,0,0,0.34))] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/35 text-[#ff8a73]">
                <ActiveCategoryIcon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff9a84]">
                  Now exploring
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-normal text-white">
                  {activeCategory.label}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/58">
                  {hasSearch
                    ? `Filtered by "${query}".`
                    : activeCategory.description}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/35 text-[#ffcf7a]">
                <BadgeCheck className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">
                  Homepage-ready discovery
                </p>
                <p className="mt-1 text-sm leading-5 text-white/50">
                  Search by name, browse by craft, then open each profile for
                  credits and Moodies context.
                </p>
              </div>
            </div>
          </div>
        </div>

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
            {featuredPeople.length > 0 && (
              <div className="mb-9">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff9a84]">
                      Spotlight
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-normal text-white">
                      Lead names to know
                    </h2>
                  </div>
                  <span className="hidden text-sm text-white/42 sm:inline">
                    {visibleCount} profiles loaded
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {featuredPeople.map((person, index) => (
                    <SpotlightCard
                      key={`spotlight-${person.id}`}
                      person={person}
                      index={index}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ef775f]">
                  {hasSearch ? "Search" : activeCategory.label}
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-normal text-white">
                  {hasSearch ? `"${query}"` : "Celebrity directory"}
                </h2>
              </div>
              <p className="text-sm text-white/40">Page {page}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/[0.38] px-3 py-2.5 backdrop-blur">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function SpotlightCard({
  person,
  index,
}: {
  person: CelebrityCard;
  index: number;
}) {
  const knownTitles = person.known_for_titles?.length
    ? person.known_for_titles
    : (person.known_for || []).map(getWorkTitle).slice(0, 2);

  return (
    <Link
      href={`/celeb/${person.id}`}
      className="group relative min-h-64 overflow-hidden rounded-lg border border-white/10 bg-white/[0.035] transition duration-200 hover:-translate-y-0.5 hover:border-[#e94f37]/40 focus:outline-none focus:ring-2 focus:ring-[#e94f37]/50"
    >
      <Image
        src={getProfileUrl(person.profile_path)}
        alt={person.name}
        fill
        sizes="(max-width: 768px) 92vw, 33vw"
        className="object-cover transition duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/42 to-black/8" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white/78 backdrop-blur">
          <Star className="h-3.5 w-3.5 text-[#ffcf7a]" aria-hidden />
          Spotlight {index + 1}
        </div>
        <h3 className="line-clamp-2 text-2xl font-semibold leading-tight text-white">
          {person.name}
        </h3>
        <p className="mt-2 text-sm font-medium text-[#ff9a84]">
          {person.known_for_department || "Entertainment"}
        </p>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-white/58">
          {knownTitles.length > 0
            ? knownTitles.join(", ")
            : "Open profile for credits and more."}
        </p>
        <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white">
          View profile
          <ArrowRight
            className="h-4 w-4 transition group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>
    </Link>
  );
}

function CelebrityCard({ person }: { person: CelebrityCard }) {
  const knownTitles = person.known_for_titles?.length
    ? person.known_for_titles
    : (person.known_for || []).map(getWorkTitle).slice(0, 3);

  return (
    <Link
      href={`/celeb/${person.id}`}
      className="group block min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#0a0a0b] transition duration-200 hover:-translate-y-0.5 hover:border-[#e94f37]/35 hover:bg-[#111113] focus:outline-none focus:ring-2 focus:ring-[#e94f37]/50"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-zinc-900">
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
        <span className="absolute bottom-2 right-2 rounded-md border border-white/10 bg-black/65 px-2 py-1 text-[10px] font-semibold text-white/70 backdrop-blur">
          {formatPopularity(person.popularity)}
        </span>
      </div>

      <div className="p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug text-white">
          {person.name}
        </h3>
        {knownTitles.length > 0 ? (
          <p className="mt-2 line-clamp-2 min-h-9 text-xs leading-4 text-white/48">
            {knownTitles.join(", ")}
          </p>
        ) : (
          <p className="mt-2 line-clamp-2 min-h-9 text-xs leading-4 text-white/32">
            Open profile
          </p>
        )}
        <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#ff9a84]">
          Details
          <ArrowRight
            className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
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
