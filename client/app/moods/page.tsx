"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Film,
  Loader2,
  RefreshCw,
  Shuffle,
  Sparkles,
  Star,
  Tv,
} from "lucide-react";
import { tmdbImage } from "@/lib/tmdb";

type MoodFromApi = {
  id: string;
  name: string;
  color?: string;
  description?: string;
  icon?: string | null;
  tmdbGenres?: number[];
  isActive?: boolean;
};

type RecommendationFromApi = {
  id: string;
  title: string;
  overview?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  type?: "movie" | "tv";
  voteAverage?: number;
  voteCount?: number;
  genres?: string[];
  releaseDate?: string;
};

type RecommendationPayload = Partial<{
  tmdbId: string | number;
  id: string | number;
  title: string;
  name: string;
  overview: string;
  description: string;
  poster_path: string | null;
  posterPath: string | null;
  poster: string | null;
  backdrop_path: string | null;
  backdropPath: string | null;
  backdrop: string | null;
  mediaType: string;
  type: string;
  media_type: string;
  vote_average: number;
  voteAverage: number;
  vote_count: number;
  voteCount: number;
  genres: string[];
  genreNames: string[];
  release_date: string;
  releaseDate: string;
  first_air_date: string;
}>;

type MoodCluster = {
  id: string;
  label: string;
  description: string;
  color: string;
  moodNames: string[];
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";

const moodClusters: MoodCluster[] = [
  {
    id: "bright",
    label: "Bright",
    description: "Easygoing, hopeful, playful, and comfort-first picks.",
    color: "#e94f37",
    moodNames: [
      "Happy",
      "Funny",
      "Cozy",
      "Whimsy",
      "Inspirational",
      "Nostalgic",
    ],
  },
  {
    id: "calm",
    label: "Calm",
    description: "Gentle, reflective, romantic, and lower-energy stories.",
    color: "#22d3ee",
    moodNames: [
      "Serenity",
      "Chill",
      "Romantic",
      "Bittersweet",
      "Sad",
      "Documentary",
    ],
  },
  {
    id: "charged",
    label: "Charged",
    description: "Big, fast, tense, and adventurous moods for momentum.",
    color: "#f59e0b",
    moodNames: ["Thrilling", "Epic", "Chaos", "Sci-Fi", "Western"],
  },
  {
    id: "shadow",
    label: "Shadow",
    description: "Mystery, horror, grit, and mind-bending atmospheres.",
    color: "#a78bfa",
    moodNames: ["Horror", "Dark", "Gritty", "Mind-Bending"],
  },
];

const fallbackMoods: MoodFromApi[] = [
  {
    id: "happy",
    name: "Happy",
    color: "#FFD700",
    description: "Lighthearted and uplifting stories that boost your mood",
  },
  {
    id: "funny",
    name: "Funny",
    color: "#FFB6C1",
    description: "Comedies full of laughs, parodies, and satire",
  },
  {
    id: "cozy",
    name: "Cozy",
    color: "#FFDEAD",
    description: "Comforting, wholesome stories that warm the heart",
  },
  {
    id: "romantic",
    name: "Romantic",
    color: "#FF69B4",
    description: "Stories of love, connection, and heartfelt emotions",
  },
  {
    id: "thrilling",
    name: "Thrilling",
    color: "#FF6B35",
    description: "High-stakes action and suspense-filled adventures",
  },
  {
    id: "dark",
    name: "Dark",
    color: "#2F4F4F",
    description: "Mysterious and unsettling narratives that linger",
  },
];

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

const slugify = (value: string) => value.toLowerCase().replace(/\s+/g, "-");

const getMoodImageSrc = (mood?: Pick<MoodFromApi, "name" | "icon"> | null) => {
  if (!mood) return "/images/moodies1.png";
  const imageName =
    moodImageMap[slugify(mood.name)] || iconFallbackMap[mood.icon ?? ""];
  return imageName ? `/images/moods/${imageName}.png` : "/images/moodies1.png";
};

const normalizeRecommendations = (
  recs: RecommendationPayload[],
): RecommendationFromApi[] =>
  recs.map((r) => {
    const typeRaw = r.mediaType ?? r.type ?? r.media_type ?? "";
    const type = String(typeRaw).toLowerCase() === "tv" ? "tv" : "movie";

    return {
      id: String(r.tmdbId ?? r.id ?? crypto.randomUUID()),
      title: r.title ?? r.name ?? "Untitled",
      overview: r.overview ?? r.description ?? "",
      posterPath: r.poster_path ?? r.posterPath ?? r.poster ?? "",
      backdropPath: r.backdrop_path ?? r.backdropPath ?? r.backdrop ?? "",
      type,
      voteAverage: r.vote_average ?? r.voteAverage ?? 0,
      voteCount: r.vote_count ?? r.voteCount ?? 0,
      genres: r.genres ?? r.genreNames ?? [],
      releaseDate: r.release_date ?? r.releaseDate ?? r.first_air_date ?? "",
    };
  });

const getSlicePath = (index: number, total: number) => {
  const center = 100;
  const radius = 92;
  const gap = 2.2;
  const slice = 360 / total;
  const startAngle = index * slice - 90 + gap / 2;
  const endAngle = startAngle + slice - gap;
  const start = polarToCartesian(center, center, radius, endAngle);
  const end = polarToCartesian(center, center, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return `M ${center} ${center} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
};

const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) => {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const normalizeDegrees = (degrees: number) => ((degrees % 360) + 360) % 360;

const getPointerAlignedRotation = (
  currentRotation: number,
  moodIndex: number,
  moodCount: number,
  extraSpins = 0,
) => {
  if (moodCount <= 0 || moodIndex < 0) return currentRotation;

  const slice = 360 / moodCount;
  const segmentCenter = moodIndex * slice + slice / 2;
  const desiredRotation = normalizeDegrees(-segmentCenter);
  const current = normalizeDegrees(currentRotation);
  const delta = normalizeDegrees(desiredRotation - current);

  return currentRotation + extraSpins * 360 + delta;
};

const getMoodsForCluster = (moods: MoodFromApi[], cluster: MoodCluster) => {
  const clusterNames = new Set(cluster.moodNames.map((name) => slugify(name)));
  const filtered = moods.filter((mood) => clusterNames.has(slugify(mood.name)));
  return filtered.length > 0 ? filtered : moods.slice(0, 8);
};

export default function MoodDiscoveryWheel() {
  const [moods, setMoods] = useState<MoodFromApi[]>([]);
  const [loadingMoods, setLoadingMoods] = useState(true);
  const [activeClusterId, setActiveClusterId] = useState(moodClusters[0].id);
  const [selectedMoodId, setSelectedMoodId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<
    RecommendationFromApi[]
  >([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [showMoodBubble, setShowMoodBubble] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recommendationRequestRef = useRef(0);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => {
      preference.removeEventListener("change", update);
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    };
  }, []);

  const activeCluster =
    moodClusters.find((cluster) => cluster.id === activeClusterId) ??
    moodClusters[0];
  const activeMoods = useMemo(
    () => getMoodsForCluster(moods, activeCluster),
    [activeCluster, moods],
  );

  const selectedMood = useMemo(
    () =>
      activeMoods.find((mood) => mood.id === selectedMoodId) ??
      activeMoods[0] ??
      null,
    [activeMoods, selectedMoodId],
  );

  useEffect(() => {
    let aborted = false;
    setLoadingMoods(true);

    fetch(`${API_BASE}/moods`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load moods (${res.status})`);
        return res.json();
      })
      .then((data: MoodFromApi[]) => {
        if (aborted) return;
        const list = Array.isArray(data)
          ? data.filter((mood) =>
              typeof mood.isActive === "boolean" ? mood.isActive : true,
            )
          : [];
        const active = list.length > 0 ? list : fallbackMoods;
        setMoods(active);
        setSelectedMoodId(active[0]?.id ?? null);
      })
      .catch((error) => {
        if (aborted) return;
        console.error("Failed to load moods:", error);
        setMoods(fallbackMoods);
        setSelectedMoodId(fallbackMoods[0].id);
      })
      .finally(() => {
        if (!aborted) setLoadingMoods(false);
      });

    return () => {
      aborted = true;
    };
  }, []);

  useEffect(() => {
    if (!activeMoods.length) return;
    if (
      !selectedMoodId ||
      !activeMoods.some((mood) => mood.id === selectedMoodId)
    ) {
      setSelectedMoodId(activeMoods[0].id);
    }
  }, [activeMoods, selectedMoodId]);

  useEffect(() => {
    if (isSpinning || !selectedMoodId || !activeMoods.length) return;

    const selectedIndex = activeMoods.findIndex(
      (mood) => mood.id === selectedMoodId,
    );
    if (selectedIndex < 0) return;

    setCurrentRotation((rotation) =>
      getPointerAlignedRotation(rotation, selectedIndex, activeMoods.length),
    );
  }, [activeMoods, isSpinning, selectedMoodId]);

  useEffect(() => {
    if (!selectedMoodId) return;
    fetchRecommendationsForMood(selectedMoodId, false, 8);
  }, [selectedMoodId]);

  async function fetchRecommendationsForMood(
    moodId: string,
    forceRefresh = false,
    limit = 8,
  ) {
    const requestId = ++recommendationRequestRef.current;
    setLoadingRecs(true);
    setRecError(null);

    try {
      if (forceRefresh) {
        const response = await fetch(
          `${API_BASE}/moods/recommendations/regenerate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              moodId,
              limit,
              page: 1,
              mediaType: "both",
              userId: null,
              shuffle: true,
            }),
          },
        );

        if (!response.ok)
          throw new Error(
            `Failed to fetch recommendations (${response.status})`,
          );
        const data = await response.json();
        if (requestId !== recommendationRequestRef.current) return;
        setRecommendations(
          normalizeRecommendations(data?.recommendations ?? []),
        );
        return;
      }

      const url = new URL(`${API_BASE}/moods/recommendations`);
      url.searchParams.set("moodId", moodId);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("page", "1");
      url.searchParams.set("mediaType", "both");
      url.searchParams.set("shuffle", "true");

      const response = await fetch(url.toString());
      if (!response.ok)
        throw new Error(`Failed to fetch recommendations (${response.status})`);
      const data = await response.json();
      if (requestId !== recommendationRequestRef.current) return;
      setRecommendations(
        normalizeRecommendations(data?.recommendations ?? data?.results ?? []),
      );
    } catch (error) {
      if (requestId !== recommendationRequestRef.current) return;
      console.error("fetchRecommendationsForMood error:", error);
      setRecError("Unable to load recommendations");
      setRecommendations([]);
    } finally {
      if (requestId === recommendationRequestRef.current) setLoadingRecs(false);
    }
  }

  const selectMood = (mood: MoodFromApi, alignWheel = true) => {
    if (isSpinning) return;
    setSelectedMoodId(mood.id);
    setShowMoodBubble(true);
    const cluster = moodClusters.find((item) =>
      item.moodNames.some((name) => slugify(name) === slugify(mood.name)),
    );
    if (cluster) setActiveClusterId(cluster.id);

    if (alignWheel) {
      const targetMoods = cluster
        ? getMoodsForCluster(moods, cluster)
        : activeMoods;
      const index = targetMoods.findIndex((item) => item.id === mood.id);
      if (index >= 0) {
        setCurrentRotation((rotation) =>
          getPointerAlignedRotation(rotation, index, targetMoods.length),
        );
      }
    }
  };

  const selectCluster = (cluster: MoodCluster) => {
    if (isSpinning || cluster.id === activeClusterId) return;
    const clusterMoods = getMoodsForCluster(moods, cluster);
    const nextMood = clusterMoods[0];

    setActiveClusterId(cluster.id);
    setSelectedMoodId(nextMood?.id ?? null);
    setShowMoodBubble(Boolean(nextMood));
    setCurrentRotation((rotation) =>
      nextMood
        ? getPointerAlignedRotation(rotation, 0, clusterMoods.length)
        : rotation,
    );
  };

  const spinWheel = () => {
    if (!activeMoods.length || isSpinning) return;

    const nextIndex = Math.floor(Math.random() * activeMoods.length);
    const extraSpins = reducedMotion ? 0 : 4 + Math.floor(Math.random() * 3);

    setShowMoodBubble(false);
    setIsSpinning(true);
    setCurrentRotation((rotation) =>
      getPointerAlignedRotation(
        rotation,
        nextIndex,
        activeMoods.length,
        extraSpins,
      ),
    );

    spinTimerRef.current = setTimeout(
      () => {
        const mood = activeMoods[nextIndex];
        if (mood) {
          setSelectedMoodId(mood.id);
          setShowMoodBubble(true);
        }
        setIsSpinning(false);
      },
      reducedMotion ? 100 : 2600,
    );
  };

  const wheelTransition = {
    duration: reducedMotion ? 0 : isSpinning ? 2.6 : 0.5,
    ease: [0.18, 0.82, 0.2, 1] as [number, number, number, number],
  };

  const highRatedCount = recommendations.filter(
    (item) => Number(item.voteAverage ?? 0) >= 7,
  ).length;

  return (
    <main className="min-h-screen overflow-x-clip bg-[var(--surface-0)] px-4 pb-10 pt-4 text-white sm:px-6 sm:pt-5 lg:px-8 lg:pt-28">
      <section className="pb-3 sm:pb-5">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-3 sm:gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(520px,1.2fr)] lg:items-end">
            <div>
              <p className="ui-kicker">Mood wheel</p>
              <h1 className="mt-1 max-w-2xl text-2xl font-bold leading-none sm:mt-2 sm:text-4xl">
                What feels right tonight?
              </h1>
              <p className="mt-1.5 max-w-xl text-sm leading-5 text-[var(--ink-muted)] sm:mt-2 sm:leading-6">
                A mood, a little chance, your next good watch.
              </p>
            </div>

            <div
              className="grid grid-cols-4 gap-1 border-b border-white/10 sm:gap-2"
              role="group"
              aria-label="Mood families"
            >
              {moodClusters.map((cluster) => {
                const isActive = cluster.id === activeClusterId;
                return (
                  <button
                    key={cluster.id}
                    onClick={() => selectCluster(cluster)}
                    disabled={isSpinning || loadingMoods}
                    aria-pressed={isActive}
                    style={{
                      borderBottomColor: isActive
                        ? cluster.color
                        : "transparent",
                    }}
                    className={`min-h-11 min-w-0 border-b-2 px-1 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral)] disabled:cursor-not-allowed disabled:opacity-55 sm:px-3 sm:py-3 ${isActive ? "text-white" : "text-[var(--ink-muted)] hover:text-white"}`}
                  >
                    <div className="flex items-center justify-center gap-1.5 sm:justify-start sm:gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: cluster.color }}
                      />
                      <span className="text-sm font-semibold">
                        {cluster.label}
                      </span>
                    </div>
                    <span className="mt-1.5 hidden text-xs leading-4 text-[var(--ink-muted)] sm:line-clamp-2">
                      {cluster.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Choose your mood" className="pb-5 sm:py-1">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="min-w-0 rounded-xl sm:border sm:border-white/10 sm:bg-[var(--surface-1)] sm:p-5">
            <div className="mb-2 flex items-center justify-between gap-3 sm:mb-4">
              <div>
                <p className="ui-kicker">{activeCluster.label} moods</p>
                <h2 className="sr-only">Choose or leave it to chance</h2>
                <p className="mt-1 hidden text-sm leading-5 text-[var(--ink-muted)] sm:block">
                  Tap a character or spin for a surprise.
                </p>
              </div>
              <button
                onClick={spinWheel}
                disabled={isSpinning || loadingMoods}
                className="ui-secondary-action hidden min-h-11 shrink-0 disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
              >
                {isSpinning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shuffle className="h-4 w-4" />
                )}
                {isSpinning ? "Spinning" : "Spin wheel"}
              </button>
            </div>

            <div className="grid place-items-center py-1 sm:py-3">
              <div
                data-mood-wheel
                className="relative aspect-square w-[min(100%,340px,46svh)] sm:w-[min(100%,430px,46svh)]"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-4 rounded-full opacity-20 blur-2xl"
                  style={{
                    backgroundColor: selectedMood?.color ?? activeCluster.color,
                  }}
                />
                <motion.div
                  className="absolute inset-0"
                  animate={{ rotate: currentRotation }}
                  transition={wheelTransition}
                >
                  <svg
                    aria-hidden
                    className="h-full w-full drop-shadow-xl"
                    viewBox="0 0 200 200"
                  >
                    <circle
                      cx="100"
                      cy="100"
                      r="98"
                      fill="#151211"
                      stroke="rgba(255,239,220,0.16)"
                      strokeWidth="0.6"
                    />
                    <circle
                      cx="100"
                      cy="100"
                      r="95"
                      fill="none"
                      stroke="rgba(255,239,220,0.08)"
                      strokeWidth="0.5"
                    />
                    {activeMoods.map((mood, index) => {
                      const isSelected =
                        mood.id === selectedMoodId && !isSpinning;
                      return (
                        <path
                          key={mood.id}
                          d={getSlicePath(index, activeMoods.length)}
                          fill={mood.color ?? activeCluster.color}
                          fillOpacity={isSelected ? 0.32 : 0.12}
                          stroke={mood.color ?? activeCluster.color}
                          strokeOpacity={isSelected ? 0.85 : 0.22}
                          strokeWidth={isSelected ? 1.1 : 0.5}
                          className="transition-colors duration-300"
                          onClick={() => selectMood(mood)}
                          style={{ cursor: isSpinning ? "wait" : "pointer" }}
                        />
                      );
                    })}
                    <circle
                      cx="100"
                      cy="100"
                      r="26"
                      fill="#151211"
                      stroke="rgba(255,239,220,0.15)"
                      strokeWidth="0.6"
                    />
                  </svg>
                  {activeMoods.map((mood, index) => {
                    const angle =
                      index * (360 / activeMoods.length) +
                      180 / activeMoods.length -
                      90;
                    const point = polarToCartesian(50, 50, 31, angle);
                    const isSelected =
                      mood.id === selectedMoodId && !isSpinning;
                    return (
                      <button
                        key={mood.id}
                        onClick={() => selectMood(mood)}
                        disabled={isSpinning || loadingMoods}
                        aria-label={`Select ${mood.name} mood`}
                        aria-pressed={isSelected}
                        style={{ left: `${point.x}%`, top: `${point.y}%` }}
                        className="absolute flex h-[24%] w-[24%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait"
                      >
                        <motion.span
                          animate={{ rotate: -currentRotation }}
                          transition={wheelTransition}
                          className="flex h-full w-full flex-col items-center justify-center gap-0.5"
                        >
                          <span
                            className={`relative block h-[58%] w-[58%] transition-transform hover:scale-110 ${isSelected ? "scale-110" : ""}`}
                          >
                            <Image
                              src={getMoodImageSrc(mood)}
                              alt=""
                              fill
                              sizes="64px"
                              className="object-contain"
                            />
                          </span>
                          <span
                            className={`max-w-full text-center text-xs font-semibold leading-tight sm:text-sm ${isSelected ? "text-white" : "text-white/80"}`}
                          >
                            {mood.name}
                          </span>
                        </motion.span>
                      </button>
                    );
                  })}
                </motion.div>
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1"
                >
                  <span className="block h-0 w-0 border-x-[7px] border-t-[13px] border-x-transparent border-t-[var(--brand-coral-strong)] drop-shadow-md" />
                </div>
                <button
                  onClick={spinWheel}
                  disabled={isSpinning || loadingMoods}
                  aria-label={
                    isSpinning ? "Choosing your mood" : "Spin the mood wheel"
                  }
                  className="absolute left-1/2 top-1/2 z-10 flex h-[24%] w-[24%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full border border-white/15 bg-[var(--surface-0)] text-white shadow-lg transition-colors hover:border-[var(--brand-coral)] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral)] disabled:cursor-wait"
                >
                  {isSpinning ? (
                    <Loader2
                      className="h-5 w-5 motion-safe:animate-spin"
                      aria-hidden
                    />
                  ) : (
                    <Shuffle
                      className="h-5 w-5 text-[var(--brand-coral-strong)] sm:h-6 sm:w-6"
                      aria-hidden
                    />
                  )}
                  <span className="text-xs font-bold sm:text-sm">
                    {isSpinning ? "Choosing…" : "Spin"}
                  </span>
                </button>
              </div>
            </div>
            <p className="mt-1 text-center text-xs text-[var(--ink-muted)] sm:hidden">
              Tap a character, or spin for a surprise.
            </p>
            <AnimatePresence mode="wait">
              {showMoodBubble && selectedMood && !isSpinning ? (
                <motion.div
                  key={selectedMood.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="mx-auto mt-3 mb-4 flex max-w-xl items-center gap-3 border-l-2 px-3 py-2"
                  style={{
                    borderColor: selectedMood.color ?? activeCluster.color,
                  }}
                  aria-live="polite"
                >
                  <span className="relative h-11 w-11 shrink-0 rounded-sm bg-black/30">
                    <Image
                      src={getMoodImageSrc(selectedMood)}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-contain"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-xs text-[var(--ink-muted)]">
                      Tonight’s mood
                    </span>
                    <span className="mt-0.5 block text-lg font-bold text-white">
                      {selectedMood.name}
                    </span>
                    <span className="line-clamp-2 block text-xs leading-4 text-[var(--ink-muted)]">
                      {selectedMood.description}
                    </span>
                  </span>
                </motion.div>
              ) : (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-center text-sm text-[var(--ink-muted)]">
                  The wheel is choosing…
                </div>
              )}
            </AnimatePresence>
            <p className="ui-kicker mb-2 hidden sm:block">Pick directly</p>
            <div className="mobile-native-scroll mb-4 hidden gap-2 sm:flex sm:overflow-x-auto sm:pb-1">
              {activeMoods.map((mood) => {
                const isSelected = mood.id === selectedMoodId;
                return (
                  <button
                    key={mood.id}
                    onClick={() => selectMood(mood)}
                    disabled={isSpinning}
                    aria-pressed={isSelected}
                    className={`flex min-h-12 min-w-0 items-center gap-2 rounded-xl border p-1.5 pr-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55 sm:min-w-fit sm:pr-3 ${
                      isSelected
                        ? "border-[var(--brand-coral)] bg-[var(--brand-coral)]/10"
                        : "border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="relative h-8 w-8 shrink-0 rounded-sm bg-black/30">
                      <Image
                        src={getMoodImageSrc(mood)}
                        alt=""
                        fill
                        sizes="32px"
                        className="object-contain"
                      />
                    </span>
                    <span className="truncate text-xs font-bold text-white">
                      {mood.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="min-w-0 rounded-md border border-white/10 bg-[var(--surface-1)] p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="relative h-12 w-12 shrink-0 rounded-lg border border-white/10 bg-black/30 p-2 sm:h-14 sm:w-14">
                  <Image
                    src={getMoodImageSrc(selectedMood)}
                    alt={`${selectedMood?.name ?? "Moodies"} mascot`}
                    fill
                    sizes="56px"
                    className="object-contain"
                  />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Recommendations
                  </p>
                  <h2 className="mt-1 text-lg font-black sm:text-xl">
                    {selectedMood?.name ?? "Mood"} picks
                  </h2>
                </div>
              </div>
              <button
                onClick={() =>
                  selectedMoodId &&
                  fetchRecommendationsForMood(
                    selectedMoodId,
                    true,
                    recommendations.length || 8,
                  )
                }
                disabled={loadingRecs || !selectedMoodId}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-50"
                title="Refresh recommendations"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loadingRecs ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2">
              <StatCard
                label="Movies"
                value={
                  recommendations.filter((rec) => rec.type === "movie").length
                }
              />
              <StatCard
                label="Series"
                value={
                  recommendations.filter((rec) => rec.type === "tv").length
                }
              />
              <StatCard label="7+ Rated" value={highRatedCount} />
            </div>

            <AnimatePresence mode="wait">
              {loadingRecs ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex gap-3 rounded-lg border border-white/10 bg-black/20 p-3"
                    >
                      <div className="h-20 w-14 animate-pulse rounded bg-white/10" />
                      <div className="flex-1 space-y-3 py-1">
                        <div className="h-3 w-3/4 animate-pulse rounded bg-white/10" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
                        <div className="h-3 w-full animate-pulse rounded bg-white/10" />
                      </div>
                    </div>
                  ))}
                </motion.div>
              ) : recError ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200"
                >
                  {recError}
                </motion.div>
              ) : recommendations.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-lg border border-white/10 bg-black/20 p-6 text-center"
                >
                  <Sparkles className="mx-auto h-8 w-8 text-zinc-500" />
                  <p className="mt-3 text-sm text-zinc-400">
                    Select a mood to generate suggestions.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="items"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2.5 lg:max-h-[530px] lg:overflow-y-auto lg:pr-1 mobile-native-scroll"
                >
                  {recommendations.map((rec, index) => (
                    <motion.a
                      key={`${rec.type}-${rec.id}`}
                      href={`/${rec.type === "tv" ? "tv" : "movies"}/${rec.id}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.025 }}
                      className="group flex gap-3 rounded-lg border border-white/10 bg-black/20 p-2.5 transition hover:border-white/25 hover:bg-white/[0.055] sm:p-3"
                    >
                      <span className="relative h-[5.5rem] w-14 shrink-0 overflow-hidden rounded-md bg-zinc-900 sm:h-24 sm:w-16">
                        <Image
                          src={
                            rec.posterPath
                              ? tmdbImage(rec.posterPath, "w154")
                              : "/placeholder-poster.svg"
                          }
                          alt={rec.title}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-bold text-white group-hover:text-red-200">
                          {rec.title}
                        </span>
                        <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          <span className="inline-flex items-center gap-1">
                            {rec.type === "tv" ? (
                              <Tv className="h-3 w-3" />
                            ) : (
                              <Film className="h-3 w-3" />
                            )}
                            {rec.type === "tv" ? "Series" : "Movie"}
                          </span>
                          {Number(rec.voteAverage ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-yellow-300">
                              <Star className="h-3 w-3 fill-current" />
                              {Number(rec.voteAverage).toFixed(1)}
                            </span>
                          )}
                        </span>
                        <span className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">
                          {rec.overview || "No description available."}
                        </span>
                      </span>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-red-200" />
                    </motion.a>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </aside>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-center">
      <div className="text-lg font-black text-white">{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </div>
    </div>
  );
}
