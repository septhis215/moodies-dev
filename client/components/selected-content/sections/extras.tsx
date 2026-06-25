"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Building2, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";
import type {
  MovieDetailsData,
  ProviderCountry,
  TvDetailsData,
} from "@/components/selected-content/types";

interface DetailsProp {
  data: MovieDetailsData | TvDetailsData;
  contentId?: string;
}

/* role → accent color mapping */
function roleColor(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("director")) return "#e94f37";
  if (r.includes("produc")) return "#f59e0b";
  if (r.includes("writ") || r.includes("story") || r.includes("screenplay"))
    return "#38bdf8";
  if (r.includes("music") || r.includes("composer")) return "#a78bfa";
  if (r.includes("photograph")) return "#34d399";
  return "#94a3b8";
}

export default function ExtraDetails({ data, contentId }: DetailsProp) {
  const [providerSearch, setProviderSearch] = useState("");
  const INITIAL_CAST = 12;
  const CAST_STEP = 12;
  const [castLimit, setCastLimit] = useState(INITIAL_CAST);

  const { info, credits, providers } = data;

  const allProviders = useMemo(() => {
    const map = new Map<
      string,
      { provider_name: string; logo_path?: string }
    >();
    if (!providers?.results) return [];
    Object.values(providers.results).forEach((countryEntry) => {
      ["flatrate", "rent", "buy"].forEach((key) => {
        const list = countryEntry[key as keyof ProviderCountry];
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
          if ("job" in person && person.job) return person.job === job;
          if ("jobs" in person && Array.isArray(person.jobs))
            return person.jobs.some((j) => j.job === job);
          return false;
        });
        return { job, people };
      })
      .filter((item) => item.people.length > 0);
  };

  const resolvedContentType: "movie" | "tv" =
    info.content_type === "tv" ? "tv" : "movie";
  const basePath = resolvedContentType === "tv" ? "tv" : "movies";
  const viewAllHref = contentId ? `/${basePath}/${contentId}/credits` : "#";

  /* Flatten crew into individual credit cards */
  const creditCards = getKeyCrewMembers().flatMap(({ job, people }) =>
    people.map((person) => ({ ...person, role: job })),
  );

  return (
    <>
      {/* ═══════════════════════════════════════════════════
          FEATURED CAST — Cinema roster with numbered stills
          ═══════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Featured Cast
            </h2>
            <p className="text-slate-400 text-sm mt-0.5">
              The faces behind the story
            </p>
          </div>
          <Link
            href={viewAllHref}
            className="text-xs px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.09] text-slate-200 transition-colors duration-150"
          >
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
          {credits.cast.slice(0, castLimit).map((actor) => (
            <Link
              key={actor.id}
              href={`/celeb/${actor.id}`}
              className="group block relative aspect-[3/4] rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.07] hover:border-[#e94f37]/45 transition-all duration-300 hover:scale-[1.025] hover:shadow-lg hover:shadow-black/40"
            >
              {/* Photo */}
              <Image
                src={
                  actor.profile_path
                    ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
                    : "/placeholder-person.svg"
                }
                alt={actor.name}
                fill
                sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 17vw"
                className="object-cover transition-all duration-500 group-hover:scale-[1.07]"
              />

              {/* Base gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/15 to-transparent" />

              {/* Red tint on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#e94f37]/18 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />

              {/* Number stamp — top left */}
             

              {/* Info panel — slides up from bottom */}
              <div className="absolute bottom-0 left-0 right-0 translate-y-[4px] group-hover:translate-y-0 transition-transform duration-300 ease-out">
                <div className="px-2.5 pb-2.5 pt-6 bg-gradient-to-t from-black/98 to-transparent">
                  <p className="text-white text-[13px] font-semibold leading-tight truncate">
                    {actor.name}
                  </p>
                  <p className="text-[#e94f37]/75 text-[11.5px] truncate italic mt-0.5 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 delay-75">
                    {actor.character}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Load more / collapse */}
        {credits.cast.length > INITIAL_CAST && (
          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
            {castLimit < credits.cast.length && (
              <button
                onClick={() =>
                  setCastLimit((v) =>
                    Math.min(v + CAST_STEP, credits.cast.length),
                  )
                }
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white px-5 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] hover:border-[#e94f37]/30 transition-all duration-200"
              >
                <ChevronDown size={11} />
                {Math.min(CAST_STEP, credits.cast.length - castLimit)} more
                <span className="text-white/20 font-mono text-[10px]">
                  · {credits.cast.length - castLimit} left
                </span>
              </button>
            )}
            {castLimit > INITIAL_CAST && (
              <button
                onClick={() => setCastLimit(INITIAL_CAST)}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white px-5 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] hover:border-[#e94f37]/30 transition-all duration-200"
              >
                <ChevronUp size={11} />
                Collapse
              </button>
            )}
            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-white/[0.07] to-transparent" />
          </div>
        )}
      </section>

      <hr className="border-white/[0.06]" />

      <section className="space-y-12">
        {/* ═══════════════════════════════════════════════════
            KEY PERSONNEL — Individual role-color credit cards
            ═══════════════════════════════════════════════════ */}
        {creditCards.length > 0 && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                  Key Personnel
                </h2>
                <p className="text-slate-400 text-sm mt-0.5">
                  The creative visionaries behind the film
                </p>
              </div>
              <Link
                href={viewAllHref}
                className="text-xs px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.09] text-slate-200 transition-colors duration-150"
              >
                View all →
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {creditCards.map((person, idx) => {
                const color = roleColor(person.role);
                return (
                  <motion.div
                    key={`${person.id}-${person.role}-${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ delay: idx * 0.04, duration: 0.3 }}
                  >
                    <Link
                      href={`/celeb/${person.id}`}
                      className="group relative flex flex-col gap-2.5 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] hover:border-white/[0.13] transition-all duration-200 overflow-hidden block"
                    >
                      {/* Left accent on hover */}
                      <div
                        className="pointer-events-none absolute left-0 top-0 bottom-0 w-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{
                          background: `linear-gradient(to bottom, transparent, ${color}80, transparent)`,
                        }}
                      />

                      {/* Role badge */}
                      <div className="flex items-center min-w-0">
                        <span
                          className="inline-block text-[9px] font-semibold uppercase tracking-[0.14em] px-2 py-0.5 rounded-full truncate max-w-full"
                          style={{
                            color,
                            background: `${color}14`,
                            border: `1px solid ${color}28`,
                          }}
                        >
                          {person.role}
                        </span>
                      </div>

                      {/* Avatar + name row */}
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.05] ring-1 ring-white/[0.08] group-hover:ring-white/[0.16] transition-all duration-200">
                          <Image
                            src={
                              person.profile_path
                                ? `https://image.tmdb.org/t/p/w45${person.profile_path}`
                                : "/placeholder-person.svg"
                            }
                            alt={person.name}
                            width={40}
                            height={40}
                            className="object-cover w-full h-full"
                          />
                        </div>
                        <p className="text-[12px] font-semibold text-white/75 group-hover:text-white transition-colors duration-200 leading-tight line-clamp-2">
                          {person.name}
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            STUDIO PARTNERS — Premium numbered logo showcase
            ═══════════════════════════════════════════════════ */}
        {info.production_companies?.length > 0 && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                Studio Partners
              </h2>
              <p className="text-slate-400 text-sm mt-0.5">
                In collaboration with industry leaders
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {info.production_companies.map((company, idx) => (
                <div
                  key={company.id}
                  className="group relative flex flex-col rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.07] hover:border-[#e94f37]/30 hover:bg-white/[0.05] transition-all duration-300"
                >
                  {/* Number stamp */}
                  <span className="absolute top-2.5 left-3 text-[9px] font-mono text-white/15 group-hover:text-[#e94f37]/50 transition-colors duration-300 select-none z-10">
                    {String(idx + 1).padStart(2, "0")}
                  </span>

                  {/* Logo area */}
                  <div className="relative flex items-center justify-center h-[88px] px-6 pt-6 pb-3">
                    {company.logo_path ? (
                      <div className="relative w-full h-full opacity-40 group-hover:opacity-85 transition-opacity duration-300">
                        <Image
                          src={`https://image.tmdb.org/t/p/w300${company.logo_path}`}
                          alt={company.name}
                          fill
                          sizes="180px"
                          style={{
                            objectFit: "contain",
                            filter: "brightness(0) invert(1)",
                          }}
                        />
                      </div>
                    ) : (
                      <Building2
                        size={32}
                        className="text-white/15 group-hover:text-white/30 transition-colors duration-300"
                      />
                    )}
                  </div>

                  {/* Name footer */}
                  <div className="px-3 py-2.5 border-t border-white/[0.05]">
                    <p className="text-[10px] font-mono text-white/25 group-hover:text-white/50 transition-colors duration-300 text-center truncate tracking-wide">
                      {company.name}
                    </p>
                  </div>

                  {/* Bottom red line on hover */}
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#e94f37]/0 to-transparent group-hover:via-[#e94f37]/45 transition-all duration-300" />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <hr className="border-white/[0.06]" />

      {/* Global Distribution — unchanged */}
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
