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
// animation durations (ms) — tweak these to make animations faster/slower
const ANIM_DURATION_MS = 200; // controls framer-motion enter/exit speed
const SCROLL_DURATION_MS = 400; // controls the smooth scroll duration
const OPEN_SCROLL_DELAY_MS = 120; // delay after opening a season before scrolling (let DOM paint)
const PAGE_SCROLL_DELAY_MS = 160; // delay after changing page before scrolling

export default function TvSeasonsEpisodes({ seasons, className = "" }: Props) {
  const [openSeason, setOpenSeason] = useState<number | null>(
    seasons && seasons.length ? seasons[0].season_number : null
  );

  // store current page for each season by season_number
  const [pages, setPages] = useState<Record<number, number>>({});

  // refs to season containers so we can scroll to them when changing pages
  const seasonRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const toggle = (num: number) => {
    const willOpen = openSeason !== num;
    setOpenSeason(willOpen ? num : null);

    // when opening a season, reset its page to 1 so users always start at page 1
    if (willOpen) {
      setPages((p) => ({ ...p, [num]: 1 }));

      // give React a tick to paint the opened section, then scroll to it smoothly
      setTimeout(() => scrollToSeason(num), OPEN_SCROLL_DELAY_MS);
    }
  };

  const setPageForSeason = (seasonNum: number, page: number) => {
    // clamp page
    setPages((p) => ({ ...p, [seasonNum]: Math.max(1, page) }));

    // after state update, allow the DOM to update then smoothly scroll the opened season into view
    setTimeout(() => scrollToSeason(seasonNum), PAGE_SCROLL_DELAY_MS);
  };

  // custom smooth scroll so we can control duration (browser `behavior: 'smooth'` has no duration control)
  const smoothScrollTo = (targetY: number, duration = SCROLL_DURATION_MS) => {
    const startY = window.scrollY || window.pageYOffset;
    const diff = targetY - startY;
    let start: number | null = null;

    // easeInOutCubic
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

    // compute a slight offset so the season header has breathing room from the top
    const top = el.getBoundingClientRect().top + window.scrollY - 16;

    smoothScrollTo(top, SCROLL_DURATION_MS);
  };

  const formatDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString() : "—";
  const truncate = (s: string = "", n = 200) =>
    s.length > n ? s.slice(0, n).trim() + "…" : s;

  return (
    <section className={`space-y-4 ${className}`}>
      {seasons.length === 0 && (
        <div className="py-8 text-center text-sm text-slate-400">
          No seasons available.
        </div>
      )}

      {seasons.map((season) => {
        const isOpen = openSeason === season.season_number;
        const currentPage = pages[season.season_number] ?? 1;

        // If there are more than PAGE_SIZE episodes, sort in descending order as requested.
        const episodesSorted =
          season.episodes && season.episodes.length > PAGE_SIZE
            ? [...season.episodes].sort(
                (a, b) => b.episode_number - a.episode_number
              )
            : season.episodes || [];

        const totalPages = Math.max(
          1,
          Math.ceil(episodesSorted.length / PAGE_SIZE)
        );
        const startIdx = (currentPage - 1) * PAGE_SIZE;
        const pageEpisodes = episodesSorted.slice(
          startIdx,
          startIdx + PAGE_SIZE
        );

        return (
          <article
            key={season.season_number}
            ref={(el: HTMLDivElement | null) => {
              seasonRefs.current[season.season_number] = el;
            }}
            className="bg-gradient-to-br from-white/3 to-white/2 border border-white/6 rounded-2xl p-4 shadow-lg"
          >
            <header className="flex items-start gap-4 md:gap-6">
              <button
                onClick={() => toggle(season.season_number)}
                aria-expanded={isOpen}
                className="flex items-start gap-4 w-full text-left focus:outline-none cursor-pointer"
              >
                <div className="relative w-24 h-36 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-white/6">
                  {season.poster_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w400${season.poster_path}`}
                      alt={season.name ?? `Season ${season.season_number}`}
                      fill
                      sizes="(max-width: 768px) 150px, 200px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-slate-400 bg-white/2">
                      No Image
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg md:text-xl font-semibold leading-tight">
                        {season.name ?? `Season ${season.season_number}`}
                      </h3>
                      <div className="mt-1 text-xs md:text-sm text-slate-400">
                        {truncate(season.overview ?? "", 180)}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/3 text-xs font-medium ring-1 ring-white/6">
                        <svg
                          className="w-3 h-3"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M12 3v18"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M3 12h18"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>
                          {season.episode_count ?? season.episodes.length}{" "}
                          episodes
                        </span>
                      </div>

                      <div className="text-xs text-slate-400">
                        {formatDate(season.air_date)}
                      </div>

                      <div
                        className={`flex items-center justify-center w-9 h-9 rounded-full text-white transform transition-transform duration-200 ${
                          isOpen ? "rotate-180 bg-amber-400" : "bg-white/4"
                        }`}
                        aria-hidden
                      >
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M5 8l5 5 5-5"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-300">
                    Season {season.season_number}
                  </div>
                </div>
              </button>
            </header>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key={`season-${season.season_number}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: ANIM_DURATION_MS / 1000 }}
                  className="mt-5 pt-4 border-t border-white/6"
                >
                  <motion.div
                    layout
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 10, opacity: 0 }}
                    transition={{ duration: ANIM_DURATION_MS / 1000 }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pageEpisodes && pageEpisodes.length > 0 ? (
                        pageEpisodes.map((ep) => (
                          <motion.article
                            key={ep.episode_number}
                            whileHover={{ scale: 1.02 }}
                            className="flex gap-4 p-3 rounded-xl bg-gradient-to-br from-white/2 to-white/3 ring-1 ring-white/4"
                          >
                            <div className="relative w-28 h-16 rounded-md overflow-hidden flex-shrink-0 bg-slate-700/20">
                              {ep.still_path ? (
                                <Image
                                  src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                                  alt={ep.name}
                                  fill
                                  sizes="(max-width: 768px) 120px, 160px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full text-xs text-slate-400">
                                  No Image
                                </div>
                              )}
                            </div>

                            <div className="flex-1 flex flex-col justify-between">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-semibold">
                                    {ep.episode_number}. {ep.name}
                                  </h4>
                                  <div className="mt-1 text-xs text-slate-400">
                                    {formatDate(ep.air_date)} •{" "}
                                    {ep.runtime ? `${ep.runtime}m` : "—"}
                                  </div>
                                </div>

                                <div className="flex flex-col items-end gap-2">
                                  <div className="text-sm font-semibold text-amber-400">
                                    {ep.vote_average
                                      ? ep.vote_average.toFixed(1)
                                      : "—"}
                                  </div>
                                  <div className="text-xs px-2 py-0.5 rounded-full bg-white/3 ring-1 ring-white/6">
                                    {ep.runtime ? `${ep.runtime}m` : "—"}
                                  </div>
                                </div>
                              </div>

                              <p className="mt-3 text-xs text-slate-300 leading-snug">
                                {truncate(ep.overview ?? "", 140)}
                              </p>
                            </div>
                          </motion.article>
                        ))
                      ) : (
                        <div className="col-span-full py-6 text-center text-sm text-slate-400">
                          Episode details not available.
                        </div>
                      )}
                    </div>

                    {/* Pagination controls (max PAGE_SIZE episodes per page) */}
                    {episodesSorted.length > PAGE_SIZE && (
                      <div className="mt-4 flex items-center justify-between gap-4">
                        <div className="text-[0.8rem] text-slate-400">
                          Showing{" "}
                          {Math.min(startIdx + 1, episodesSorted.length)}–
                          {Math.min(
                            startIdx + PAGE_SIZE,
                            episodesSorted.length
                          )}{" "}
                          of {episodesSorted.length}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setPageForSeason(
                                season.season_number,
                                Math.max(1, currentPage - 1)
                              )
                            }
                            disabled={currentPage === 1}
                            className="text-[1.1rem] px-3 py-1 rounded-md bg-white/4 disabled:opacity-40 cursor-pointer"
                          >
                            Prev
                          </button>

                          <div className="text-[0.8rem] text-slate-300">
                            Page {currentPage} of {totalPages}
                          </div>

                          <button
                            onClick={() =>
                              setPageForSeason(
                                season.season_number,
                                Math.min(totalPages, currentPage + 1)
                              )
                            }
                            disabled={currentPage === totalPages}
                            className="text-[1.1rem] px-3 py-1 rounded-md bg-white/4 disabled:opacity-40 cursor-pointer"
                          >
                            Next
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
