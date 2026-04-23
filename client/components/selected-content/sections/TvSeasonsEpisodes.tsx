"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export type Episode = {
  episode_number: number;
  name: string;
  overview: string;
  air_date?: string | null;
  runtime?: number | null;
  still_path?: string | null;
  vote_average?: number | null;
};

export type SeasonWithEpisodes = {
  season_number: number;
  name?: string;
  overview?: string | null;
  air_date?: string | null;
  poster_path?: string | null;
  episode_count?: number;
  episodes: Episode[];
};

type Props = {
  seasons: SeasonWithEpisodes[];
  className?: string;
};

const PAGE_SIZE = 30;
const ANIM_DURATION_MS = 200;
const SCROLL_DURATION_MS = 400;
const OPEN_SCROLL_DELAY_MS = 120;
const PAGE_SCROLL_DELAY_MS = 160;

export default function TvSeasonsEpisodes({ seasons, className = "" }: Props) {
  const [openSeason, setOpenSeason] = useState<number | null>(
    seasons && seasons.length ? seasons[0].season_number : null,
  );
  const [pages, setPages] = useState<Record<number, number>>({});
  const seasonRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const toggle = (num: number) => {
    const willOpen = openSeason !== num;
    setOpenSeason(willOpen ? num : null);
    if (willOpen) {
      setPages((p) => ({ ...p, [num]: 1 }));
      setTimeout(() => scrollToSeason(num), OPEN_SCROLL_DELAY_MS);
    }
  };

  const setPageForSeason = (seasonNum: number, page: number) => {
    setPages((p) => ({ ...p, [seasonNum]: Math.max(1, page) }));
    setTimeout(() => scrollToSeason(seasonNum), PAGE_SCROLL_DELAY_MS);
  };

  const smoothScrollTo = (targetY: number, duration = SCROLL_DURATION_MS) => {
    const startY = window.scrollY || window.pageYOffset;
    const diff = targetY - startY;
    let start: number | null = null;
    const ease = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const t = Math.min(1, elapsed / duration);
      window.scrollTo(0, Math.round(startY + diff * ease(t)));
      if (elapsed < duration) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const scrollToSeason = (seasonNum: number) => {
    const el = seasonRefs.current[seasonNum];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 16;
    smoothScrollTo(top, SCROLL_DURATION_MS);
  };

  const formatDate = (d?: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";
  const truncate = (s: string = "", n = 200) =>
    s.length > n ? s.slice(0, n).trim() + "…" : s;

  return (
    <section className={`space-y-3 ${className}`}>
      {seasons.length === 0 && (
        <div className="py-12 text-center text-sm text-white/30">
          No seasons available.
        </div>
      )}

      {seasons.map((season) => {
        const isOpen = openSeason === season.season_number;
        const currentPage = pages[season.season_number] ?? 1;

        const episodesSorted =
          season.episodes && season.episodes.length > PAGE_SIZE
            ? [...season.episodes].sort(
                (a, b) => b.episode_number - a.episode_number,
              )
            : season.episodes || [];

        const totalPages = Math.max(
          1,
          Math.ceil(episodesSorted.length / PAGE_SIZE),
        );
        const startIdx = (currentPage - 1) * PAGE_SIZE;
        const pageEpisodes = episodesSorted.slice(
          startIdx,
          startIdx + PAGE_SIZE,
        );

        return (
          <article
            key={season.season_number}
            ref={(el: HTMLDivElement | null) => {
              seasonRefs.current[season.season_number] = el;
            }}
            className="rounded-xl bg-white/[0.03] border border-white/[0.07] overflow-hidden"
          >
            {/* ── Season header ── */}
            <button
              onClick={() => toggle(season.season_number)}
              aria-expanded={isOpen}
              className="w-full text-left focus:outline-none cursor-pointer"
            >
              <div className="flex items-start gap-4 p-4">
                {/* Poster */}
                <div className="relative w-16 h-24 sm:w-20 sm:h-28 rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.06]">
                  <Image
                    src={season.poster_path ? `https://image.tmdb.org/t/p/w400${season.poster_path}` : "/placeholder-poster.svg"}
                    alt={season.name ?? `Season ${season.season_number}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex items-start justify-between gap-3 py-0.5">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-widest text-white/30 mb-1">
                      Season {season.season_number}
                    </p>
                    <h3 className="text-base font-semibold text-white leading-snug">
                      {season.name ?? `Season ${season.season_number}`}
                    </h3>
                    {season.overview && (
                      <p className="mt-1 text-sm text-white/40 leading-relaxed line-clamp-2">
                        {truncate(season.overview, 160)}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs text-white/40">
                        {season.episode_count ?? season.episodes.length}{" "}
                        episodes
                      </span>
                      {season.air_date && (
                        <>
                          <span className="text-xs text-white/20">·</span>
                          <span className="text-xs text-white/40">
                            {formatDate(season.air_date)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  <div
                    className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-200 ${
                      isOpen
                        ? "bg-[#e94f37] border-[#e94f37] rotate-180"
                        : "bg-white/[0.05] border-white/[0.1]"
                    }`}
                    aria-hidden
                  >
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      viewBox="0 0 20 20"
                      fill="none"
                    >
                      <path
                        d="M5 8l5 5 5-5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </button>

            {/* ── Episodes panel ── */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key={`season-${season.season_number}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: ANIM_DURATION_MS / 1000 }}
                  className="border-t border-white/[0.06]"
                >
                  <motion.div
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 8, opacity: 0 }}
                    transition={{ duration: ANIM_DURATION_MS / 1000 }}
                    className="p-4 space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {pageEpisodes && pageEpisodes.length > 0 ? (
                        pageEpisodes.map((ep) => (
                          <div
                            key={ep.episode_number}
                            className="flex gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-150"
                          >
                            {/* Still */}
                            <div className="relative w-24 h-14 rounded-md overflow-hidden flex-shrink-0 bg-white/[0.06]">
                              <Image
                                src={ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : "/placeholder-backdrop.svg"}
                                alt={ep.name}
                                fill
                                sizes="96px"
                                className="object-cover"
                              />
                              {/* Episode number badge */}
                              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-semibold text-white/70 leading-none">
                                E{ep.episode_number}
                              </div>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                              <div>
                                <p className="text-sm font-semibold text-white leading-snug line-clamp-1">
                                  {ep.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-white/30">
                                    {formatDate(ep.air_date)}
                                  </span>
                                  {ep.runtime && (
                                    <>
                                      <span className="text-xs text-white/20">
                                        ·
                                      </span>
                                      <span className="text-xs text-white/30">
                                        {ep.runtime}m
                                      </span>
                                    </>
                                  )}
                                  {ep.vote_average ? (
                                    <>
                                      <span className="text-xs text-white/20">
                                        ·
                                      </span>
                                      <span className="text-xs text-[#e94f37] font-semibold">
                                        ★ {ep.vote_average.toFixed(1)}
                                      </span>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                              {ep.overview && (
                                <p className="mt-1.5 text-xs text-white/40 leading-relaxed line-clamp-2">
                                  {truncate(ep.overview, 120)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-8 text-center text-sm text-white/25">
                          Episode details not available.
                        </div>
                      )}
                    </div>

                    {/* Pagination */}
                    {episodesSorted.length > PAGE_SIZE && (
                      <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/[0.06]">
                        <p className="text-[11px] text-white/25">
                          {Math.min(startIdx + 1, episodesSorted.length)}–
                          {Math.min(
                            startIdx + PAGE_SIZE,
                            episodesSorted.length,
                          )}{" "}
                          of {episodesSorted.length}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setPageForSeason(
                                season.season_number,
                                Math.max(1, currentPage - 1),
                              )
                            }
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/[0.04] border border-white/[0.07] text-white/50 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 transition-all cursor-pointer"
                          >
                            ← Prev
                          </button>
                          <span className="text-[11px] text-white/30 px-1">
                            {currentPage} / {totalPages}
                          </span>
                          <button
                            onClick={() =>
                              setPageForSeason(
                                season.season_number,
                                Math.min(totalPages, currentPage + 1),
                              )
                            }
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/[0.04] border border-white/[0.07] text-white/50 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 transition-all cursor-pointer"
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </article>
        );
      })}
    </section>
  );
}
