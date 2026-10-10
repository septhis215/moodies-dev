"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ChevronDown, Clapperboard, Film, MessageCircle, Search, Users2, X } from "lucide-react";
import { TmdbImage } from "@/components/ui/TmdbImage";
import { tmdbImage } from "@/lib/tmdb";

type Person = {
  id: number | string;
  name: string;
  profile_path?: string | null;
  character?: string | null;
  job?: string | null;
  department?: string | null;
  order?: number;
  roles?: Array<{ character?: string | null }>;
  jobs?: Array<{ job?: string | null }>;
};

type ContentInfo = {
  content_type: string;
  title: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
};

const CREDIT_BATCH_SIZE = 24;
const EMPTY_PEOPLE: Person[] = [];
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral)]";
const FIELD = "min-h-11 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] text-sm text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral)]";

function portrait(path?: string | null) {
  if (path?.startsWith("/http")) return path.slice(1);
  return tmdbImage(path, "w342") ?? "/placeholder-person.svg";
}

export default function AllCredits({ credits, info, id, highlight }: {
  credits: { cast?: Person[]; crew?: Person[] };
  info: ContentInfo;
  id?: string;
  highlight?: string | null;
}) {
  const cast = credits.cast ?? EMPTY_PEOPLE;
  const crew = credits.crew ?? EMPTY_PEOPLE;
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"cast" | "crew">(() =>
    highlight && !cast.some((person) => String(person.id) === highlight) && crew.some((person) => String(person.id) === highlight) ? "crew" : "cast",
  );
  const [sortBy, setSortBy] = useState<"order" | "name">("order");
  const [department, setDepartment] = useState("");

  const castPeople = useMemo(() => cast.map((person, index) => ({
    ...person,
    order: typeof person.order === "number" ? person.order : index,
    character: person.character || person.roles?.map((role) => role.character).filter(Boolean).join(", ") || "Role unavailable",
  })), [cast]);

  // Movie credits can list the same person more than once for different jobs.
  const crewPeople = useMemo(() => {
    const people = new Map<string, Person>();
    for (const person of crew) {
      const dept = person.department || "Other";
      const key = `${dept}-${person.id}`;
      const previous = people.get(key);
      const jobs = [previous?.job, person.job, ...(person.jobs?.map((item) => item.job) ?? [])]
        .filter((job): job is string => Boolean(job));
      people.set(key, { ...person, department: dept, job: [...new Set(jobs.flatMap((job) => job.split(", ")))].join(", ") });
    }
    return [...people.values()].sort((a, b) => a.department!.localeCompare(b.department!) || a.name.localeCompare(b.name));
  }, [crew]);

  const departments = useMemo(() => [...new Set(crewPeople.map((person) => person.department!))], [crewPeople]);
  const results = useMemo(() => {
    const search = query.trim().toLowerCase();
    const people = tab === "cast" ? castPeople : crewPeople;
    const filtered = people.filter((person) =>
      (tab !== "crew" || !department || person.department === department) &&
      (!search || [person.name, person.character, person.job, person.department].some((value) => value?.toLowerCase().includes(search))),
    );
    if (tab === "cast") filtered.sort((a, b) => sortBy === "name" ? a.name.localeCompare(b.name) : (a.order ?? 0) - (b.order ?? 0));
    return filtered;
  }, [castPeople, crewPeople, department, query, sortBy, tab]);

  const [visibleCount, setVisibleCount] = useState(() => {
    const people = tab === "cast" ? [...castPeople].sort((a, b) => a.order - b.order) : crewPeople;
    const index = people.findIndex((person) => String(person.id) === highlight);
    return Math.max(CREDIT_BATCH_SIZE, Math.ceil((index + 1) / CREDIT_BATCH_SIZE) * CREDIT_BATCH_SIZE);
  });
  const visiblePeople = results.slice(0, visibleCount);
  const groups = tab === "crew" ? departments.map((dept) => ({
    dept, people: visiblePeople.filter((person) => person.department === dept),
  })).filter((group) => group.people.length) : [];
  const titleHref = `/${info.content_type === "movie" ? "movies" : "tv"}/${id}`;
  const year = (info.release_date || info.first_air_date)?.slice(0, 4);
  const highlightedPerson = results.find((person) => String(person.id) === highlight);
  const highlightId = tab === "crew" && highlightedPerson
    ? `credit-crew-${encodeURIComponent(highlightedPerson.department!)}-${highlight}`
    : `credit-cast-${highlight}`;

  useEffect(() => {
    if (!highlight) return;
    const timer = window.setTimeout(() => {
      document.getElementById(highlightId)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "center",
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [highlight, highlightId]);

  function resetFilters() {
    setQuery(""); setDepartment(""); setVisibleCount(CREDIT_BATCH_SIZE);
  }

  function personCard(person: Person, isCrew = false) {
    return (
      <li key={`${person.department ?? "cast"}-${person.id}`} id={isCrew ? `credit-crew-${encodeURIComponent(person.department!)}-${person.id}` : `credit-cast-${person.id}`}
        className={`min-w-0 scroll-mt-28 rounded-xl ${String(person.id) === highlight ? "ring-2 ring-[var(--brand-coral)] ring-offset-4 ring-offset-[var(--surface-0)]" : ""}`}>
        <Link href={`/celeb/${person.id}`} prefetch={false}
          className={`group block rounded-xl ${isCrew ? "flex items-center gap-4 border border-[var(--surface-border)] bg-[var(--surface-1)] p-3 transition-colors hover:bg-[var(--surface-2)]" : ""} ${FOCUS}`}>
          <div className={`relative overflow-hidden rounded-xl bg-[var(--surface-2)] ${isCrew ? "h-20 w-16 shrink-0" : "aspect-[2/3] ring-1 ring-inset ring-[var(--surface-border)]"}`}>
            <TmdbImage src={portrait(person.profile_path)} alt="" fill
              sizes={isCrew ? "64px" : "(min-width: 1280px) 190px, (min-width: 1024px) 18vw, (min-width: 640px) 23vw, 45vw"}
              className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" />
            {!isCrew && <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />}
          </div>
          <div className={`min-w-0 flex-1 ${isCrew ? "" : "mt-3"}`}>
            <div className="flex items-start justify-between gap-2">
              <h3 className={`line-clamp-2 text-sm font-semibold leading-5 transition-colors group-hover:text-[var(--brand-coral-strong)] ${isCrew ? "" : "min-h-10"}`}>{person.name}</h3>
              <ArrowUpRight size={16} className="mt-0.5 shrink-0 text-[var(--ink-muted)] transition-colors group-hover:text-[var(--brand-coral-strong)]" aria-hidden="true" />
            </div>
            <p className={`mt-1 line-clamp-2 text-sm leading-5 text-[var(--ink-muted)] ${isCrew ? "" : "min-h-10"}`} title={isCrew ? person.job || undefined : person.character || undefined}>
              {isCrew ? person.job || "Role unavailable" : person.character}
            </p>
          </div>
        </Link>
      </li>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-0)] pb-12 text-[var(--ink)]">
      <header className="relative isolate overflow-hidden">
        {info.backdrop_path && <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <TmdbImage src={tmdbImage(info.backdrop_path, "w1280")} alt="" fill sizes="100vw" className="object-cover opacity-30" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-0)] via-[var(--surface-0)]/70 to-[var(--surface-0)]/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--surface-0)]/80 to-transparent" />
        </div>}
        <div className="ui-shell pb-8 pt-[calc(2rem+var(--mobile-nav-safe))] sm:pb-10 lg:pt-28">
          <nav aria-label="Title navigation" className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
            <Link href={titleHref} aria-label={`Back to ${info.title}`} className={`inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--brand-coral-strong)] ${FOCUS}`}>
              <ArrowLeft size={16} aria-hidden="true" /><span className="max-w-48 truncate">{info.title}</span>
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link href={titleHref} className="ui-secondary-action leading-none">Details <Film size={16} aria-hidden="true" /></Link>
              <Link href={`${titleHref}/reviews`} className="ui-secondary-action leading-none">Reviews <MessageCircle size={16} aria-hidden="true" /></Link>
              <span aria-current="page" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--brand-coral)]/30 bg-[var(--brand-coral)]/10 px-4 text-sm font-semibold text-[var(--brand-coral-strong)]">Credits <Users2 size={16} aria-hidden="true" /></span>
            </div>
          </nav>
          <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-8">
            <Link href={titleHref} aria-label={`View ${info.title} details`} className={`relative aspect-[2/3] self-start overflow-hidden rounded-xl border border-[var(--surface-border)] shadow-xl shadow-black/30 ${FOCUS}`}>
              <TmdbImage src={tmdbImage(info.poster_path, "w342") ?? "/placeholder-poster.svg"} alt={info.title} fill sizes="(min-width: 640px) 160px, 96px" className="object-cover" />
            </Link>
            <div className="min-w-0">
              <p className="ui-kicker">Cast & crew</p>
              <h1 className="mt-3 max-w-3xl break-words text-balance text-[2.1rem] font-bold leading-[0.98] tracking-normal text-white min-[390px]:text-[2.45rem] sm:text-[clamp(2.45rem,4.6vw,4rem)] sm:leading-[0.96] xl:text-[clamp(2.45rem,4.2vw,4.8rem)]">{info.title}</h1>
              <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--ink-muted)]"><span>{info.content_type === "movie" ? "Film" : "Series"}</span>{year && <span>{year}</span>}</p>
              <p className="mt-4 hidden max-w-xl text-sm leading-6 text-[var(--ink-muted)] sm:block">The faces you remember. The people behind every scene.</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--ink-muted)]"><span><strong className="font-semibold text-[var(--ink)]">{cast.length}</strong> cast</span><span><strong className="font-semibold text-[var(--ink)]">{crewPeople.length}</strong> crew credits</span></div>
            </div>
          </div>
        </div>
      </header>

      <section className="ui-shell py-8 sm:py-10" aria-labelledby="credits-heading">
        <div className="mb-6 space-y-5 sm:mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-5" role="group" aria-label="Credit type">
              {(["cast", "crew"] as const).map((value) => <button type="button" key={value} aria-pressed={tab === value}
                onClick={() => { setTab(value); resetFilters(); }}
                className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-1 text-sm font-semibold transition-colors ${FOCUS} ${tab === value ? "border-[var(--brand-coral)] text-[var(--ink)]" : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
                {value === "cast" ? <Users2 size={16} aria-hidden="true" /> : <Clapperboard size={16} aria-hidden="true" />}{value === "cast" ? "Cast" : "Crew"}
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs">{value === "cast" ? cast.length : crewPeople.length}</span>
              </button>)}
            </div>
            <p role="status" className="text-xs text-[var(--ink-muted)]">{results.length} {results.length === 1 ? "credit" : "credits"}{query.trim() || department ? " found" : ""}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <div className="relative">
              <label htmlFor="credit-search" className="sr-only">Search credits by name or role</label>
              <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" aria-hidden="true" />
              <input id="credit-search" type="search" value={query} placeholder="Search name or role" onChange={(event) => { setQuery(event.target.value); setVisibleCount(CREDIT_BATCH_SIZE); }} className={`${FIELD} py-3 pl-11 pr-12 placeholder:text-[var(--ink-muted)] [&::-webkit-search-cancel-button]:appearance-none`} />
              {query && <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); setVisibleCount(CREDIT_BATCH_SIZE); }} className={`absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)] ${FOCUS}`}><X size={16} aria-hidden="true" /></button>}
            </div>
            <div className="relative">
              <label htmlFor="credit-filter" className="sr-only">{tab === "cast" ? "Sort cast" : "Filter crew department"}</label>
              <select id="credit-filter" value={tab === "cast" ? sortBy : department}
                onChange={(event) => { if (tab === "cast") setSortBy(event.target.value === "name" ? "name" : "order"); else setDepartment(event.target.value); setVisibleCount(CREDIT_BATCH_SIZE); }} className={`${FIELD} appearance-none px-4 py-3 pr-10`}>
                {tab === "cast" ? <><option value="order">Billing order</option><option value="name">Name A–Z</option></> : <><option value="">All departments</option>{departments.map((dept) => <option key={dept} value={dept}>{dept}</option>)}</>}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" aria-hidden="true" />
            </div>
          </div>
        </div>
        <h2 id="credits-heading" className="sr-only">{tab === "cast" ? "Cast" : "Crew"}</h2>
        <div id="credit-results">
          {results.length === 0 ? <div className="ui-panel flex flex-col items-center rounded-xl px-6 py-16 text-center">
            <Users2 size={28} className="text-[var(--brand-coral)]" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-bold leading-tight">{query.trim() || department ? "No matches" : `No ${tab} available`}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{query.trim() || department ? "Try another name, role, or department." : "Credits haven’t been added for this title yet."}</p>
            {(query.trim() || department) && <button type="button" onClick={resetFilters} className="ui-secondary-action mt-5">Reset <X size={16} aria-hidden="true" /></button>}
          </div> : tab === "cast" ? <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-4 sm:gap-x-5 lg:grid-cols-5 xl:grid-cols-6">{visiblePeople.map((person) => personCard(person))}</ul>
            : <div className="space-y-8">{groups.map((group) => <section key={group.dept} aria-labelledby={`dept-${encodeURIComponent(group.dept)}`}>
              <h3 id={`dept-${encodeURIComponent(group.dept)}`} className="mb-4 flex items-center gap-3 text-lg font-bold">{group.dept}<span className="text-xs font-normal text-[var(--ink-muted)]">{results.filter((person) => person.department === group.dept).length}</span></h3>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group.people.map((person) => personCard(person, true))}</ul>
            </section>)}</div>}
        </div>
        {results.length > CREDIT_BATCH_SIZE && <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--surface-border)] pt-5">
          <p role="status" className="text-sm text-[var(--ink-muted)]">{visiblePeople.length} of {results.length} credits</p>
          {visiblePeople.length < results.length && <button type="button" className="ui-secondary-action leading-none" aria-controls="credit-results" onClick={() => setVisibleCount((count) => Math.min(count + CREDIT_BATCH_SIZE, results.length))}>More <ChevronDown size={16} aria-hidden="true" /></button>}
        </div>}
      </section>
    </div>
  );
}
