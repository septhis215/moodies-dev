"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronRight, Film, Tv, Heart, Star, Zap, Coffee, Trophy, X, Info, ArrowLeft, Award, TrendingUp, Clock, Flame, ExternalLink, Bookmark, Play } from 'lucide-react';
import questionsData from '@/data/questions.json';
import { RatingBadge } from '@/components/ui/rating-badge';

interface QuizOption {
    text: string;
    genres: string[];
    mood: string;
    mediaType?: string;
}

interface Question {
    id: number;
    question: string;
    options: QuizOption[];
}

interface MovieItem {
    id: number;
    title?: string;
    name?: string;
    poster_path: string;
    backdrop_path: string;
    vote_average: number;
    release_date?: string;
    first_air_date?: string;
    vote_count: number;
    popularity: number;
    media_type?: string;
    tagline?: string;
    runtime?: number;
    status?: string;
    episode_run_time?: number[];
    original_language?: string;
    overview?: string;
    genre_ids?: number[];
}

interface RecommendationData {
    results: MovieItem[];
    analysis: {
        topGenres: string[];
        topMoods: string[];
        preferredMediaType: string | null;
    };
}

const QUESTION_POOL = questionsData.questions;

const GENRE_NAMES: { [key: number]: string } = {
    28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
    99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
    27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
    10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
    10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
    10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

const MOOD_DESCRIPTORS: { [key: string]: string } = {
    'relaxing': 'unwinding',
    'exciting': 'thrilling',
    'thoughtful': 'contemplative',
    'fun': 'entertaining',
    'intense': 'gripping',
    'emotional': 'moving',
    'lighthearted': 'fun',
    'serious': 'thought-provoking'
};

export default function MovieQuizPage() {
    const [stage, setStage] = useState<'welcome' | 'quiz' | 'loading' | 'results'>('welcome');
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<QuizOption[]>([]);
    const [recommendations, setRecommendations] = useState<MovieItem[]>([]);
    const [analysis, setAnalysis] = useState<RecommendationData['analysis'] | null>(null);
    const [selectedMovie, setSelectedMovie] = useState<MovieItem | null>(null);

    const startQuiz = () => {
        const shuffled = [...QUESTION_POOL].sort(() => Math.random() - 0.5);
        setSelectedQuestions(shuffled.slice(0, 5));
        setAnswers([]);
        setCurrentQuestion(0);
        setStage('quiz');
    };

    const handleAnswer = (option: QuizOption) => {
        const newAnswers = [...answers, option];
        setAnswers(newAnswers);

        if (currentQuestion < selectedQuestions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
        } else {
            fetchRecommendations(newAnswers);
        }
    };

    const fetchRecommendations = async (userAnswers: QuizOption[]) => {
        setStage('loading');

        try {
            const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

            const response = await fetch(`${base}/quiz/recommendations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    answers: userAnswers,
                }),
            });

            const data: RecommendationData = await response.json();

            if (data.results && data.results.length > 0) {
                setRecommendations(data.results.slice(0, 12));
                setAnalysis(data.analysis);
            } else {
                setRecommendations([]);
                setAnalysis(null);
            }

            setStage('results');
        } catch (error) {
            console.error('Error fetching recommendations:', error);
            setStage('results');
            setRecommendations([]);
        }
    };
    const getDetailUrl = (m) =>
        m ? (m.media_type === "tv" ? `/tv/${m.id}` : `/movies/${m.id}`) : "#";

    const resetQuiz = () => {
        setStage('welcome');
        setCurrentQuestion(0);
        setAnswers([]);
        setRecommendations([]);
        setAnalysis(null);
        setSelectedMovie(null);
    };
    const modalRef = useRef(null);
    const firstFocusableRef = useRef(null);

    useEffect(() => {
        if (!selectedMovie) return;

        // put focus on the close button (or firstFocusableRef)
        firstFocusableRef.current?.focus();

        function onKey(e) {
            if (e.key === "Escape") setSelectedMovie(null);
            if (e.key === "Tab" && modalRef.current) {
                // simple focus trap: cycle focus inside modal
                const focusable = modalRef.current.querySelectorAll(
                    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
                );
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }

        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [selectedMovie]);
    const getPersonalizationReasons = (item: MovieItem) => {
        if (!analysis) return [];

        const reasons: Array<{ icon: any; text: string; priority: number }> = [];
        const itemGenres = item.genre_ids?.map(id => GENRE_NAMES[id]).filter(Boolean) || [];

        // Genre matching with more specific messages
        const matchedGenres = analysis.topGenres.filter(g =>
            itemGenres.some(ig => ig?.toLowerCase().includes(g.toLowerCase()))
        );

        if (matchedGenres.length >= 2) {
            reasons.push({
                icon: Star,
                text: `Perfect blend of ${matchedGenres.slice(0, 2).join(' and ')} - exactly your taste`,
                priority: 10
            });
        } else if (matchedGenres.length === 1) {
            reasons.push({
                icon: Heart,
                text: `Nails the ${matchedGenres[0]} vibe you're craving`,
                priority: 8
            });
        }

        // Mood alignment
        if (analysis.topMoods.length > 0) {
            const mood = analysis.topMoods[0];
            const descriptor = MOOD_DESCRIPTORS[mood.toLowerCase()] || mood;
            reasons.push({
                icon: Sparkles,
                text: `Matches your ${descriptor} mood perfectly`,
                priority: 7
            });
        }

        // Rating quality indicators
        if (item.vote_average >= 8.0) {
            reasons.push({
                icon: Award,
                text: `Critically acclaimed with ${item.vote_average.toFixed(1)}/10 - a must-watch`,
                priority: 9
            });
        } else if (item.vote_average >= 7.5) {
            reasons.push({
                icon: TrendingUp,
                text: `Highly rated by viewers like you (${item.vote_average.toFixed(1)}/10)`,
                priority: 6
            });
        }

        // Popularity insights
        if (item.popularity && item.popularity > 100) {
            reasons.push({
                icon: Flame,
                text: 'Trending now - everyone\'s talking about this',
                priority: 5
            });
        }

        // Recent content
        const releaseYear = item.release_date?.split('-')[0] || item.first_air_date?.split('-')[0];
        if (releaseYear && parseInt(releaseYear) >= 2023) {
            reasons.push({
                icon: Clock,
                text: `Fresh ${releaseYear} release - cutting-edge storytelling`,
                priority: 4
            });
        }

        // Media type preference
        if (analysis.preferredMediaType) {
            const isTV = item.media_type === 'tv';
            const preference = analysis.preferredMediaType.toLowerCase();
            if ((isTV && preference.includes('tv')) || (!isTV && preference.includes('movie'))) {
                reasons.push({
                    icon: Tv,
                    text: isTV ? 'Perfect for a series binge session' : 'Great standalone movie experience',
                    priority: 6
                });
            }
        }

        // Multi-genre fusion
        if (itemGenres.length >= 3) {
            reasons.push({
                icon: Zap,
                text: `Unique fusion of ${itemGenres.slice(0, 2).join(', ')} and more`,
                priority: 5
            });
        }

        // Vote count reliability
        if (item.vote_count && item.vote_count > 5000 && item.vote_average >= 7.0) {
            reasons.push({
                icon: Trophy,
                text: `Proven favorite with ${(item.vote_count / 1000).toFixed(1)}K+ ratings`,
                priority: 4
            });
        }

        // Sort by priority and return top 3
        return reasons
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 3);
    };

    const getIconForOption = (index: number) => {
        const icons = [Heart, Star, Zap, Coffee];
        const Icon = icons[index % icons.length];
        return <Icon className="w-4 h-4" />;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 flex items-center justify-center p-18 sm:p-22 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.03, 0.06, 0.03],
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-[#e94f37]/20 to-transparent rounded-full blur-3xl"
                />
                <motion.div
                    animate={{
                        scale: [1.2, 1, 1.2],
                        opacity: [0.03, 0.06, 0.03],
                    }}
                    transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 1
                    }}
                    className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-[#ff6b58]/20 to-transparent rounded-full blur-3xl"
                />
            </div>

            <AnimatePresence mode="wait">
                {/* Welcome Stage */}
                {stage === 'welcome' && (
                    <motion.div
                        key="welcome"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="max-w-xl w-full relative z-10"
                    >
                        <div className="bg-gradient-to-b from-zinc-900/90 to-zinc-900/70 backdrop-blur-2xl rounded-3xl p-8 sm:p-10 border border-zinc-800/50 shadow-2xl relative overflow-hidden">
                            {/* Decorative gradient */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#e94f37] to-transparent opacity-50" />

                            <motion.div
                                initial={{ y: -20 }}
                                animate={{ y: 0 }}
                                className="flex justify-center mb-6"
                            >
                                <motion.div
                                    animate={{
                                        boxShadow: [
                                            "0 0 20px rgba(233, 79, 55, 0.3)",
                                            "0 0 40px rgba(233, 79, 55, 0.5)",
                                            "0 0 20px rgba(233, 79, 55, 0.3)"
                                        ]
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#e94f37] via-[#ff6b58] to-[#e94f37] flex items-center justify-center"
                                >
                                    <Sparkles className="w-8 h-8 text-white" />
                                </motion.div>
                            </motion.div>

                            <h1 className="text-3xl sm:text-4xl font-bold text-center mb-4 bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent leading-tight">
                                Discover Your Perfect Watch
                            </h1>
                            <p className="text-zinc-400 text-center text-base mb-6">
                                Answer 5 quick questions and get AI-powered recommendations tailored just for you
                            </p>

                            <div className="grid grid-cols-4 gap-4 mb-8">
                                {[
                                    { icon: Film, label: 'Movies', color: 'from-blue-500/20 to-blue-600/20' },
                                    { icon: Tv, label: 'TV Shows', color: 'from-purple-500/20 to-purple-600/20' },
                                    { icon: Star, label: 'Top Rated', color: 'from-yellow-500/20 to-yellow-600/20' },
                                    { icon: Sparkles, label: 'Personal', color: 'from-[#e94f37]/20 to-[#ff6b58]/20' }
                                ].map((item, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        whileHover={{ scale: 1.05, y: -2 }}
                                        className={`bg-gradient-to-br ${item.color} rounded-xl p-4 border border-zinc-700/50 flex flex-col items-center gap-2 backdrop-blur-sm`}
                                    >
                                        <item.icon className="w-6 h-6 text-white" />
                                        <span className="text-zinc-300 text-xs font-medium text-center">{item.label}</span>
                                    </motion.div>
                                ))}
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02, boxShadow: "0 20px 40px rgba(233, 79, 55, 0.4)" }}
                                whileTap={{ scale: 0.98 }}
                                onClick={startQuiz}
                                className="w-full bg-gradient-to-r from-[#e94f37] via-[#ff6b58] to-[#e94f37] text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-[#e94f37]/30 flex items-center justify-center gap-2 hover:shadow-[#e94f37]/50 transition-all relative overflow-hidden group"
                            >
                                <motion.div
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                    animate={{
                                        x: ['-200%', '200%']
                                    }}
                                    transition={{
                                        duration: 3,
                                        repeat: Infinity,
                                        ease: "linear"
                                    }}
                                />
                                <span className="relative z-10">Start Your Journey</span>
                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform relative z-10" />
                            </motion.button>
                        </div>
                    </motion.div>
                )}

                {/* Quiz Stage */}
                {stage === 'quiz' && selectedQuestions[currentQuestion] && (
                    <motion.div
                        key={`quiz-${currentQuestion}`}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        className="max-w-2xl w-full relative z-10"
                    >
                        <div className="bg-gradient-to-b from-zinc-900/90 to-zinc-900/70 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 border border-zinc-800/50 shadow-2xl">
                            {/* Progress */}
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-zinc-400 text-sm font-medium">
                                        Question {currentQuestion + 1} of {selectedQuestions.length}
                                    </span>
                                    <motion.span
                                        key={currentQuestion}
                                        initial={{ scale: 1.2, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="text-[#e94f37] text-sm font-bold px-3 py-1 bg-[#e94f37]/10 rounded-full"
                                    >
                                        {Math.round(((currentQuestion + 1) / selectedQuestions.length) * 100)}%
                                    </motion.span>
                                </div>
                                <div className="h-2 bg-zinc-800/50 rounded-full overflow-hidden backdrop-blur-sm">
                                    <motion.div
                                        initial={{ width: `${(currentQuestion / selectedQuestions.length) * 100}%` }}
                                        animate={{ width: `${((currentQuestion + 1) / selectedQuestions.length) * 100}%` }}
                                        className="h-full bg-gradient-to-r from-[#e94f37] via-[#ff6b58] to-[#e94f37] rounded-full relative overflow-hidden"
                                        transition={{ duration: 0.5, ease: "easeOut" }}
                                    >
                                        <motion.div
                                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                            animate={{
                                                x: ['-100%', '200%']
                                            }}
                                            transition={{
                                                duration: 1.5,
                                                repeat: Infinity,
                                                ease: "linear"
                                            }}
                                        />
                                    </motion.div>
                                </div>
                            </div>

                            {/* Question */}
                            <motion.h2
                                key={selectedQuestions[currentQuestion].id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-2xl sm:text-3xl font-bold text-white mb-6 text-center leading-tight"
                            >
                                {selectedQuestions[currentQuestion].question}
                            </motion.h2>

                            {/* Options */}
                            <div className="space-y-3">
                                {selectedQuestions[currentQuestion].options.map((option, idx) => (
                                    <motion.button
                                        key={idx}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.08 }}
                                        whileHover={{ scale: 1.02, x: 8 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleAnswer(option)}
                                        className="w-full bg-gradient-to-r from-zinc-800/40 to-zinc-800/20 hover:from-zinc-800/70 hover:to-zinc-800/50 border border-zinc-700/30 hover:border-[#e94f37]/50 rounded-xl p-3 text-left transition-all group relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-[#e94f37]/0 via-[#e94f37]/5 to-[#e94f37]/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className="flex items-center gap-4 relative z-10">
                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#e94f37]/70 to-[#ff6b58]/50 group-hover:from-[#e94f37] group-hover:to-[#ff6b58] flex items-center justify-center transition-all shadow-lg">
                                                {getIconForOption(idx)}
                                            </div>
                                            <span className="text-zinc-200 group-hover:text-white font-medium text-base sm:text-lg transition-colors flex-1">
                                                {option.text}
                                            </span>
                                            <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-[#e94f37] opacity-0 group-hover:opacity-100 transition-all" />
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Loading Stage */}
                {stage === 'loading' && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center relative z-10"
                    >
                        <motion.div
                            animate={{
                                rotate: 360,
                                scale: [1, 1.1, 1]
                            }}
                            transition={{
                                rotate: { duration: 2, repeat: Infinity, ease: 'linear' },
                                scale: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                            }}
                            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#e94f37] via-[#ff6b58] to-[#e94f37] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-[#e94f37]/50"
                        >
                            <Sparkles className="w-10 h-10 text-white" />
                        </motion.div>
                        <motion.h2
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="text-3xl font-bold text-white mb-3"
                        >
                            Analyzing Your Taste...
                        </motion.h2>
                        <p className="text-zinc-400">Curating personalized recommendations</p>
                    </motion.div>
                )}

                {/* Results Stage */}
                {stage === 'results' && (
                    <motion.div
                        key="results"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="max-w-7xl w-full relative z-10"
                    >
                        <div className="bg-gradient-to-b from-zinc-900/90 to-zinc-900/70 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 border border-zinc-800/50 shadow-2xl">
                            {/* Header */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#e94f37] to-[#ff6b58] flex items-center justify-center shadow-lg shadow-[#e94f37]/30">
                                        <Trophy className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-1">Your Perfect Matches</h2>
                                        <p className="text-zinc-400">Handpicked based on your preferences</p>
                                    </div>
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={resetQuiz}
                                    className="bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 px-5 py-2.5 rounded-xl text-white font-medium transition-all flex items-center gap-2 shadow-lg"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Retake Quiz
                                </motion.button>
                            </div>

                            {/* Personalization Summary */}
                            {analysis && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-gradient-to-r from-[#e94f37]/10 via-[#ff6b58]/10 to-[#e94f37]/10 rounded-2xl p-5 border border-[#e94f37]/20 mb-6 relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#e94f37]/5 to-transparent opacity-50" />
                                    <div className="relative z-10">
                                        <div className="flex items-start gap-3 mb-3">
                                            <Sparkles className="w-5 h-5 text-[#e94f37] flex-shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <h3 className="text-white font-bold text-lg mb-3">Your Viewing Profile</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {analysis.topGenres.map((genre, idx) => (
                                                        <motion.span
                                                            key={idx}
                                                            initial={{ opacity: 0, scale: 0.8 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            transition={{ delay: idx * 0.1 }}
                                                            className="px-4 py-2 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white text-sm rounded-full font-semibold shadow-lg"
                                                        >
                                                            {genre.charAt(0).toUpperCase() + genre.slice(1)}
                                                        </motion.span>
                                                    ))}
                                                    {analysis.topMoods.slice(0, 2).map((mood, idx) => (
                                                        <motion.span
                                                            key={idx}
                                                            initial={{ opacity: 0, scale: 0.8 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            transition={{ delay: (analysis.topGenres.length + idx) * 0.1 }}
                                                            className="px-4 py-2 bg-zinc-700/70 backdrop-blur-sm text-zinc-100 text-sm rounded-full font-semibold"
                                                        >
                                                            {mood.charAt(0).toUpperCase() + mood.slice(1)}
                                                        </motion.span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {recommendations.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                                    {recommendations.map((item, idx) => (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: idx * 0.05 }}
                                            whileHover={{ scale: 1.05, y: -8 }}
                                            className="group cursor-pointer"
                                            onClick={() => setSelectedMovie(item)}
                                        >
                                            <div className="relative rounded-xl overflow-hidden shadow-xl border border-zinc-800/50 group-hover:border-[#e94f37]/60 transition-all group-hover:shadow-2xl group-hover:shadow-[#e94f37]/20">
                                                <img
                                                    src={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '/placeholder.png'}
                                                    alt={item.title || item.name}
                                                    className="w-full aspect-[2/3] object-cover"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="absolute bottom-0 left-0 right-0 p-3">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <RatingBadge rating={item.vote_average} variant="colored" size="sm" />
                                                            {item.media_type && (
                                                                <span className="px-2 py-1 bg-zinc-900/90 backdrop-blur-sm text-zinc-200 text-xs rounded-lg font-medium">
                                                                    {item.media_type === 'tv' ? 'TV' : 'Movie'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h3 className="text-white font-bold text-sm line-clamp-2 leading-tight">
                                                            {item.title || item.name}
                                                        </h3>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-16">
                                    <div className="w-16 h-16 rounded-xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
                                        <Film className="w-8 h-8 text-zinc-400" />
                                    </div>
                                    <h3 className="text-white text-xl font-bold mb-2">No recommendations found</h3>
                                    <p className="text-zinc-400 mb-6">Try retaking the quiz with different preferences</p>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={resetQuiz}
                                        className="bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white font-semibold px-8 py-3 rounded-xl shadow-lg shadow-[#e94f37]/30"
                                    >
                                        Retake Quiz
                                    </motion.button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Movie Detail Modal (improved) */}
            <AnimatePresence>
                {selectedMovie && (
                    <motion.div
                        key="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}
                        onClick={() => setSelectedMovie(null)}
                        aria-hidden={false}
                    >
                        {/* modal content wrapper */}
                        <motion.div
                            key="modal"
                            initial={{ opacity: 0, y: 18, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 18, scale: 0.98 }}
                            transition={{ type: "spring", stiffness: 320, damping: 30 }}
                            className="relative flex flex-col w-full max-w-4xl max-h-[92vh] bg-zinc-900/95 rounded-3xl border border-zinc-800/50 shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="movie-title"
                            aria-describedby="movie-overview"
                            ref={(node) => (modalRef.current = node)}
                            tabIndex={-1}
                        >
                            {/* Top hero/backdrop */}
                            <div className="relative">


                                {/* Close button */}
                                <button
                                    ref={firstFocusableRef}
                                    onClick={() => setSelectedMovie(null)}
                                    className="absolute top-4 right-4 z-20 w-10 h-10 rounded-xl bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/80 transition-all border border-zinc-700/50"
                                    aria-label="Close dialog"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Scrollable content */}
                            <div className="p-6 sm:p-8 pb-28 overflow-y-auto flex-1">
                                <div className="flex gap-6 items-start">
                                    {/* Poster */}
                                    {selectedMovie.poster_path && (
                                        <a
                                            href={getDetailUrl(selectedMovie)}
                                            onClick={(e) => e.stopPropagation()}
                                            title="Open details"
                                            className="block w-28 sm:w-36 rounded-xl overflow-hidden shadow-2xl flex-shrink-0 transform hover:scale-105 transition"
                                        >
                                            <motion.img
                                                initial={{ opacity: 0, scale: 0.98 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                src={`https://image.tmdb.org/t/p/w342${selectedMovie.poster_path}`}
                                                alt={selectedMovie.title || selectedMovie.name}
                                                className="w-full h-full object-cover"
                                                draggable={false}
                                            />
                                        </a>
                                    )}

                                    {/* Meta */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <a
                                                    href={getDetailUrl(selectedMovie)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="block"
                                                >
                                                    <h2 id="movie-title" className="text-2xl sm:text-3xl font-extrabold text-white leading-tight truncate hover:text-[#ff6b58]">
                                                        {selectedMovie.title || selectedMovie.name}
                                                    </h2>
                                                </a>

                                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                                    <RatingBadge rating={selectedMovie.vote_average} variant="minimal" size="sm" />

                                                    {(selectedMovie.release_date || selectedMovie.first_air_date) && (
                                                        <span className="text-zinc-300 text-sm font-medium px-3 py-1 bg-zinc-800/50 rounded-lg">
                                                            {(selectedMovie.release_date || selectedMovie.first_air_date)}
                                                        </span>
                                                    )}

                                                    <span className="px-3 py-1 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white text-sm rounded-lg font-semibold shadow-sm">
                                                        {selectedMovie.media_type === "tv" ? "TV Series" : "Movie"}
                                                    </span>
                                                </div>

                                                {/* Rating / popularity bar */}
                                                <div className="mt-3">
                                                    <div className="text-xs text-zinc-400 mb-1">Popularity & Rating</div>
                                                    <div className="w-full bg-zinc-800/50 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className="h-2 rounded-full"
                                                            style={{
                                                                width: `${Math.min((selectedMovie.vote_average || 0) * 10, 100)}%`,
                                                                background: "linear-gradient(90deg,#e94f37,#ff6b58)",
                                                            }}
                                                            aria-hidden
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* (space for other controls if you want) */}
                                        </div>

                                        {/* Genres */}
                                        {selectedMovie.genre_ids && selectedMovie.genre_ids.length > 0 && (
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {selectedMovie.genre_ids.slice(0, 6).map((g, i) => (
                                                    <span key={i} className="px-3 py-1 bg-zinc-800/60 backdrop-blur-sm text-zinc-200 text-xs rounded-full font-medium border border-zinc-700/50">
                                                        {GENRE_NAMES[g] || "—"}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                    </div>
                                </div>

                                {/* Personalized reasons */}
                                <motion.div
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-gradient-to-br from-[#e94f37]/6 via-[#ff6b58]/6 to-transparent border border-[#e94f37]/20 rounded-2xl p-4 my-6 relative"
                                >
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#e94f37] to-[#ff6b58] flex items-center justify-center">
                                            <Sparkles className="w-4 h-4 text-white" />
                                        </div>
                                        <h3 className="text-white font-bold text-sm">Why this matches you</h3>
                                    </div>

                                    <div className="space-y-2">
                                        {getPersonalizationReasons(selectedMovie).map((reason, idx) => {
                                            const Icon = reason.icon;
                                            return (
                                                <motion.div
                                                    key={idx}
                                                    initial={{ opacity: 0, x: -6 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: idx * 0.04 }}
                                                    className="flex items-start gap-3 p-3 bg-zinc-900/40 backdrop-blur-sm rounded-lg border border-zinc-800/50"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-[#e94f37]/10 flex items-center justify-center flex-shrink-0">
                                                        <Icon className="w-4 h-4 text-[#e94f37]" />
                                                    </div>
                                                    <p className="text-zinc-200 text-sm leading-tight">{reason.text}</p>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </motion.div>

                                {/* Overview block with metadata */}
                                {selectedMovie.overview && (
                                    <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-5 border border-zinc-800/50">
                                        <h3 className="text-white font-bold text-base mb-3 flex items-center gap-2">
                                            <Info className="w-4 h-4 text-[#e94f37]" />
                                            Overview
                                        </h3>
                                        <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">{selectedMovie.overview}</p>

                                        <div className="mt-4 text-zinc-400 text-sm flex flex-wrap gap-3">
                                            {selectedMovie.runtime && <span>⏱ {selectedMovie.runtime} min</span>}
                                            {selectedMovie.episode_run_time?.length > 0 && <span>⏱ {selectedMovie.episode_run_time[0]} min / ep</span>}
                                            {selectedMovie.original_language && <span>🌐 {selectedMovie.original_language.toUpperCase()}</span>}
                                            {selectedMovie.status && <span>📌 {selectedMovie.status}</span>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* optional sticky action bar — uncomment to enable */}
                            {/* <div className="absolute left-0 right-0 bottom-0 p-4 bg-gradient-to-t from-zinc-900/90 via-transparent to-transparent border-t border-zinc-800/40">
          ...actions...
        </div> */}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>


        </div>
    );
}