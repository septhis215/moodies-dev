"use client";

import React, { useEffect, useMemo, useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Film,
  Grid3X3,
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

  const activeCluster =
    moodClusters.find((cluster) => cluster.id === activeClusterId) ??
    moodClusters[0];
  const activeClusterNameSet = useMemo(
    () => new Set(activeCluster.moodNames.map((name) => slugify(name))),
    [activeCluster],
  );

  const activeMoods = useMemo(() => {
    const filtered = moods.filter((mood) =>
      activeClusterNameSet.has(slugify(mood.name)),
    );
    return filtered.length > 0 ? filtered : moods.slice(0, 8);
  }, [activeClusterNameSet, moods]);

  const selectedMood = useMemo(
    () =>
      moods.find((mood) => mood.id === selectedMoodId) ??
      activeMoods[0] ??
      null,
    [activeMoods, moods, selectedMoodId],
  );

  const selectedClusterForMood = useMemo(() => {
    if (!selectedMood) return activeCluster;
    return (
      moodClusters.find((cluster) =>
        cluster.moodNames.some(
          (name) => slugify(name) === slugify(selectedMood.name),
        ),
      ) ?? activeCluster
    );
  }, [activeCluster, selectedMood]);

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
      setRecommendations(
        normalizeRecommendations(data?.recommendations ?? data?.results ?? []),
      );
    } catch (error) {
      console.error("fetchRecommendationsForMood error:", error);
      setRecError("Unable to load recommendations");
      setRecommendations([]);
    } finally {
      setLoadingRecs(false);
    }
  }

  const selectMood = (mood: MoodFromApi, alignWheel = true) => {
    setSelectedMoodId(mood.id);
    setShowMoodBubble(true);
    const cluster = moodClusters.find((item) =>
      item.moodNames.some((name) => slugify(name) === slugify(mood.name)),
    );
    if (cluster) setActiveClusterId(cluster.id);

    if (alignWheel) {
      const index = activeMoods.findIndex((item) => item.id === mood.id);
      if (index >= 0) {
        setCurrentRotation((rotation) =>
          getPointerAlignedRotation(rotation, index, activeMoods.length),
        );
      }
    }
  };

  const spinWheel = () => {
    if (!activeMoods.length || isSpinning) return;

    const nextIndex = Math.floor(Math.random() * activeMoods.length);
    const extraSpins = 4 + Math.floor(Math.random() * 3);

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

    window.setTimeout(() => {
      const mood = activeMoods[nextIndex];
      if (mood) {
        setSelectedMoodId(mood.id);
        setShowMoodBubble(true);
        fetchRecommendationsForMood(mood.id, true, 8);
      }
      setIsSpinning(false);
    }, 2600);
  };

  const highRatedCount = recommendations.filter(
    (item) => Number(item.voteAverage ?? 0) >= 7,
  ).length;

  return (
    <main className="min-h-screen overflow-hidden bg-black px-4 pb-10 pt-4 text-white sm:px-6 sm:pt-32 lg:px-8">
      <section className="relative border-b border-white/10 pb-5 sm:pb-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(233,79,55,0.10),transparent_34%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.07),transparent_30%),linear-gradient(180deg,#060606_0%,#000_72%)]" />
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-end">
            <div>
              <h1 className="max-w-3xl text-[2rem] font-black leading-[1.06] tracking-tight sm:mt-6 sm:text-5xl lg:text-6xl">
                Spin into a mood, then let Moodies find the watchlist.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:mt-5 sm:text-lg sm:leading-7">
                Explore moods by emotional clusters, use mascot cues to spot the
                right vibe quickly, and unlock recommendations without wading
                through clutter.
              </p>
            </div>

            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 mobile-native-scroll sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0">
              {moodClusters.map((cluster) => {
                const isActive = cluster.id === activeClusterId;
                return (
                  <button
                    key={cluster.id}
                    onClick={() => setActiveClusterId(cluster.id)}
                    className={`min-w-[184px] snap-start rounded-lg border p-3 text-left transition sm:min-w-0 sm:p-4 ${
                      isActive
                        ? "border-white/30 bg-white/[0.08]"
                        : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]"
                    }`}
                    style={{
                      boxShadow: isActive
                        ? `0 0 28px ${cluster.color}22`
                        : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-black text-white">
                        {cluster.label}
                      </span>
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: cluster.color }}
                      />
                    </div>
                    <p className="mt-2 hidden text-xs leading-5 text-zinc-400 sm:block">
                      {cluster.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="py-5 sm:py-8">
        <div className="mx-auto grid max-w-7xl gap-4 sm:gap-6 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
          <aside className="min-w-0 space-y-3 sm:space-y-4">
            <div className="hidden rounded-lg border border-white/10 bg-white/[0.04] p-4 md:block">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Cluster
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    {activeCluster.label}
                  </h2>
                </div>
                <Grid3X3 className="h-5 w-5 text-zinc-500" />
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {activeCluster.description}
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Related moods
              </div>
              <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 mobile-native-scroll sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-1">
                {activeMoods.map((mood) => {
                  const isSelected = mood.id === selectedMoodId;
                  return (
                    <button
                      key={mood.id}
                      onClick={() => selectMood(mood)}
                      className={`group flex min-w-[168px] snap-start items-center gap-2.5 rounded-lg border p-2.5 text-left transition sm:min-w-0 sm:gap-3 sm:p-3 ${
                        isSelected
                          ? "border-white/30 bg-white/[0.08]"
                          : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.055]"
                      }`}
                    >
                      <span
                        className="relative h-10 w-10 shrink-0 rounded-lg border border-white/10 bg-black/30 p-1.5 sm:h-12 sm:w-12"
                        style={{
                          boxShadow: isSelected
                            ? `0 0 20px ${mood.color ?? activeCluster.color}44`
                            : undefined,
                        }}
                      >
                        <Image
                          src={getMoodImageSrc(mood)}
                          alt={`${mood.name} mascot`}
                          fill
                          sizes="48px"
                          className="object-contain transition group-hover:scale-110"
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-white">
                          {mood.name}
                        </span>
                        <span className="hidden line-clamp-1 text-xs text-zinc-500 sm:block">
                          {mood.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="min-w-0 rounded-lg border border-white/10 bg-zinc-950/70 p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300/80">
                  Interactive wheel
                </p>
                <h2 className="mt-2 text-xl font-black sm:text-3xl">
                  Choose a mood or spin for one
                </h2>
              </div>
              <button
                onClick={spinWheel}
                disabled={isSpinning || loadingMoods}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isSpinning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shuffle className="h-4 w-4" />
                )}
                {isSpinning ? "Spinning" : "Spin wheel"}
              </button>
            </div>

            <div className="hidden place-items-center lg:grid">
              <div className="relative size-[min(52vw,520px)] max-h-[520px] max-w-[520px]">
                <motion.div
                  className="absolute inset-0"
                  animate={{ rotate: currentRotation }}
                  transition={{
                    duration: isSpinning ? 2.6 : 0.5,
                    ease: isSpinning ? [0.18, 0.82, 0.2, 1] : "easeOut",
                  }}
                >
                  <svg
                    className="h-full w-full drop-shadow-2xl"
                    viewBox="0 0 200 200"
                  >
                    <defs>
                      {activeMoods.map((mood, index) => (
                        <linearGradient
                          key={mood.id}
                          id={`mood-gradient-${index}`}
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="100%"
                        >
                          <stop
                            offset="0%"
                            stopColor={mood.color ?? activeCluster.color}
                            stopOpacity="0.98"
                          />
                          <stop
                            offset="100%"
                            stopColor={mood.color ?? activeCluster.color}
                            stopOpacity="0.72"
                          />
                        </linearGradient>
                      ))}
                    </defs>
                    <circle
                      cx="100"
                      cy="100"
                      r="98"
                      fill="#080808"
                      stroke="rgba(255,255,255,0.14)"
                      strokeWidth="1.5"
                    />
                    {activeMoods.map((mood, index) => {
                      const total = activeMoods.length;
                      const slice = 360 / total;
                      const angle = index * slice + slice / 2 - 90;
                      const mascotPoint = polarToCartesian(100, 100, 58, angle);
                      const isSelected = mood.id === selectedMoodId;
                      const mascotSize = isSelected ? 32 : 29;
                      return (
                        <g
                          key={mood.id}
                          className="cursor-pointer outline-none"
                          onClick={() => selectMood(mood)}
                          tabIndex={0}
                          role="button"
                          aria-label={`Select ${mood.name} mood`}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              selectMood(mood);
                            }
                          }}
                        >
                          <path
                            d={getSlicePath(index, total)}
                            fill={`url(#mood-gradient-${index})`}
                            stroke={
                              isSelected
                                ? "rgba(255,255,255,0.85)"
                                : "rgba(255,255,255,0.16)"
                            }
                            strokeWidth={isSelected ? 2.2 : 1}
                            className="transition duration-300 hover:brightness-110"
                          />
                          <circle
                            cx={mascotPoint.x}
                            cy={mascotPoint.y}
                            r={isSelected ? 20 : 17}
                            fill="rgba(0,0,0,0.14)"
                            stroke="rgba(255,255,255,0.22)"
                            className="transition"
                          />
                          <g
                            transform={`rotate(${-currentRotation} ${mascotPoint.x} ${mascotPoint.y})`}
                          >
                            {isSelected && (
                              <animateTransform
                                attributeName="transform"
                                type="translate"
                                values="0 0; 0 -1.4; 0 0"
                                dur="2.4s"
                                repeatCount="indefinite"
                                additive="sum"
                              />
                            )}
                            <image
                              href={getMoodImageSrc(mood)}
                              x={mascotPoint.x - mascotSize / 2}
                              y={mascotPoint.y - mascotSize / 2}
                              width={mascotSize}
                              height={mascotSize}
                              preserveAspectRatio="xMidYMid meet"
                            />
                          </g>
                        </g>
                      );
                    })}
                    <circle
                      cx="100"
                      cy="100"
                      r="31"
                      fill="#050505"
                      stroke="rgba(255,255,255,0.18)"
                      strokeWidth="1.5"
                    />
                  </svg>
                </motion.div>

                <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1">
                  <div className="h-0 w-0 border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-red-400 drop-shadow-[0_0_16px_rgba(248,113,113,0.7)]" />
                </div>

                <div className="absolute left-1/2 top-1/2 z-10 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black shadow-[0_0_40px_rgba(0,0,0,0.8)]">
                  <Image
                    src="/images/moodies-transparent.png"
                    alt="Moodies mascot"
                    width={64}
                    height={64}
                    className="object-contain"
                  />
                </div>

                <AnimatePresence>
                  {showMoodBubble && selectedMood && !isSpinning && (
                    <motion.div
                      key={selectedMood.id}
                      initial={{ opacity: 0, y: 14, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.96 }}
                      transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 22,
                      }}
                      className="absolute -right-4 top-16 z-20 w-64 rounded-lg border border-white/15 bg-black/85 p-4 shadow-2xl backdrop-blur-xl"
                      style={{
                        boxShadow: `0 0 34px ${selectedMood.color ?? activeCluster.color}33`,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="relative h-14 w-14 shrink-0 rounded-lg bg-white/[0.06] p-2">
                          <Image
                            src={getMoodImageSrc(selectedMood)}
                            alt={`${selectedMood.name} mascot`}
                            fill
                            sizes="56px"
                            className="object-contain"
                          />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-red-200">
                            Your result
                          </span>
                          <span className="mt-1 block text-xl font-black text-white">
                            {selectedMood.name}
                          </span>
                          <span className="mt-1 line-clamp-3 block text-sm leading-5 text-zinc-400">
                            {selectedMood.description}
                          </span>
                        </span>
                      </div>
                      <div className="absolute -left-2 top-8 h-4 w-4 rotate-45 border-b border-l border-white/15 bg-black/85" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:hidden">
              {activeMoods.map((mood) => {
                const isSelected = mood.id === selectedMoodId;
                return (
                  <button
                    key={mood.id}
                    onClick={() => selectMood(mood)}
                    className={`flex min-h-[116px] flex-col items-start gap-2 rounded-lg border p-3 text-left transition sm:min-h-0 sm:flex-row sm:items-center sm:gap-3 ${
                      isSelected
                        ? "border-white/30 bg-white/[0.08]"
                        : "border-white/10 bg-white/[0.035] hover:border-white/20"
                    }`}
                  >
                    <span className="relative h-14 w-14 shrink-0 rounded-lg bg-black/30 p-2 sm:h-12 sm:w-12">
                      <Image
                        src={getMoodImageSrc(mood)}
                        alt={`${mood.name} mascot`}
                        fill
                        sizes="48px"
                        className="object-contain"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-black">
                        {mood.name}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-5 text-zinc-400 sm:line-clamp-1">
                        {mood.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="relative h-12 w-12 shrink-0 rounded-lg border border-white/10 bg-black/30 p-2 sm:h-14 sm:w-14"
                  style={{
                    boxShadow: selectedMood
                      ? `0 0 24px ${selectedMood.color ?? selectedClusterForMood.color}33`
                      : undefined,
                  }}
                >
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
                  className="space-y-3 sm:max-h-[620px] sm:overflow-y-auto sm:pr-1 mobile-native-scroll"
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
                          className="object-cover transition group-hover:scale-105"
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
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-600 transition group-hover:translate-x-1 group-hover:text-red-200" />
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
