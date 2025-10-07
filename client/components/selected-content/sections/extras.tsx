"use client";

import React, { useMemo, useRef, useState } from "react";
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

  const formatCurrency = (amount: number) => {
    if (!amount) return "$0";
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(1)}K`;
    return `$${amount.toLocaleString()}`;
  };

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
  const scrollNext = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: el.clientWidth * 0.75, behavior: "smooth" });
  };
  const scrollPrev = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: -el.clientWidth * 0.75, behavior: "smooth" });
  };

  // Analytics color helpers (data-sheet style)
  const getRevenueColor = (budget: number, revenue: number) => {
    if (!budget) return "text-yellow-300";
    const ratio = revenue / budget;
    if (ratio >= 1.2) return "text-green-400";
    if (ratio >= 0.8) return "text-yellow-300";
    return "text-red-400";
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 7.5) return "text-green-400";
    if (rating >= 5) return "text-yellow-300";
    return "text-red-400";
  };

  const roi = info.budget ? info.revenue / Math.max(1, info.budget) : 0;

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
            <div className="relative bg-gradient-to-r from-black via-slate-900 to-black py-8 px-4 rounded-2xl border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.7)] overflow-hidden">
              {/* subtle spotlight effect */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_70%)] pointer-events-none"></div>

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
                          className="object-contain opacity-80 group-hover:opacity-100 transition-all duration-300"
                        />
                      ) : (
                        <Building2 size={40} className="text-slate-500" />
                      )}
                      {/* Underline accent */}
                      <div className="absolute -bottom-2 w-0 group-hover:w-full h-[2px] bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 transition-all duration-500"></div>
                    </div>
                    <p className="mt-4 text-xs text-slate-400 group-hover:text-slate-100 transition-colors text-center max-w-[140px]">
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

      {/* Film Analytics: dashboard layout with highlights + charts */}
      <section>
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
            {info.content_type === "movie"
              ? "Film Analytics"
              : "Series Analytics"}
          </h2>
          <p className="text-slate-400 text-sm">
            {info.content_type === "movie"
              ? "Key performance metrics & insights"
              : "Production details & audience metrics"}
          </p>
        </div>

        {info.content_type === "movie" ? (
          // Movie Analytics (existing code)
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left column: KPI highlights */}
            <div className="col-span-1 xl:col-span-1 space-y-4">
              <div className="p-5 rounded-2xl bg-white/06 border border-white/10 shadow-sm">
                <div className="text-xs text-slate-400">Budget</div>
                <div className="text-2xl font-semibold text-slate-100">
                  {formatCurrency(info.budget)}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white/06 border border-white/10 shadow-sm">
                <div className="text-xs text-slate-400">Revenue</div>
                <div
                  className={`text-2xl font-semibold ${getRevenueColor(
                    info.budget,
                    info.revenue
                  )}`}
                >
                  {formatCurrency(info.revenue)}
                </div>
                <div className="text-xs text-slate-400">
                  ROI: {roi ? `${roi.toFixed(2)}x` : "—"}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white/06 border border-white/10 shadow-sm">
                <div className="text-xs text-slate-400">Audience Rating</div>
                <span
                  className={`text-2xl font-semibold ${getRatingColor(
                    info.vote_average
                  )}`}
                >
                  {info.vote_average.toFixed(1)}
                </span>
                <span className={`text-1.5xl font-semibold`}> / 10</span>
                <div className="text-xs text-slate-400">
                  {info.vote_count.toLocaleString()} votes
                </div>
              </div>
            </div>

            {/* Middle column: performance visuals */}
            <div className="col-span-1 xl:col-span-1 space-y-4">
              {/* Revenue vs Budget */}
              <div className="p-5 rounded-2xl bg-white/06 border border-white/10 shadow-sm">
                <div className="text-sm text-slate-300 mb-2">
                  Revenue vs Budget
                </div>
                <div className="relative h-3 bg-white/6 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${info.budget > 0
                          ? Math.min(100, (info.revenue / info.budget) * 100)
                          : 0
                        }%`,
                    }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="absolute top-0 left-0 h-full bg-green-500"
                  />
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {roi >= 1.2
                    ? "Strong performance"
                    : roi >= 0.8
                      ? "Average"
                      : "Underperforming"}
                </div>
              </div>

              {/* Rating bar */}
              <div className="p-5 rounded-2xl bg-white/06 border border-white/10 shadow-sm">
                <div className="text-sm text-slate-300 mb-2">
                  Rating Distribution
                </div>
                <div className="h-3 bg-white/6 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(info.vote_average / 10) * 100}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full ${info.vote_average < 5
                        ? "bg-red-500"
                        : info.vote_average < 7
                          ? "bg-yellow-400"
                          : "bg-green-500"
                      }`}
                  />
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {info.vote_average >= 7.5
                    ? "Well received"
                    : info.vote_average >= 5
                      ? "Mixed reception"
                      : "Poor reception"}
                </div>
              </div>
            </div>

            {/* Right column: quick insights */}
            <div className="col-span-1 xl:col-span-1">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/70 to-slate-900/70 border border-white/12 shadow-md">
                <h3 className="text-sm font-medium text-slate-100 mb-3">
                  Quick Insights
                </h3>
                <ul className="list-disc list-inside text-sm text-slate-300 space-y-2">
                  <li>
                    ROI: {roi ? `${roi.toFixed(2)}x` : "—"} (
                    {roi >= 1 ? "Profitable" : "Loss"})
                  </li>
                  <li>
                    Audience sentiment:{" "}
                    <span
                      className={`${info.vote_average >= 7.5
                          ? "text-green-400"
                          : info.vote_average >= 5
                            ? "text-yellow-300"
                            : "text-red-400"
                        }`}
                    >
                      {info.vote_average >= 7.5
                        ? "Positive"
                        : info.vote_average >= 5
                          ? "Neutral"
                          : "Negative"}
                    </span>
                  </li>
                  <li>
                    {info.production_companies?.length
                      ? `${info.production_companies.length} production partner(s)`
                      : "No studio info"}
                  </li>
                  <li>
                    Top genres:{" "}
                    {info.genres
                      ?.map((g) => g.name)
                      .slice(0, 2)
                      .join(", ") || "—"}
                  </li>
                </ul>
                <div className="mt-4 text-xs text-slate-400">
                  <strong className="text-slate-100">Tip:</strong> Bars & colors
                  indicate performance tiers — green = strong, yellow = average,
                  red = weak.
                </div>
              </div>
            </div>
          </div>
        ) : (
          // TV Series Analytics (new)
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left column: Series metrics */}
            <div className="col-span-1 xl:col-span-1 space-y-4">
              <div className="p-5 rounded-2xl bg-white/06 border border-white/10 shadow-sm">
                <div className="text-xs text-slate-400">Seasons</div>
                <div className="text-2xl font-semibold text-slate-100">
                  {(info as TvDetailsData["info"]).number_of_seasons || 0}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white/06 border border-white/10 shadow-sm">
                <div className="text-xs text-slate-400">Episodes</div>
                <div className="text-2xl font-semibold text-purple-400">
                  {(info as TvDetailsData["info"]).number_of_episodes || 0}
                </div>
                <div className="text-xs text-slate-400">
                  Avg:{" "}
                  {(info as TvDetailsData["info"]).episode_run_time?.[0] ||
                    info.runtime}{" "}
                  min/ep
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white/06 border border-white/10 shadow-sm">
                <div className="text-xs text-slate-400">Audience Rating</div>
                <span
                  className={`text-2xl font-semibold ${getRatingColor(
                    info.vote_average
                  )}`}
                >
                  {info.vote_average.toFixed(1)}
                </span>
                <span className={`text-1.5xl font-semibold`}> / 10</span>
                <div className="text-xs text-slate-400">
                  {info.vote_count.toLocaleString()} votes
                </div>
              </div>
            </div>

            {/* Middle column: Series progression */}
            <div className="col-span-1 xl:col-span-1 space-y-4">
              {/* Series Duration */}
              <div className="p-5 rounded-2xl bg-white/06 border border-white/10 shadow-sm">
                <div className="text-sm text-slate-300 mb-2">
                  Series Longevity
                </div>
                <div className="relative h-3 bg-white/6 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(
                        100,
                        ((info as TvDetailsData["info"]).number_of_seasons ||
                          1) * 10
                      )}%`,
                    }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="absolute top-0 left-0 h-full bg-purple-500"
                  />
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {((info as TvDetailsData["info"]).number_of_seasons || 0) >= 5
                    ? "Long-running series"
                    : ((info as TvDetailsData["info"]).number_of_seasons ||
                      0) >= 2
                      ? "Multi-season"
                      : "Limited series"}
                </div>
              </div>

              {/* Rating progression */}
              <div className="p-5 rounded-2xl bg-white/06 border border-white/10 shadow-sm">
                <div className="text-sm text-slate-300 mb-2">
                  Audience Reception
                </div>
                <div className="h-3 bg-white/6 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(info.vote_average / 10) * 100}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full ${info.vote_average < 5
                        ? "bg-red-500"
                        : info.vote_average < 7
                          ? "bg-yellow-400"
                          : "bg-green-500"
                      }`}
                  />
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {info.vote_average >= 7.5
                    ? "Critically acclaimed"
                    : info.vote_average >= 5
                      ? "Mixed reviews"
                      : "Poor reception"}
                </div>
              </div>
            </div>

            {/* Right column: Series insights */}
            <div className="col-span-1 xl:col-span-1">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800/70 to-slate-900/70 border border-white/12 shadow-md">
                <h3 className="text-sm font-medium text-slate-100 mb-3">
                  Series Overview
                </h3>
                <ul className="list-disc list-inside text-sm text-slate-300 space-y-2">
                  <li>
                    Content volume:{" "}
                    {(info as TvDetailsData["info"]).number_of_episodes || 0}{" "}
                    episodes (
                    {Math.round(
                      ((((info as TvDetailsData["info"]).number_of_episodes ||
                        0) *
                        (info.runtime || 0)) /
                        60) *
                      10
                    ) / 10}
                    h total)
                  </li>
                  <li>
                    Status:{" "}
                    <span
                      className={`${info.status === "Ended"
                          ? "text-red-400"
                          : info.status === "Returning Series"
                            ? "text-green-400"
                            : "text-yellow-300"
                        }`}
                    >
                      {info.status}
                    </span>
                  </li>
                  <li>
                    Run period:{" "}
                    {(info as TvDetailsData["info"]).first_air_date?.split(
                      "-"
                    )[0] || info.release_date.split("-")[0]}
                    {(info as TvDetailsData["info"]).last_air_date &&
                      ` - ${(info as TvDetailsData["info"]).last_air_date?.split(
                        "-"
                      )[0]
                      }`}
                  </li>
                  <li>
                    Networks:{" "}
                    {((info as TvDetailsData["info"]).networks?.length || 0) > 0
                      ? (info as TvDetailsData["info"]).networks
                        ?.slice(0, 2)
                        .map((n) => n.name)
                        .join(", ")
                      : "Unknown"}
                  </li>
                  <li>
                    Top genres:{" "}
                    {info.genres
                      ?.map((g) => g.name)
                      .slice(0, 2)
                      .join(", ") || "—"}
                  </li>
                </ul>
                <div className="mt-4 text-xs text-slate-400">
                  <strong className="text-slate-100">Note:</strong> TV metrics
                  focus on content volume, longevity, and audience engagement
                  patterns.
                </div>
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
