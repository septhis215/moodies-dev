"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Film,
  Trophy,
  Tv,
} from "lucide-react";
import type { All } from "@/types/all";
import RatingBadge from "../ui/rating-badge";

type FootballStory = All & {
  media_type?: "movie" | "tv";
  vote_count?: number;
};

const footballLabels = [
  "World Cup Journey",
  "Docuseries",
  "National Team Story",
  "Player Documentary",
  "Behind the Scenes",
  "Club Documentary",
];

function posterUrl(path?: string | null) {
  return path ? `https://image.tmdb.org/t/p/w500${path}` : "/placeholder-poster.svg";
}

function getMediaType(item: FootballStory) {
  return item.media_type ?? item.type;
}

function getTitle(item: FootballStory) {
  return item.title || item.name || "Untitled";
}

function getYear(item: FootballStory) {
  const date = item.release_date || item.first_air_date;
  return date ? date.slice(0, 4) : null;
}

function getRelevanceLabel(item: FootballStory, index: number) {
  const text = `${item.title ?? ""} ${item.overview ?? ""}`.toLowerCase();
  if (text.includes("world cup")) return "World Cup Journey";
  if (text.includes("national team") || text.includes("captain")) return "National Team Story";
  if (text.includes("neymar") || text.includes("messi") || text.includes("ronaldo") || text.includes("player") || text.includes("legend")) return "Player Documentary";
  if (text.includes("arsenal") || text.includes("club")) return "Club Documentary";
  if (text.includes("behind")) return "Behind the Scenes";
  if (text.includes("documentary") || text.includes("docuseries") || item.genres?.includes("Documentary")) return "Docuseries";
  return footballLabels[index % footballLabels.length];
}

export default function FootballStoriesSection() {
  const [items, setItems] = useState<FootballStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    async function loadFootballStories() {
      try {
        setLoading(true);
        setHasError(false);
        const base = process.env.NEST_API_URL || "http://localhost:4000";
        const res = await fetch(`${base}/all/football-stories?limit=25&rankingMode=world-cup-docs&language=en-US&region=US`, {
          next: { revalidate: 60 },
        });

        if (!res.ok) throw new Error("Failed to fetch football stories");

        const json = (await res.json()) as FootballStory[];
        if (active) setItems(Array.isArray(json) ? json : []);
      } catch (error) {
        console.error("Error fetching football stories:", error);
        if (active) {
          setHasError(true);
          setItems([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadFootballStories();

    return () => {
      active = false;
    };
  }, []);

  const displayItems = useMemo(
    () =>
      loading
        ? []
        : items.slice(0, 25),
    [items, loading],
  );

  const empty = !loading && items.length === 0;
  const updateScrollState = () => {
    const el = carouselRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    updateScrollState();
    const onScroll = () => updateScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
    };
  }, [displayItems.length, loading]);

  const scrollCarousel = (direction: "left" | "right") => {
    const el = carouselRef.current;
    if (!el) return;
    const distance = Math.min(el.clientWidth * 0.82, 760);
    el.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
    window.setTimeout(updateScrollState, 360);
  };

  return (
    <section className="relative mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#06140d] shadow-2xl shadow-black/60">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.065)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:58px_58px]" />
        <div className="absolute inset-x-5 top-1/2 h-px bg-white/15" />
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/15" />
        <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
        <div className="absolute inset-x-6 top-5 h-12 rounded-b-full border-x border-b border-white/12" />
        <div className="absolute inset-x-6 bottom-5 h-12 rounded-t-full border-x border-t border-white/12" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_13%_0%,rgba(255,255,255,0.28),transparent_22%),radial-gradient(circle_at_87%_0%,rgba(255,214,89,0.24),transparent_24%),radial-gradient(circle_at_68%_68%,rgba(233,79,55,0.16),transparent_32%),linear-gradient(135deg,rgba(233,79,55,0.16),transparent_38%,rgba(16,185,129,0.16))]" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

        <div className="relative p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-black/35 p-2 shadow-2xl shadow-black/40 sm:h-24 sm:w-24">
                <Image
                  src="/images/Fifa2026.png"
                  alt="FIFA World Cup 2026"
                  fill
                  sizes="96px"
                  className="object-contain p-2"
                  priority={false}
                />
              </div>
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-yellow-300/25 bg-yellow-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-yellow-100 sm:text-xs">
                  <Trophy className="h-3.5 w-3.5" />
                  FIFA World Cup 2026 spotlight
                </div>
                <h2 className="max-w-3xl text-2xl font-black leading-none text-white sm:text-3xl lg:text-4xl">
                  World Cup Documentary Picks
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-5 text-zinc-200">
                  National-team journeys, player portraits, club access, and
                  tournament stories from the curated matchday pool.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2">
              <Link
                href="/world-cup-docs"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-yellow-200/40 bg-yellow-300 px-3 text-xs font-black uppercase tracking-[0.08em] text-zinc-950 shadow-lg shadow-yellow-300/20 transition hover:bg-yellow-200 sm:px-4 sm:text-sm"
              >
                Matchday Shelf
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {empty ? (
            <div className="mt-4 flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/25 p-6 text-center">
              <div>
                <Trophy className="mx-auto h-9 w-9 text-yellow-200" />
                <h3 className="mt-3 text-lg font-black text-white">
                  The pitch is being prepared
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
                  {hasError
                    ? "We could not load the World Cup documentary carousel right now. The full collection will retry from the curated recommendation pool."
                    : "No World Cup documentary picks surfaced yet. The curated collection is being refreshed from trusted anchor titles."}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_176px] lg:items-stretch">
              <div className="group/carousel relative min-w-0">
                {canScrollLeft && (
                  <button
                    type="button"
                    onClick={() => scrollCarousel("left")}
                    className="absolute cursor-pointer left-0 top-1/2 z-30 hidden h-12 w-12 -translate-x-4 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white opacity-0 shadow-2xl ring-2 ring-white/10 transition-all hover:scale-110 group-hover/carousel:opacity-100 sm:flex"
                    aria-label="Previous World Cup documentary picks"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                )}
                {canScrollRight && (
                  <button
                    type="button"
                    onClick={() => scrollCarousel("right")}
                    className="absolute cursor-pointer right-0 top-1/2 z-30 hidden h-12 w-12 translate-x-4 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white opacity-0 shadow-2xl ring-2 ring-white/10 transition-all hover:scale-110 group-hover/carousel:opacity-100 sm:flex"
                    aria-label="Next World Cup documentary picks"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                )}
                <div
                  ref={carouselRef}
                  className="flex snap-x gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4"
                >
                  {loading
                    ? Array.from({ length: 10 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-[244px] w-[138px] shrink-0 animate-pulse rounded-lg border border-white/10 bg-white/10 sm:h-[286px] sm:w-[162px]"
                      />
                    ))
                    : displayItems.map((item, index) => (
                      <FootballCard key={`${getMediaType(item)}-${item.id}`} item={item} index={index} />
                    ))}
                </div>
              </div>

              <div className="relative hidden overflow-hidden rounded-lg border border-white/10 bg-black/30 shadow-xl shadow-black/30 lg:block">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.28),transparent_28%),linear-gradient(180deg,rgba(255,214,89,0.12),transparent_48%)]" />
                <div className="absolute inset-x-4 bottom-8 h-px bg-white/15" />
                <div className="absolute bottom-7 left-1/2 h-12 w-12 -translate-x-1/2 rounded-full border-[4px] border-white bg-black shadow-2xl before:absolute before:left-1/2 before:top-0 before:h-full before:w-0.5 before:-translate-x-1/2 before:bg-white after:absolute after:left-0 after:top-1/2 after:h-0.5 after:w-full after:-translate-y-1/2 after:bg-white" />
                <motion.div
                  aria-hidden="true"
                  className="absolute bottom-11 left-1/2 h-32 w-32 -translate-x-1/2"
                  animate={{ y: [0, -7, 0], rotate: [-2, 2, -2] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="absolute left-5 top-8 z-10 h-6 w-24 -rotate-12 rounded-full bg-[#e94f37] shadow-lg shadow-black/30 after:absolute after:right-2 after:top-full after:h-4 after:w-2 after:bg-yellow-300" />
                  <Image
                    src="/images/moodies-mascot.png"
                    alt="Moodies mascot celebrating on a football pitch"
                    fill
                    sizes="128px"
                    className="object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.65)]"
                  />
                </motion.div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <div className="rounded-md border border-yellow-200/20 bg-yellow-200/10 px-2 py-1 text-center text-[10px] font-black uppercase tracking-[0.14em] text-yellow-100">
                    Matchday mood
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FootballCard({ item, index }: { item: FootballStory; index: number }) {
  const mediaType = getMediaType(item) === "tv" ? "tv" : "movie";
  const title = getTitle(item);
  const year = getYear(item);
  const href = mediaType === "tv" ? `/tv/${item.id}` : `/movies/${item.id}`;
  const relevance = getRelevanceLabel(item, index);

  return (
    <Link href={href} className="group w-[138px] shrink-0 snap-start sm:w-[162px]">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-white/[0.065] shadow-xl shadow-black/30 backdrop-blur transition duration-300 group-hover:-translate-y-1 group-hover:border-yellow-200/35">
        <Image
          src={posterUrl(item.poster_path)}
          alt={title}
          fill
          sizes="(max-width: 640px) 42vw, (max-width: 1024px) 28vw, 15vw"
          className="object-cover transition duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-85" />
        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white shadow-lg shadow-black/30 backdrop-blur">
          {mediaType === "tv" ? (
            <>
              <Tv className="h-3 w-3 text-sky-300" />
              Series
            </>
          ) : (
            <>
              <Film className="h-3 w-3 text-violet-300" />
              Movie
            </>
          )}
        </div>
        {item.vote_average ? (
          <div className="absolute right-2 top-2">
            <RatingBadge rating={item.vote_average} size="sm" />
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3">
          <div className="mb-1.5 inline-flex max-w-full rounded bg-emerald-300/15 px-2 py-0.5 text-[9px] font-bold text-emerald-100 ring-1 ring-emerald-200/20 sm:py-1 sm:text-[10px]">
            <span className="truncate">{relevance}</span>
          </div>
          <h3 className="line-clamp-2 text-xs font-black leading-tight text-white sm:text-sm">
            {title}
          </h3>
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-zinc-300 sm:mt-2 sm:gap-2 sm:text-[11px]">
            {year ? <span className="inline-flex items-center gap-1">{year}</span> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
