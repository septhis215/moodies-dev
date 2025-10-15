"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Users2,
  Building2,
  Globe2,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";

export type MovieDetailsData = {
  info: {
    id: number;
    title: string;
    overview: string;
    release_date: string;
    runtime: number;
    budget: number;
    revenue: number;
    vote_average: number;
    vote_count: number;
    genres: Array<{ id: number; name: string }>;
    production_companies: Array<{
      id: number;
      name: string;
      logo_path?: string;
    }>;
    production_countries: Array<{ iso_3166_1: string; name?: string }>;
    spoken_languages: Array<{ iso_639_1: string; name: string }>;
    status: string;
    tagline?: string;
    homepage?: string;
    poster_path?: string;
    backdrop_path?: string;
    content_type: "movie";
    director?: string;
    content_rating?: string;
  };
  credits: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path?: string;
      order: number;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path?: string;
    }>;
  };
  trailer?: any;
  providers?: any;
  reviews?: any[];
  similar?: any[];
  raw?: any;
};

// TV API data structure (matching your updated TvService)
export type TvDetailsData = {
  info: {
    id: number;
    title: string;
    original_title?: string;
    overview: string;
    release_date: string; // maps to first_air_date
    runtime: number; // normalized from episode_run_time
    budget: number;
    revenue: number;
    vote_average: number;
    vote_count: number;
    genres: Array<{ id: number; name: string }>;
    production_companies: Array<{
      id: number;
      name: string;
      logo_path?: string;
    }>;
    production_countries: Array<{ iso_3166_1: string; name?: string }>;
    spoken_languages: Array<{ iso_639_1: string; name: string }>;
    status: string;
    tagline?: string;
    homepage?: string;
    poster_path?: string;
    backdrop_path?: string;
    adult: boolean;
    created_by?: Array<{ id: number; name: string }>;
    content_type: "tv";
    director?: string; // creator name
    content_rating?: string;
    // TV-specific fields
    number_of_seasons?: number;
    number_of_episodes?: number;
    episode_run_time?: number[];
    first_air_date?: string;
    last_air_date?: string;
    networks?: Array<{ id: number; name: string; logo_path?: string }>;
    seasons?: Array<any>;
  };
  credits: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path?: string;
      order: number;
    }>;
    crew: Array<{
      id: number;
      name: string;
      jobs: {
        job: string;
      };
      department: string;
      profile_path?: string;
    }>;
  };
  trailer?: any;
  providers?: any;
  reviews?: any[];
  similar?: any[];
  raw?: any;
};

interface DetailsProp {
  data: MovieDetailsData | TvDetailsData;
}

export default function ExtraDetails({ data }: DetailsProp) {
  // carousel uses a ref-driven single-row scroll
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [providerSearch, setProviderSearch] = useState("");

  const { info, credits, providers } = data;

  // Providers aggregation (unchanged)
  const allProviders = useMemo(() => {
    const map = new Map<
      string,
      { provider_name: string; logo_path?: string }
    >();

    if (!providers?.results) return [];

    Object.values(providers.results).forEach((countryEntry) => {
      ["flatrate", "rent", "buy"].forEach((key) => {
        const list = (countryEntry as any)[key] as
          | Array<{ provider_name: string; logo_path?: string }>
          | undefined;
        if (!Array.isArray(list)) return;
        list.forEach((p) => {
          if (!map.has(p.provider_name)) {
            map.set(p.provider_name, {
              provider_name: p.provider_name,
              logo_path: p.logo_path,
            });
          } else {
            const existing = map.get(p.provider_name)!;
            if (!existing.logo_path && p.logo_path)
              existing.logo_path = p.logo_path;
          }
        });
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      a.provider_name.localeCompare(b.provider_name)
    );
  }, [providers]);

  const filteredProviders = useMemo(() => {
    if (!providerSearch.trim()) return allProviders;
    const q = providerSearch.trim().toLowerCase();
    return allProviders.filter((p) =>
      p.provider_name.toLowerCase().includes(q)
    );
  }, [allProviders, providerSearch]);

  const getKeyCrewMembers = () => {
    const keyJobs = [
      "Director",
      "Producer",
      "Executive Producer",
      "Screenplay",
      "Story",
      "Writer",
      "Original Music Composer",
      "Director of Photography",
    ];

    return keyJobs
      .map((job) => {
        const people = credits.crew.filter((person) => {
          if ("job" in person && person.job) {
            return person.job === job;
          }
          if ("jobs" in person && Array.isArray(person.jobs)) {
            return person.jobs.some((j: any) => j.job === job);
          }
          return false;
        });

        return { job, people };
      })
      .filter((item) => item.people.length > 0);
  };

  // Carousel helpers
  const [itemsPerView, setItemsPerView] = useState(4.5);
  const [itemWidthPx, setItemWidthPx] = useState<number>(220);
  const [maxScrollLeft, setMaxScrollLeft] = useState<number>(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const GAP_PX = 32; // gap-8 = 32px
  const stepCount = Math.max(1, Math.floor(itemsPerView - 1));
  const stepPx = Math.round(stepCount * (itemWidthPx + GAP_PX));

  const scrollNext = () => {
    const el = scrollRef.current;
    if (!el) return;
    const desired = el.scrollLeft + stepPx;
    const next = Math.min(maxScrollLeft, desired);
    el.scrollTo({ left: next, behavior: "smooth" });
  };

  const scrollPrev = () => {
    const el = scrollRef.current;
    if (!el) return;
    const next = Math.max(0, el.scrollLeft - stepPx);
    el.scrollTo({ left: next, behavior: "smooth" });
  };

  // Responsive itemsPerView
  useEffect(() => {
    const updateLayout = () => {
      const w = window.innerWidth;
      if (w < 640) setItemsPerView(1.5);
      else if (w < 768) setItemsPerView(2.5);
      else if (w < 1024) setItemsPerView(3.5);
      else setItemsPerView(4.5);
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  // Compute sizes & scroll limits using DOM measurements
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const compute = () => {
      const containerWidth = el.clientWidth || 0;
      const computed = Math.max(
        140,
        (containerWidth - Math.max(0, itemsPerView - 1) * GAP_PX) / itemsPerView
      );
      setItemWidthPx(Math.round(computed));

      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      setMaxScrollLeft(maxScroll);

      const sLeft = el.scrollLeft || 0;
      setCanScrollLeft(sLeft > 5);
      setCanScrollRight(sLeft < Math.max(0, maxScroll - 5));
    };

    compute();

    const ro = new ResizeObserver(() => compute());
    ro.observe(el);

    const t = setTimeout(() => compute(), 120);

    const onScroll = () => {
      const sLeft = el.scrollLeft || 0;
      setCanScrollLeft(sLeft > 5);
      setCanScrollRight(
        sLeft < Math.max(0, el.scrollWidth - el.clientWidth - 5)
      );
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      ro.disconnect();
      clearTimeout(t);
      el.removeEventListener("scroll", onScroll);
    };
  }, [credits.cast.length, itemsPerView]);

  return (
    <>
      {/* Cast carousel: single-row horizontal scroll */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Featured Cast
            </h2>
            <p className="text-slate-400 text-sm">The faces behind the story</p>
          </div>

          <div className="flex items-center gap-2">
            {canScrollLeft && (
              <button
                onClick={scrollPrev}
                className="w-10 h-10 rounded-full  bg-gradient-to-br from-zinc-900/70 via-neutral-800/50 to-zinc-700/40
                backdrop-blur-md border border-white/10
                text-white shadow-lg shadow-black/40
                hover:scale-110 hover:bg-gradient-to-br hover:from-zinc-800/80 hover:via-neutral-700/60 hover:to-zinc-600/50
                transition-all duration-300 cursor-pointer flex items-center justify-center shadow-md transition"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            {canScrollRight && (
              <button
                onClick={scrollNext}
                className="w-10 h-10 rounded-full  bg-gradient-to-br from-zinc-900/70 via-neutral-800/50 to-zinc-700/40
                backdrop-blur-md border border-white/10
                text-white shadow-lg shadow-black/40
                hover:scale-110 hover:bg-gradient-to-br hover:from-zinc-800/80 hover:via-neutral-700/60 hover:to-zinc-600/50
                transition-all duration-300 cursor-pointer flex items-center justify-center shadow-md transition"
              >
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-8 overflow-x-auto snap-x snap-mandatory pb-8 scrollbar-none"
        >
          {credits.cast.map((actor) => (
            <Link
              href={`/celeb/${actor.id}`}
              key={actor.id}
              className="snap-start flex-shrink-0 min-w-[180px] text-center group"
            >
              <div
                className="relative w-44 h-64 mx-auto rounded-xl overflow-hidden shadow-xl border border-white/10 bg-gradient-to-b from-slate-800/80 to-slate-900/90 
                        group-hover:scale-105 group-hover:rotate-1 transition-all duration-500"
              >
                {/* Glow behind */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent w-auto h-auto" />
                {actor.profile_path ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/w500${actor.profile_path}`}
                    alt={actor.name}
                    fill
                    style={{ objectFit: "cover" }}
                    sizes="176px"
                    className="group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-700/40">
                    <Users2 size={40} className="text-slate-400" />
                  </div>
                )}

                {/* Overlay for name & role */}
                <div className="absolute bottom-0 left-0 right-0 p-3 text-left bg-gradient-to-t from-black/70 via-black/40 to-transparent">
                  <h3 className="font-semibold text-slate-100 truncate">
                    {actor.name}
                  </h3>
                  <p className="text-slate-300 text-xs truncate italic">
                    {actor.character}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <hr className="border-white/8" />

      <section className="space-y-12">
        {/* Director / Producer Spotlight */}
        {(getKeyCrewMembers() || [])
          .filter((item) => item.job)
          .some((item) => item.people?.length) && (
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Key Personnel
            </h2>
            <p className="text-slate-400 text-sm mb-8">
              The creative visionaries behind the film
            </p>

            <div className="flex flex-wrap gap-4">
              {getKeyCrewMembers()
                .filter((item) => item.job)
                .map((item) =>
                  item.people.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                        {person.profile_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w92${person.profile_path}`}
                            alt={person.name}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Users2 size={18} className="text-slate-500" />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col">
                        <span className="text-slate-100 text-sm font-medium leading-tight">
                          {person.name}
                        </span>
                        <span className="text-[10px] uppercase text-slate-400 tracking-wide">
                          {item.job}
                        </span>
                      </div>
                    </div>
                  ))
                )}
            </div>
          </div>
        )}

        {/* Timeline Style Crew List */}
        {(getKeyCrewMembers() || [])
          .filter((item) => item.job)
          .some((item) => item.people?.length) && (
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Creative Team
            </h2>
            <div className="divide-y divide-white/10">
              {getKeyCrewMembers()
                .filter((item) => item.job)
                .map((item) => (
                  <div
                    key={item.job}
                    className="flex justify-between py-3 text-sm"
                  >
                    <span className="text-slate-400 uppercase tracking-wide font-medium">
                      {item.job}
                    </span>
                    <div className="text-slate-100 font-medium">
                      {item.people
                        .map((person) => person.name)
                        .slice(0, 3)
                        .join(", ")}
                      {item.people.length > 3 && (
                        <button className="ml-2 text-xs text-blue-400 hover:text-blue-300">
                          View All
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Studio Partners */}
        {info.production_companies?.length > 0 && (
          <div className="relative mt-20">
            <div className="mb-8">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                Studio Partners
              </h2>
              <p className="text-slate-400 text-sm mb-8">
                In collaboration with industry leaders
              </p>
            </div>

            {/* Banner Strip */}
            <div className="relative bg-gradient-to-r from-indigo-950 via-slate-800 to-indigo-900 py-8 px-4 rounded-2xl overflow-hidden">
              {/* soft luminous center glow */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15),transparent_70%)] pointer-events-none"></div>

              <div className="flex flex-wrap items-center justify-center gap-12 relative z-10">
                {info.production_companies.map((company) => (
                  <div
                    key={company.id}
                    className="flex flex-col items-center group"
                  >
                    <div className="relative flex items-center justify-center w-auto h-auto">
                      {company.logo_path ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w300${company.logo_path}`}
                          alt={company.name}
                          width={180}
                          height={90}
                          className="object-contain opacity-90 group-hover:opacity-100 transition-all duration-300 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                        />
                      ) : (
                        <Building2 size={40} className="text-slate-300" />
                      )}

                      {/* gradient accent line */}
                      <div className="absolute -bottom-2 w-0 group-hover:w-full h-[2px] bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 transition-all duration-500"></div>
                    </div>
                    <p className="mt-4 text-xs text-slate-200 group-hover:text-white transition-colors text-center max-w-[140px]">
                      {company.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <hr className="border-white/8" />

      {/* Global Distribution: Passport stamp style */}
      <section>
        <div className="mb-10">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
            Global Distribution
          </h2>
          <p className="text-slate-400 text-sm">
            International premieres & streaming availability
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Countries */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/70 border border-white/10 shadow-lg p-6 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03] bg-cover bg-center"></div>

            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200 mb-6">
              Release Countries
            </h3>
            <div className="flex flex-wrap gap-3">
              {info.production_countries.map((country) => (
                <span
                  key={country.iso_3166_1}
                  className="px-3 py-1.5 rounded-full border border-indigo-400/40 text-xs font-medium text-slate-100 bg-indigo-500/10 backdrop-blur-sm hover:bg-indigo-500/20 transition"
                >
                  {country.name}
                </span>
              ))}
            </div>

            <div className="mt-6 text-xs text-slate-400">
              ✦ {info.production_countries.length} countries released
            </div>
          </div>

          {/* Streaming Platforms */}
          <div className="rounded-2xl bg-gradient-to-br from-indigo-900/60 to-slate-900/70 border border-white/10 shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                Streaming Platforms
              </h3>
              <span className="text-xs text-slate-400">
                {allProviders.length} providers
              </span>
            </div>

            {/* Search */}
            <div className="mb-6">
              <input
                type="search"
                value={providerSearch}
                onChange={(e) => setProviderSearch(e.target.value)}
                placeholder="Search Netflix, Prime, Disney+..."
                className="w-full bg-slate-800/60 text-slate-100 placeholder-slate-400 rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-400/50"
              />
            </div>

            {/* Providers */}
            <div className="max-h-72 overflow-y-auto pr-1">
              {filteredProviders.length === 0 ? (
                <div className="text-slate-400 text-sm text-center py-6">
                  No providers match your search.
                </div>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {filteredProviders.map((provider, idx) => (
                    <div
                      key={`${provider.provider_name}-${idx}`}
                      className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-indigo-400/60 hover:shadow-md transition-all"
                    >
                      {provider.logo_path ? (
                        <div className="w-14 h-8 relative">
                          <Image
                            src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                            alt={provider.provider_name}
                            fill
                            sizes=""
                            style={{ objectFit: "contain" }}
                          />
                        </div>
                      ) : (
                        <div className="w-14 h-8 flex items-center justify-center bg-white/10 rounded">
                          <GlobeIconFallback />
                        </div>
                      )}
                      <span className="text-xs font-medium text-slate-200">
                        {provider.provider_name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// small fallback icon for providers with no logo
function GlobeIconFallback() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      className="text-slate-400"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12a8 8 0 0013.66 5.12L9.12 6.34A8 8 0 004 12z"
        fill="currentColor"
      />
    </svg>
  );
}
