"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
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
  contentId?: string;
}

export default function ExtraDetails({ data, contentId }: DetailsProp) {
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
      a.provider_name.localeCompare(b.provider_name),
    );
  }, [providers]);

  const filteredProviders = useMemo(() => {
    if (!providerSearch.trim()) return allProviders;
    const q = providerSearch.trim().toLowerCase();
    return allProviders.filter((p) =>
      p.provider_name.toLowerCase().includes(q),
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
        (containerWidth - Math.max(0, itemsPerView - 1) * GAP_PX) /
          itemsPerView,
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
        sLeft < Math.max(0, el.scrollWidth - el.clientWidth - 5),
      );
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      ro.disconnect();
      clearTimeout(t);
      el.removeEventListener("scroll", onScroll);
    };
  }, [credits.cast.length, itemsPerView]);

  const resolvedContentType: "movie" | "tv" =
    (info as any)?.content_type === "tv" ? "tv" : "movie";

  const basePath = resolvedContentType === "tv" ? "tv" : "movies";
  const viewAllHref = contentId ? `/${basePath}/${contentId}/credits` : "#";

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
            <Link
              href={viewAllHref}
              className="inline-block text-xs px-3 py-2 rounded bg-white/6 hover:bg-white/8 text-slate-200"
            >
              View all casts →
            </Link>
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
                <Image
                  src={actor.profile_path ? `https://image.tmdb.org/t/p/w500${actor.profile_path}` : "/placeholder-person.svg"}
                  alt={actor.name}
                  fill
                  style={{ objectFit: "cover" }}
                  sizes="176px"
                  className="group-hover:scale-110 transition-transform duration-500"
                />

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
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                  Key Personnel
                </h2>
                <p className="text-slate-400 text-sm">
                  The creative visionaries behind the film
                </p>
              </div>

              <Link
                href={viewAllHref}
                className="inline-block text-xs px-3 py-2 rounded bg-white/6 hover:bg-white/8 text-slate-200"
              >
                View all personnel →
              </Link>
            </div>

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
                        <Image
                          src={person.profile_path ? `https://image.tmdb.org/t/p/w92${person.profile_path}` : "/placeholder-person.svg"}
                          alt={person.name}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
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
                  )),
                )}
            </div>
          </div>
        )}

        {/* Timeline Style Crew List */}
        {(getKeyCrewMembers() || [])
          .filter((item) => item.job)
          .some((item) => item.people?.length) && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                  Creative Team
                </h2>
                <p className="text-slate-400 text-sm">
                  "Also" creative visionaries behind the film
                </p>
              </div>

              <Link
                href={viewAllHref}
                className="inline-block text-xs px-3 py-2 rounded bg-white/6 hover:bg-white/8 text-slate-200"
              >
                View the team →
              </Link>
            </div>
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

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {info.production_companies.map((company) => (
                <div
                  key={company.id}
                  className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] hover:border-[#e94f37]/25 transition-all duration-200 min-h-[100px]"
                >
                  {company.logo_path ? (
                    <div className="relative w-full h-16 flex-shrink-0">
                      <Image
                        src={`https://image.tmdb.org/t/p/w300${company.logo_path}`}
                        alt={company.name}
                        fill
                        style={{
                          objectFit: "contain",
                          filter: "brightness(0) invert(1)",
                          opacity: 0.65,
                        }}
                        sizes="160px"
                      />
                    </div>
                  ) : (
                    <Building2
                      size={40}
                      className="text-white/20 flex-shrink-0"
                    />
                  )}
                  <p className="text-[11px] text-white/40 text-center leading-snug line-clamp-2">
                    {company.name}
                  </p>
                </div>
              ))}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Countries */}
          <div className="flex flex-col gap-4 p-5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
            <p className="text-[11px] uppercase tracking-widest text-white/30">
              Release Countries
            </p>
            <div className="flex flex-wrap gap-2">
              {info.production_countries.map((country) => (
                <span
                  key={country.iso_3166_1}
                  className="inline-flex items-center px-3 py-1 rounded-full text-[11px] text-white/60 bg-white/[0.05] border border-white/10 hover:bg-[#e94f37]/10 hover:border-[#e94f37]/30 hover:text-white transition-all duration-150"
                >
                  {country.name}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-white/20 pt-3 border-t border-white/[0.06] mt-auto">
              {info.production_countries.length} countr
              {info.production_countries.length === 1 ? "y" : "ies"}
            </p>
          </div>

          {/* Streaming Platforms */}
          <div className="flex flex-col gap-4 p-5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-widest text-white/30">
                Streaming Platforms
              </p>
              <span className="text-[11px] text-white/20">
                {allProviders.length} providers
              </span>
            </div>

            <input
              type="search"
              value={providerSearch}
              onChange={(e) => setProviderSearch(e.target.value)}
              placeholder="Search Netflix, Prime…"
              className="w-full bg-white/[0.05] border border-white/10 focus:border-[#e94f37]/40 rounded-lg px-3 py-2 text-[13px] text-white placeholder-white/25 outline-none transition-colors duration-150"
            />

            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto scrollbar-none">
              {filteredProviders.length === 0 ? (
                <p className="text-xs text-white/25">No providers match.</p>
              ) : (
                filteredProviders.map((provider, idx) => (
                  <div
                    key={`${provider.provider_name}-${idx}`}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-white/60 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:text-white transition-all duration-150 whitespace-nowrap"
                  >
                    {provider.logo_path ? (
                      <div className="relative w-5 h-5 rounded overflow-hidden flex-shrink-0">
                        <Image
                          src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                          alt={provider.provider_name}
                          fill
                          style={{ objectFit: "cover" }}
                          sizes="20px"
                        />
                      </div>
                    ) : (
                      <GlobeIconFallback />
                    )}
                    {provider.provider_name}
                  </div>
                ))
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
