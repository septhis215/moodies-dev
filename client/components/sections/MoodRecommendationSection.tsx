"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Star,
  Plus,
  Info,
  Share2,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Shuffle,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getMoodRecommendations } from "@/app/tv/action";
import { useRouter } from "next/navigation";
import { useWatchlist } from "@/hooks/useWatchlist";

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
  overview: string;
  genreNames?: string[];
  voteAverage: number;
  releaseDate: string;
  posterPath: string;
  backdropPath: string;
  score: number;
  reason: string;
}

interface MoodRecommendationsSectionProps {
  moods: Mood[];
  mediaType: string;
}

const BASE_URL = process.env.NEST_API_URL || "http://localhost:4000";

export default function MoodRecommendationsSection({
  moods,
  mediaType,
}: MoodRecommendationsSectionProps) {
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayedMoods, setDisplayedMoods] = useState<Mood[]>([]);
  const [moodCount, setMoodCount] = useState(12); // Default to 12 moods

  const router = useRouter();
  const { add, remove, isInWatchlist, ready } = useWatchlist();

  const [watchlistStates, setWatchlistStates] = useState<
    Record<string, boolean>
  >({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>(
    {}
  );

  const toHookType = (t: "MOVIE" | "TV") =>
    (t === "TV" ? "series" : "movie") as "movie" | "series";

  const getPosterUrl = (path?: string) =>
    path ? `https://image.tmdb.org/t/p/w500${path}` : "/coming-soon.png";

  const getIconEmoji = (iconName: string) => {
    const iconMap: Record<string, string> = {
      smile: "😊",
      zap: "⚡",
      skull: "💀",
      heart: "❤️",
      wind: "🌊",
      moon: "🌙",
      crown: "👑",
      star: "⭐",
      clock: "⏰",
      "cloud-rain": "🌧️",
      laugh: "😂",
      book: "📚",
      cloud: "☁️",
      flag: "🇺🇸",
      music: "🎵",
      compass: "🧭",
      sun: "☀️",
      brain: "🧠",
      shield: "🛡️",
      rocket: "🚀",
      cowboy: "🤠",
      crosshair: "🎯",
      "mug-hot": "☕",
      beaker: "🧪",
      fist: "✊",
      "book-open": "📖",
    };
    return iconMap[iconName] || "🎬";
  };

  // Shuffle function
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Initialize and shuffle moods on mount
  useEffect(() => {
    const shuffled = shuffleArray(moods).slice(0, moodCount);
    setDisplayedMoods(shuffled);
  }, [moods, moodCount]);

  // Handle shuffle button
  const handleShuffleMoods = () => {
    const shuffled = shuffleArray(moods).slice(0, moodCount);
    setDisplayedMoods(shuffled);
  };

  // Toggle between 12 and 18 moods
  const toggleMoodCount = () => {
    const newCount = moodCount === 12 ? 18 : 12;
    setMoodCount(newCount);
    const shuffled = shuffleArray(moods).slice(0, newCount);
    setDisplayedMoods(shuffled);
  };

  const fetchRecommendations = async (mood: Mood) => {
    setLoading(true);
    setError(null);

    try {
      const data = await getMoodRecommendations(mood.id, 12, mediaType);
      setRecommendations(data.recommendations || []);
    } catch (err) {
      setError("Failed to load recommendations. Please try again.");
      console.error("Error fetching recommendations:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMoodClick = (mood: Mood) => {
    setSelectedMood(mood);
    fetchRecommendations(mood);
  };

  const handleRefresh = () => {
    if (selectedMood) {
      fetchRecommendations(selectedMood);
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
    } catch (error) {
      console.error("Watchlist toggle failed:", error);
      // Rollback on error
      const inListNow = isInWatchlist(id, kind) ?? watchlistStates[id];
      setWatchlistStates((prev) => ({ ...prev, [id]: inListNow }));
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

  return (
    <section
      id="moods"
      className="relative  w-full max-w-7xl mx-auto overflow-hidden"
    >
      {/* Enhanced Animated Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "700ms" }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-600/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1400ms" }}
        />
      </div>

      {/* Header */}
      <div className="relative mb-12">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
                <div className="relative bg-gradient-to-br from-violet-600 via-fuchsia-600 to-cyan-600 p-2.5 rounded-xl">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-violet-200 to-white">
                  Mood Matcher
                </h2>
              </div>
            </div>
            <p className="text-gray-400 text-base ml-14">
              Discover content that matches your current vibe
            </p>
          </div>

          {selectedMood && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full hover:shadow-lg hover:shadow-violet-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <RefreshCw
                className={`w-4 h-4 text-white ${loading
                  ? "animate-spin"
                  : "group-hover:rotate-180 transition-transform duration-500"
                  }`}
              />
              <span className="text-sm font-bold text-white">New Picks</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Mood Selection Controls */}
      <AnimatePresence mode="wait">
        {!selectedMood && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between mb-6 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-300">
                Showing {displayedMoods.length} moods
              </span>
              <div className="h-4 w-px bg-white/20" />
              <button
                onClick={toggleMoodCount}
                className="text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors"
              >
                {moodCount === 12 ? "Show 18" : "Show 12"}
              </button>
            </div>
            <button
              onClick={handleShuffleMoods}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 hover:from-violet-600/30 hover:to-fuchsia-600/30 rounded-xl border border-violet-500/30 transition-all duration-300 group"
            >
              <Shuffle className="w-4 h-4 text-violet-400 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-sm font-bold text-violet-300">Shuffle</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mood Selection Grid - Enhanced Design */}
      <AnimatePresence mode="wait">
        {!selectedMood ? (
          <motion.div
            key="mood-grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-12"
          >
            {displayedMoods.map((mood, index) => (
              <motion.button
                key={`${mood.id}-${index}`}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  delay: index * 0.03,
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                }}
                onClick={() => handleMoodClick(mood)}
                className="group relative p-6 rounded-2xl transition-all duration-300 hover:scale-105 hover:-translate-y-2"
                style={{
                  background: `linear-gradient(135deg, ${mood.color}20 0%, ${mood.color}05 100%)`,
                  border: `2px solid ${mood.color}30`,
                }}
              >
                {/* Animated glow effect */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: `linear-gradient(135deg, ${mood.color}40 0%, ${mood.color}15 100%)`,
                    boxShadow: `0 8px 32px ${mood.color}40, 0 0 0 1px ${mood.color}50`,
                  }}
                />

                {/* Shimmer effect on hover */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div
                    className="absolute inset-0 animate-shimmer"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${mood.color}30, transparent)`,
                      transform: "translateX(-100%)",
                    }}
                  />
                </div>

                <div className="relative flex flex-col items-center text-center gap-3">
                  <div className="text-3xl mb-1 transform group-hover:scale-125 group-hover:rotate-12 transition-all duration-300">
                    {getIconEmoji(mood.icon)}
                  </div>
                  <div>
                    <h3
                      className="font-bold text-black text-sm mb-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r transition-all"
                      style={{
                        backgroundImage: `linear-gradient(135deg, ${mood.color}, white)`,
                      }}
                    >
                      {mood.name}
                    </h3>
                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed group-hover:text-gray-300 transition-colors">
                      {mood.description}
                    </p>
                  </div>
                  <ChevronRight
                    className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300"
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
            {/* Selected Mood Bar - Enhanced */}
            <div
              className="relative flex items-center justify-between p-5 rounded-2xl mb-8 overflow-hidden"
              style={{
                background: `linear-gradient(90deg, ${selectedMood.color}30 0%, ${selectedMood.color}15 50%, ${selectedMood.color}30 100%)`,
                border: `2px solid ${selectedMood.color}50`,
              }}
            >
              {/* Animated background pattern */}
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
                <div className="text-4xl animate-bounce">
                  {getIconEmoji(selectedMood.icon)}
                </div>
                <div>
                  <h3 className="font-black text-white text-xl mb-1">
                    {selectedMood.name} Mode
                  </h3>
                  <p className="text-sm text-gray-300 font-medium">
                    {selectedMood.description}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMood(null)}
                className="relative px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm font-bold transition-all duration-300 border border-white/20 hover:border-white/40 hover:scale-105"
              >
                Change Mood
              </button>
            </div>

            {/* Recommendations Grid */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32">
                <div className="relative mb-6">
                  <div
                    className="w-20 h-20 border-4 rounded-full animate-spin"
                    style={{
                      borderColor: `${selectedMood.color}20`,
                      borderTopColor: selectedMood.color,
                    }}
                  />
                  <div
                    className="absolute inset-0 blur-2xl opacity-50 animate-pulse"
                    style={{ backgroundColor: selectedMood.color }}
                  />
                </div>
                <p className="text-2xl font-black text-white mb-2 animate-pulse">
                  Curating your perfect matches
                </p>
                <p className="text-gray-400 text-lg">
                  Finding content that fits your{" "}
                  {selectedMood.name.toLowerCase()} mood...
                </p>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-32">
                <div className="text-center max-w-md">
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <span className="text-4xl">😕</span>
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2">Oops!</h3>
                  <p className="text-gray-400 mb-6 text-lg">{error}</p>
                  <button
                    onClick={handleRefresh}
                    className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full font-bold text-white hover:shadow-lg hover:shadow-violet-500/50 transition-all hover:scale-105"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : recommendations.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                {recommendations.map((rec, index) => {
                  const id = String(rec.tmdbId);
                  const kind = toHookType(rec.mediaType);
                  const inList = isInWatchlist(id, kind) ?? watchlistStates[id];
                  const isBusy = loadingStates[id];

                  return (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        delay: index * 0.05,
                        type: "spring",
                        stiffness: 260,
                        damping: 20,
                      }}
                    >
                      <Link
                        href={`/${rec.mediaType.toLowerCase()}/${rec.tmdbId}`}
                      >
                        <div className="group relative block">
                          {/* Poster Container */}
                          <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 mb-3 shadow-2xl ring-1 ring-white/10 group-hover:ring-2 group-hover:ring-violet-500/50 transition-all duration-300">
                            {rec.posterPath && (
                              <Image
                                src={getPosterUrl(rec.posterPath)}
                                alt={rec.title}
                                fill
                                className="object-cover transition-transform duration-700 group-hover:scale-110"
                              />
                            )}

                            {/* Enhanced Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                            {/* Match Score Badge - Enhanced */}
                            <div
                              className="absolute top-3 left-3 px-3 py-1.5 rounded-full backdrop-blur-md font-black text-xs shadow-lg ring-1 ring-white/20"
                              style={{
                                background: `linear-gradient(135deg, ${selectedMood.color}F5 0%, ${selectedMood.color}DD 100%)`,
                                color: "#ffffff",
                              }}
                            >
                              ✨ {Math.round(rec.score * 100)}%
                            </div>

                            {/* Rating Badge - Enhanced */}
                            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md font-bold text-xs flex items-center gap-1 shadow-lg ring-1 ring-white/10">
                              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              <span className="text-white">
                                {Number(rec.voteAverage) && Number(rec.voteAverage) > 0
                                  ? Number(rec.voteAverage).toFixed(1)
                                  : "New"}
                              </span>
                            </div>

                            {/* Hover Actions - Enhanced */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/50 opacity-0 group-hover:opacity-100 transition-all duration-300">
                              <div className="absolute inset-0 flex flex-col justify-end p-4">
                                {/* Action Buttons */}
                                <div className="flex justify-center gap-2 mb-3">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      if (!isBusy) toggleWatchlist(rec);
                                    }}
                                    disabled={isBusy}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-lg group/btn
                                        ${inList
                                        ? "bg-emerald-500 hover:bg-emerald-600"
                                        : "bg-white hover:bg-violet-500"
                                      }
                                        ${isBusy
                                        ? "opacity-70 cursor-not-allowed"
                                        : ""
                                      }`}
                                    title={
                                      inList
                                        ? "Remove from Watchlist"
                                        : "Add to Watchlist"
                                    }
                                  >
                                    {isBusy ? (
                                      <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{
                                          duration: 1,
                                          repeat: Infinity,
                                          ease: "linear",
                                        }}
                                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                                      />
                                    ) : inList ? (
                                      <BookmarkCheck className="w-5 h-5 text-white" />
                                    ) : (
                                      <Plus className="w-5 h-5 text-black group-hover/btn:text-white transition-colors" />
                                    )}
                                  </button>
                                  <button className="w-10 h-10 bg-white hover:bg-violet-500 rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-lg group/btn">
                                    <Info className="w-5 h-5 text-black group-hover/btn:text-white transition-colors" />
                                  </button>

                                </div>
                                {/* Reason */}
                                <p className="text-xs text-center text-white font-semibold line-clamp-2 leading-relaxed">
                                  {rec.reason}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Title and Genres */}
                          <div className="px-1">
                            <h4 className="font-bold text-sm text-white line-clamp-2 leading-tight mb-1.5 group-hover:text-violet-400 transition-colors">
                              {rec.title}
                            </h4>
                            {rec.genreNames && rec.genreNames.length > 0 && (
                              <p className="text-xs text-gray-500 font-medium">
                                {rec.genreNames.slice(0, 2).join(" • ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center py-32">
                <div className="text-center">
                  <div className="text-6xl mb-4 animate-bounce">🎭</div>
                  <h3 className="text-2xl font-black text-white mb-2">
                    No matches found
                  </h3>
                  <p className="text-gray-400 mb-6 text-lg">
                    Try selecting a different mood
                  </p>
                  <button
                    onClick={() => setSelectedMood(null)}
                    className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full font-bold text-white hover:shadow-lg hover:shadow-violet-500/50 transition-all hover:scale-105"
                  >
                    Choose Another Mood
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </section>
  );
}
