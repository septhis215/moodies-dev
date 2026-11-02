"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, SearchX, X } from "lucide-react";
import CustomSelect from "@/components/ui/custom-select";
import CelebrityPersonCard from "@/components/celeb/CelebrityPersonCard";
import styles from "@/components/celeb/celebrity-hub.module.css";

const options = [
  { value: "trending", label: "Trending" },
  { value: "popular", label: "Popular" },
  { value: "actors", label: "Actors" },
  { value: "actresses", label: "Actresses" },
  { value: "directors", label: "Directors" },
  { value: "writers", label: "Writers" },
  { value: "movie-stars", label: "Movie stars" },
  { value: "tv-stars", label: "TV stars" },
  { value: "rising", label: "Rising talent" },
];
type Person = {
  id: number;
  name: string;
  profile_path?: string | null;
  known_for_department?: string;
  known_for_titles?: string[];
  known_for?: Array<{
    id: number;
    title?: string;
    name?: string;
    media_type?: string;
  }>;
};
type Discovery = {
  results: Person[];
  total_pages: number;
  total_results: number;
  has_more: boolean;
};
export default function CelebritiesPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const category = options.some(
    (option) => option.value === params.get("category"),
  )
    ? params.get("category")!
    : "trending";
  const query = params.get("q") || "";
  const parsed = Number.parseInt(params.get("page") || "1", 10);
  const page = Number.isFinite(parsed) ? Math.min(8, Math.max(1, parsed)) : 1;
  const [search, setSearch] = useState(query);
  const [data, setData] = useState<Discovery | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const update = useCallback(
    (changes: Record<string, string>, replace = false) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const href = `${pathname}?${next}`;
      if (replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [params, pathname, router],
  );
  useEffect(() => setSearch(query), [query]);
  useEffect(() => {
    if (search === query) return;
    const timeout = window.setTimeout(
      () => update({ q: search.trim(), page: "1" }, true),
      400,
    );
    return () => window.clearTimeout(timeout);
  }, [search, query, update]);
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    const request = new URLSearchParams({
      category,
      page: String(page),
      limit: "24",
    });
    if (query.trim()) request.set("query", query.trim());
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api"}/people/discover?${request}`,
      {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(20000),
        ]),
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Directory unavailable");
        const payload = await response.json();
        if (!Array.isArray(payload.results))
          throw new Error("Invalid directory");
        if (!controller.signal.aborted) {
          setData(payload);
          setStatus("success");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setData(null);
          setStatus("error");
        }
      });
    return () => controller.abort();
  }, [category, page, query, attempt]);
  const totalPages = Math.max(1, Math.min(8, data?.total_pages || page));
  return (
    <section
      className="ui-shell pb-12 pt-6 sm:pb-16 sm:pt-8"
      aria-label="Celebrity directory"
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: search.trim(), page: "1" }, true);
          }}
          className="flex min-h-12 flex-1 items-center gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] px-4 focus-within:border-[var(--brand-coral)]"
        >
          <Search
            className="h-5 w-5 shrink-0 text-[var(--ink-muted)]"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search people"
            aria-label="Search celebrities"
            className="min-w-0 flex-1 bg-transparent py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearch("");
                update({ q: "", page: "1" }, true);
              }}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </form>
        <CustomSelect
          label="People category"
          value={category}
          onChange={(value) => update({ category: value, page: "1" })}
          options={options}
          widthClass="w-full sm:w-56"
        />
      </div>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div
          role="group"
          aria-label="Popular people filters"
          className="flex gap-2"
        >
          {["trending", "popular", "rising"].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              className={styles.chip}
              onClick={() => update({ category: value, page: "1" })}
            >
              {options.find((option) => option.value === value)!.label}
            </button>
          ))}
        </div>
        <p
          className="text-xs text-[var(--ink-muted)]"
          role="status"
          aria-live="polite"
        >
          {status === "loading"
            ? "Finding people…"
            : query
              ? `Results for “${query}”`
              : "Film & TV, through the people who make it"}
        </p>
      </div>
      {status === "loading" ? (
        <div
          className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6"
          aria-label="Loading celebrity profiles"
          role="status"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className="moodies-skeleton aspect-[4/5] rounded-xl motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="ui-panel p-8" role="status">
          <h2 className="text-3xl font-bold">People couldn’t load</h2>
          <p className="mt-3 text-sm text-[var(--ink-muted)]">
            Try loading the directory again.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="ui-secondary-action mt-5"
          >
            Try again
          </button>
        </div>
      ) : data?.results.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-4 lg:grid-cols-6">
          {data.results.map((person) => (
            <CelebrityPersonCard
              key={person.id}
              person={person}
              subtitle={
                person.known_for_titles?.slice(0, 2).join(" · ") ||
                person.known_for_department
              }
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center" role="status">
          <SearchX
            className="mx-auto mb-4 h-8 w-8 text-[var(--ink-muted)]"
            aria-hidden="true"
          />
          <h2 className="text-3xl font-bold">No people found</h2>
          <p className="mt-3 text-sm text-[var(--ink-muted)]">
            Try a different name or category.
          </p>
        </div>
      )}
      {status === "success" && !!data?.results.length && (
        <nav
          aria-label="Celebrity directory pages"
          className="mt-8 flex items-center justify-center gap-5 border-t border-[var(--surface-border)] pt-6"
        >
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            className="ui-secondary-action disabled:opacity-35"
            onClick={() => update({ page: String(page - 1) })}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="text-sm tabular-nums text-[var(--ink-muted)]">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            aria-label="Next page"
            disabled={!data.has_more || page >= totalPages}
            className="ui-secondary-action disabled:opacity-35"
            onClick={() => update({ page: String(page + 1) })}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </nav>
      )}
    </section>
  );
}
