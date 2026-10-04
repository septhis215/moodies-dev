"use client";

import { tmdbImage } from "@/lib/tmdb";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { HeroMoodRequest } from "@/components/hero/HeroMoodGuide";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import {
  Bookmark,
  Info,
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
  requestedMood?: HeroMoodRequest | null;
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
  requestedMood,
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
  const handledHeroRequest = useRef<number | null>(null);
  const initialMoodShuffleSeed = useRef(Date.now() + Math.random());

  const orderedMoods = useMemo(
    () => shuffleWithSeed(orderMoods(moods), initialMoodShuffleSeed.current),
    [moods],
  );
  const topMatch = recommendations[0];
  const movieCount = recommendations.filter(
    (rec) => rec.mediaType === "MOVIE",
  ).length;
  const tvCount = recommendations.filter(
    (rec) => rec.mediaType === "TV",
  ).length;

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

  const fetchRecommendations = useCallback(
    async (mood: Mood) => {
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
    },
    [mediaType, isAuthenticated, user?.id],
  );

  const handleMoodClick = useCallback(
    (mood: Mood) => {
      setRefreshedAt(null);
      setSelectedMood(mood);
      void fetchRecommendations(mood);
    },
    [fetchRecommendations],
  );

  useEffect(() => {
    if (!requestedMood || handledHeroRequest.current === requestedMood.revision)
      return;
    const mood = moods.find(
      (item) => item.name.toLowerCase() === requestedMood.name.toLowerCase(),
    );
    if (!mood) return;
    handledHeroRequest.current = requestedMood.revision;
    handleMoodClick(mood);
  }, [requestedMood, moods, handleMoodClick]);

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
            <h3 className="mb-2 text-2xl font-black text-white">
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
      className="relative mx-auto w-full max-w-7xl scroll-mt-24 overflow-hidden border-t border-[var(--surface-border)] pt-6 sm:pt-7"
    >
      <div className="relative mb-5 sm:mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md border border-[var(--surface-border)] text-[var(--brand-coral-strong)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <h2 className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">
                Mood Matcher
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-[var(--ink-muted)] sm:ml-[52px]">
              Choose how you feel. Find{" "}
              {mediaType === "movie"
                ? "films"
                : mediaType === "tv"
                  ? "series"
                  : "movies and series"}{" "}
              to meet you there.
            </p>
          </div>

          {selectedMood && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleRefresh}
              disabled={loading}
              className="group flex items-center gap-2.5 rounded-md border border-[var(--surface-border)] bg-[var(--surface-1)] px-3 py-2 text-left transition-colors hover:border-[var(--brand-coral)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--surface-2)] text-[var(--brand-coral-strong)]">
                <RefreshCw
                  className={`h-4 w-4 ${
                    loading
                      ? "animate-spin"
                      : "transition-transform duration-500 group-hover:rotate-180"
                  }`}
                />
              </span>
              <span>
                <span className="block text-sm font-semibold text-[var(--ink)]">
                  {loading ? "Refreshing..." : "Refresh Picks"}
                </span>
                <span className="block text-[11px] text-[var(--ink-muted)]">
                  {refreshedAt
                    ? "Fresh set requested"
                    : `Regenerate for ${selectedMood.name.toLowerCase()}`}
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
            className="mb-4 overflow-hidden border-y border-[var(--surface-border)] bg-[var(--surface-1)]"
          >
            <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--surface-border)] text-[var(--brand-coral-strong)]">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--ink)]">
                    {displayedMoods.length} moods in view
                  </div>
                  <div className="text-xs text-[var(--ink-muted)]">
                    Pick the emotional lane for your next watch.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={toggleMoodCount}
                  className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brand-coral)]"
                >
                  {moodCount === DEFAULT_MOOD_COUNT
                    ? "Show more moods"
                    : "Show fewer"}
                </button>
                <button
                  onClick={handleShuffleMoods}
                  className="group flex items-center gap-2 rounded-md border border-[var(--surface-border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brand-coral)]"
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
            className="-mx-4 mb-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scroll-smooth sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 xl:grid-cols-6"
          >
            {moodsLoading
              ? Array.from({ length: DEFAULT_MOOD_COUNT }).map((_, index) => (
                  <div
                    key={index}
                    className="h-36 w-[44vw] min-w-[150px] max-w-[178px] shrink-0 snap-start animate-pulse rounded-md bg-white/[0.06] sm:w-auto sm:min-w-0 sm:max-w-none"
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
                    className="group relative w-[44vw] min-w-[150px] max-w-[178px] shrink-0 snap-start rounded-md border border-[var(--surface-border)] bg-[var(--surface-1)] p-3 transition-colors hover:border-[var(--brand-coral)] sm:w-auto sm:min-w-0 sm:max-w-none sm:p-4"
                    style={{
                      borderLeftColor: mood.color,
                    }}
                  >
                    <div className="relative flex flex-col items-center gap-3 text-center">
                      <div className="relative h-14 w-14 sm:h-16 sm:w-16">
                        <Image
                          src={getMoodImageSrc(mood)}
                          alt={`${mood.name} mood mascot`}
                          fill
                          sizes="(max-width: 640px) 64px, 96px"
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
                        <p className="line-clamp-2 text-xs leading-relaxed text-[var(--ink-muted)]">
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
            className="mb-8"
          >
            <div
              className="mb-5 flex flex-col gap-3 border-y border-[var(--surface-border)] bg-[var(--surface-1)] p-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderLeft: `3px solid ${selectedMood.color}` }}
            >
              <div className="flex items-center gap-4">
                <div className="relative h-14 w-14 shrink-0">
                  <Image
                    src={getMoodImageSrc(selectedMood)}
                    alt={`${selectedMood.name} mood mascot`}
                    fill
                    sizes="56px"
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
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-muted)]">
                    <span>
                      {recommendations.length || RECOMMENDATION_LIMIT} picks
                    </span>
                    <span>{movieCount} movies</span>
                    <span>{tvCount} series</span>
                    {topMatch && (
                      <span className="text-[var(--ink)]">
                        Top match {getMatchScore(topMatch)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedMood(null)}
                className="rounded-md border border-[var(--surface-border)] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:border-[var(--brand-coral)]"
              >
                Change Mood
              </button>
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
                <p className="mb-2 text-2xl font-black text-white">
                  Curating your perfect matches
                </p>
                <p className="text-lg text-gray-400">
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
                  <h3 className="mb-2 text-2xl font-black text-white">Oops!</h3>
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
                className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scroll-smooth sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7"
              >
                {recommendations.map((rec) => {
                  const id = String(rec.tmdbId);
                  const kind = toHookType(rec.mediaType);
                  const inList = isInWatchlist(id, kind) ?? watchlistStates[id];
                  const isBusy = loadingStates[id];
                  const matchScore = getMatchScore(rec);
                  const genres = rec.genreNames?.filter(Boolean) ?? [];
                  const visibleGenres = genres.slice(0, 2);
                  const hiddenGenreCount = Math.max(
                    0,
                    genres.length - visibleGenres.length,
                  );
                  const moodColor = getMoodColor(selectedMood);

                  return (
                    <motion.div
                      key={`${rec.mediaType}-${rec.tmdbId}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.18 }}
                      className="w-[42vw] min-w-[145px] max-w-[176px] shrink-0 snap-start sm:w-auto sm:min-w-0 sm:max-w-none"
                    >
                      <Link href={getMediaHref(rec)}>
                        <div className="group relative block">
                          <div className="relative mb-3 aspect-[2/3] overflow-hidden rounded-md border border-[var(--surface-border)] bg-[var(--surface-2)] transition-colors group-hover:border-[var(--brand-coral)]">
                            <Image
                              src={getPosterUrl(rec.posterPath)}
                              alt={rec.title}
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                              className="object-cover"
                            />
                            <div
                              className="pointer-events-none absolute inset-0 rounded-md border opacity-0 transition-opacity group-hover:opacity-100"
                              style={{
                                borderColor: `${moodColor}B8`,
                              }}
                            />

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <motion.button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      if (!isBusy) void toggleWatchlist(rec);
                                    }}
                                    disabled={isBusy}
                                    aria-label={
                                      inList
                                        ? "Remove from My List"
                                        : "Add to My List"
                                    }
                                    className={`absolute left-2 top-2 z-30 flex h-9 w-9 items-center justify-center rounded-sm border border-white/25 bg-[#0b0909]/90 text-white shadow-[0_6px_18px_rgba(0,0,0,0.35)] transition-colors ${isBusy ? "cursor-not-allowed opacity-70" : ""}`}
                                    style={{
                                      backgroundColor: inList
                                        ? moodColor
                                        : undefined,
                                    }}
                                    onMouseEnter={(event) => {
                                      if (!inList)
                                        event.currentTarget.style.backgroundColor =
                                          moodColor;
                                    }}
                                    onMouseLeave={(event) => {
                                      if (!inList)
                                        event.currentTarget.style.backgroundColor =
                                          "";
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
                            </TooltipProvider>

                            <div className="absolute right-2 top-2">
                              <RatingBadge
                                rating={rec.voteAverage}
                                variant="colored"
                                size="sm"
                              />
                            </div>

                            <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-end gap-1.5 transition-opacity duration-300 group-hover:opacity-0">
                              <span className="border border-white/15 bg-[#0b0909]/90 px-2 py-1 text-[10px] font-bold text-white">
                                Match {matchScore}%
                              </span>
                              <span className="border border-white/15 bg-[#0b0909]/90 px-2 py-1 text-[10px] font-bold text-white">
                                {getMediaLabel(rec)}
                              </span>
                              <span className="border border-white/15 bg-[#0b0909]/90 px-2 py-1 text-[10px] font-bold text-zinc-200">
                                {getYear(rec.releaseDate)}
                              </span>
                            </div>

                            <div className="absolute inset-0 bg-[#0b0909]/94 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                              <div className="absolute inset-0 flex items-end justify-center p-3">
                                <TooltipProvider>
                                  <div className="flex gap-2">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            router.push(getMediaHref(rec));
                                          }}
                                          className="flex h-9 w-9 items-center justify-center rounded-sm border border-white/15 bg-white text-black transition-colors hover:text-white"
                                          onMouseEnter={(event) => {
                                            event.currentTarget.style.backgroundColor =
                                              moodColor;
                                          }}
                                          onMouseLeave={(event) => {
                                            event.currentTarget.style.backgroundColor =
                                              "";
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
                                        <div className="text-xs font-medium text-white">
                                          More Info
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TooltipProvider>
                              </div>
                            </div>
                          </div>

                          <div className="px-1">
                            <div className="mb-1.5 flex items-start justify-between gap-2">
                              <h4 className="line-clamp-2 text-sm font-bold leading-tight text-white transition-colors group-hover:text-[var(--brand-coral-strong)]">
                                {rec.title}
                              </h4>
                              <span
                                className="mt-0.5 shrink-0 border-l px-2 py-0.5 text-[10px] font-black text-white"
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
                                    className="max-w-[74px] shrink-0 truncate text-[10px] font-semibold text-zinc-400 sm:max-w-[92px]"
                                    title={genre}
                                  >
                                    {genre}
                                  </span>
                                ))}
                                {hiddenGenreCount > 0 && (
                                  <span className="shrink-0 text-[10px] font-black text-zinc-300">
                                    +{hiddenGenreCount}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                                <span className="truncate text-[10px] font-semibold text-zinc-400">
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
                <div className="w-1 shrink-0 sm:hidden" aria-hidden="true" />
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
                  <h3 className="mb-2 text-2xl font-black text-white">
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
