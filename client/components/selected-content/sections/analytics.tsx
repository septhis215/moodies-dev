"use client";

import React from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Star, BarChart2 } from "lucide-react";
import type {
  MovieDetailsData,
  TvDetailsData,
} from "@/components/selected-content/types";

interface DetailsProp {
  data: MovieDetailsData | TvDetailsData;
}

export default function Analytics({ data }: DetailsProp) {
  const { info } = data;

  const fmt = (n: number) => {
    if (!n || n === 0) return "—";
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toLocaleString()}`;
  };

  const roi = info.budget > 0 ? info.revenue / info.budget : 0;
  const revenueRatioPct =
    info.budget > 0 ? Math.min(100, (info.revenue / info.budget) * 100) : 0;
  const ratingPct = (info.vote_average / 10) * 100;

  const perfLabel =
    roi >= 2.5
      ? "Blockbuster"
      : roi >= 1.5
        ? "Strong Hit"
        : roi >= 1.0
          ? "Profitable"
          : roi > 0
            ? "Underperformed"
            : "—";
  const perfColor =
    roi >= 1.5
      ? "#4ade80"
      : roi >= 1.0
        ? "#86efac"
        : roi > 0
          ? "#f87171"
          : "#475569";

  const ratingLabel =
    info.vote_average >= 8
      ? "Acclaimed"
      : info.vote_average >= 7
        ? "Well Received"
        : info.vote_average >= 5.5
          ? "Mixed Reviews"
          : "Poor Reception";
  const ratingColor =
    info.vote_average >= 7
      ? "#4ade80"
      : info.vote_average >= 5.5
        ? "#facc15"
        : "#f87171";

  const hasBoxOffice = info.budget > 0 || info.revenue > 0;

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
          {info.content_type === "movie" ? "Film Analytics" : "Series Analytics"}
        </h2>
        <p className="text-slate-400 text-sm">
          {info.content_type === "movie"
            ? "Key performance metrics & insights"
            : "Production details & audience metrics"}
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Budget */}
        <div className="relative p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] transition-colors duration-200 overflow-hidden">
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-sky-400/40 to-transparent" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">
              Budget
            </span>
            <DollarSign size={13} className="text-sky-400/40" />
          </div>
          <div className="text-2xl font-bold text-white leading-none">
            {fmt(info.budget)}
          </div>
          <div className="text-[11px] text-white/25 mt-1">Production cost</div>
        </div>

        {/* Revenue */}
        <div className="relative p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] transition-colors duration-200 overflow-hidden">
          <div
            className="pointer-events-none absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent to-transparent"
            style={{
              background: `linear-gradient(to bottom, transparent, ${perfColor}60, transparent)`,
            }}
          />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">
              Revenue
            </span>
            <TrendingUp size={13} style={{ color: `${perfColor}60` }} />
          </div>
          <div className="text-2xl font-bold text-white leading-none">
            {fmt(info.revenue)}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {roi > 0 && (
              <span
                className="text-[11px] font-semibold"
                style={{ color: perfColor }}
              >
                {roi.toFixed(1)}x ROI
              </span>
            )}
            {roi > 0 && (
              <span className="text-[10px] text-white/20">· {perfLabel}</span>
            )}
            {!hasBoxOffice && (
              <span className="text-[11px] text-white/25">No data available</span>
            )}
          </div>
        </div>

        {/* Audience Score */}
        <div className="relative p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] transition-colors duration-200 overflow-hidden">
          <div
            className="pointer-events-none absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent to-transparent"
            style={{
              background: `linear-gradient(to bottom, transparent, ${ratingColor}60, transparent)`,
            }}
          />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">
              Audience Score
            </span>
            <Star size={13} style={{ color: `${ratingColor}60` }} />
          </div>
          <div className="flex items-baseline gap-1 leading-none">
            <span className="text-2xl font-bold" style={{ color: ratingColor }}>
              {info.vote_average.toFixed(1)}
            </span>
            <span className="text-sm text-white/25">/ 10</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className="text-[11px] font-semibold"
              style={{ color: ratingColor }}
            >
              {ratingLabel}
            </span>
            <span className="text-[10px] text-white/20">
              · {info.vote_count.toLocaleString()} votes
            </span>
          </div>
        </div>
      </div>

      {/* Performance panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Box Office */}
        <div className="p-5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-white">Box Office</p>
              <p className="text-[11px] text-white/30 mt-0.5">
                Revenue vs production budget
              </p>
            </div>
            <BarChart2 size={15} className="text-white/15" />
          </div>

          {hasBoxOffice ? (
            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-white/40">Budget</span>
                  <span className="text-white/60 font-medium">
                    {fmt(info.budget)}
                  </span>
                </div>
                <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full w-full bg-sky-400/40 rounded-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-white/40">Revenue</span>
                  <span
                    className="font-medium"
                    style={{ color: perfColor }}
                  >
                    {fmt(info.revenue)}
                  </span>
                </div>
                <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${revenueRatioPct}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: perfColor }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] text-white/25">
                  Performance tier
                </span>
                {roi > 0 ? (
                  <span
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border"
                    style={{
                      color: perfColor,
                      borderColor: `${perfColor}30`,
                      background: `${perfColor}12`,
                    }}
                  >
                    {perfLabel}
                  </span>
                ) : (
                  <span className="text-[11px] text-white/20">—</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="text-2xl opacity-20 mb-2">💰</div>
              <p className="text-xs text-white/25">
                Box office data not available
              </p>
            </div>
          )}
        </div>

        {/* Audience Reception */}
        <div className="p-5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-white">
                Audience Reception
              </p>
              <p className="text-[11px] text-white/30 mt-0.5">
                Community ratings & sentiment
              </p>
            </div>
            <Star size={15} className="text-white/15" />
          </div>

          <div className="flex items-center gap-5 mb-4">
            <RatingArcViz rating={info.vote_average} color={ratingColor} />
            <div>
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-3xl font-bold text-white"
                  style={{ color: ratingColor }}
                >
                  {info.vote_average.toFixed(1)}
                </span>
                <span className="text-sm text-white/25">/ 10</span>
              </div>
              <div className="text-[11px] text-white/35 mt-0.5">
                {info.vote_count.toLocaleString()} total votes
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-white/40">Score</span>
              <span className="font-medium" style={{ color: ratingColor }}>
                {ratingLabel}
              </span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${ratingPct}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ backgroundColor: ratingColor }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Insights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <InsightPill
          label="ROI"
          value={roi > 0 ? `${roi.toFixed(1)}x` : "—"}
          sub={roi >= 1 ? "Profitable" : roi > 0 ? "Net loss" : "N/A"}
          color={roi >= 1 ? "#4ade80" : roi > 0 ? "#f87171" : "#475569"}
        />
        <InsightPill
          label="Sentiment"
          value={ratingLabel.split(" ")[0]}
          sub="Based on rating"
          color={ratingColor}
        />
        <InsightPill
          label="Studios"
          value={`${info.production_companies?.length ?? 0}`}
          sub="Production partner(s)"
          color="#94a3b8"
        />
        <InsightPill
          label="Top Genres"
          value={
            info.genres?.slice(0, 2).map((g) => g.name).join(" · ") || "—"
          }
          sub="Primary categories"
          color="#94a3b8"
          compact
        />
      </div>
    </section>
  );
}

function InsightPill({
  label,
  value,
  sub,
  color,
  compact,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  compact?: boolean;
}) {
  return (
    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.05] transition-colors duration-200">
      <div className="text-[9px] uppercase tracking-widest text-white/25 mb-1.5 font-semibold">
        {label}
      </div>
      <div
        className={`font-bold truncate leading-tight ${compact ? "text-xs" : "text-sm"}`}
        style={{ color }}
      >
        {value}
      </div>
      <div className="text-[10px] text-white/20 mt-0.5 truncate">{sub}</div>
    </div>
  );
}

function RatingArcViz({
  rating,
  color,
}: {
  rating: number;
  color: string;
}) {
  const size = 60,
    r = 23,
    circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(10, rating));
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="3"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - clamped / 10) }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
        {clamped.toFixed(1)}
      </span>
    </div>
  );
}
