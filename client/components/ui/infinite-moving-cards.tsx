"use client";

import { cn } from "@/lib/utils";
import { Film, MessageCircle, Star, Tv } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo } from "react";

type MovingCardItem = {
  quote: string;
  name: string;
  title: string;
  avatar: string;
  rating?: number;
  tmdbId?: number;
  movieTitle?: string;
  moviePoster?: string | null;
  movieBackdrop?: string | null;
  movieYear?: string | null;
  mediaType?: "MOVIE" | "TV";
};

const MASCOT_SRC = "/images/moodies-mascot.png";

function tmdbImage(path?: string | null, size = "w342") {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function getAvatarSrc(avatar?: string) {
  if (!avatar) return "/placeholder-avatar.png";
  if (avatar.startsWith("/https")) return avatar.slice(1);
  if (avatar.startsWith("http") || avatar.startsWith("/")) return avatar;
  return `https://image.tmdb.org/t/p/w185${avatar}`;
}

function getRatingTone(rating?: number) {
  if (rating === undefined) return "text-white/54";
  if (rating >= 8) return "text-emerald-300";
  if (rating >= 6) return "text-[#ffd78a]";
  return "text-[#ff9b8a]";
}

function getMascotTone(rating?: number) {
  if (rating === undefined) return "border-white/10 bg-white/[0.06]";
  if (rating >= 8) return "border-emerald-300/25 bg-emerald-300/10";
  if (rating >= 6) return "border-[#f6b73c]/25 bg-[#f6b73c]/10";
  return "border-[#e94f37]/25 bg-[#e94f37]/10";
}

export const InfiniteMovingCards = ({
  items,
  direction = "left",
  speed = "very-slow",
  pauseOnHover = true,
  className,
}: {
  items: MovingCardItem[];
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow" | "very-slow";
  pauseOnHover?: boolean;
  className?: string;
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const loopedItems = useMemo(() => [...items, ...items], [items]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const durationMap = {
      fast: "40s",
      normal: "90s",
      slow: "180s",
      "very-slow": "400s",
    } satisfies Record<NonNullable<typeof speed>, string>;

    containerRef.current.style.setProperty(
      "--animation-direction",
      direction === "left" ? "forwards" : "reverse",
    );
    containerRef.current.style.setProperty(
      "--animation-duration",
      durationMap[speed],
    );
  }, [direction, speed]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "scroller relative z-20 w-full overflow-hidden px-4 [mask-image:linear-gradient(to_right,transparent,white_10%,white_90%,transparent)] sm:px-8",
        className,
      )}
    >
      <ul
        className={cn(
          "flex w-max min-w-full shrink-0 flex-nowrap gap-4 py-5 animate-scroll motion-safe:[animation-play-state:running] sm:gap-5",
          pauseOnHover && "hover:[animation-play-state:paused]",
        )}
      >
        {loopedItems.map((item, idx) => {
          const title = item.movieTitle || item.title;
          const poster =
            tmdbImage(item.moviePoster, "w342") ||
            tmdbImage(item.movieBackdrop, "w342") ||
            "/placeholder-poster.svg";
          const isTv = item.mediaType === "TV";
          const MediaIcon = isTv ? Tv : Film;
          const href = item.tmdbId
            ? `/${isTv ? "tv" : "movies"}/${item.tmdbId}`
            : null;

          return (
            <li
              key={`${item.name}-${idx}`}
              className={cn(
                "group relative w-[300px] max-w-[calc(100vw-2rem)] shrink-0 overflow-hidden rounded-2xl border border-white/10",
                "bg-[#101012] shadow-xl shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-[#e94f37]/35 hover:bg-[#141416]",
                href && "cursor-pointer",
                "sm:w-[360px] md:w-[410px]",
              )}
            >
              {href ? (
                <Link
                  href={href}
                  aria-label={`Open ${title}`}
                  className="absolute inset-0 z-30 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e94f37]"
                >
                  <span className="sr-only">Open {title}</span>
                </Link>
              ) : null}

              <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/[0.055] to-transparent" />

              <blockquote className="relative z-10 grid min-h-[210px] grid-cols-[86px_minmax(0,1fr)] gap-3 p-3 sm:min-h-[224px] sm:grid-cols-[102px_minmax(0,1fr)] sm:p-4">
                <div className="flex flex-col gap-2">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={poster}
                      alt={title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/44 to-transparent" />
                    {item.rating !== undefined ? (
                      <div className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/72 px-1.5 py-0.5 text-[10px] font-black text-white backdrop-blur-sm">
                        <Star className="h-2.5 w-2.5 fill-[#f6b73c] text-[#f6b73c]" />
                        {item.rating.toFixed(1)}
                      </div>
                    ) : null}
                  </div>

                  <div className="hidden items-center gap-1 rounded-full bg-white/[0.055] px-2 py-1 text-[10px] font-bold text-white/48 sm:flex">
                    <MessageCircle className="h-3 w-3 text-[#e94f37]" />
                    Review
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#e94f37]/12 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#ff9b8a]">
                      <MediaIcon className="h-3 w-3" />
                      {isTv ? "TV" : "Movie"}
                    </span>
                    {item.movieYear ? (
                      <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-white/48">
                        {item.movieYear}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="line-clamp-2 text-sm font-black leading-tight text-white sm:text-base">
                    {title}
                  </h3>

                  <p className="mt-2 line-clamp-4 text-xs leading-5 text-white/62 sm:text-[13px] sm:leading-5">
                    {item.quote}
                  </p>

                  <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getAvatarSrc(item.avatar)}
                      alt={item.name}
                      className="h-8 w-8 rounded-full border border-white/12 object-cover"
                    />

                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white/82">
                        {item.name}
                      </p>
                      <p className="truncate text-[11px] font-semibold text-white/42">
                        Community take
                        <span
                          className={cn("ml-1", getRatingTone(item.rating))}
                        >
                          {item.rating !== undefined
                            ? `${item.rating.toFixed(1)}/10`
                            : "Unrated"}
                        </span>
                      </p>
                    </div>

                    <div
                      className={cn(
                        "relative ml-auto h-9 w-9 shrink-0 overflow-hidden rounded-full border",
                        getMascotTone(item.rating),
                      )}
                      title="Moodies community signal"
                      aria-hidden
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={MASCOT_SRC}
                        alt=""
                        className="h-full w-full object-contain p-1"
                      />
                    </div>
                  </div>
                </div>
              </blockquote>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
