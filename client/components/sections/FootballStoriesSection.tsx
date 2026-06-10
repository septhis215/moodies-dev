"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Film,
  Sparkles,
  Star,
  Trophy,
  Tv,
} from "lucide-react";
import type { All } from "@/types/all";

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

function getBackdropUrl(path?: string | null) {
  return path ? `https://image.tmdb.org/t/p/w780${path}` : "/placeholder-backdrop.svg";
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

  useEffect(() => {
    let active = true;

    async function loadFootballStories() {
      try {
        setLoading(true);
        setHasError(false);
        const base = process.env.NEST_API_URL || "http://localhost:4000";
        const res = await fetch(`${base}/all/football-stories?limit=16&rankingMode=world-cup-docs&language=en-US&region=US`, {
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

  const featured = items[0];
  const displayItems = useMemo(
    () =>
      loading
        ? []
        : items.slice(0, 12),
    [items, loading],
  );

  const empty = !loading && items.length === 0;

  return (
    <section className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="relative overflow-hidden rounded-lg border border-emerald-300/15 bg-[#07110d] shadow-2xl shadow-black/50">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px]" />
        <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_18%_0%,rgba(255,217,92,0.28),transparent_34%),radial-gradient(circle_at_78%_0%,rgba(233,79,55,0.26),transparent_30%)]" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
        <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
        <div className="absolute bottom-0 left-0 right-0 h-44 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />

        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.36fr)] lg:p-8">
          <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-white/10 bg-black/35 p-5 sm:min-h-[390px] sm:p-6">
            {featured?.backdrop_path ? (
              <Image
                src={getBackdropUrl(featured.backdrop_path)}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 42vw"
                className="object-cover opacity-25"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/70 via-black/55 to-[#e94f37]/20" />
            <div className="absolute -right-12 top-10 h-40 w-40 rounded-full border border-yellow-300/20 shadow-[0_0_60px_rgba(250,204,21,0.22)]" />
            <div className="absolute bottom-8 right-6 h-14 w-14 rounded-full border-[6px] border-white bg-black shadow-2xl before:absolute before:left-1/2 before:top-0 before:h-full before:w-0.5 before:-translate-x-1/2 before:bg-white after:absolute after:left-0 after:top-1/2 after:h-0.5 after:w-full after:-translate-y-1/2 after:bg-white" />

            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-300/25 bg-yellow-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-yellow-100">
                  <Trophy className="h-3.5 w-3.5" />
                  World Cup doc spotlight
                </div>
                <h2 className="max-w-xl text-3xl font-black leading-none text-white sm:text-4xl lg:text-5xl">
                  World Cup Stories Cup
                </h2>
                <p className="mt-4 max-w-[46ch] text-sm leading-6 text-zinc-200 sm:text-base">
                  A curated run of World Cup documentaries, national-team
                  journeys, football legends, club docuseries, and
                  behind-the-scenes tournament stories.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/world-cup-docs"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#e94f37] px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-[#e94f37]/25 transition hover:bg-[#ff6b58]"
                >
                  Open the Collection
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/world-cup-docs?sort=recent"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15"
                >
                  Latest Doc Picks
                </Link>
              </div>
            </div>

            <motion.div
              aria-hidden="true"
              className="absolute bottom-4 right-14 z-10 hidden h-40 w-40 sm:block"
              animate={{ y: [0, -7, 0], rotate: [-2, 2, -2] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="absolute left-5 top-7 z-10 h-8 w-28 -rotate-12 rounded-full bg-[#e94f37] shadow-lg shadow-black/30 after:absolute after:right-2 after:top-full after:h-6 after:w-3 after:bg-yellow-300" />
              <Image
                src="/images/moodies-mascot.png"
                alt="Moodies mascot celebrating on a football pitch"
                fill
                sizes="160px"
                className="object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.65)]"
              />
            </motion.div>
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
                  <Sparkles className="h-3.5 w-3.5 text-yellow-200" />
                  Curated documentary picks
                </div>
                <p className="mt-2 max-w-2xl text-sm text-zinc-300">
                  Premium sports documentaries, docuseries, player profiles,
                  club access stories, and championship journeys.
                </p>
              </div>
              <Link
                href="/world-cup-docs"
                className="text-sm font-bold text-[#ff8a78] transition hover:text-white"
              >
                View full collection
              </Link>
            </div>

            {empty ? (
              <div className="flex min-h-[310px] items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/25 p-6 text-center">
                <div>
                  <Trophy className="mx-auto h-9 w-9 text-yellow-200" />
                  <h3 className="mt-3 text-lg font-black text-white">
                    The pitch is being prepared
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
                    {hasError
                      ? "We could not load the World Cup documentary shelf right now. The full collection will retry from the curated recommendation pool."
                      : "No World Cup documentary picks surfaced yet. The curated collection is being refreshed from trusted anchor titles."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {loading
                  ? Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[260px] w-[150px] shrink-0 animate-pulse rounded-lg border border-white/10 bg-white/10 sm:h-[300px] sm:w-[176px]"
                    />
                  ))
                  : displayItems.map((item, index) => (
                    <FootballCard key={`${getMediaType(item)}-${item.id}`} item={item} index={index} />
                  ))}
              </div>
            )}
          </div>
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
    <Link href={href} className="group w-[150px] shrink-0 sm:w-[176px]">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-zinc-950 shadow-xl shadow-black/30 transition duration-300 group-hover:-translate-y-1 group-hover:border-yellow-200/35">
        <Image
          src={posterUrl(item.poster_path)}
          alt={title}
          fill
          sizes="(max-width: 640px) 42vw, (max-width: 1024px) 28vw, 15vw"
          className="object-cover transition duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-85" />
        <div className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/70 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white backdrop-blur">
          {mediaType === "tv" ? (
            <span className="inline-flex items-center gap-1">
              <Tv className="h-3 w-3 text-sky-300" />
              Series
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Film className="h-3 w-3 text-violet-300" />
              Movie
            </span>
          )}
        </div>
        {item.vote_average ? (
          <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-yellow-300 px-2 py-1 text-[10px] font-black text-zinc-950">
            <Star className="h-3 w-3 fill-current" />
            {item.vote_average.toFixed(1)}
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="mb-2 inline-flex max-w-full rounded bg-emerald-300/15 px-2 py-1 text-[10px] font-bold text-emerald-100 ring-1 ring-emerald-200/20">
            <span className="truncate">{relevance}</span>
          </div>
          <h3 className="line-clamp-2 text-sm font-black leading-tight text-white">
            {title}
          </h3>
          <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-zinc-300">
            {year ? (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {year}
              </span>
            ) : null}
            <span className="h-1 w-1 rounded-full bg-[#e94f37]" />
            <span>Doc pick</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
