"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bookmark,
  Info,
  Layers,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Shuffle,
  BookmarkCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getMoodRecommendations, getAllMoods } from "@/app/tv/action";
import { useAuth } from "@/app/context/AuthProvider";
import { useRouter } from "next/navigation";
import { useWatchlist } from "@/hooks/useWatchlist";
import { RatingBadge } from "@/components/ui/rating-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Mood {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
}

interface Recommendation {
  id: string;
  tmdbId: number;
  mediaType: "MOVIE" | "TV";
  title: string;
  overview: string | null;
  genreNames?: string[];
  voteAverage: number;
  releaseDate: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  score: number | string;
  reason: string;
  voteCount?: number | null;
  popularity?: number | null;
  metadata?: {
    scoreBreakdown?: Partial<Record<
      "genreScore" | "valenceScore" | "arousalScore" | "popularityScore" | "recencyScore" | "keywordScore",
      number
    >>;
    source?: string;
  } | null;
}

interface MoodRecommendationsSectionProps {
  mediaType?: "movie" | "tv" | "both" | string;
  initialMoods?: unknown[];
}

const RECOMMENDATION_LIMIT = 18;
const DEFAULT_MOOD_COUNT = 12;
const EXPANDED_MOOD_COUNT = 18;
const FEATURED_MOOD_NAMES = [
  "Happy",
  "Funny",
  "Cozy",
  "Thrilling",
  "Epic",
  "Dark",
  "Mind-Bending",
  "Romantic",
  "Inspirational",
  "Sci-Fi",
  "Documentary",
  "Chill",
];
const NEUTRAL_MOOD_COLOR = "#8b8b95";

const moodImageMap: Record<string, string> = {
  happy: "happy",
  funny: "funny",
  cozy: "cozy",
  whimsy: "whimsy",
  romantic: "romantic",
  serenity: "serenity",
  chill: "chill",
  inspirational: "inspirational",
  nostalgic: "nostalgic",
  bittersweet: "bittersweet",
  sad: "sad",
  thrilling: "thrilling",
  epic: "epic",
  chaos: "chaos",
  horror: "horror",
  dark: "dark",
  gritty: "gritty",
  "mind-bending": "mind-bending",
  "sci-fi": "sci-fi",
  western: "western",
  documentary: "documentary",
};

const iconFallbackMap: Record<string, string> = {
  smile: "happy",
  laugh: "funny",
  "mug-hot": "cozy",
  magic: "whimsy",
  heart: "romantic",
  wind: "serenity",
  cloud: "chill",
  star: "inspirational",
  clock: "nostalgic",
  zap: "thrilling",
  crown: "epic",
  fire: "chaos",
  skull: "horror",
  moon: "dark",
  shield: "gritty",
  brain: "mind-bending",
  rocket: "sci-fi",
  cowboy: "western",
  book: "documentary",
};

function slugify(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function normalizeMoods(value: unknown[]): Mood[] {
  return value.filter((item): item is Mood => {
    if (!item || typeof item !== "object") return false;
    const mood = item as Partial<Mood>;
    return Boolean(mood.id && mood.name && mood.color);
  });
}

function getMoodImageSrc(mood: Mood) {
  const imageName = moodImageMap[slugify(mood.name)] || iconFallbackMap[mood.icon];
  return imageName ? `/images/moods/${imageName}.png` : "/images/moodies1.png";
}

function getPosterUrl(path?: string | null) {
  return path ? `https://image.tmdb.org/t/p/w500${path}` : "/placeholder-poster.svg";
}

function getMoodColor(mood?: Mood | null) {
  const color = mood?.color?.trim();
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : NEUTRAL_MOOD_COLOR;
}

function getMediaHref(rec: Recommendation) {
  return rec.mediaType === "TV" ? `/tv/${rec.tmdbId}` : `/movies/${rec.tmdbId}`;
}

function getMediaLabel(rec: Recommendation) {
  return rec.mediaType === "TV" ? "Series" : "Movie";
}

function getYear(date?: string | null) {
  if (!date) return "New";
  const year = new Date(date).getFullYear();
  return Number.isFinite(year) ? String(year) : "New";
}

function getMatchScore(rec: Recommendation) {
  return Math.max(1, Math.min(99, Math.round(Number(rec.score ?? 0) * 100)));
}

function orderMoods(moods: Mood[]) {
  const byName = new Map(moods.map((mood) => [mood.name.toLowerCase(), mood]));
  const preferred = FEATURED_MOOD_NAMES
    .map((name) => byName.get(name.toLowerCase()))
    .filter((mood): mood is Mood => Boolean(mood));
  const remaining = moods
    .filter((mood) => !FEATURED_MOOD_NAMES.some((name) => name.toLowerCase() === mood.name.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...preferred, ...remaining];
}

function rotateArray<T>(items: T[], offset: number) {
  if (items.length === 0) return items;
  const safeOffset = offset % items.length;
  return [...items.slice(safeOffset), ...items.slice(0, safeOffset)];
}

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function shuffleWithSeed<T>(items: T[], seed: number) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(seededRandom(seed + index) * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export default function MoodRecommendationsSection({
  mediaType = "both",
  initialMoods,
}: MoodRecommendationsSectionProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { add, remove, isInWatchlist, ready } = useWatchlist();
  const initialMoodList = useMemo(() => normalizeMoods(initialMoods ?? []), [initialMoods]);

  const [moods, setMoods] = useState<Mood[]>(initialMoodList);
  const [displayedMoods, setDisplayedMoods] = useState<Mood[]>([]);
  const [moodsLoading, setMoodsLoading] = useState(initialMoodList.length === 0);
  const [moodsError, setMoodsError] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moodCount, setMoodCount] = useState(DEFAULT_MOOD_COUNT);
  const [shuffleOffset, setShuffleOffset] = useState(0);
  const [watchlistStates, setWatchlistStates] = useState<Record<string, boolean>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const requestIdRef = useRef(0);
  const initialMoodShuffleSeed = useRef(Date.now() + Math.random());

  const orderedMoods = useMemo(
    () => shuffleWithSeed(orderMoods(moods), initialMoodShuffleSeed.current),
    [moods]
  );
  const topMatch = recommendations[0];
  const movieCount = recommendations.filter((rec) => rec.mediaType === "MOVIE").length;
  const tvCount = recommendations.filter((rec) => rec.mediaType === "TV").length;

  const toHookType = (type: "MOVIE" | "TV") =>
    (type === "TV" ? "series" : "movie") as "movie" | "series";

  useEffect(() => {
    setDisplayedMoods(rotateArray(orderedMoods, shuffleOffset).slice(0, moodCount));
  }, [moodCount, orderedMoods, shuffleOffset]);

  useEffect(() => {
    if (initialMoodList.length > 0) {
      setMoods(initialMoodList);
      setMoodsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchMoods() {
      try {
        setMoodsLoading(true);
        setMoodsError(null);
        const moodsList = await getAllMoods();
        const safeMoods = normalizeMoods(Array.isArray(moodsList) ? moodsList : []);

        if (safeMoods.length === 0) {
          throw new Error("No moods available");
        }

        if (!cancelled) setMoods(safeMoods);
      } catch (err) {
        if (!cancelled) {
          setMoodsError(err instanceof Error ? err.message : "Failed to load moods");
        }
      } finally {
        if (!cancelled) setMoodsLoading(false);
      }
    }

    fetchMoods();
    return () => {
      cancelled = true;
    };
  }, [initialMoodList]);

  const handleShuffleMoods = () => {
    setShuffleOffset((current) => current + Math.max(1, Math.floor(moodCount / 2)));
  };

  const toggleMoodCount = () => {
    setMoodCount((current) =>
      current === DEFAULT_MOOD_COUNT ? EXPANDED_MOOD_COUNT : DEFAULT_MOOD_COUNT
    );
  };

  const fetchRecommendations = async (mood: Mood) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setLoading(true);
    setError(null);
    setRecommendations([]);

    try {
      const data = await getMoodRecommendations(
        mood.id,
        RECOMMENDATION_LIMIT,
        mediaType,
        true,
        true,
        {
          userId: isAuthenticated ? user?.id : undefined,
          minRating: 5.8,
          excludeViewed: true,
        }
      );

      const recs = Array.isArray(data?.recommendations)
        ? data.recommendations
        : Array.isArray(data)
          ? data
          : [];

      if (recs.length === 0) {
        throw new Error("No recommendations received from server");
      }

      if (requestIdRef.current === requestId) {
        setRecommendations(recs);
        setRefreshedAt(Date.now());
      }
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      const message = err instanceof Error ? err.message : "Failed to load recommendations";
      setError(message);
      setRecommendations([]);
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  const handleMoodClick = (mood: Mood) => {
    setRefreshedAt(null);
    setSelectedMood(mood);
    void fetchRecommendations(mood);
  };

  const handleRefresh = () => {
    if (selectedMood) {
      void fetchRecommendations(selectedMood);
    }
  };

  const toggleWatchlist = async (rec: Recommendation) => {
    if (!ready) {
      router.push("/auth/login");
      return;
    }

    const id = String(rec.tmdbId);
    const kind = toHookType(rec.mediaType);
    setLoadingStates((prev) => ({ ...prev, [id]: true }));

    try {
      const inListNow = isInWatchlist(id, kind) ?? watchlistStates[id];

      if (inListNow) {
        await remove(id, kind, {
          title: rec.title,
          posterUrl: getPosterUrl(rec.posterPath),
          variant: "info",
          duration: 3500,
        });
        setWatchlistStates((prev) => ({ ...prev, [id]: false }));
      } else {
        await add(id, kind, {
          title: rec.title,
          posterUrl: getPosterUrl(rec.posterPath),
          variant: "info",
          duration: 3500,
        });
        setWatchlistStates((prev) => ({ ...prev, [id]: true }));
      }
    } catch (err) {
      const inListNow = isInWatchlist(id, kind) ?? watchlistStates[id];
      setWatchlistStates((prev) => ({ ...prev, [id]: inListNow }));
      console.error("Watchlist toggle failed:", err);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [id]: false }));
    }
  };

  useEffect(() => {
    if (recommendations.length > 0) {
      const states: Record<string, boolean> = {};
      recommendations.forEach((rec) => {
        const id = String(rec.tmdbId);
        const kind = toHookType(rec.mediaType);
        states[id] = isInWatchlist(id, kind);
      });
      setWatchlistStates(states);
    }
  }, [recommendations, isInWatchlist, ready]);

  if (moodsError && !moodsLoading) {
    return (
      <section id="moods" className="relative w-full max-w-7xl mx-auto overflow-hidden">
        <div className="flex items-center justify-center py-32">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
              <Sparkles className="h-9 w-9 text-red-300" />
            </div>
            <h3 className="mb-2 text-2xl font-black text-white">Error Loading Moods</h3>
            <p className="mb-6 text-lg text-gray-400">{moodsError}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 font-bold text-white transition hover:scale-105 hover:shadow-lg hover:shadow-violet-500/50"
            >
              Reload
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="moods" className="relative w-full max-w-7xl mx-auto overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-fuchsia-600/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-96 w-96 rounded-full bg-cyan-600/5 blur-3xl" />
      </div>

      <div className="relative mb-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 opacity-50 blur-lg" />
                <div className="relative rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-cyan-600 p-2.5">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
              </div>
              <h2 className="bg-gradient-to-r from-white via-violet-200 to-white bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
                Mood Matcher
              </h2>
            </div>
            <p className="ml-14 max-w-2xl text-base text-gray-400">
              Discover content that matches your current vibe, now ranked with stronger mood signals.
            </p>
          </div>

          {selectedMood && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleRefresh}
              disabled={loading}
              className="group flex items-center gap-3 rounded-2xl border border-violet-400/30 bg-gradient-to-r from-violet-600/25 to-fuchsia-600/25 px-4 py-3 text-left shadow-lg shadow-black/20 ring-1 ring-white/10 backdrop-blur transition duration-300 hover:border-violet-300/60 hover:from-violet-600/35 hover:to-fuchsia-600/35 hover:shadow-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-md">
                <RefreshCw
                  className={`h-4 w-4 ${
                    loading ? "animate-spin" : "transition-transform duration-500 group-hover:rotate-180"
                  }`}
                />
              </span>
              <span>
                <span className="block text-sm font-black text-white">
                  {loading ? "Refreshing..." : "Refresh Picks"}
                </span>
                <span className="block text-[11px] font-semibold text-violet-100/75">
                  {refreshedAt ? "Fresh set requested" : `Regenerate for ${selectedMood.name.toLowerCase()}`}
                </span>
              </span>
            </motion.button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!selectedMood && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/80 shadow-xl shadow-black/20 backdrop-blur-sm"
          >
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/20">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-white">
                    {displayedMoods.length} moods in view
                  </div>
                  <div className="text-xs font-medium text-zinc-500">
                    Pick the emotional lane for your next watch.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={toggleMoodCount}
                  className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-zinc-200 transition hover:bg-white/[0.1]"
                >
                  {moodCount === DEFAULT_MOOD_COUNT ? "Show more moods" : "Show fewer"}
                </button>
                <button
                  onClick={handleShuffleMoods}
                  className="group flex items-center gap-2 rounded-lg border border-violet-500/30 bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 px-3 py-2 text-xs font-bold text-violet-200 transition duration-300 hover:from-violet-600/30 hover:to-fuchsia-600/30"
                >
                  <Shuffle className="h-4 w-4 text-violet-300 transition-transform duration-500 group-hover:rotate-180" />
                  Shuffle moods
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!selectedMood ? (
          <motion.div
            key="mood-grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
          >
            {moodsLoading
              ? Array.from({ length: DEFAULT_MOOD_COUNT }).map((_, index) => (
                <div key={index} className="h-48 animate-pulse rounded-2xl bg-white/[0.06]" />
              ))
              : displayedMoods.map((mood, index) => (
                <motion.button
                  key={mood.id}
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    delay: index * 0.03,
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                  }}
                  onClick={() => handleMoodClick(mood)}
                  className="group relative rounded-2xl p-6 transition duration-300 hover:-translate-y-2 hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, ${mood.color}20 0%, ${mood.color}05 100%)`,
                    border: `2px solid ${mood.color}30`,
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background: `linear-gradient(135deg, ${mood.color}40 0%, ${mood.color}15 100%)`,
                      boxShadow: `0 8px 32px ${mood.color}40, 0 0 0 1px ${mood.color}50`,
                    }}
                  />
                  <div className="relative flex flex-col items-center gap-3 text-center">
                    <div className="relative mb-1 h-24 w-24 transition duration-300 group-hover:rotate-3 group-hover:scale-110">
                      <Image
                        src={getMoodImageSrc(mood)}
                        alt={`${mood.name} mood mascot`}
                        fill
                        sizes="96px"
                        className="object-contain"
                      />
                    </div>
                    <div>
                      <h3
                        className="mb-1 text-sm font-bold"
                        style={{ color: mood.color }}
                      >
                        {mood.name}
                      </h3>
                      <p className="line-clamp-2 text-xs leading-relaxed text-gray-400 transition-colors group-hover:text-gray-300">
                        {mood.description}
                      </p>
                    </div>
                    <ChevronRight
                      className="h-5 w-5 opacity-0 transition duration-300 group-hover:translate-x-1 group-hover:opacity-100"
                      style={{ color: mood.color }}
                    />
                  </div>
                </motion.button>
              ))}
          </motion.div>
        ) : (
          <motion.div
            key="recommendations"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mb-8"
          >
            <div
              className="relative mb-8 flex flex-col gap-4 overflow-hidden rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between"
              style={{
                background: `linear-gradient(90deg, ${selectedMood.color}30 0%, ${selectedMood.color}15 50%, ${selectedMood.color}30 100%)`,
                border: `2px solid ${selectedMood.color}50`,
              }}
            >
              <div className="absolute inset-0 opacity-10">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `radial-gradient(circle at 2px 2px, ${selectedMood.color} 1px, transparent 0)`,
                    backgroundSize: "32px 32px",
                  }}
                />
              </div>

              <div className="relative flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0">
                  <Image
                    src={getMoodImageSrc(selectedMood)}
                    alt={`${selectedMood.name} mood mascot`}
                    fill
                    sizes="80px"
                    className="object-contain"
                  />
                </div>
                <div>
                  <h3 className="mb-1 text-xl font-black text-white">
                    {selectedMood.name} Mode
                  </h3>
                  <p className="text-sm font-medium text-gray-300">
                    {selectedMood.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-bold text-white/80 ring-1 ring-white/10">
                      {recommendations.length || RECOMMENDATION_LIMIT} picks
                    </span>
                    <span className="rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-bold text-white/80 ring-1 ring-white/10">
                      {movieCount} movies
                    </span>
                    <span className="rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-bold text-white/80 ring-1 ring-white/10">
                      {tvCount} series
                    </span>
                    {topMatch && (
                      <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-black text-white ring-1 ring-white/20">
                        Top match {getMatchScore(topMatch)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedMood(null)}
                className="relative rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-bold text-white transition duration-300 hover:scale-105 hover:border-white/40 hover:bg-white/20"
              >
                Change Mood
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-32">
                <div className="relative mb-6">
                  <div
                    className="h-20 w-20 animate-spin rounded-full border-4"
                    style={{
                      borderColor: `${selectedMood.color}20`,
                      borderTopColor: selectedMood.color,
                    }}
                  />
                  <div
                    className="absolute inset-0 animate-pulse blur-2xl"
                    style={{ backgroundColor: `${selectedMood.color}55` }}
                  />
                </div>
                <p className="mb-2 text-2xl font-black text-white">
                  Curating your perfect matches
                </p>
                <p className="text-lg text-gray-400">
                  Finding content that fits your {selectedMood.name.toLowerCase()} mood...
                </p>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-32">
                <div className="max-w-md text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
                    <Sparkles className="h-9 w-9 text-red-300" />
                  </div>
                  <h3 className="mb-2 text-2xl font-black text-white">Oops!</h3>
                  <p className="mb-6 text-lg text-gray-400">{error}</p>
                  <button
                    onClick={handleRefresh}
                    className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 font-bold text-white transition hover:scale-105 hover:shadow-lg hover:shadow-violet-500/50"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : recommendations.length > 0 ? (
              <motion.div
                key={`recommendations-${selectedMood.id}-${refreshedAt ?? 0}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
              >
                {recommendations.map((rec, index) => {
                  const id = String(rec.tmdbId);
                  const kind = toHookType(rec.mediaType);
                  const inList = isInWatchlist(id, kind) ?? watchlistStates[id];
                  const isBusy = loadingStates[id];
                  const matchScore = getMatchScore(rec);
                  const genres = rec.genreNames?.filter(Boolean) ?? [];
                  const visibleGenres = genres.slice(0, 2);
                  const hiddenGenreCount = Math.max(0, genres.length - visibleGenres.length);
                  const moodColor = getMoodColor(selectedMood);

                  return (
                    <motion.div
                      key={`${rec.mediaType}-${rec.tmdbId}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        delay: index * 0.03,
                        type: "spring",
                        stiffness: 260,
                        damping: 20,
                      }}
                    >
                      <Link href={getMediaHref(rec)}>
                        <div className="group relative block">
                          <div className="relative mb-3 aspect-[2/3] overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl ring-1 ring-white/10 transition duration-500 group-hover:-translate-y-1">
                            <Image
                              src={getPosterUrl(rec.posterPath)}
                              alt={rec.title}
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                              className="object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 transition-opacity group-hover:opacity-40" />
                            <div
                              className="pointer-events-none absolute inset-0 rounded-2xl border-2 opacity-0 transition duration-500 group-hover:opacity-100"
                              style={{
                                borderColor: `${moodColor}B8`,
                                boxShadow: `0 18px 46px ${moodColor}35, inset 0 0 26px ${moodColor}18`,
                              }}
                            />

                            <div className="absolute left-2 top-2">
                              <div
                                className="relative h-14 w-14 rounded-full p-[3px] shadow-xl ring-1 ring-white/20"
                                style={{
                                  background: `conic-gradient(${moodColor} ${matchScore * 3.6}deg, rgba(255,255,255,0.22) 0deg)`,
                                }}
                              >
                                <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-black/80 text-white backdrop-blur">
                                  <div className="text-[8px] font-black uppercase tracking-[0.12em] text-white/60">
                                    Match
                                  </div>
                                  <div className="text-sm font-black leading-none">
                                    {matchScore}%
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="absolute right-2 top-2">
                              <RatingBadge rating={rec.voteAverage} variant="colored" size="sm" />
                            </div>

                            <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-end gap-1.5 transition-opacity duration-300 group-hover:opacity-0">
                              <span className="rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-black text-white ring-1 ring-white/10 backdrop-blur">
                                {getMediaLabel(rec)}
                              </span>
                              <span className="rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-zinc-200 ring-1 ring-white/10 backdrop-blur">
                                {getYear(rec.releaseDate)}
                              </span>
                            </div>

                            <div
                              className="absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100"
                              style={{
                                background: `linear-gradient(to top, rgba(0,0,0,0.92) 0%, ${moodColor}66 58%, rgba(0,0,0,0.28) 100%)`,
                              }}
                            >
                              <div className="absolute inset-0 flex items-end justify-center p-3">
                                <TooltipProvider>
                                  <div className="flex gap-2">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <motion.button
                                          onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            if (!isBusy) void toggleWatchlist(rec);
                                          }}
                                          disabled={isBusy}
                                          className={`flex h-9 w-9 items-center justify-center rounded-full shadow-xl transition hover:scale-110 ${
                                            inList
                                              ? "text-white"
                                              : "bg-white text-black hover:text-white"
                                          } ${isBusy ? "cursor-not-allowed opacity-70" : ""}`}
                                          style={{
                                            backgroundColor: inList ? moodColor : undefined,
                                          }}
                                          whileTap={{ scale: 0.9 }}
                                          onMouseEnter={(event) => {
                                            if (!inList) event.currentTarget.style.backgroundColor = moodColor;
                                          }}
                                          onMouseLeave={(event) => {
                                            if (!inList) event.currentTarget.style.backgroundColor = "";
                                          }}
                                        >
                                          {isBusy ? (
                                            <motion.div
                                              animate={{ rotate: 360 }}
                                              transition={{
                                                duration: 1,
                                                repeat: Infinity,
                                                ease: "linear",
                                              }}
                                              className="h-4 w-4 rounded-full border-2 border-current border-t-transparent"
                                            />
                                          ) : inList ? (
                                            <BookmarkCheck className="h-4 w-4" />
                                          ) : (
                                            <Bookmark className="h-4 w-4" />
                                          )}
                                        </motion.button>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="bottom"
                                        sideOffset={8}
                                        className="rounded-lg border border-white/20 bg-black/90 px-3 py-2 shadow-xl backdrop-blur-md"
                                      >
                                        <div className="text-xs font-medium text-white">
                                          {isBusy
                                            ? "Updating..."
                                            : inList
                                              ? "Remove from My List"
                                              : "Add to My List"}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>

                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            router.push(getMediaHref(rec));
                                          }}
                                          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-xl transition hover:scale-110 hover:text-white"
                                          onMouseEnter={(event) => {
                                            event.currentTarget.style.backgroundColor = moodColor;
                                          }}
                                          onMouseLeave={(event) => {
                                            event.currentTarget.style.backgroundColor = "";
                                          }}
                                        >
                                          <Info className="h-4 w-4" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="bottom"
                                        sideOffset={8}
                                        className="rounded-lg border border-white/20 bg-black/90 px-3 py-2 shadow-xl backdrop-blur-md"
                                      >
                                        <div className="text-xs font-medium text-white">More Info</div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TooltipProvider>
                              </div>
                            </div>
                          </div>

                          <div className="px-1">
                            <div className="mb-1.5 flex items-start justify-between gap-2">
                              <h4
                                className="line-clamp-2 text-sm font-bold leading-tight text-white transition-colors duration-300"
                                style={{ textShadow: `0 0 0 ${moodColor}` }}
                                onMouseEnter={(event) => {
                                  event.currentTarget.style.color = moodColor;
                                  event.currentTarget.style.textShadow = `0 0 18px ${moodColor}66`;
                                }}
                                onMouseLeave={(event) => {
                                  event.currentTarget.style.color = "";
                                  event.currentTarget.style.textShadow = `0 0 0 ${moodColor}`;
                                }}
                              >
                                {rec.title}
                              </h4>
                              <span
                                className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black text-white shadow-sm"
                                style={{ backgroundColor: `${moodColor}B8` }}
                              >
                                {matchScore}%
                              </span>
                            </div>
                            {visibleGenres.length > 0 ? (
                              <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                                {visibleGenres.map((genre) => (
                                  <span
                                    key={genre}
                                    className="max-w-[74px] shrink-0 truncate rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-zinc-400 ring-1 ring-white/10 sm:max-w-[92px]"
                                    title={genre}
                                  >
                                    {genre}
                                  </span>
                                ))}
                                {hiddenGenreCount > 0 && (
                                  <span className="shrink-0 rounded-full bg-white/[0.09] px-2 py-0.5 text-[10px] font-black text-zinc-300 ring-1 ring-white/10">
                                    +{hiddenGenreCount}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                                <span className="truncate rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-zinc-400 ring-1 ring-white/10">
                                  {getMediaLabel(rec)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <div className="flex items-center justify-center py-32">
                <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/20 backdrop-blur">
                  <div
                    className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `${selectedMood.color}22`, color: selectedMood.color }}
                  >
                    <Sparkles className="h-8 w-8" />
                  </div>
                  <h3 className="mb-2 text-2xl font-black text-white">No matches found</h3>
                  <p className="mb-6 text-sm leading-6 text-gray-400">
                    We could not build a confident {selectedMood.name.toLowerCase()} set from the current filters.
                    Refresh this mood or choose another lane.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button
                      onClick={handleRefresh}
                      className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white transition hover:scale-105"
                      style={{ backgroundColor: selectedMood.color }}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh Picks
                    </button>
                    <button
                      onClick={() => setSelectedMood(null)}
                      className="rounded-xl border border-white/15 bg-white/[0.06] px-5 py-3 text-sm font-bold text-white transition hover:border-white/30 hover:bg-white/[0.1]"
                    >
                      Change Mood
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
