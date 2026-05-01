"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Building2, Globe2, TrendingUp } from "lucide-react";
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
  const [providerSearch, setProviderSearch] = useState("");
  const INITIAL_CAST = 12;
  const CAST_STEP = 12;
  const [castLimit, setCastLimit] = useState(INITIAL_CAST);

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

  const resolvedContentType: "movie" | "tv" =
    (info as any)?.content_type === "tv" ? "tv" : "movie";

  const basePath = resolvedContentType === "tv" ? "tv" : "movies";
  const viewAllHref = contentId ? `/${basePath}/${contentId}/credits` : "#";

  return (
    <>
      {/* Featured Cast */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Featured Cast
            </h2>
            <p className="text-slate-400 text-sm">The faces behind the story</p>
          </div>
          <Link
            href={viewAllHref}
            className="inline-block text-xs px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.08] text-slate-200 transition-colors duration-150"
          >
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
          {credits.cast
            .slice(0, castLimit)
            .map((actor, i) => (
              <Link
                key={actor.id}
                href={`/celeb/${actor.id}`}
                className="group block relative aspect-[3/4] rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.07] hover:border-[#e94f37]/40 transition-all duration-300"
              >
                <Image
                  src={
                    actor.profile_path
                      ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
                      : "/placeholder-person.svg"
                  }
                  alt={actor.name}
                  fill
                  sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 17vw"
                  className="object-cover grayscale-[40%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#e94f37]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <span className="absolute top-2 right-2 text-[9px] font-mono text-white/20 group-hover:text-white/50 transition-colors duration-300 leading-none select-none">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-white text-[11px] font-semibold leading-tight truncate">
                    {actor.name}
                  </p>
                  <p className="text-white/40 text-[10px] truncate italic mt-0.5 group-hover:text-white/60 transition-colors duration-300">
                    {actor.character}
                  </p>
                </div>
              </Link>
            ))}
        </div>

        {credits.cast.length > INITIAL_CAST && (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.06]" />
            {castLimit < credits.cast.length && (
              <button
                onClick={() =>
                  setCastLimit((v) =>
                    Math.min(v + CAST_STEP, credits.cast.length),
                  )
                }
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors duration-200 px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-[#e94f37]/30"
              >
                {`Show ${Math.min(CAST_STEP, credits.cast.length - castLimit)} more`}
                <span className="text-white/20">
                  · {credits.cast.length - castLimit} remaining
                </span>
              </button>
            )}
            {castLimit > INITIAL_CAST && (
              <button
                onClick={() => setCastLimit(INITIAL_CAST)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors duration-200 px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-[#e94f37]/30"
              >
                Collapse
              </button>
            )}
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>
        )}
      </section>

      <hr className="border-white/8" />

      <section className="space-y-12">
        {/* Key Personnel — dossier style */}
        {getKeyCrewMembers().some((item) => item.people?.length) && (
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
                className="inline-block text-xs px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.08] text-slate-200 transition-colors duration-150"
              >
                View all →
              </Link>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-white/[0.07]">
              {/* Left gradient accent bar */}
              <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-[#e94f37]/50 to-transparent" />

              <div className="divide-y divide-white/[0.04]">
                {getKeyCrewMembers().map((item, idx) => {
                  const shown = item.people.slice(0, 5);
                  const extra = item.people.length - 5;
                  return (
                    <div
                      key={item.job}
                      className="group relative flex items-start gap-4 sm:gap-6 pl-5 sm:pl-7 pr-5 py-3.5 transition-colors duration-200 hover:bg-white/[0.025]"
                    >
                      {/* Red scan-line sweep on hover */}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#e94f37]/[0.04] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      {/* Index */}
                      <span className="mt-0.5 w-5 shrink-0 text-right text-[10px] font-mono text-white/10 transition-colors duration-200 group-hover:text-[#e94f37]/60">
                        {String(idx + 1).padStart(2, "0")}
                      </span>

                      {/* Role label */}
                      <span className="mt-0.5 w-28 sm:w-36 shrink-0 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.14em] text-white/20 transition-colors duration-200 group-hover:text-white/35 leading-relaxed">
                        {item.job}
                      </span>

                      {/* People */}
                      <div className="flex-1 flex flex-wrap gap-x-4 gap-y-2 min-w-0">
                        {shown.map((person) => (
                          <div key={person.id} className="inline-flex items-center gap-2">
                            <div className="w-[22px] h-[22px] shrink-0 rounded-full overflow-hidden ring-1 ring-white/[0.08] bg-white/[0.05]">
                              <Image
                                src={
                                  person.profile_path
                                    ? `https://image.tmdb.org/t/p/w45${person.profile_path}`
                                    : "/placeholder-person.svg"
                                }
                                alt={person.name}
                                width={22}
                                height={22}
                                className="object-cover w-full h-full grayscale group-hover:grayscale-0 transition-all duration-300"
                              />
                            </div>
                            <span className="text-xs text-white/45 whitespace-nowrap transition-colors duration-200 group-hover:text-white/75">
                              {person.name}
                            </span>
                          </div>
                        ))}
                        {extra > 0 && (
                          <span className="self-center text-[10px] font-mono text-white/20">
                            +{extra}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Studio Partners */}
        {info.production_companies?.length > 0 && (
          <div className="relative">
            <div className="mb-6">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                Studio Partners
              </h2>
              <p className="text-slate-400 text-sm">
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
        <div className="mb-6">
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
