"use client";

import { tmdbImage } from "@/lib/tmdb";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import {
  Bookmark,
  Layers,
  Sparkles,
  RefreshCw,
  Shuffle,
  BookmarkCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getMoodRecommendations, getAllMoods } from "@/app/tv/action";
import { useAuth } from "@/app/context/AuthProvider";
import { useRouter } from "next/navigation";
import { useWatchlist } from "@/hooks/useWatchlist";
import { RatingBadge } from "@/components/ui/rating-badge";

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
    scoreBreakdown?: Partial<
      Record<
        | "genreScore"
        | "valenceScore"
        | "arousalScore"
        | "popularityScore"
        | "recencyScore"
        | "keywordScore",
        number
      >
    >;
    source?: string;
  } | null;
}

interface MoodRecommendationsSectionProps {
  mediaType?: "movie" | "tv" | "both" | string;
  initialMoods?: unknown[];
}

const RECOMMENDATION_LIMIT = 18;
const DEFAULT_MOOD_COUNT = 8;
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
  const imageName =
    moodImageMap[slugify(mood.name)] || iconFallbackMap[mood.icon];
  return imageName ? `/images/moods/${imageName}.png` : "/images/moodies1.png";
}

function getPosterUrl(path?: string | null) {
  return path ? tmdbImage(path, "w500") : "/placeholder-poster.svg";
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
  const preferred = FEATURED_MOOD_NAMES.map((name) =>
    byName.get(name.toLowerCase()),
  ).filter((mood): mood is Mood => Boolean(mood));
  const remaining = moods
    .filter(
      (mood) =>
        !FEATURED_MOOD_NAMES.some(
          (name) => name.toLowerCase() === mood.name.toLowerCase(),
        ),
    )
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
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
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
  const initialMoodList = useMemo(
    () => normalizeMoods(initialMoods ?? []),
    [initialMoods],
  );

  const [moods, setMoods] = useState<Mood[]>(initialMoodList);
  const [displayedMoods, setDisplayedMoods] = useState<Mood[]>([]);
  const [moodsLoading, setMoodsLoading] = useState(
    initialMoodList.length === 0,
  );
  const [moodsError, setMoodsError] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moodCount, setMoodCount] = useState(DEFAULT_MOOD_COUNT);
  const [shuffleOffset, setShuffleOffset] = useState(0);
  const [watchlistStates, setWatchlistStates] = useState<
    Record<string, boolean>
  >({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>(
    {},
  );
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const requestIdRef = useRef(0);
  const initialMoodShuffleSeed = useRef(Date.now() + Math.random());

  const orderedMoods = useMemo(
    () => shuffleWithSeed(orderMoods(moods), initialMoodShuffleSeed.current),
    [moods],
  );
  const toHookType = (type: "MOVIE" | "TV") =>
    (type === "TV" ? "series" : "movie") as "movie" | "series";

  useEffect(() => {
    setDisplayedMoods(
      rotateArray(orderedMoods, shuffleOffset).slice(0, moodCount),
    );
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
        const safeMoods = normalizeMoods(
          Array.isArray(moodsList) ? moodsList : [],
        );

        if (safeMoods.length === 0) {
          throw new Error("No moods available");
        }

        if (!cancelled) setMoods(safeMoods);
      } catch (err) {
        if (!cancelled) {
          setMoodsError(
            err instanceof Error ? err.message : "Failed to load moods",
          );
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
    setShuffleOffset(
      (current) => current + Math.max(1, Math.floor(moodCount / 2)),
    );
  };

  const toggleMoodCount = () => {
    setMoodCount((current) =>
      current === DEFAULT_MOOD_COUNT ? EXPANDED_MOOD_COUNT : DEFAULT_MOOD_COUNT,
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
        },
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
      const message =
        err instanceof Error ? err.message : "Failed to load recommendations";
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
      <section
        id="moods"
        className="relative w-full max-w-7xl mx-auto overflow-hidden"
      >
        <div className="flex items-center justify-center py-32">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
              <Sparkles className="h-9 w-9 text-red-300" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-[var(--ink)]">
              Error Loading Moods
            </h3>
            <p className="mb-6 text-lg text-gray-400">{moodsError}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-[var(--brand-coral)] px-6 py-3 font-semibold text-white transition-colors hover:bg-[var(--brand-coral-strong)]"
            >
              Reload
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="moods"
      className="relative mx-auto w-full max-w-7xl overflow-hidden border-t border-[var(--surface-border)] pt-6 sm:pt-7"
    >
      <div className="mb-5 max-w-2xl sm:mb-6">
        <p className="ui-kicker">Find your mood</p>
        <h2 className="mt-2 text-balance text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">
          Mood matcher
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          Pick how you feel and find{" "}
          {mediaType === "tv"
            ? "a series"
            : mediaType === "movie"
              ? "a movie"
              : "something"}{" "}
          to watch.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!selectedMood && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-1)]"
          >
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-coral)]/10 text-[var(--brand-coral-strong)]">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--ink)]">
                    Choose how you want to feel
                  </h3>
                  <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                    Pick one below, or shuffle for a fresh set.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <button
                  onClick={toggleMoodCount}
                  className="min-h-11 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brand-coral)]"
                >
                  {moodCount === DEFAULT_MOOD_COUNT
                    ? "Show more moods"
                    : "Show fewer"}
                </button>
                <button
                  onClick={handleShuffleMoods}
                  className="group flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brand-coral)]"
                >
                  <Shuffle className="h-4 w-4 text-[var(--brand-coral-strong)]" />
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
            className={`mb-6 grid grid-cols-2 gap-2.5 sm:gap-3 ${
              moodCount === DEFAULT_MOOD_COUNT
                ? "sm:grid-cols-4"
                : "sm:grid-cols-3 lg:grid-cols-6"
            }`}
          >
            {moodsLoading
              ? Array.from({ length: DEFAULT_MOOD_COUNT }).map((_, index) => (
                  <div
                    key={index}
                    className="h-40 moodies-skeleton rounded-xl border border-[var(--surface-border)] bg-white/[0.06]"
                  />
                ))
              : displayedMoods.map((mood, index) => (
                  <motion.button
                    key={mood.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      delay: index * 0.03,
                      duration: 0.18,
                    }}
                    onClick={() => handleMoodClick(mood)}
                    className="group relative min-h-40 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-3 text-left transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:bg-[var(--surface-2)] sm:p-4"
                    style={{
                      borderTopColor: mood.color,
                    }}
                  >
                    <div className="flex h-full flex-col">
                      <div className="relative h-14 w-14 self-center sm:h-16 sm:w-16">
                        <Image
                          src={getMoodImageSrc(mood)}
                          alt={`${mood.name} mood mascot`}
                          fill
                          sizes="(max-width: 640px) 64px, 96px"
                          className="object-contain"
                        />
                      </div>
                      <div className="mt-2 text-center">
                        <h3 className="mb-1 text-sm font-bold text-[var(--ink)]">
                          {mood.name}
                        </h3>
                        <p className="line-clamp-2 text-xs leading-5 text-[var(--ink-muted)]">
                          {mood.description}
                        </p>
                      </div>
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
            className="relative mb-8 isolate"
          >
            <div className="relative mb-6 border-b border-[var(--surface-border)] pb-5 sm:pb-6">
              <div className="min-w-0 flex-1">
                <p className="ui-kicker pr-20 sm:pr-48">Selected mood</p>
                <h3
                  data-display
                  className="mt-2 pr-20 text-3xl font-bold text-[var(--ink)] sm:pr-48 sm:text-4xl"
                >
                  {selectedMood.name} picks
                </h3>
                <p className="mt-2 max-w-lg pr-20 text-sm leading-6 text-[var(--ink-muted)] sm:pr-36">
                  {selectedMood.description}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setSelectedMood(null)}
                    className="ui-secondary-action min-h-11 justify-center"
                  >
                    Change mood
                  </button>
                  <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="ui-secondary-action min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}
                    />
                    {loading ? "Refreshing" : "Refresh picks"}
                  </button>
                </div>
              </div>
              <div className="absolute right-0 top-0 h-16 w-16 sm:h-40 sm:w-40">
                <Image
                  src={getMoodImageSrc(selectedMood)}
                  alt={`${selectedMood.name} mood mascot`}
                  fill
                  sizes="(max-width: 640px) 64px, 160px"
                  className="object-contain"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="relative mb-6">
                  <div
                    className="h-20 w-20 animate-spin rounded-full border-4"
                    style={{
                      borderColor: `${selectedMood.color}20`,
                      borderTopColor: selectedMood.color,
                    }}
                  />
                </div>
                <p className="mb-2 text-xl font-bold text-[var(--ink)]">
                  Finding your picks
                </p>
                <p className="text-sm text-[var(--ink-muted)]">
                  Finding content that fits your{" "}
                  {selectedMood.name.toLowerCase()} mood...
                </p>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-16">
                <div className="max-w-md text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
                    <Sparkles className="h-9 w-9 text-red-300" />
                  </div>
                  <h3 className="mb-2 text-xl font-bold text-[var(--ink)]">
                    Oops!
                  </h3>
                  <p className="mb-6 text-lg text-gray-400">{error}</p>
                  <button
                    onClick={handleRefresh}
                    className="rounded-md bg-[var(--brand-coral)] px-6 py-3 font-bold text-white transition-colors hover:bg-[var(--brand-coral-strong)]"
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
                className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 lg:grid-cols-4 xl:grid-cols-6"
              >
                {recommendations.map((rec, index) => {
                  const id = String(rec.tmdbId);
                  const kind = toHookType(rec.mediaType);
                  const inList = isInWatchlist(id, kind) ?? watchlistStates[id];
                  const isBusy = loadingStates[id];
                  const matchScore = getMatchScore(rec);
                  const genres = rec.genreNames?.filter(Boolean) ?? [];
                  const moodColor = getMoodColor(selectedMood);
                  const isFeatured = index === 0;

                  return (
                    <motion.article
                      key={`${rec.mediaType}-${rec.tmdbId}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.18 }}
                      className={`relative min-w-0 ${isFeatured ? "col-span-2" : ""}`}
                    >
                      <Link
                        href={getMediaHref(rec)}
                        className="group flex h-full flex-col rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--brand-coral)]"
                      >
                        <div
                          className={`relative overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)] ${isFeatured ? "aspect-video sm:aspect-[4/3]" : "aspect-[2/3]"}`}
                        >
                          <Image
                            src={
                              isFeatured && rec.backdropPath
                                ? tmdbImage(rec.backdropPath, "w780")
                                : getPosterUrl(rec.posterPath)
                            }
                            alt={rec.title}
                            fill
                            sizes={
                              isFeatured
                                ? "(max-width: 640px) 100vw, (max-width: 1024px) 66vw, 40vw"
                                : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                            }
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.035] motion-reduce:transform-none motion-reduce:transition-none"
                          />

                          <div className="absolute right-2 top-2">
                            <RatingBadge
                              rating={rec.voteAverage}
                              variant="colored"
                              size="sm"
                            />
                          </div>

                          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/65 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
                              <span
                                aria-hidden="true"
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: moodColor }}
                              />
                              {matchScore}% match
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-1 flex-col px-0.5 pt-3">
                          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)] transition-colors group-hover:text-[var(--brand-coral-strong)]">
                            {rec.title}
                          </h3>
                          <p className="mt-1 text-xs text-[var(--ink-muted)]">
                            {getMediaLabel(rec)} · {getYear(rec.releaseDate)}
                          </p>
                          {genres.length > 0 && (
                            <p className="mt-1 truncate text-xs text-[var(--ink-muted)]">
                              {genres.slice(0, 2).join(" · ")}
                            </p>
                          )}
                        </div>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isBusy) void toggleWatchlist(rec);
                        }}
                        disabled={isBusy}
                        aria-label={
                          inList
                            ? `Remove ${rec.title} from My List`
                            : `Add ${rec.title} to My List`
                        }
                        className={`absolute left-2 top-2 z-20 flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-black/80 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-[var(--brand-coral)] disabled:cursor-not-allowed disabled:opacity-70`}
                        aria-pressed={Boolean(inList)}
                        style={{ borderColor: inList ? moodColor : undefined }}
                      >
                        {isBusy ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : inList ? (
                          <BookmarkCheck className="h-4 w-4" />
                        ) : (
                          <Bookmark className="h-4 w-4" />
                        )}
                      </button>
                    </motion.article>
                  );
                })}
              </motion.div>
            ) : (
              <div className="flex items-center justify-center py-32">
                <div className="max-w-md border border-[var(--surface-border)] bg-[var(--surface-1)] p-8 text-center">
                  <div
                    className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
                    style={{
                      backgroundColor: `${selectedMood.color}22`,
                      color: selectedMood.color,
                    }}
                  >
                    <Sparkles className="h-8 w-8" />
                  </div>
                  <h3 className="mb-2 text-xl font-bold text-[var(--ink)]">
                    No matches found
                  </h3>
                  <p className="mb-6 text-sm leading-6 text-gray-400">
                    We could not build a confident{" "}
                    {selectedMood.name.toLowerCase()} set from the current
                    filters. Refresh this mood or choose another lane.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button
                      onClick={handleRefresh}
                      className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-black text-white transition-colors"
                      style={{ backgroundColor: selectedMood.color }}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh Picks
                    </button>
                    <button
                      onClick={() => setSelectedMood(null)}
                      className="rounded-md border border-[var(--surface-border)] px-5 py-3 text-sm font-bold text-white transition-colors hover:border-[var(--brand-coral)]"
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
