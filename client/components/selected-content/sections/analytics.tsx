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

export default function Analytics({ data }: DetailsProp) {
  const { info } = data;

  const formatCurrency = (amount: number) => {
    if (!amount) return "$0";
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(1)}K`;
    return `$${amount.toLocaleString()}`;
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
            <div className="text-sm text-slate-300 mb-2">Revenue vs Budget</div>
            <div className="relative h-3 bg-white/6 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${
                    info.budget > 0
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
                className={`h-full ${
                  info.vote_average < 5
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
                  className={`${
                    info.vote_average >= 7.5
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
              indicate performance tiers — green = strong, yellow = average, red
              = weak.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
