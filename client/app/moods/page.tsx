"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
    Shuffle,
    Heart,
    Zap,
    Moon,
    Smile,
    Wind,
    Skull,
    Play,
    Star,
    Film,
    Tv,
    Sparkles
} from "lucide-react";
import { useRouter } from "next/navigation";

/* Types */
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
/* Enhanced mood icon mapping */
const moodIcon = (name: string, size: number = 20) => {
    const iconProps = { size, className: "drop-shadow-sm" };
    switch (name.toLowerCase()) {
        case "happy":
        case "joy":
        case "cheerful":
            return <Smile {...iconProps} />;
        case "thrilling":
        case "exciting":
        case "adventurous":
            return <Zap {...iconProps} />;
        case "horror":
        case "scary":
        case "terrifying":
            return <Skull {...iconProps} />;
        case "romantic":
        case "love":
        case "passionate":
            return <Heart {...iconProps} />;
        case "chill":
        case "relaxed":
        case "calm":
            return <Wind {...iconProps} />;
        case "dark":
        case "mysterious":
        case "noir":
            return <Moon {...iconProps} />;
        default:
            return <Sparkles {...iconProps} />;
    }
};

/* Shuffle array utility */
const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

export default function MoodDiscoveryWheel() {
    const [moods, setMoods] = useState<MoodFromApi[]>([]);
    const [shuffledMoods, setShuffledMoods] = useState<MoodFromApi[]>([]);
    const [loadingMoods, setLoadingMoods] = useState(true);

    const [selectedMoodId, setSelectedMoodId] = useState<string | null>(null);
    const [selectedMoodName, setSelectedMoodName] = useState<string>("Happy");

    const [recommendations, setRecommendations] = useState<RecommendationFromApi[]>([]);
    const [loadingRecs, setLoadingRecs] = useState(false);
    const [recError, setRecError] = useState<string | null>(null);

    const [isSpinning, setIsSpinning] = useState(false);
    const [currentRotation, setCurrentRotation] = useState(0);
    const router = useRouter();

    /* Enhanced color palette */
    const fallbackMoods: MoodFromApi[] = [
        {
            id: "happy",
            name: "Happy",
            color: "#10B981", // Emerald
            description: "Uplifting stories to brighten your spirits"
        },
        {
            id: "thrilling",
            name: "Thrilling",
            color: "#EF4444", // Red
            description: "Edge-of-your-seat adventures"
        },
        {
            id: "horror",
            name: "Horror",
            color: "#7C2D12", // Dark Red
            description: "Spine-chilling tales"
        },
        {
            id: "romantic",
            name: "Romantic",
            color: "#EC4899", // Pink
            description: "Love stories that warm the heart"
        },
        {
            id: "chill",
            name: "Chill",
            color: "#06B6D4", // Cyan
            description: "Relaxing content for unwinding"
        },
        {
            id: "dark",
            name: "Dark",
            color: "#6366F1", // Indigo
            description: "Complex narratives and mysteries"
        }
    ];

    /* Fetch moods on mount */
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
                    ? data.filter((m) => (typeof m.isActive === "boolean" ? m.isActive : true))
                    : [];
                const activeMoods = list.length > 0 ? list : fallbackMoods;
                const shuffled = shuffleArray(activeMoods).slice(0, 6);

                setMoods(activeMoods);
                setShuffledMoods(shuffled);

                if (shuffled.length > 0) {
                    setSelectedMoodId(shuffled[0].id);
                    setSelectedMoodName(shuffled[0].name);
                }
            })
            .catch((err) => {
                if (aborted) return;
                console.error("Failed to load moods:", err);


                setMoods(fallbackMoods);
                // Fallback moods reshuffled too
                const shuffled = shuffleArray(fallbackMoods).slice(0, 6);
                setShuffledMoods(shuffled);
                setSelectedMoodId(shuffled[0].id);
                setSelectedMoodName(shuffled[0].name);
            })
            .finally(() => {
                if (!aborted) setLoadingMoods(false);
            });

        return () => {
            aborted = true;
        };
    }, []);

    /* Fetch recommendations */
    async function fetchRecommendationsForMood(moodId: string, forceRefresh = false, limit = 6) {
        setLoadingRecs(true);
        setRecError(null);

        try {
            const endpoint = forceRefresh ? '/moods/recommendations/regenerate' : '/moods/recommendations';

            if (forceRefresh) {
                const response = await fetch(`${API_BASE}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        moodId: moodId,
                        limit: limit,
                        page: 1,
                        mediaType: 'both',
                        userId: null
                    }),
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch recommendations (${response.status})`);
                }

                const data = await response.json();
                const recs = data?.recommendations ?? [];
                setRecommendations(normalizeRecommendations(recs));
            } else {
                const url = new URL(`${API_BASE}${endpoint}`);
                url.searchParams.set("moodId", moodId);
                url.searchParams.set("limit", String(limit));
                url.searchParams.set("page", "1");
                url.searchParams.set("mediaType", "both");

                const res = await fetch(url.toString());
                if (!res.ok) {
                    throw new Error(`Failed to fetch recommendations (${res.status})`);
                }
                const data = await res.json();
                const recs = data?.recommendations ?? data?.results ?? [];
                setRecommendations(normalizeRecommendations(recs));
            }
        } catch (err) {
            console.error("fetchRecommendationsForMood error:", err);
            setRecError("Unable to load recommendations");
            setRecommendations([]);
        } finally {
            setLoadingRecs(false);
        }
    }

    /* Normalize recommendations data */
    function normalizeRecommendations(recs: any[]): RecommendationFromApi[] {
        return recs.map((r: any) => {
            const typeRaw = r.mediaType ?? r.type ?? r.media_type ?? "";
            const type = typeRaw.toLowerCase() === "tv" ? "tv" : "movie";

            return {
                id: (r.tmdbId ?? r.id ?? Math.random()).toString(),
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
    }


    /* Load recommendations when mood changes */
    useEffect(() => {
        if (!selectedMoodId) return;
        fetchRecommendationsForMood(selectedMoodId, false, 6);
    }, [selectedMoodId]);

    /* Enhanced spin functionality with mood shuffling */
    const randomizeMood = () => {
        if (!shuffledMoods.length || isSpinning) return;

        setIsSpinning(true);

        // Calculate spins and final position
        const minSpins = 3;
        const maxSpins = 6;
        const spins = minSpins + Math.random() * (maxSpins - minSpins);

        // Calculate slice angle based on current mood arrangement
        const sliceAngle = 360 / shuffledMoods.length;

        // Choose a random mood index
        const randomIndex = Math.floor(Math.random() * shuffledMoods.length);

        // Calculate target angle - pointer points up (270 degrees in SVG coordinates)
        // We want the selected slice center to align with the pointer
        const targetSliceCenter = randomIndex * sliceAngle + sliceAngle / 2;

        // Calculate rotation needed to align target slice with pointer (270 degrees)
        const targetRotation = 270 - targetSliceCenter;
        const finalRotation = spins * 360 + targetRotation;

        setCurrentRotation(prev => prev + finalRotation);

        const durationMs = 3000;

        setTimeout(() => {
            const chosenMood = shuffledMoods[randomIndex];

            if (chosenMood) {
                setSelectedMoodId(chosenMood.id);
                setSelectedMoodName(chosenMood.name);

                // Shuffle moods after spin completes
                const newShuffled = shuffleArray(shuffledMoods);
                setShuffledMoods(newShuffled);

                // Force fresh recommendations
                setTimeout(() => {
                    fetchRecommendationsForMood(chosenMood.id, true, 6);
                }, 300);
            }

            setIsSpinning(false);
        }, durationMs);
    };

    const selectedMood = shuffledMoods.find((m) => m.id === selectedMoodId) ?? shuffledMoods[0];

    return (
        <section id="mood-wheels" className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
            {/* Subtle background elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/3 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/3 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 container mx-auto px-14 py-8">
                {/* Main Content - Single Row Layout */}
                <div className="max-w-7xl mx-auto mt-14">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

                        {/* Left: Mood Selection */}
                        <div className="lg:col-span-3">
                            <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl p-4 border border-gray-700/50">
                                <h3 className="text-xl font-semibold text-white mb-4">Select Mood</h3>
                                <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                                    {shuffledMoods.map((mood) => (
                                        <button
                                            key={mood.id}
                                            onClick={() => {
                                                setSelectedMoodId(mood.id);
                                                setSelectedMoodName(mood.name);
                                            }}
                                            className={`p-2 rounded-xl border-2 transition-all duration-300 text-left ${selectedMoodId === mood.id
                                                ? 'border-white/40 bg-white/10 text-white'
                                                : 'border-gray-600/50 bg-gray-700/30 text-gray-300 hover:border-gray-500/70 hover:bg-gray-600/40'
                                                }`}
                                            style={{
                                                borderColor: selectedMoodId === mood.id ? mood.color : undefined,
                                                backgroundColor: selectedMoodId === mood.id ? `${mood.color}15` : undefined
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div style={{ color: mood.color }}>
                                                    {moodIcon(mood.name, 18)}
                                                </div>
                                                <span className="font-medium text-sm">{mood.name}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* Current Mood Info */}
                                {selectedMood && (
                                    <div className="mt-6 p-4 bg-gray-700/30 rounded-xl border border-gray-600/30">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div style={{ color: selectedMood.color }}>
                                                {moodIcon(selectedMood.name, 24)}
                                            </div>
                                            <span className="font-semibold text-white">{selectedMood.name}</span>
                                        </div>
                                        <p className="text-gray-400 text-sm">{selectedMood.description}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Center: Compact Wheel */}
                        <div className="lg:col-span-6 flex flex-col items-center">
                            {/* Header */}
                            <div className="text-center mb-4">
                                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text text-transparent mb-2">
                                    Mood Discovery Wheel
                                </h1>
                                <p className="text-gray-400 text-lg">
                                    Discover content that matches your vibe
                                </p>
                            </div>
                            <div className="relative mb-6">

                                {/* Wheel Container */}
                                <div className="relative w-74 h-74">
                                    <motion.div
                                        className="relative w-full h-full"
                                        animate={{ rotate: currentRotation }}
                                        transition={{
                                            duration: isSpinning ? 3 : 0.6,
                                            ease: isSpinning ? [0.25, 0.46, 0.45, 0.94] : "easeOut"
                                        }}
                                    >
                                        {/* Wheel Background */}
                                        <div className="absolute inset-0 rounded-full bg-gray-800/60 backdrop-blur-sm border-4 border-gray-600/50 shadow-2xl"></div>

                                        {/* Wheel SVG */}
                                        <svg className="w-full h-full" viewBox="0 0 200 200">
                                            <defs>
                                                {shuffledMoods.map((mood, i) => (
                                                    <linearGradient key={`gradient-${i}`} id={`gradient-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                                        <stop offset="0%" stopColor={mood.color || "#666"} stopOpacity="0.8" />
                                                        <stop offset="100%" stopColor={mood.color || "#333"} stopOpacity="0.4" />
                                                    </linearGradient>
                                                ))}
                                            </defs>

                                            {shuffledMoods.map((mood, i) => {
                                                const slice = 360 / shuffledMoods.length;
                                                const startAngle = i * slice;
                                                const endAngle = startAngle + slice;
                                                const x1 = 100 + 85 * Math.cos((startAngle * Math.PI) / 180);
                                                const y1 = 100 + 85 * Math.sin((startAngle * Math.PI) / 180);
                                                const x2 = 100 + 85 * Math.cos((endAngle * Math.PI) / 180);
                                                const y2 = 100 + 85 * Math.sin((endAngle * Math.PI) / 180);
                                                const largeArcFlag = slice > 180 ? 1 : 0;
                                                const textAngle = startAngle + slice / 2;
                                                const textX = 100 + 65 * Math.cos((textAngle * Math.PI) / 180);
                                                const textY = 100 + 65 * Math.sin((textAngle * Math.PI) / 180);
                                                const isSelected = selectedMoodId === mood.id;

                                                return (
                                                    <g key={`${mood.id}-${i}`}>
                                                        <path
                                                            d={`M100 100 L ${x1} ${y1} A 85 85 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                                                            fill={`url(#gradient-${i})`}
                                                            stroke="rgba(255,255,255,0.1)"
                                                            strokeWidth={1}
                                                            className="cursor-pointer transition-all duration-300"
                                                            onClick={() => {
                                                                setSelectedMoodId(mood.id);
                                                                setSelectedMoodName(mood.name);
                                                            }}
                                                            style={{
                                                                filter: isSelected ? 'brightness(1.3)' : 'brightness(1)',
                                                            }}
                                                        />
                                                        <text
                                                            x={textX}
                                                            y={textY}
                                                            textAnchor="middle"
                                                            dominantBaseline="middle"
                                                            fill="white"
                                                            fontSize="9"
                                                            fontWeight="700"
                                                            transform={`rotate(${textAngle > 90 && textAngle < 270 ? textAngle + 180 : textAngle}, ${textX}, ${textY})`}
                                                            className="pointer-events-none select-none"
                                                            style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
                                                        >
                                                            {mood.name}
                                                        </text>
                                                    </g>
                                                );
                                            })}
                                        </svg>

                                        {/* Center Hub */}
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-r from-orange-500 to-red-500 shadow-xl flex items-center justify-center border-2 border-white/30">
                                            <motion.div
                                                animate={isSpinning ? { rotate: -360 } : { rotate: 0 }}
                                                transition={{ repeat: isSpinning ? Infinity : 0, duration: 1, ease: "linear" }}
                                            >
                                                <Sparkles size={20} className="text-white" />
                                            </motion.div>
                                        </div>
                                    </motion.div>

                                    {/* Fixed Pointer - Top Position */}
                                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20">
                                        <div className="flex flex-col items-center">
                                            <div className="w-0 h-0 border-l-3 border-r-3 border-b-6 border-l-transparent border-r-transparent border-b-white shadow-lg"></div>
                                            <div className="w-2 h-2 bg-white rounded-full shadow-lg"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Spin Button */}
                            <button
                                onClick={randomizeMood}
                                disabled={isSpinning}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <motion.div
                                        animate={isSpinning ? { rotate: 360 } : { rotate: 0 }}
                                        transition={{ repeat: isSpinning ? Infinity : 0, duration: 1, ease: "linear" }}
                                    >
                                        <Shuffle size={20} />
                                    </motion.div>
                                    <span>{isSpinning ? "Spinning..." : "Spin the Wheel"}</span>
                                </div>
                            </button>
                        </div>

                        {/* Right: Enhanced Recommendations */}
                        <div className="lg:col-span-3">
                            <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl p-4 border border-gray-700/50">
                                {/* Header with Actions */}
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-semibold text-white">Recommendations</h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => selectedMoodId && fetchRecommendationsForMood(selectedMoodId, true, recommendations.length || 6)}
                                            disabled={loadingRecs}
                                            className="p-2 bg-blue-600/20 hover:bg-blue-600/40 rounded-lg border border-blue-500/30 text-blue-400 transition-all duration-200 disabled:opacity-50"
                                            title="Refresh recommendations"
                                        >
                                            <motion.div
                                                animate={loadingRecs ? { rotate: 360 } : { rotate: 0 }}
                                                transition={{ repeat: loadingRecs ? Infinity : 0, duration: 1, ease: "linear" }}
                                            >
                                                <Shuffle size={14} />
                                            </motion.div>
                                        </button>
                                    </div>
                                </div>

                                {/* Stats Bar */}
                                {recommendations.length > 0 && (
                                    <div className="bg-gray-700/30 rounded-xl p-3 mb-4 border border-gray-600/30">
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                            <div>
                                                <div className="text-lg font-bold text-blue-400">
                                                    {recommendations.filter(r => r.type === 'movie').length}
                                                </div>
                                                <div className="text-xs text-gray-400">Movies</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-bold text-purple-400">
                                                    {recommendations.filter(r => r.type === 'tv').length}
                                                </div>
                                                <div className="text-xs text-gray-400">TV Shows</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-bold text-yellow-400">
                                                    {recommendations.filter(r => r.voteAverage && r.voteAverage > 0).length > 0
                                                        ? (recommendations.filter(r => r.voteAverage && r.voteAverage > 0)
                                                            .reduce((sum, r) => sum + Number(r.voteAverage), 0) /
                                                            recommendations.filter(r => r.voteAverage && r.voteAverage > 0).length).toFixed(1)
                                                        : '0.0'}
                                                </div>
                                                <div className="text-xs text-gray-400">Avg Rating</div>
                                            </div>
                                        </div>

                                        {/* Quality Bar */}
                                        <div className="mt-3 space-y-1">
                                            <div className="flex justify-between text-xs text-gray-400">
                                                <span>Content Quality</span>
                                                <span>{recommendations.filter(r => r.voteAverage && r.voteAverage >= 7).length}/{recommendations.length} High-Rated</span>
                                            </div>
                                            <div className="w-full bg-gray-600/50 rounded-full h-1.5">
                                                <div
                                                    className="bg-gradient-to-r from-green-500 to-blue-500 h-1.5 rounded-full transition-all duration-500"
                                                    style={{
                                                        width: `${recommendations.length > 0 ? (recommendations.filter(r => r.voteAverage && r.voteAverage >= 7).length / recommendations.length) * 100 : 0}%`
                                                    }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {loadingRecs ? (
                                    <div className="space-y-4">
                                        {Array.from({ length: 4 }).map((_, i) => (
                                            <div key={i} className="flex gap-3 animate-pulse">
                                                <div className="w-12 h-16 bg-gray-700 rounded" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-3 bg-gray-700 rounded w-3/4" />
                                                    <div className="h-2 bg-gray-700 rounded w-1/2" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : recError ? (
                                    <div className="text-center py-8">
                                        <p className="text-red-400 mb-4">{recError}</p>
                                        <button
                                            onClick={() => selectedMoodId && fetchRecommendationsForMood(selectedMoodId, true, 6)}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                ) : recommendations.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400">
                                        <div className="mb-4">
                                            <Sparkles size={32} className="mx-auto text-gray-500 mb-2" />
                                            <p>No recommendations found</p>
                                        </div>
                                        <button
                                            onClick={() => selectedMoodId && fetchRecommendationsForMood(selectedMoodId, true, 6)}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm"
                                        >
                                            Generate Suggestions
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {/* Recommendations List */}
                                        <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                                            <AnimatePresence mode="popLayout">
                                                {recommendations.map((rec, index) => (
                                                    <motion.div
                                                        key={rec.id}
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -20 }}
                                                        transition={{ duration: 0.3, delay: index * 0.03 }}
                                                        className="group cursor-pointer"
                                                        onClick={() => {
                                                            const tmdbUrl = `/${rec.type === "tv" ? "tv" : "movies"}/${rec.id}`;
                                                            window.open(tmdbUrl, "_blank");
                                                        }}
                                                    >
                                                        <div className="flex gap-3 bg-gray-700/30 rounded-xl p-3 border border-gray-600/30 hover:border-gray-500/50 hover:bg-gray-600/40 transition-all duration-300 relative overflow-hidden">
                                                            {/* Quality indicator */}
                                                            {rec.voteAverage && rec.voteAverage >= 8 && (
                                                                <div className="absolute top-2 right-2 bg-yellow-500/20 text-yellow-400 text-xs px-1.5 py-0.5 rounded-full border border-yellow-500/30">
                                                                    TOP
                                                                </div>
                                                            )}

                                                            <div className="relative w-18 aspect-[2/3] bg-gray-600 rounded overflow-hidden flex-shrink-0">
                                                                {rec.posterPath ? (
                                                                    <Image
                                                                        src={`https://image.tmdb.org/t/p/w154${rec.posterPath}`}
                                                                        alt={rec.title}
                                                                        fill
                                                                        className="object-cover group-hover:scale-110 transition-transform duration-300"
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                                        <Play size={12} />
                                                                    </div>
                                                                )}

                                                                {/* Type badge */}
                                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                                                                    {rec.type === "tv" ?
                                                                        <Tv size={8} className="text-white/80" /> :
                                                                        <Film size={8} className="text-white/80" />
                                                                    }
                                                                </div>
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-medium text-white text-sm line-clamp-2 mb-1 group-hover:text-blue-300 transition-colors">
                                                                    {rec.title}
                                                                </h4>

                                                                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                                                                    <span>{rec.releaseDate ? new Date(rec.releaseDate).getFullYear() : 'N/A'}</span>
                                                                    {rec.voteAverage && rec.voteAverage > 0 && (
                                                                        <div className="flex items-center gap-1">
                                                                            <Star size={10} className="text-yellow-400 fill-current" />
                                                                            <span className="font-medium">{Number(rec.voteAverage).toFixed(1)}</span>
                                                                        </div>
                                                                    )}
                                                                    {rec.voteCount && rec.voteCount > 1000 && (
                                                                        <div className="flex items-center gap-1">
                                                                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                                                                            <span className="text-green-400">Popular</span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                                                                    {rec.overview || "No description available"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                        </div>

                                        {/* Load More Button */}
                                        <div className="mt-4 text-center">
                                            <button
                                                onClick={() => selectedMoodId && fetchRecommendationsForMood(selectedMoodId, true, Math.min(recommendations.length + 6, 20))}
                                                disabled={loadingRecs || recommendations.length >= 20}
                                                className="w-full px-4 py-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/40 hover:to-purple-600/40 border border-blue-500/30 hover:border-blue-400/50 rounded-lg text-blue-300 font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                            >
                                                {recommendations.length >= 20 ?
                                                    "Maximum recommendations reached" :
                                                    `Load More (${recommendations.length}/20)`
                                                }
                                            </button>
                                        </div>

                                        {/* Mood Match Indicator */}
                                        {selectedMood && (
                                            <div className="mt-4 p-3 bg-gray-700/20 rounded-lg border border-gray-600/20">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div style={{ color: selectedMood.color }}>
                                                        {moodIcon(selectedMood.name, 16)}
                                                    </div>
                                                    <span className="text-sm font-medium text-white">
                                                        {selectedMood.name} Mood Match
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    Recommendations tailored for your current mood and preferences
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}