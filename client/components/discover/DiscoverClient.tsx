"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { MediaCard, type MediaCardItem } from "@/components/ui/MediaCard";
import SectionHeader from "@/components/ui/SectionHeader";
import { MediaCardSkeleton } from "@/components/ui/MediaCard";
import { useWatchlist } from "@/hooks/useWatchlist";
import { getMediaApiBase } from "@/lib/mediaApi";

type Result = MediaCardItem & { type: "movie" | "tv" | "person"; profile_path?: string | null };
type FilterResponse = { genres?: string[]; countries?: Array<{ code: string; name: string }> };
type DiscoverResponse = {
  results?: Result[];
  total_results?: number;
  total_pages?: number;
  status?: "success" | "partial" | "empty" | "error";
};

const DEFAULT_TYPE = "movie";
const DEFAULT_SORT = "popularity";

function csv(value: string | null): string[] {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function parseNumber(value: string | null): string {
  return value && /^\d+(\.\d+)?$/.test(value) ? value : "";
}

export default function DiscoverClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isInWatchlist, add, remove, ready } = useWatchlist();

  const query = searchParams.get("q") || "";
  const type = searchParams.get("type") || DEFAULT_TYPE;
  const sort = searchParams.get("sort") || DEFAULT_SORT;
  const page = Number(searchParams.get("page") || "1");
  const selectedGenresParam = searchParams.get("genres") || "";
  const selectedCountriesParam = searchParams.get("countries") || "";
  const selectedGenres = useMemo(() => csv(selectedGenresParam), [selectedGenresParam]);
  const selectedCountries = useMemo(() => csv(selectedCountriesParam), [selectedCountriesParam]);
  const yearMin = searchParams.get("year_min") || "";
  const yearMax = searchParams.get("year_max") || "";
  const ratingMin = searchParams.get("rating_min") || "";
  const ratingMax = searchParams.get("rating_max") || "";

  const [draftQuery, setDraftQuery] = useState(query);
  const [draftType, setDraftType] = useState(type);
  const [draftSort, setDraftSort] = useState(sort);
  const [draftGenres, setDraftGenres] = useState(selectedGenres);
  const [draftCountries, setDraftCountries] = useState(selectedCountries);
  const [draftYearMin, setDraftYearMin] = useState(yearMin);
  const [draftYearMax, setDraftYearMax] = useState(yearMax);
  const [draftRatingMin, setDraftRatingMin] = useState(ratingMin);
  const [draftRatingMax, setDraftRatingMax] = useState(ratingMax);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterResponse>({});
  const [results, setResults] = useState<Result[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "empty" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    setDraftQuery(query);
    setDraftType(type);
    setDraftSort(sort);
    setDraftGenres(selectedGenres);
    setDraftCountries(selectedCountries);
    setDraftYearMin(yearMin);
    setDraftYearMax(yearMax);
    setDraftRatingMin(ratingMin);
    setDraftRatingMax(ratingMax);
  }, [query, type, sort, selectedGenresParam, selectedCountriesParam, selectedGenres, selectedCountries, yearMin, yearMax, ratingMin, ratingMax]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getMediaApiBase()}/search/filters`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : {}))
      .then((value: FilterResponse) => {
        if (!cancelled) setFilters(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set("type", type);
    params.set("page", String(Number.isFinite(page) && page > 0 ? page : 1));
    params.set("sort", sort);
    if (query.trim()) params.set("q", query.trim());
    if (yearMin) params.set("year_min", yearMin);
    if (yearMax) params.set("year_max", yearMax);
    if (ratingMin) params.set("rating_min", ratingMin);
    if (ratingMax) params.set("rating_max", ratingMax);
    if (selectedGenres.length) params.set("genres", selectedGenres.join(","));
    if (selectedCountries.length) params.set("countries", selectedCountries.join(","));

    setStatus("loading");
    setError(null);
    const endpoint = query.trim() ? "/search" : "/search/discover";

    fetch(`${getMediaApiBase()}${endpoint}?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Discovery is temporarily unavailable.");
        return (await response.json()) as DiscoverResponse;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        const nextResults = Array.isArray(payload.results) ? payload.results : [];
        setResults(nextResults);
        setTotalResults(payload.total_results || 0);
        setTotalPages(payload.total_pages || 0);
        setStatus(nextResults.length ? "success" : "empty");
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(reason instanceof Error ? reason.message : "Discovery is temporarily unavailable.");
      });

    return () => controller.abort();
  }, [query, type, sort, page, yearMin, yearMax, ratingMin, ratingMax, selectedGenresParam, selectedCountriesParam, selectedGenres, selectedCountries]);

  const mediaResults = useMemo(
    () => results.filter((result): result is Result & { type: "movie" | "tv" } => result.type === "movie" || result.type === "tv"),
    [results],
  );
  const peopleResults = useMemo(
    () => results.filter((result) => result.type === "person"),
    [results],
  );

  function applyFilters(event?: FormEvent) {
    event?.preventDefault();
    const params = new URLSearchParams();
    if (draftQuery.trim()) params.set("q", draftQuery.trim());
    params.set("type", draftType);
    params.set("sort", draftSort);
    if (draftYearMin) params.set("year_min", draftYearMin);
    if (draftYearMax) params.set("year_max", draftYearMax);
    if (draftRatingMin) params.set("rating_min", draftRatingMin);
    if (draftRatingMax) params.set("rating_max", draftRatingMax);
    if (draftGenres.length) params.set("genres", draftGenres.join(","));
    if (draftCountries.length) params.set("countries", draftCountries.join(","));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setShowFilters(false);
  }

  function resetFilters() {
    setDraftQuery("");
    setDraftType(DEFAULT_TYPE);
    setDraftSort(DEFAULT_SORT);
    setDraftGenres([]);
    setDraftCountries([]);
    setDraftYearMin("");
    setDraftYearMax("");
    setDraftRatingMin("");
    setDraftRatingMax("");
    router.replace(`${pathname}?type=${DEFAULT_TYPE}&sort=${DEFAULT_SORT}`, { scroll: false });
  }

  async function toggleSave(item: Result) {
    if (item.type === "person") return;
    if (!ready) {
      router.push("/auth/login");
      return;
    }
    const key = `${item.type}:${item.id}`;
    setSavingKey(key);
    try {
      const watchType = item.type === "tv" ? "series" : "movie";
      const saved = isInWatchlist(item.id, watchType);
      if (saved) await remove(item.id, watchType, { title: item.title || item.name });
      else await add(item.id, watchType, { title: item.title || item.name });
    } finally {
      setSavingKey(null);
    }
  }

  const hasFilters = Boolean(query || yearMin || yearMax || ratingMin || ratingMax || selectedGenres.length || selectedCountries.length);

  return (
    <main className="min-h-screen bg-surface-0 pb-20 text-white">
      <div className="ui-shell pt-24 sm:pt-32">
        <SectionHeader
          eyebrow="Discovery workspace"
          title="Find something that fits the moment."
          description="Search the catalog or narrow it down by format, mood-adjacent genres, release year, country, and rating. Your filters stay in the URL."
        />

        <form onSubmit={applyFilters} className="ui-panel mt-8 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search titles, people, or keywords</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden="true" />
              <input
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                placeholder="Search titles, people, or keywords"
                className="min-h-12 w-full rounded-xl border border-white/10 bg-black/20 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-brand-coral focus:ring-2 focus:ring-brand-coral/20"
              />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <select value={draftType} onChange={(event) => setDraftType(event.target.value)} className="min-h-12 rounded-xl border border-white/10 bg-surface-1 px-3 text-sm text-white outline-none focus:border-brand-coral">
                <option value="movie">Movies</option>
                <option value="tv">Series</option>
                <option value="all">Movies + series</option>
              </select>
              <select value={draftSort} onChange={(event) => setDraftSort(event.target.value)} className="min-h-12 rounded-xl border border-white/10 bg-surface-1 px-3 text-sm text-white outline-none focus:border-brand-coral">
                <option value="popularity">Popular</option>
                <option value="rating">Top rated</option>
                <option value="date">Newest</option>
              </select>
              <button type="submit" className="ui-primary-action col-span-2 sm:col-span-1">
                <Search className="h-4 w-4" aria-hidden="true" />
                Search
              </button>
              <button type="button" onClick={() => setShowFilters((current) => !current)} className="ui-secondary-action col-span-2 sm:col-span-1">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Filters
              </button>
            </div>
          </div>

          {showFilters ? (
            <div className="mt-5 grid gap-5 border-t border-white/10 pt-5 lg:grid-cols-[1fr_1fr_1fr]">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-white/40">Year</p>
                <div className="grid grid-cols-2 gap-2">
                  <input value={draftYearMin} onChange={(event) => setDraftYearMin(parseNumber(event.target.value))} inputMode="numeric" placeholder="From" className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-brand-coral" />
                  <input value={draftYearMax} onChange={(event) => setDraftYearMax(parseNumber(event.target.value))} inputMode="numeric" placeholder="To" className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-brand-coral" />
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-white/40">Rating</p>
                <div className="grid grid-cols-2 gap-2">
                  <input value={draftRatingMin} onChange={(event) => setDraftRatingMin(parseNumber(event.target.value))} inputMode="decimal" placeholder="Min" className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-brand-coral" />
                  <input value={draftRatingMax} onChange={(event) => setDraftRatingMax(parseNumber(event.target.value))} inputMode="decimal" placeholder="Max" className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-brand-coral" />
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-white/40">Country</p>
                <select value={draftCountries[0] || ""} onChange={(event) => setDraftCountries(event.target.value ? [event.target.value] : [])} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-brand-coral">
                  <option value="">Any country</option>
                  {(filters.countries || []).map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
                </select>
              </div>
              <div className="lg:col-span-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">Genres</p>
                  {draftGenres.length ? <button type="button" onClick={() => setDraftGenres([])} className="text-xs text-white/45 hover:text-white">Clear</button> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(filters.genres || []).slice(0, 18).map((genre) => {
                    const active = draftGenres.includes(genre);
                    return <button type="button" key={genre} onClick={() => setDraftGenres((current) => active ? current.filter((item) => item !== genre) : [...current, genre])} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? "border-brand-coral bg-brand-coral/15 text-brand-coral-strong" : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/25 hover:text-white"}`}>{genre}</button>;
                  })}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:col-span-3">
                <button type="submit" className="ui-primary-action">Apply filters</button>
                <button type="button" onClick={resetFilters} className="ui-secondary-action">Reset</button>
              </div>
            </div>
          ) : null}
        </form>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-white/55">
            <Filter className="h-4 w-4 text-brand-coral-strong" aria-hidden="true" />
            {status === "loading" ? "Finding your next watch…" : `${totalResults.toLocaleString()} results`}
            {hasFilters ? <span className="rounded-full bg-white/[0.06] px-2 py-1 text-xs text-white/45">Filters active</span> : null}
          </div>
          {hasFilters ? <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 text-xs font-semibold text-white/45 hover:text-white"><X className="h-3.5 w-3.5" aria-hidden="true" />Clear all</button> : null}
        </div>

        {status === "loading" ? (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }, (_, index) => <MediaCardSkeleton key={index} />)}
          </div>
        ) : status === "error" ? (
          <div className="ui-panel mt-6 p-8 text-center">
            <h2 className="text-xl font-black text-white">Discovery is taking a breather.</h2>
            <p className="mt-2 text-sm text-white/55">{error}</p>
            <button type="button" onClick={() => applyFilters()} className="ui-primary-action mt-5">Try again</button>
          </div>
        ) : status === "empty" ? (
          <div className="ui-panel mt-6 p-8 text-center">
            <h2 className="text-xl font-black text-white">No titles match those filters.</h2>
            <p className="mt-2 text-sm text-white/55">Try a wider year range, another genre, or reset the filters.</p>
            <button type="button" onClick={resetFilters} className="ui-secondary-action mt-5">Reset discovery</button>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-5 xl:grid-cols-6">
              {mediaResults.map((item) => {
                const watchType = item.type === "tv" ? "series" : "movie";
                const saved = isInWatchlist(item.id, watchType);
                return <MediaCard key={`${item.type}:${item.id}`} item={item} type={item.type} saved={saved} saving={savingKey === `${item.type}:${item.id}`} onToggleSave={() => toggleSave(item)} />;
              })}
            </div>
            {peopleResults.length ? (
              <section className="mt-12" aria-labelledby="people-heading">
                <h2 id="people-heading" className="text-xl font-black text-white">People</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {peopleResults.slice(0, 8).map((person) => <Link key={person.id} href={`/celeb/${person.id}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white/70 hover:border-brand-coral/50 hover:text-white">{person.name || person.title}</Link>)}
                </div>
              </section>
            ) : null}
          </>
        )}

        {totalPages > 1 ? (
          <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Discovery pagination">
            <button type="button" disabled={page <= 1} onClick={() => router.replace(`${pathname}?${new URLSearchParams([...Array.from(searchParams.entries()), ["page", String(page - 1)]])}`, { scroll: false })} className="ui-secondary-action disabled:opacity-35"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Previous</button>
            <span className="text-sm text-white/45">Page {page} of {Math.min(totalPages, 25)}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => router.replace(`${pathname}?${new URLSearchParams([...Array.from(searchParams.entries()), ["page", String(page + 1)]])}`, { scroll: false })} className="ui-secondary-action disabled:opacity-35">Next<ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
          </nav>
        ) : null}
      </div>
    </main>
  );
}
