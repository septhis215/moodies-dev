'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star, Plus, Info, Share2, Sparkles, RefreshCw } from 'lucide-react';
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
        <section className="relative">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <Sparkles className="w-8 h-8 text-purple-400" />
                    <h2 className="text-3xl sm:text-4xl font-black">Discover by Mood</h2>
                </div>
                {selectedMood && (
                    <button
                        onClick={handleRefresh}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/40 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="text-sm font-semibold">Refresh</span>
                    </button>
                )}
            </div>

            {/* Mood Selection */}
            <div className="mb-8">
                <p className="text-gray-400 mb-4">How are you feeling today?</p>
                <div className="flex flex-wrap gap-3">
                    {moods.map((mood) => (
                        <button
                            key={mood.id}
                            onClick={() => handleMoodClick(mood)}
                            className={`group relative px-5 py-3 rounded-xl font-semibold transition-all ${selectedMood?.id === mood.id
                                ? 'ring-2 scale-105 shadow-lg'
                                : 'hover:scale-105'
                                }`}
                            style={{
                                backgroundColor: selectedMood?.id === mood.id ? mood.color + '40' : mood.color + '20',
                                borderColor: mood.color + '60',
                                borderWidth: '1px',
                                color: selectedMood?.id === mood.id ? '#fff' : mood.color,
                            }}
                        >
                            <span className="mr-2">{getIconEmoji(mood.icon)}</span>
                            {mood.name}

                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                {mood.description}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Recommendations Display */}
            <AnimatePresence mode="wait">
                {selectedMood && (
                    <motion.div
                        key={selectedMood.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                                    <p className="text-gray-400">Finding perfect matches for your {selectedMood.name.toLowerCase()} mood...</p>
                                </div>
                            </div>
                        ) : error ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="text-center">
                                    <p className="text-red-400 mb-4">{error}</p>
                                    <button
                                        onClick={handleRefresh}
                                        className="px-6 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg font-semibold transition"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            </div>
                        ) : recommendations.length > 0 ? (
                            <>
                                <div className="mb-6 p-4 bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-xl">
                                    <p className="text-sm text-gray-300">
                                        <span className="font-bold" style={{ color: selectedMood.color }}>
                                            {selectedMood.name}
                                        </span>
                                        {' '}- {selectedMood.description}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {recommendations.map((rec) => (
                                        <div key={rec.id} className="group relative">
                                            <Link href={`/${rec.mediaType.toLowerCase()}/${rec.tmdbId}`}>
                                                <div className="block">
                                                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-zinc-900 shadow-md mb-2">
                                                        {rec.posterPath && (
                                                            <Image
                                                                src={getPosterUrl(rec.posterPath)}
                                                                alt={rec.title}
                                                                fill
                                                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                            />
                                                        )}

                                                        {/* Rating Badge */}
                                                        <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded-md font-bold text-[11px] flex items-center gap-1">
                                                            <Star className="w-3 h-3 text-yellow-400" />
                                                            {rec.voteAverage.toFixed(1)}
                                                        </div>

                                                        {/* Match Score */}
                                                        <div
                                                            className="absolute top-2 left-2 px-2 py-1 rounded-md font-bold text-[10px] backdrop-blur-sm"
                                                            style={{
                                                                backgroundColor: selectedMood.color + '80',
                                                                color: '#fff',
                                                            }}
                                                        >
                                                            {Math.round(rec.score * 100)}% Match
                                                        </div>

                                                        {/* Hover Overlay */}
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                            <div className="absolute bottom-0 left-0 right-0 p-3">
                                                                <div className="flex justify-center gap-2 mb-2">
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); }}
                                                                        className="w-8 h-8 bg-white/95 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                                                                    >
                                                                        <Plus className="w-4 h-4 text-black" />
                                                                    </button>
                                                                    <button
                                                                        className="w-8 h-8 bg-white/95 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                                                                    >
                                                                        <Info className="w-4 h-4 text-black" />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); }}
                                                                        className="w-8 h-8 bg-white/95 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                                                                    >
                                                                        <Share2 className="w-4 h-4 text-black" />
                                                                    </button>
                                                                </div>
                                                                <p className="text-[10px] text-center text-gray-300 line-clamp-2">
                                                                    {rec.reason}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <h4 className="font-semibold text-xs sm:text-sm line-clamp-2 leading-tight mb-1">
                                                        {rec.title}
                                                    </h4>

                                                    {rec.genreNames && rec.genreNames.length > 0 && (
                                                        <p className="text-[10px] text-gray-400 line-clamp-1">
                                                            {rec.genreNames.slice(0, 2).join(', ')}
                                                        </p>
                                                    )}
                                                </div>
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center py-20">
                                <p className="text-gray-400">No recommendations found for this mood. Try another!</p>
                            </div>
                        )}
                    </motion.div>
                )}

                {!selectedMood && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-20 text-center"
                    >
                        <Sparkles className="w-16 h-16 text-purple-400 mb-4" />
                        <h3 className="text-2xl font-bold mb-2">Select a mood to get started</h3>
                        <p className="text-gray-400 max-w-md">
                            Choose how you're feeling and we'll recommend the perfect movies and TV shows to match your vibe
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}