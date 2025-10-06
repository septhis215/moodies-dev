'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star, Plus, Info, Share2, Sparkles, RefreshCw, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getMoodRecommendations } from '@/app/tv/action';

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
    mediaType: 'MOVIE' | 'TV';
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
const BASE_URL = process.env.NEST_API_URL || 'http://localhost:4000';

export default function MoodRecommendationsSection({ moods, mediaType }: MoodRecommendationsSectionProps) {
    const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getPosterUrl = (path?: string) =>
        path ? `https://image.tmdb.org/t/p/w500${path}` : "/placeholder.jpg";

    const getIconEmoji = (iconName: string) => {
        const iconMap: Record<string, string> = {
            'smile': '😊',
            'zap': '⚡',
            'skull': '💀',
            'heart': '❤️',
            'wind': '🌊',
            'moon': '🌙',
            'crown': '👑',
            'star': '⭐',
            'clock': '⏰',
            'cloud-rain': '🌧️',
            'laugh': '😂',
            'book': '📚',
            'cloud': '☁️',
            'flag': '🇺🇸',
            'music': '🎵',
            'compass': '🧭',
            'sun': '☀️',
            'brain': '🧠',
            'shield': '🛡️',
            'rocket': '🚀',
            'cowboy': '🤠',
            'crosshair': '🎯',
            'mug-hot': '☕',
            'beaker': '🧪',
            'fist': '✊',
            'book-open': '📖',
        };
        return iconMap[iconName] || '🎬';
    };

    const fetchRecommendations = async (mood: Mood) => {
        setLoading(true);
        setError(null);

        try {
            const data = await getMoodRecommendations(mood.id, 12, mediaType);
            setRecommendations(data.recommendations || []);
        } catch (err) {
            setError('Failed to load recommendations. Please try again.');
            console.error('Error fetching recommendations:', err);
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

    return (
        <section className="relative overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-3xl animate-pulse delay-700" />
            </div>

            {/* Header */}
            <div className="relative mb-12">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-xl blur-lg opacity-50" />
                                <div className="relative bg-gradient-to-br from-violet-600 to-fuchsia-600 p-2.5 rounded-xl">
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
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
                            <RefreshCw className={`w-4 h-4 text-white ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                            <span className="text-sm font-bold text-white">New Picks</span>
                        </motion.button>
                    )}
                </div>
            </div>

            {/* Mood Selection - Redesigned as Cards */}
            <AnimatePresence mode="wait">
                {!selectedMood ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-12"
                    >
                        {moods.map((mood, index) => (
                            <motion.button
                                key={mood.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => handleMoodClick(mood)}
                                className="group relative p-6 rounded-2xl transition-all duration-300 hover:scale-105 hover:-translate-y-1"
                                style={{
                                    background: `linear-gradient(135deg, ${mood.color}20 0%, ${mood.color}05 100%)`,
                                    border: `2px solid ${mood.color}30`,
                                }}
                            >
                                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                    style={{
                                        background: `linear-gradient(135deg, ${mood.color}30 0%, ${mood.color}10 100%)`,
                                        boxShadow: `0 8px 32px ${mood.color}30`,
                                    }}
                                />

                                <div className="relative flex flex-col items-center text-center gap-3">
                                    <div className="text-4xl mb-1 transform group-hover:scale-110 transition-transform duration-300">
                                        {getIconEmoji(mood.icon)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-sm mb-1">
                                            {mood.name}
                                        </h3>
                                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                                            {mood.description}
                                        </p>
                                    </div>
                                    <ChevronRight
                                        className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                        style={{ color: mood.color }}
                                    />
                                </div>
                            </motion.button>
                        ))}
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mb-8"
                    >
                        {/* Selected Mood Bar */}
                        <div className="flex items-center justify-between p-4 rounded-2xl mb-8"
                            style={{
                                background: `linear-gradient(90deg, ${selectedMood.color}25 0%, ${selectedMood.color}10 100%)`,
                                border: `2px solid ${selectedMood.color}40`,
                            }}
                        >
                            <div className="flex items-center gap-4">
                                <div className="text-3xl">
                                    {getIconEmoji(selectedMood.icon)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">
                                        {selectedMood.name} Mode
                                    </h3>
                                    <p className="text-sm text-gray-300">
                                        {selectedMood.description}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedMood(null)}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-semibold transition-colors"
                            >
                                Change Mood
                            </button>
                        </div>

                        {/* Recommendations Grid */}
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-32">
                                <div className="relative mb-6">
                                    <div className="w-16 h-16 border-4 rounded-full animate-spin"
                                        style={{
                                            borderColor: `${selectedMood.color}30`,
                                            borderTopColor: selectedMood.color,
                                        }}
                                    />
                                    <div className="absolute inset-0 blur-xl opacity-50"
                                        style={{ backgroundColor: selectedMood.color }}
                                    />
                                </div>
                                <p className="text-xl font-semibold text-white mb-2">
                                    Curating your perfect matches
                                </p>
                                <p className="text-gray-400">
                                    Finding content that fits your {selectedMood.name.toLowerCase()} mood...
                                </p>
                            </div>
                        ) : error ? (
                            <div className="flex items-center justify-center py-32">
                                <div className="text-center max-w-md">
                                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="text-3xl">😕</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">Oops!</h3>
                                    <p className="text-gray-400 mb-6">{error}</p>
                                    <button
                                        onClick={handleRefresh}
                                        className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full font-bold text-white hover:shadow-lg hover:shadow-violet-500/50 transition-all"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            </div>
                        ) : recommendations.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                                {recommendations.map((rec, index) => (
                                    <motion.div
                                        key={rec.id}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <Link href={`/${rec.mediaType.toLowerCase()}/${rec.tmdbId}`}>
                                            <div className="group relative block">
                                                {/* Poster Container */}
                                                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 mb-3 shadow-xl">
                                                    {rec.posterPath && (
                                                        <Image
                                                            src={getPosterUrl(rec.posterPath)}
                                                            alt={rec.title}
                                                            fill
                                                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                                                        />
                                                    )}

                                                    {/* Gradient Overlay */}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />

                                                    {/* Match Score Badge */}
                                                    <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full backdrop-blur-md font-black text-xs shadow-lg"
                                                        style={{
                                                            background: `linear-gradient(135deg, ${selectedMood.color}F0 0%, ${selectedMood.color}CC 100%)`,
                                                            color: '#ffffff',
                                                        }}
                                                    >
                                                        {Math.round(rec.score * 100)}%
                                                    </div>

                                                    {/* Rating Badge */}
                                                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md font-bold text-xs flex items-center gap-1 shadow-lg">
                                                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                                        <span className="text-white">{rec.voteAverage && rec.voteAverage > 0 ? rec.voteAverage.toFixed(1) : "New"}</span>
                                                    </div>

                                                    {/* Hover Actions */}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                        <div className="absolute inset-0 flex flex-col justify-end p-4">
                                                            {/* Action Buttons */}
                                                            <div className="flex justify-center gap-2 mb-3">
                                                                <button
                                                                    onClick={(e) => { e.preventDefault(); }}
                                                                    className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                                                >
                                                                    <Plus className="w-5 h-5 text-black" />
                                                                </button>
                                                                <button
                                                                    className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                                                >
                                                                    <Info className="w-5 h-5 text-black" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.preventDefault(); }}
                                                                    className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                                                >
                                                                    <Share2 className="w-5 h-5 text-black" />
                                                                </button>
                                                            </div>
                                                            {/* Reason */}
                                                            <p className="text-xs text-center text-white font-medium line-clamp-2 leading-relaxed">
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
                                                            {rec.genreNames.slice(0, 2).join(' • ')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center py-32">
                                <div className="text-center">
                                    <div className="text-6xl mb-4">🎭</div>
                                    <h3 className="text-xl font-bold text-white mb-2">No matches found</h3>
                                    <p className="text-gray-400 mb-6">Try selecting a different mood</p>
                                    <button
                                        onClick={() => setSelectedMood(null)}
                                        className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full font-bold text-white hover:shadow-lg hover:shadow-violet-500/50 transition-all"
                                    >
                                        Choose Another Mood
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}