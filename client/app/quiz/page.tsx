"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import questionsData from "@/data/questions.json";
import { RatingBadge } from "@/components/ui/rating-badge";

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
    backdrop_path?: string;
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

type Stage = "welcome" | "quiz" | "loading" | "results";
type MatchReason = { mascot: string; text: string; priority: number };
type PersonalityInsight = {
    archetype: string;
    headline: string;
    summary: string;
    traits: string[];
    watchStyle: string;
    recommendationLogic: string;
    mascot: string;
};

const QUESTION_POOL = questionsData.questions as Question[];
const MASCOT_SRC = "/images/moodies-mascot.png";
const LOGO_SRC = "/images/moodies-transparent.png";
const TMDB_POSTER = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP = "https://image.tmdb.org/t/p/w780";

const GENRE_NAMES: Record<number, string> = {
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Science Fiction",
    10770: "TV Movie",
    53: "Thriller",
    10752: "War",
    37: "Western",
    10759: "Action & Adventure",
    10762: "Kids",
    10763: "News",
    10764: "Reality",
    10765: "Sci-Fi & Fantasy",
    10766: "Soap",
    10767: "Talk",
    10768: "War & Politics",
};

const MOOD_DESCRIPTORS: Record<string, string> = {
    relaxing: "unwinding",
    exciting: "thrilling",
    thoughtful: "contemplative",
    fun: "playful",
    intense: "gripping",
    emotional: "moving",
    lighthearted: "bright",
    serious: "thought-provoking",
    energetic: "high-energy",
    adventurous: "adventurous",
    epic: "epic",
    realistic: "grounded",
    thrilling: "tense",
};

const welcomeHighlights = [
    { mascot: "epic", label: "Movies", text: "Standalone picks" },
    { mascot: "cozy", label: "Series", text: "Binge-ready shows" },
    { mascot: "mind-bending", label: "Mood fit", text: "Vibe-aware scoring" },
];

const optionMascots = ["romantic", "epic", "mind-bending", "funny"];

const moodMascotMap: Record<string, string> = {
    adventurous: "epic",
    calm: "serenity",
    contemplative: "mind-bending",
    emotional: "bittersweet",
    energetic: "thrilling",
    epic: "epic",
    exciting: "thrilling",
    fun: "funny",
    lighthearted: "happy",
    realistic: "gritty",
    relaxed: "cozy",
    relaxing: "chill",
    serious: "dark",
    thoughtful: "mind-bending",
    thrilling: "thrilling",
};

const genreMascotMap: Record<string, string> = {
    action: "thrilling",
    adventure: "epic",
    animation: "whimsy",
    comedy: "funny",
    crime: "gritty",
    documentary: "documentary",
    drama: "bittersweet",
    family: "cozy",
    fantasy: "whimsy",
    horror: "horror",
    mystery: "mind-bending",
    romance: "romantic",
    "sci-fi": "sci-fi",
    thriller: "thrilling",
};

function getTitle(item: MovieItem) {
    return item.title || item.name || "Untitled";
}

function getPosterSrc(item: MovieItem) {
    return item.poster_path ? `${TMDB_POSTER}${item.poster_path}` : "/placeholder-poster.svg";
}

function getBackdropSrc(item?: MovieItem | null) {
    return item?.backdrop_path ? `${TMDB_BACKDROP}${item.backdrop_path}` : null;
}

function getDetailUrl(item?: MovieItem | null) {
    if (!item) return "#";
    return item.media_type === "tv" ? `/tv/${item.id}` : `/movies/${item.id}`;
}

function getYear(item: MovieItem) {
    const date = item.release_date || item.first_air_date;
    return date ? date.slice(0, 4) : "New";
}

function getMediaLabel(item: MovieItem) {
    return item.media_type === "tv" ? "Series" : "Movie";
}

function formatLabel(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function getGenreNames(item: MovieItem) {
    return (item.genre_ids ?? []).map((id) => GENRE_NAMES[id]).filter(Boolean);
}

function getMoodMascotSrc(name?: string | null) {
    const normalized = (name ?? "").toLowerCase().trim();
    const mascot = moodMascotMap[normalized] ?? genreMascotMap[normalized] ?? normalized;
    return mascot ? `/images/moods/${mascot}.png` : MASCOT_SRC;
}

function getOptionMascot(option: QuizOption, index: number) {
    return getMoodMascotSrc(option.mood || option.genres[0] || optionMascots[index % optionMascots.length]);
}

function buildPersonalityInsight(
    answers: QuizOption[],
    analysis: RecommendationData["analysis"] | null,
): PersonalityInsight {
    const moodCounts = new Map<string, number>();
    const genreCounts = new Map<string, number>();

    for (const answer of answers) {
        if (answer.mood) moodCounts.set(answer.mood, (moodCounts.get(answer.mood) ?? 0) + 1);
        for (const genre of answer.genres) {
            genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
        }
    }

    const primaryMood = analysis?.topMoods[0] ?? [...moodCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "curious";
    const secondaryMood = analysis?.topMoods[1] ?? [...moodCounts.entries()].sort((a, b) => b[1] - a[1])[1]?.[0] ?? "open";
    const primaryGenre = analysis?.topGenres[0] ?? [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "story";
    const secondaryGenre = analysis?.topGenres[1] ?? [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[1]?.[0] ?? "character";
    const format = analysis?.preferredMediaType?.toLowerCase() ?? "mixed";
    const totalSignals = answers.length || 1;
    const genreVariety = genreCounts.size;
    const moodVariety = moodCounts.size;

    const highEnergy = ["energetic", "adventurous", "epic", "thrilling", "exciting"].some((mood) => moodCounts.has(mood));
    const reflective = ["thoughtful", "serious", "emotional", "realistic"].some((mood) => moodCounts.has(mood));
    const comfort = ["relaxed", "relaxing", "lighthearted", "fun"].some((mood) => moodCounts.has(mood));
    const archetype = highEnergy
        ? "Momentum Seeker"
        : reflective
            ? "Meaning Hunter"
            : comfort
                ? "Comfort Curator"
                : "Genre Explorer";

    const formatText = format.includes("tv")
        ? "You seem to enjoy stories with room to breathe, so series with evolving characters should land well."
        : format.includes("movie")
            ? "You lean toward complete, satisfying arcs, so strong standalone films should feel especially rewarding."
            : "You are flexible on format, so the recommendations mix compact movie payoffs with longer series arcs.";

    return {
        archetype,
        headline: `${formatLabel(primaryMood)} ${formatLabel(primaryGenre)} personality`,
        summary: `Moodies AI reads your answers as a ${primaryMood} viewer who gravitates toward ${primaryGenre} with a ${secondaryMood} undercurrent. Your choices suggest you care about how a story feels first, then use genre as the shortcut to find the right pace.`,
        traits: [
            `${genreVariety > 3 ? "Broad" : "Focused"} genre appetite across ${genreVariety} signal${genreVariety === 1 ? "" : "s"}`,
            `${moodVariety > 2 ? "Layered" : "Clear"} emotional intent from ${totalSignals} answers`,
            `${format.includes("tv") ? "Series-friendly" : format.includes("movie") ? "Movie-night focused" : "Format-flexible"} watch rhythm`,
            `${formatLabel(primaryGenre)} with ${formatLabel(secondaryGenre)} support`,
        ],
        watchStyle: formatText,
        recommendationLogic: `The result set prioritizes titles that share your strongest genre signals, then boosts picks that match your ${primaryMood} mood and your preferred viewing format.`,
        mascot: primaryMood,
    };
}

export default function MovieQuizPage() {
    const [stage, setStage] = useState<Stage>("welcome");
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<QuizOption[]>([]);
    const [recommendations, setRecommendations] = useState<MovieItem[]>([]);
    const [analysis, setAnalysis] = useState<RecommendationData["analysis"] | null>(null);
    const [selectedMovie, setSelectedMovie] = useState<MovieItem | null>(null);

    const modalRef = useRef<HTMLDivElement | null>(null);
    const firstFocusableRef = useRef<HTMLButtonElement | null>(null);

    const progress = selectedQuestions.length
        ? Math.round(((currentQuestion + 1) / selectedQuestions.length) * 100)
        : 0;
    const topPick = recommendations[0] ?? null;
    const profileTitle = useMemo(() => {
        if (!analysis) return "Your Moodies profile";
        const mood = analysis.topMoods[0] ? formatLabel(analysis.topMoods[0]) : "Curious";
        const genre = analysis.topGenres[0] ? formatLabel(analysis.topGenres[0]) : "Story";
        return `${mood} ${genre} seeker`;
    }, [analysis]);
    const personalityInsight = useMemo(
        () => buildPersonalityInsight(answers, analysis),
        [answers, analysis],
    );

    const startQuiz = () => {
        const shuffled = [...QUESTION_POOL].sort(() => Math.random() - 0.5);
        setSelectedQuestions(shuffled.slice(0, 5));
        setAnswers([]);
        setRecommendations([]);
        setAnalysis(null);
        setSelectedMovie(null);
        setCurrentQuestion(0);
        setStage("quiz");
    };

    const handleAnswer = (option: QuizOption) => {
        const newAnswers = [...answers, option];
        setAnswers(newAnswers);

        if (currentQuestion < selectedQuestions.length - 1) {
            setCurrentQuestion((current) => current + 1);
            return;
        }

        void fetchRecommendations(newAnswers);
    };

    const fetchRecommendations = async (userAnswers: QuizOption[]) => {
        setStage("loading");

        try {
            const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
            const response = await fetch(`${base}/quiz/recommendations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answers: userAnswers }),
            });

            if (!response.ok) throw new Error(`Quiz recommendations failed (${response.status})`);
            const data = (await response.json()) as RecommendationData;

            setRecommendations(Array.isArray(data.results) ? data.results.slice(0, 12) : []);
            setAnalysis(data.analysis ?? null);
        } catch (error) {
            console.error("Error fetching recommendations:", error);
            setRecommendations([]);
            setAnalysis(null);
        } finally {
            setStage("results");
        }
    };

    const resetQuiz = () => {
        setStage("welcome");
        setCurrentQuestion(0);
        setAnswers([]);
        setRecommendations([]);
        setAnalysis(null);
        setSelectedMovie(null);
    };

    useEffect(() => {
        if (!selectedMovie) return;

        firstFocusableRef.current?.focus();

        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") setSelectedMovie(null);
            if (event.key !== "Tab" || !modalRef.current) return;

            const focusable = modalRef.current.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
            );
            if (!focusable.length) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [selectedMovie]);

    const getPersonalizationReasons = (item: MovieItem): MatchReason[] => {
        if (!analysis) return [];

        const reasons: MatchReason[] = [];
        const itemGenres = getGenreNames(item);
        const matchedGenres = analysis.topGenres.filter((genre) =>
            itemGenres.some((itemGenre) => itemGenre.toLowerCase().includes(genre.toLowerCase())),
        );

        if (matchedGenres.length >= 2) {
            reasons.push({
                mascot: matchedGenres[0],
                text: `Blends ${matchedGenres.slice(0, 2).map(formatLabel).join(" and ")} in your lane.`,
                priority: 10,
            });
        } else if (matchedGenres.length === 1) {
            reasons.push({
                mascot: matchedGenres[0],
                text: `Leans into the ${formatLabel(matchedGenres[0])} taste you chose.`,
                priority: 8,
            });
        }

        if (analysis.topMoods.length > 0) {
            const mood = analysis.topMoods[0];
            const descriptor = MOOD_DESCRIPTORS[mood.toLowerCase()] || mood;
            reasons.push({
                mascot: mood,
                text: `Matches your ${descriptor} mood profile.`,
                priority: 7,
            });
        }

        if (item.vote_average >= 8.0) {
            reasons.push({
                mascot: "inspirational",
                text: `A high-confidence pick at ${item.vote_average.toFixed(1)}/10.`,
                priority: 9,
            });
        } else if (item.vote_average >= 7.5) {
            reasons.push({
                mascot: "happy",
                text: `Strong viewer score: ${item.vote_average.toFixed(1)}/10.`,
                priority: 6,
            });
        }

        if (item.popularity > 100) {
            reasons.push({ mascot: "chaos", text: "Currently carrying real audience heat.", priority: 5 });
        }

        const releaseYear = getYear(item);
        if (Number(releaseYear) >= 2023) {
            reasons.push({ mascot: "whimsy", text: `Fresh ${releaseYear} release energy.`, priority: 4 });
        }

        if (analysis.preferredMediaType) {
            const preference = analysis.preferredMediaType.toLowerCase();
            const isTv = item.media_type === "tv";
            if ((isTv && preference.includes("tv")) || (!isTv && preference.includes("movie"))) {
                reasons.push({
                    mascot: isTv ? "cozy" : "epic",
                    text: isTv ? "Fits your series-watching preference." : "Fits your movie-night preference.",
                    priority: 6,
                });
            }
        }

        return reasons.sort((a, b) => b.priority - a.priority).slice(0, 3);
    };

    return (
        <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-10 pt-6 text-white sm:px-6 sm:pt-32 lg:px-8">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(233,79,55,0.18),transparent_32%),radial-gradient(circle_at_88%_18%,rgba(34,211,238,0.10),transparent_28%),linear-gradient(180deg,#050505_0%,#000_70%)]" />
                <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:42px_42px]" />
            </div>

            <AnimatePresence mode="wait">
                {stage === "welcome" && (
                    <motion.section
                        key="welcome"
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        className="relative z-10 mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)] lg:items-center"
                    >
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-[#e94f37]/25 bg-[#e94f37]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#ffb2a6]">
                                <MoodMascot name="happy" size="xs" />
                                Personality quiz
                            </div>
                            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-6xl">
                                Let Moodies read the room before you pick.
                            </h1>
                            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:mt-5 sm:text-lg sm:leading-7">
                                Answer five quick prompts and the mascot will build a viewing profile from your mood,
                                genre appetite, and movie-versus-series energy.
                            </p>

                            <div className="mt-7 grid gap-3 sm:grid-cols-3">
                                {welcomeHighlights.map((item) => {
                                    return (
                                        <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                                            <MoodMascot name={item.mascot} size="sm" />
                                            <div className="mt-3 text-sm font-black text-white">{item.label}</div>
                                            <div className="mt-1 text-xs text-zinc-500">{item.text}</div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={startQuiz}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#e94f37] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#e94f37]/25 transition hover:bg-[#ff604b]"
                                >
                                    Start quiz
                                </motion.button>
                                <Link
                                    href="/moods/explore"
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-bold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.08]"
                                >
                                    Browse mood tools
                                </Link>
                            </div>
                        </div>

                        <MascotPanel
                            title="Moodies is listening"
                            body="Tiny choices become a watchlist signal. No pressure, just a better first pick."
                        />
                    </motion.section>
                )}

                {stage === "quiz" && selectedQuestions[currentQuestion] && (
                    <motion.section
                        key={`quiz-${currentQuestion}`}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        className="relative z-10 mx-auto grid max-w-6xl gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start"
                    >
                        <aside className="rounded-xl border border-white/10 bg-zinc-950/80 p-5">
                            <div className="flex items-center gap-3">
                                <div className="relative h-16 w-16 shrink-0">
                                    <Image src={MASCOT_SRC} alt="Moodies mascot" fill sizes="64px" className="object-contain" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                                        Signal scan
                                    </div>
                                    <div className="mt-1 text-2xl font-black text-white">{progress}%</div>
                                </div>
                            </div>
                            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                                <motion.div
                                    initial={{ width: `${(currentQuestion / selectedQuestions.length) * 100}%` }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.35 }}
                                    className="h-full rounded-full bg-[#e94f37]"
                                />
                            </div>
                            <div className="mt-5 space-y-2">
                                {selectedQuestions.map((question, index) => (
                                    <div
                                        key={question.id}
                                        className={`h-2 rounded-full ${
                                            index <= currentQuestion ? "bg-[#ff7b68]" : "bg-white/10"
                                        }`}
                                    />
                                ))}
                            </div>
                            {answers.length > 0 && (
                                <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.035] p-3">
                                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                                        Last cue
                                    </div>
                                    <div className="mt-2 line-clamp-2 text-sm text-zinc-300">
                                        {answers[answers.length - 1].text}
                                    </div>
                                </div>
                            )}
                        </aside>

                        <div className="rounded-xl border border-white/10 bg-zinc-950/85 p-5 shadow-2xl shadow-black/30 sm:p-7">
                            <div className="mb-6 flex items-center justify-between gap-4">
                                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-bold text-zinc-300 ring-1 ring-white/10">
                                    Question {currentQuestion + 1} of {selectedQuestions.length}
                                </span>
                                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ff9b8b]">
                                    Choose one
                                </span>
                            </div>

                            <h2 className="max-w-3xl text-2xl font-black leading-tight text-white sm:text-4xl">
                                {selectedQuestions[currentQuestion].question}
                            </h2>

                            <div className="mt-7 grid gap-3">
                                {selectedQuestions[currentQuestion].options.map((option, index) => {
                                    return (
                                        <motion.button
                                            key={`${option.text}-${index}`}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => handleAnswer(option)}
                                            className="group rounded-lg border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-[#e94f37]/50 hover:bg-[#e94f37]/10"
                                        >
                                            <div className="flex items-center gap-4">
                                                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-black/35 ring-1 ring-white/10 transition group-hover:bg-[#e94f37]/20">
                                                    <Image
                                                        src={getOptionMascot(option, index)}
                                                        alt={`${option.mood} mood mascot`}
                                                        width={46}
                                                        height={46}
                                                        className="object-contain transition group-hover:scale-110"
                                                    />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-base font-bold text-white">{option.text}</span>
                                                    <span className="mt-1 block text-xs text-zinc-500">
                                                        {option.genres.map(formatLabel).join(" / ")} · {formatLabel(option.mood)}
                                                    </span>
                                                </span>
                                                <span className="shrink-0 text-sm font-black text-zinc-600 transition group-hover:translate-x-1 group-hover:text-white">
                                                    Pick
                                                </span>
                                            </div>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.section>
                )}

                {stage === "loading" && (
                    <motion.section
                        key="loading"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="relative z-10 mx-auto max-w-lg text-center"
                    >
                        <div className="rounded-xl border border-white/10 bg-zinc-950/85 p-8 shadow-2xl shadow-black/30">
                            <motion.div
                                animate={{ y: [0, -8, 0], rotate: [0, 2, -2, 0] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                className="relative mx-auto h-28 w-28"
                            >
                                <Image src={MASCOT_SRC} alt="Moodies mascot analyzing results" fill sizes="112px" className="object-contain" />
                            </motion.div>
                            <h2 className="mt-5 text-3xl font-black text-white">Building your taste map</h2>
                            <p className="mt-3 text-sm leading-6 text-zinc-400">
                                Matching your answers against mood, genre, quality, and watch format signals.
                            </p>
                            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
                                <motion.div
                                    animate={{ x: ["-100%", "120%"] }}
                                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                                    className="h-full w-1/2 rounded-full bg-[#e94f37]"
                                />
                            </div>
                        </div>
                    </motion.section>
                )}

                {stage === "results" && (
                    <motion.section
                        key="results"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        className="relative z-10 mx-auto max-w-7xl"
                    >
                        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
                            <aside className="space-y-4">
                                <div className="rounded-xl border border-white/10 bg-zinc-950/85 p-5">
                                    <div className="flex items-center gap-4">
                                        <div className="relative h-20 w-20 shrink-0">
                                            <Image src={LOGO_SRC} alt="Moodies logo" fill sizes="80px" className="object-contain" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#ff9b8b]">
                                                Quiz result
                                            </div>
                                            <h1 className="mt-1 text-2xl font-black text-white">{profileTitle}</h1>
                                        </div>
                                    </div>
                                    <p className="mt-4 text-sm leading-6 text-zinc-400">
                                        Your matches are ranked from the answer profile you just built. Open any card for why it fits.
                                    </p>
                                    <button
                                        onClick={resetQuiz}
                                        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-zinc-200 transition hover:bg-white/[0.08]"
                                    >
                                        <MoodMascot name="nostalgic" size="xs" />
                                        Retake quiz
                                    </button>
                                </div>

                                {analysis && (
                                    <div className="rounded-xl border border-[#e94f37]/25 bg-[#e94f37]/10 p-5">
                                        <div className="flex items-center gap-3">
                                            <MoodMascot name={personalityInsight.mascot} size="md" />
                                            <div>
                                                <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffb2a6]">
                                                    Moodies AI read
                                                </div>
                                                <h2 className="mt-1 text-lg font-black text-white">
                                                    {personalityInsight.archetype}
                                                </h2>
                                            </div>
                                        </div>
                                        <p className="mt-4 text-sm leading-6 text-zinc-200">
                                            {personalityInsight.summary}
                                        </p>
                                        <div className="mt-4 grid gap-2">
                                            {personalityInsight.traits.map((trait, index) => (
                                                <div key={trait} className="flex items-start gap-2 rounded-lg bg-black/25 p-2.5">
                                                    <MoodMascot name={analysis.topMoods[index] ?? analysis.topGenres[index] ?? "happy"} size="xs" />
                                                    <span className="text-xs leading-5 text-zinc-300">{trait}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
                                            <div className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                                                Watch style
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-zinc-300">{personalityInsight.watchStyle}</p>
                                        </div>
                                        <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
                                            <div className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                                                Why these picks
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-zinc-300">
                                                {personalityInsight.recommendationLogic}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {analysis && (
                                    <div className="rounded-xl border border-white/10 bg-zinc-950/85 p-5">
                                        <h2 className="text-sm font-black text-white">Signal breakdown</h2>
                                        <div className="mt-4 space-y-4">
                                            <ProfileChips title="Genres" values={analysis.topGenres} />
                                            <ProfileChips title="Moods" values={analysis.topMoods} />
                                            <div>
                                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                                                    Format
                                                </div>
                                                <div className="mt-2 rounded-lg bg-black/25 px-3 py-2 text-sm font-bold text-white ring-1 ring-white/10">
                                                    {analysis.preferredMediaType || "Movies and series"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </aside>

                            <div className="min-w-0">
                                {topPick && (
                                    <TopPickCard item={topPick} reasons={getPersonalizationReasons(topPick)} onOpen={() => setSelectedMovie(topPick)} />
                                )}

                                {recommendations.length > 0 ? (
                                    <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                                        {recommendations.map((item, index) => (
                                            <RecommendationCard
                                                key={`${item.media_type ?? "movie"}-${item.id}`}
                                                item={item}
                                                index={index}
                                                reasons={getPersonalizationReasons(item)}
                                                onOpen={() => setSelectedMovie(item)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-white/10 bg-zinc-950/85 p-10 text-center">
                                        <MoodMascot name="sad" size="lg" className="mx-auto" />
                                        <h2 className="mt-4 text-xl font-black text-white">No recommendations found</h2>
                                        <p className="mt-2 text-sm text-zinc-400">Try retaking the quiz with different preferences.</p>
                                        <button
                                            onClick={resetQuiz}
                                            className="mt-6 rounded-lg bg-[#e94f37] px-6 py-3 text-sm font-black text-white"
                                        >
                                            Retake quiz
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.section>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {selectedMovie && (
                    <motion.div
                        key="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/80 p-3 backdrop-blur-md sm:items-center sm:p-4"
                        onClick={() => setSelectedMovie(null)}
                    >
                        <motion.div
                            key="modal"
                            initial={{ opacity: 0, y: 18, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 18, scale: 0.98 }}
                            transition={{ type: "spring", stiffness: 320, damping: 30 }}
                            className="relative flex max-h-[88svh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-2xl sm:max-h-[92vh]"
                            onClick={(event) => event.stopPropagation()}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="movie-title"
                            aria-describedby="movie-overview"
                            ref={modalRef}
                            tabIndex={-1}
                        >
                            <div className="relative h-44 shrink-0 bg-zinc-900 sm:h-56">
                                {getBackdropSrc(selectedMovie) && (
                                    <Image
                                        src={getBackdropSrc(selectedMovie) ?? ""}
                                        alt=""
                                        fill
                                        sizes="(max-width: 1024px) 100vw, 1024px"
                                        className="object-cover opacity-45"
                                    />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/45 to-transparent" />
                                <button
                                    ref={firstFocusableRef}
                                    onClick={() => setSelectedMovie(null)}
                                    className="absolute right-4 top-4 z-20 rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-xs font-black text-white backdrop-blur transition hover:bg-black/80"
                                    aria-label="Close dialog"
                                >
                                    Close
                                </button>
                            </div>

                            <div className="-mt-14 grid min-h-0 gap-5 overflow-y-auto p-4 mobile-native-scroll sm:-mt-20 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6 sm:p-7">
                                <Link href={getDetailUrl(selectedMovie)} className="relative z-10 mx-auto block w-36 overflow-hidden rounded-lg shadow-2xl sm:mx-0 sm:w-full">
                                    <Image
                                        src={getPosterSrc(selectedMovie)}
                                        alt={getTitle(selectedMovie)}
                                        width={360}
                                        height={540}
                                        className="aspect-[2/3] w-full object-cover"
                                    />
                                </Link>

                                <div className="relative z-10 min-w-0 pt-12 sm:pt-20">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <h2 id="movie-title" className="text-3xl font-black leading-tight text-white sm:text-4xl">
                                                {getTitle(selectedMovie)}
                                            </h2>
                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <RatingBadge rating={selectedMovie.vote_average} variant="colored" size="sm" />
                                                <span className="rounded-full bg-white/[0.08] px-3 py-1 text-xs font-bold text-zinc-200 ring-1 ring-white/10">
                                                    {getMediaLabel(selectedMovie)}
                                                </span>
                                                <span className="rounded-full bg-white/[0.08] px-3 py-1 text-xs font-bold text-zinc-200 ring-1 ring-white/10">
                                                    {getYear(selectedMovie)}
                                                </span>
                                            </div>
                                        </div>
                                        <Link
                                            href={getDetailUrl(selectedMovie)}
                                            className="inline-flex items-center justify-center rounded-lg bg-[#e94f37] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#ff604b]"
                                        >
                                            Open details
                                        </Link>
                                    </div>

                                    {getGenreNames(selectedMovie).length > 0 && (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {getGenreNames(selectedMovie).slice(0, 6).map((genre) => (
                                                <span key={genre} className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-zinc-300 ring-1 ring-white/10">
                                                    {genre}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-6 rounded-lg border border-[#e94f37]/25 bg-[#e94f37]/10 p-4">
                                        <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
                                            <MoodMascot name={personalityInsight.mascot} size="xs" />
                                            Why this matches you
                                        </div>
                                        <div className="grid gap-2">
                                            {getPersonalizationReasons(selectedMovie).map((reason) => {
                                                return (
                                                    <div key={reason.text} className="flex items-start gap-3 rounded-lg bg-black/25 p-3">
                                                        <MoodMascot name={reason.mascot} size="xs" />
                                                        <p className="text-sm leading-5 text-zinc-200">{reason.text}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {selectedMovie.overview && (
                                        <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.035] p-4">
                                            <h3 className="flex items-center gap-2 text-sm font-black text-white">
                                                <MoodMascot name="documentary" size="xs" />
                                                Overview
                                            </h3>
                                            <p id="movie-overview" className="mt-3 text-sm leading-6 text-zinc-400">
                                                {selectedMovie.overview}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}

function MoodMascot({
    name,
    size = "sm",
    className = "",
}: {
    name?: string | null;
    size?: "xs" | "sm" | "md" | "lg";
    className?: string;
}) {
    const dimensions = {
        xs: "h-5 w-5",
        sm: "h-9 w-9",
        md: "h-12 w-12",
        lg: "h-16 w-16",
    };
    const pixelSize = {
        xs: 20,
        sm: 36,
        md: 48,
        lg: 64,
    };

    return (
        <span className={`relative inline-flex shrink-0 ${dimensions[size]} ${className}`}>
            <Image
                src={getMoodMascotSrc(name)}
                alt={`${name ?? "Moodies"} mood mascot`}
                width={pixelSize[size]}
                height={pixelSize[size]}
                className="h-full w-full object-contain"
            />
        </span>
    );
}

function MascotPanel({ title, body }: { title: string; body: string }) {
    return (
        <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-white/10 bg-zinc-950/85 p-6 shadow-2xl shadow-black/30">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(233,79,55,0.20),transparent_42%)]" />
            <motion.div
                animate={{ y: [0, -10, 0], rotate: [0, 1.5, -1.5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-2 right-2 h-72 w-72 sm:h-80 sm:w-80"
            >
                <Image src={MASCOT_SRC} alt="Moodies mascot" fill sizes="320px" className="object-contain" />
            </motion.div>
            <div className="relative z-10 max-w-xs">
                <MoodMascot name="happy" size="lg" />
                <h2 className="mt-5 text-2xl font-black text-white">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{body}</p>
            </div>
        </div>
    );
}

function ProfileChips({ title, values }: { title: string; values: string[] }) {
    return (
        <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">{title}</div>
            <div className="mt-2 flex flex-wrap gap-2">
                {values.slice(0, 5).map((value) => (
                    <span key={value} className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-xs font-bold text-white ring-1 ring-white/10">
                        <MoodMascot name={value} size="xs" />
                        {formatLabel(value)}
                    </span>
                ))}
            </div>
        </div>
    );
}

function TopPickCard({ item, reasons, onOpen }: { item: MovieItem; reasons: MatchReason[]; onOpen: () => void }) {
    return (
        <button
            onClick={onOpen}
            className="group relative w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-950/85 text-left shadow-2xl shadow-black/30"
        >
            <div className="absolute inset-0">
                {getBackdropSrc(item) && (
                    <Image
                        src={getBackdropSrc(item) ?? ""}
                        alt=""
                        fill
                        sizes="(max-width: 1024px) 100vw, 900px"
                        className="object-cover opacity-35 transition group-hover:scale-105"
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/85 to-zinc-950/40" />
            </div>
            <div className="relative grid gap-5 p-5 sm:grid-cols-[120px_minmax(0,1fr)] sm:p-6">
                <Image
                    src={getPosterSrc(item)}
                    alt={getTitle(item)}
                    width={240}
                    height={360}
                    className="hidden aspect-[2/3] rounded-lg object-cover shadow-xl sm:block"
                />
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#e94f37] px-3 py-1 text-xs font-black text-white">
                        <MoodMascot name={reasons[0]?.mascot ?? "inspirational"} size="xs" />
                        Top match
                    </div>
                    <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">{getTitle(item)}</h2>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <RatingBadge rating={item.vote_average} variant="colored" size="sm" />
                        <span className="rounded-full bg-white/[0.08] px-3 py-1 text-xs font-bold text-zinc-200 ring-1 ring-white/10">
                            {getMediaLabel(item)}
                        </span>
                        <span className="rounded-full bg-white/[0.08] px-3 py-1 text-xs font-bold text-zinc-200 ring-1 ring-white/10">
                            {getYear(item)}
                        </span>
                    </div>
                    {reasons[0] && <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">{reasons[0].text}</p>}
                    <div className="mt-5 inline-flex items-center gap-2 text-sm font-black text-white">
                        View match details
                        <span className="transition group-hover:translate-x-1">Go</span>
                    </div>
                </div>
            </div>
        </button>
    );
}

function RecommendationCard({
    item,
    index,
    reasons,
    onOpen,
}: {
    item: MovieItem;
    index: number;
    reasons: MatchReason[];
    onOpen: () => void;
}) {
    const firstReason = reasons[0];

    return (
        <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.035 }}
            onClick={onOpen}
            className="group min-w-0 text-left"
        >
            <div className="relative overflow-hidden rounded-lg border border-white/10 bg-zinc-950 shadow-xl transition group-hover:-translate-y-1 group-hover:border-[#e94f37]/50">
                <Image
                    src={getPosterSrc(item)}
                    alt={getTitle(item)}
                    width={360}
                    height={540}
                    className="aspect-[2/3] w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
                <div className="absolute left-2 top-2 flex gap-1.5">
                    <RatingBadge rating={item.vote_average} variant="colored" size="sm" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                    <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold text-white ring-1 ring-white/10">
                            {getMediaLabel(item)}
                        </span>
                        <span className="rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold text-zinc-200 ring-1 ring-white/10">
                            {getYear(item)}
                        </span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-sm font-black leading-tight text-white">{getTitle(item)}</h3>
                </div>
            </div>
            {firstReason && (
                <div className="mt-2 flex gap-2 rounded-lg border border-white/10 bg-white/[0.035] p-2">
                    <MoodMascot name={firstReason.mascot} size="xs" />
                    <p className="line-clamp-2 text-xs leading-5 text-zinc-400">{firstReason.text}</p>
                </div>
            )}
        </motion.button>
    );
}
