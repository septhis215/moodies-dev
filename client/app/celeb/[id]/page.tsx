"use client";

import { useState, useEffect, use } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar,
    MapPin,
    Award,
    Film,
    Tv,
    Instagram,
    Twitter,
    Facebook,
    Star,
    ChevronDown,
    ChevronUp,
    Camera,
    Users,
    Trophy,
    X,
    ExternalLink,
    Play,
    Heart,
    Sparkles,
    ChevronRight,
    ChevronLeft,
    Clock,
    Zap,
    TrendingUp
} from 'lucide-react';
import Link from 'next/link';

interface Person {
    id: number;
    name: string;
    biography: string;
    birthday: string;
    deathday?: string;
    place_of_birth: string;
    profile_path: string;
    known_for_department: string;
    popularity: number;
    gender: number;
    also_known_as?: string[];
    homepage?: string;
    external_ids: {
        instagram_id: string;
        twitter_id: string;
        facebook_id: string;
        imdb_id: string;
    };
    images: {
        profiles: Array<{ file_path: string; vote_average: number; aspect_ratio: number }>;
    };
    combined_credits: {
        cast: Array<{
            id: number;
            title?: string;
            name?: string;
            character: string;
            poster_path: string;
            vote_average: number;
            release_date?: string;
            first_air_date?: string;
            media_type: string;
            genre_ids?: number[];
        }>;
    };
    tagged_images: {
        results: Array<{
            file_path: string;
            vote_average: number;
            media?: {
                id: number;
                title?: string;
                name?: string;
                media_type: "movie" | "tv";
                vote_average: number;
            };
        }>;
    };
}

interface SimilarPerson {
    id: number;
    name: string;
    profile_path: string;
    known_for_department: string;
    popularity: number;
}

interface UpcomingProject {
    id: number;
    title?: string;
    name?: string;
    poster_path: string;
    release_date?: string;
    first_air_date?: string;
    character?: string;
    media_type?: string;
}
interface Timeline {
    debut: { title: string; year: number; character: string; rating: number };
    breakout: { title: string; year: number; character: string; rating: number };
    recent: { title: string; year: number; character: string; rating: number };
    decades: Array<{ period: string; count: number; avgRating: string; topWork: any }>;
    totalYears: number;
}

interface Collaboration {
    id: number;
    name: string;
    count: number;
    projects: string[];
}
export default function CelebrityDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [person, setPerson] = useState<Person | null>(null);
    const [timeline, setTimeline] = useState<Timeline | null>(null);
    const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTab, setSelectedTab] = useState<'all' | 'movies' | 'tv'>('all');
    const [bioExpanded, setBioExpanded] = useState(false);
    const [showAllCredits, setShowAllCredits] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [similarPeople, setSimilarPeople] = useState<SimilarPerson[]>([]);
    const [upcomingProjects, setUpcomingProjects] = useState<any[]>([]);

    useEffect(() => {
        const fetchPerson = async () => {
            try {
                const base = process.env.NEXT_PUBLIC_NEST_API_URL || 'http://localhost:4000';

                const [personRes, similarRes, upcomingRes, timelineRes, collabRes] = await Promise.all([
                    fetch(`${base}/people/${resolvedParams.id}`),
                    fetch(`${base}/people/${resolvedParams.id}/similar`),
                    fetch(`${base}/people/${resolvedParams.id}/upcoming`),
                    fetch(`${base}/people/${resolvedParams.id}/timeline`),
                    fetch(`${base}/people/${resolvedParams.id}/collaborations`)
                ]);

                const personData = await personRes.json();
                setPerson(personData);
                setSimilarPeople(await similarRes.json());

                const upData = await upcomingRes.json();
                setUpcomingProjects([...upData.movies, ...upData.tv]);

                const timelineData = await timelineRes.json();
                setTimeline(timelineData);

                const collabData = await collabRes.json();
                setCollaborations(collabData);
            } catch (error) {
                console.error('Error fetching celebrity:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPerson();
    }, [resolvedParams.id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a1a2e] to-[#0a0a0a] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 border-4 border-[#e94f37] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-white text-lg font-medium">Loading celebrity profile...</p>
                </div>
            </div>
        );
    }

    if (!person) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a1a2e] to-[#0a0a0a] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-r from-[#e94f37] to-[#ff6b58] flex items-center justify-center mx-auto mb-4">
                        <Users className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-white text-2xl font-bold mb-2">Celebrity not found</h2>
                    <p className="text-gray-400">This profile doesn't exist</p>
                </div>
            </div>
        );
    }

    const Carousel = ({ items }: { items: any[] }) => {
        const [startIndex, setStartIndex] = useState(0);
        const [itemsPerView, setItemsPerView] = useState(6);

        useEffect(() => {
            const updateLayout = () => {
                const w = window.innerWidth;
                if (w < 640) setItemsPerView(2);
                else if (w < 768) setItemsPerView(3);
                else if (w < 1024) setItemsPerView(4);
                else if (w < 1280) setItemsPerView(5);
                else setItemsPerView(6);
            };

            updateLayout();
            window.addEventListener("resize", updateLayout);
            return () => window.removeEventListener("resize", updateLayout);
        }, []);

        const canScrollLeft = startIndex > 0;
        const canScrollRight = startIndex < items.length - itemsPerView;

        const scrollLeft = () => {
            setStartIndex((prev) => Math.max(0, prev - itemsPerView));
        };

        const scrollRight = () => {
            setStartIndex((prev) => Math.min(items.length - itemsPerView, prev + itemsPerView));
        };

        const visibleItems = items.slice(startIndex, startIndex + itemsPerView);

        return (
            <div className="relative group/carousel">
                {canScrollLeft && (
                    <button
                        onClick={scrollLeft}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-12 h-12 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 shadow-2xl ring-2 ring-white/10"
                        aria-label="Scroll left"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                )}

                {canScrollRight && (
                    <button
                        onClick={scrollRight}
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-12 h-12 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 shadow-2xl ring-2 ring-white/10"
                        aria-label="Scroll right"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                    {visibleItems.map((person, idx) => (
                        <motion.div
                            key={person.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="group cursor-pointer"
                        >
                            <Link href={`/celeb/${person.id}`}>
                                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#111] mb-3 group-hover:ring-2 group-hover:ring-[#e94f37] transition-all">
                                    <Image
                                        src={
                                            person.profile_path
                                                ? `https://image.tmdb.org/t/p/w342${person.profile_path}`
                                                : "/coming-soon.png"
                                        }
                                        alt={person.name}
                                        fill
                                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                </div>
                                <h3 className="text-white font-semibold text-sm text-center line-clamp-2 mb-1">
                                    {person.name}
                                </h3>
                                <p className="text-gray-500 text-xs text-center">{person.known_for_department}</p>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>
        );
    };

    const movieCredits = person.combined_credits?.cast.filter(c => c.media_type === 'movie').sort((a, b) => b.vote_average - a.vote_average) || [];
    const tvCredits = person.combined_credits?.cast.filter(c => c.media_type === 'tv').sort((a, b) => b.vote_average - a.vote_average) || [];
    const allCredits = [...movieCredits, ...tvCredits].sort((a, b) => b.vote_average - a.vote_average);

    const displayCredits = selectedTab === 'all' ? allCredits : selectedTab === 'movies' ? movieCredits : tvCredits;
    const getCreditDate = (credit: any) =>
        credit.release_date || credit.first_air_date || "";

    // Sort displayCredits by date descending (latest first)
    const sortedCredits = [...displayCredits].sort((a, b) => {
        const dateA = getCreditDate(a);
        const dateB = getCreditDate(b);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    const visibleCredits = showAllCredits ? sortedCredits : sortedCredits.slice(0, 12);

    const age = person.birthday ? new Date().getFullYear() - new Date(person.birthday).getFullYear() : null;
    const shouldTruncateBio = person.biography && person.biography.length > 400;
    const displayBio = shouldTruncateBio && !bioExpanded ? person.biography.slice(0, 400) + '...' : person.biography;

    const backdropImage = visibleCredits.find(
        credit => credit.poster_path
    )?.poster_path || null;

    // Genre mapping
    const genreMap: Record<number, string> = {
        28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
        99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
        27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
        10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
        10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
        10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
    };

    // Calculate genre stats
    const genreStats: Record<string, number> = {};
    allCredits.forEach(credit => {
        credit.genre_ids?.forEach(genreId => {
            const genreName = genreMap[genreId] || 'Other';
            genreStats[genreName] = (genreStats[genreName] || 0) + 1;
        });
    });

    const topGenres = Object.entries(genreStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const totalGenreWorks = Object.values(genreStats).reduce((a, b) => a + b, 0);

    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            {/* Hero Section with Moodiest Design */}
            <div className="relative overflow-hidden">
                {/* Animated Background */}
                <div className="absolute inset-0">
                    {/* Base gradient */}
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-800/20 to-black" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-gray-900/60 to-transparent" />
                    {/* Animated blobs */}
                    <motion.div
                        animate={{
                            scale: [1, 1.2, 1],
                            rotate: [0, 90, 0],
                        }}
                        transition={{
                            duration: 20,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        className="absolute -top-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl"
                    ></motion.div>
                    <motion.div
                        animate={{
                            scale: [1.2, 1, 1.2],
                            rotate: [90, 0, 90],
                        }}
                        transition={{
                            duration: 15,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        className="absolute -bottom-40 -right-40 w-96 h-96 bg-black/20 rounded-full blur-3xl"
                    ></motion.div>

                    {/* Pattern overlay */}
                    <div className="absolute inset-0 opacity-10" style={{
                        backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                        backgroundSize: '40px 40px'
                    }}></div>
                </div>

                {/* Content */}
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-32">
                    <div className="flex flex-col lg:flex-row items-center lg:items-start gap-12">
                        {/* Profile Image */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5 }}
                            className="relative flex-shrink-0"
                        >
                            <div className="w-72 h-[432px] rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white/30 relative">
                                <Image
                                    src={
                                        person.profile_path
                                            ? `https://image.tmdb.org/t/p/w500${person.profile_path}`
                                            : '/coming-soon.png'
                                    }
                                    alt={person.name}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            </div>
                        </motion.div>

                        {/* Info */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="flex-1 text-center lg:text-left"
                        >
                            {/* Department Badge */}
                            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-white text-sm font-bold mb-4">
                                <Award className="w-4 h-4" />
                                {person.known_for_department}
                            </div>

                            {/* Name */}
                            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-4 leading-tight">
                                {person.name}
                            </h1>

                            {/* Info Pills */}
                            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-6">
                                {person.birthday && (
                                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                                        <Calendar className="w-4 h-4 text-white" />
                                        <span className="text-white text-sm font-semibold">
                                            {new Date(person.birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                        {age && <span className="text-white/70 text-sm">({age})</span>}
                                    </div>
                                )}
                                {person.place_of_birth && (
                                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                                        <MapPin className="w-4 h-4 text-white" />
                                        <span className="text-white text-sm font-semibold truncate max-w-xs">
                                            {person.place_of_birth}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Stats */}
                            <div className="flex items-center justify-center lg:justify-start gap-6 mb-8">
                                <div className="text-center">
                                    <div className="text-3xl font-black text-white">{allCredits.length}</div>
                                    <div className="text-sm text-white/70 font-medium">Works</div>
                                </div>
                                <div className="w-px h-12 bg-white/20"></div>
                                <div className="text-center">
                                    <div className="text-3xl font-black text-white">{person.popularity.toFixed(0)}</div>
                                    <div className="text-sm text-white/70 font-medium">Popularity</div>
                                </div>
                                <div className="w-px h-12 bg-white/20"></div>
                                <div className="text-center">
                                    <div className="text-3xl font-black text-white">{displayCredits.filter(c => c.vote_average >= 7).length}</div>
                                    <div className="text-sm text-white/70 font-medium">Top Rated</div>
                                </div>
                            </div>

                            {/* Social Links */}
                            <div className="flex items-center justify-center lg:justify-start gap-3">
                                {person.external_ids?.instagram_id && (
                                    <a
                                        href={`https://instagram.com/${person.external_ids.instagram_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
                                    >
                                        <Instagram className="w-5 h-5 text-white" />
                                    </a>
                                )}
                                {person.external_ids?.twitter_id && (
                                    <a
                                        href={`https://twitter.com/${person.external_ids.twitter_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
                                    >
                                        <Twitter className="w-5 h-5 text-white" />
                                    </a>
                                )}
                                {person.external_ids?.facebook_id && (
                                    <a
                                        href={`https://facebook.com/${person.external_ids.facebook_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
                                    >
                                        <Facebook className="w-5 h-5 text-white" />
                                    </a>
                                )}
                                {person.external_ids?.imdb_id && (
                                    <a
                                        href={`https://www.imdb.com/name/${person.external_ids.imdb_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
                                    >
                                        <Star className="w-5 h-5 text-white" />
                                    </a>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0">
                    <svg viewBox="0 0 1440 120" fill="none" className="w-full h-16">
                        <path d="M0 0L60 10C120 20 240 40 360 46.7C480 53 600 47 720 43.3C840 40 960 40 1080 46.7C1200 53 1320 67 1380 73.3L1440 80V120H0V0Z" fill="url(#wave-gradient)" />
                        <defs>
                            <linearGradient id="wave-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#1a1a2e" />
                                <stop offset="100%" stopColor="#0a0a0a" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">
                {/* Biography */}
                {person.biography && (
                    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <h2 className="text-4xl font-black text-white mb-8 flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#e94f37] to-[#ff6b58] flex items-center justify-center shadow-xl">
                                <Sparkles className="w-7 h-7 text-white" />
                            </div>
                            About {person.name.split(' ')[0]}
                        </h2>
                        <div className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm rounded-3xl p-8 border border-white/10 shadow-2xl">
                            <p className="text-gray-300 leading-relaxed text-lg">{displayBio}</p>
                            {shouldTruncateBio && (
                                <button onClick={() => setBioExpanded(!bioExpanded)}
                                    className="mt-6 text-[#e94f37] hover:text-[#ff6b58] font-semibold text-sm flex items-center gap-2 transition-colors">
                                    {bioExpanded ? <><ChevronUp className="w-4 h-4" /> Show less</> : <><ChevronDown className="w-4 h-4" /> Read more</>}
                                </button>
                            )}
                        </div>
                    </motion.section>
                )}

                {/* {timeline && (
                    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <h2 className="text-4xl font-black text-white mb-8 flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-xl">
                                <Clock className="w-7 h-7 text-white" />
                            </div>
                            Career Journey
                        </h2>

                        <div className="relative">
                            <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-[#e94f37] via-purple-500 to-blue-500 rounded-full" />

                            <div className="space-y-10">
                                <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} className="relative pl-24">
                                    <div className="absolute left-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-[#e94f37] to-[#ff6b58] flex items-center justify-center ring-4 ring-[#0a0a0a] shadow-xl">
                                        <Sparkles className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 shadow-xl hover:shadow-2xl transition-shadow">
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <h3 className="text-white font-black text-2xl mb-2">Career Debut</h3>
                                                <p className="text-[#e94f37] font-bold text-xl">{timeline.debut.year}</p>
                                            </div>
                                            <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-full border border-yellow-500/30">
                                                <Star className="w-5 h-5 text-yellow-400" fill="currentColor" />
                                                <span className="text-yellow-400 text-lg font-bold">{timeline.debut.rating.toFixed(1)}</span>
                                            </div>
                                        </div>
                                        <p className="text-white text-xl font-semibold mb-2">{timeline.debut.title}</p>
                                        <p className="text-gray-400 text-sm">as {timeline.debut.character}</p>
                                    </div>
                                </motion.div>

                                <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="relative pl-24">
                                    <div className="absolute left-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center ring-4 ring-[#0a0a0a] shadow-xl">
                                        <Trophy className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 shadow-xl hover:shadow-2xl transition-shadow">
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <h3 className="text-white font-black text-2xl mb-2">Breakout Performance</h3>
                                                <p className="text-purple-400 font-bold text-xl">{timeline.breakout.year}</p>
                                            </div>
                                            <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-full border border-yellow-500/30">
                                                <Star className="w-5 h-5 text-yellow-400" fill="currentColor" />
                                                <span className="text-yellow-400 text-lg font-bold">{timeline.breakout.rating.toFixed(1)}</span>
                                            </div>
                                        </div>
                                        <p className="text-white text-xl font-semibold mb-2">{timeline.breakout.title}</p>
                                        <p className="text-gray-400 text-sm">as {timeline.breakout.character}</p>
                                    </div>
                                </motion.div>

                                <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="relative pl-24">
                                    <div className="absolute left-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center ring-4 ring-[#0a0a0a] shadow-xl">
                                        <Film className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 shadow-xl hover:shadow-2xl transition-shadow">
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <h3 className="text-white font-black text-2xl mb-2">Recent Work</h3>
                                                <p className="text-blue-400 font-bold text-xl">{timeline.recent.year}</p>
                                            </div>
                                            <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-full border border-yellow-500/30">
                                                <Star className="w-5 h-5 text-yellow-400" fill="currentColor" />
                                                <span className="text-yellow-400 text-lg font-bold">{timeline.recent.rating.toFixed(1)}</span>
                                            </div>
                                        </div>
                                        <p className="text-white text-xl font-semibold mb-2">{timeline.recent.title}</p>
                                        <p className="text-gray-400 text-sm">as {timeline.recent.character}</p>
                                    </div>
                                </motion.div>
                            </div>
                        </div>

                        {timeline.decades.length > 0 && (
                            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {timeline.decades.map((decade, idx) => (
                                    <motion.div key={decade.period} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                                        className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all group">
                                        <h4 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#e94f37] to-[#ff6b58] mb-4">{decade.period}</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-400 text-sm">Productions</span>
                                                <span className="text-white font-bold text-lg">{decade.count}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-400 text-sm">Avg Rating</span>
                                                <div className="flex items-center gap-1">
                                                    <Star className="w-4 h-4 text-yellow-400" fill="currentColor" />
                                                    <span className="text-white font-bold text-lg">{decade.avgRating}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </motion.section>
                )} */}

                {/* Collaborations Network */}
                {collaborations.length > 0 && (
                    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <h2 className="text-4xl font-black text-white mb-8 flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-xl">
                                <Users className="w-7 h-7 text-white" />
                            </div>
                            Frequent Collaborators
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {collaborations.slice(0, 6).map((collab, idx) => (
                                <Link
                                    key={collab.id}
                                    href={`/celeb/${collab.id}`} 
                                    className="block"
                                >
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.1 }}
                                        whileHover={{ scale: 1.03 }}
                                        className="bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all group cursor-pointer"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <h3 className="text-white font-bold text-xl mb-1 group-hover:text-[#e94f37] transition-colors">
                                                    {collab.name}
                                                </h3>
                                                <p className="text-gray-500 text-sm">
                                                    Co-starred in {collab.count} project{collab.count > 1 ? "s" : ""}
                                                </p>
                                            </div>
                                            <div className="px-4 py-2 bg-[#e94f37]/20 rounded-full border border-[#e94f37]/30">
                                                <span className="text-[#e94f37] text-lg font-black">{collab.count}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            {collab.projects.slice(0, 3).map((project, i) => (
                                                <p key={i} className="text-gray-400 text-sm truncate">
                                                    • {project}
                                                </p>
                                            ))}
                                        </div>
                                    </motion.div>
                                </Link>
                            ))}
                        </div>
                    </motion.section>
                )}

                {/* Photos */}
                {person.images?.profiles && person.images.profiles.length > 0 && (
                    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                        <h2 className="text-4xl font-black text-white mb-8 flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-xl">
                                <Camera className="w-7 h-7 text-white" />
                            </div>
                            Gallery
                            <span className="text-sm text-gray-500 font-normal">({person.images.profiles.length} photos)</span>
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {person.images.profiles.slice(0, 12).map((img, idx) => (
                                <motion.div key={idx} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }}
                                    whileHover={{ scale: 1.05 }} className="relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer group bg-[#111] border border-white/10 hover:border-white/20"
                                    onClick={() => setSelectedImage(`https://image.tmdb.org/t/p/original${img.file_path}`)}>
                                    <Image src={`https://image.tmdb.org/t/p/w342${img.file_path}`} alt={`${person.name} photo`} fill className="object-cover transition-transform duration-300 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                        <Camera className="w-5 h-5 text-white" />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.section>
                )}

                {/* Career Highlights */}
                <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                    <h2 className="text-4xl font-black text-white mb-8 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-xl">
                            <Trophy className="w-7 h-7 text-white" />
                        </div>
                        Career Statistics
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm rounded-2xl p-8 border border-blue-500/20 hover:border-blue-500/40 transition-all group">
                            <Film className="w-12 h-12 text-blue-400 mb-4 group-hover:scale-110 transition-transform" />
                            <div className="text-5xl font-black text-white mb-2">{movieCredits.length}</div>
                            <div className="text-sm text-gray-400 font-medium">Feature Films</div>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                            className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20 hover:border-purple-500/40 transition-all group">
                            <Tv className="w-12 h-12 text-purple-400 mb-4 group-hover:scale-110 transition-transform" />
                            <div className="text-5xl font-black text-white mb-2">{tvCredits.length}</div>
                            <div className="text-sm text-gray-400 font-medium">TV Productions</div>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                            className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 backdrop-blur-sm rounded-2xl p-8 border border-yellow-500/20 hover:border-yellow-500/40 transition-all group">
                            <Star className="w-12 h-12 text-yellow-400 mb-4 group-hover:scale-110 transition-transform" fill="currentColor" />
                            <div className="text-5xl font-black text-white mb-2">{allCredits.filter(c => c.vote_average >= 7).length}</div>
                            <div className="text-sm text-gray-400 font-medium">Highly Rated</div>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                            className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm rounded-2xl p-8 border border-green-500/20 hover:border-green-500/40 transition-all group">
                            <Clock className="w-12 h-12 text-green-400 mb-4 group-hover:scale-110 transition-transform" />
                            <div className="text-5xl font-black text-white mb-2">{timeline?.totalYears || 0}+</div>
                            <div className="text-sm text-gray-400 font-medium">Years Active</div>
                        </motion.div>
                    </div>
                </motion.section>

                {/* Genre Stats */}
                {topGenres.length > 0 && (
                    <section>
                        <h2 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#e94f37] to-[#ff6b58] flex items-center justify-center">
                                <Film className="w-5 h-5 text-white" />
                            </div>
                            Genre Breakdown
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Genre Chart */}
                            <div className="bg-[#111] rounded-xl p-6 border border-gray-800">
                                <h3 className="text-white font-bold text-lg mb-6">Top Genres</h3>
                                <div className="space-y-4">
                                    {topGenres.map(([genre, count], idx) => {
                                        const percentage = totalGenreWorks > 0 ? (count / totalGenreWorks) * 100 : 0;
                                        const colors = [
                                            'from-[#e94f37] to-[#ff6b58]',
                                            'from-purple-600 to-pink-600',
                                            'from-blue-600 to-cyan-600',
                                            'from-green-600 to-emerald-600',
                                            'from-yellow-600 to-orange-600'
                                        ];
                                        return (
                                            <div key={genre}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-white text-sm font-semibold">{genre}</span>
                                                    <span className="text-gray-400 text-sm">{count} works ({percentage.toFixed(0)}%)</span>
                                                </div>
                                                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${percentage}%` }}
                                                        transition={{ duration: 1, delay: idx * 0.1 }}
                                                        className={`h-full bg-gradient-to-r ${colors[idx]}`}
                                                    ></motion.div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Genre Summary */}
                            <div className="bg-[#111] rounded-xl p-6 border border-gray-800">
                                <h3 className="text-white font-bold text-lg mb-6">Genre Diversity</h3>
                                <div className="space-y-6">
                                    <div>
                                        <p className="text-gray-400 text-sm mb-2">Most Frequent</p>
                                        <p className="text-white text-2xl font-black">{topGenres[0]?.[0] || 'N/A'}</p>
                                        <p className="text-[#e94f37] text-sm font-semibold">{topGenres[0]?.[1] || 0} works</p>
                                    </div>
                                    <div className="border-t border-gray-800 pt-6">
                                        <p className="text-gray-400 text-sm mb-2">Total Genres</p>
                                        <p className="text-white text-2xl font-black">{Object.keys(genreStats).length}</p>
                                        <p className="text-gray-500 text-sm">Across {allCredits.length} productions</p>
                                    </div>
                                    <div className="border-t border-gray-800 pt-6">
                                        <p className="text-gray-400 text-sm mb-3">Specialization</p>
                                        <div className="flex flex-wrap gap-2">
                                            {topGenres.slice(0, 3).map(([genre]) => (
                                                <span key={genre} className="px-3 py-1 bg-gradient-to-r from-[#e94f37]/20 to-[#ff6b58]/20 border border-[#e94f37]/30 rounded-full text-[#e94f37] text-xs font-semibold">
                                                    {genre}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Upcoming Projects */}
                {upcomingProjects.length > 0 && (
                    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                        <h2 className="text-4xl font-black text-white mb-8 flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-xl">
                                <Calendar className="w-7 h-7 text-white" />
                            </div>
                            Coming Soon
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                            {upcomingProjects.slice(0, 6).map((project, idx) => (
                                <motion.div key={project.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="group">
                                    <Link href={`/${project.media_type === "tv" ? "tv" : "movies"}/${project.id}`}>
                                        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#111] mb-3 border border-white/10 group-hover:border-cyan-500/50 transition-all shadow-lg">
                                            <Image src={project.poster_path ? `https://image.tmdb.org/t/p/w342${project.poster_path}` : "/coming-soon.png"} alt={project.title || project.name || ""} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                                            <div className="absolute top-2 left-2 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg shadow-lg">
                                                <span className="text-white text-xs font-bold">Upcoming</span>
                                            </div>
                                        </div>
                                        <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1">{project.title || project.name}</h3>
                                        <p className="text-gray-500 text-xs">{(project.release_date || project.first_air_date) ? new Date(project.release_date || project.first_air_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : "TBA"}</p>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </motion.section>
                )}

                {/* Similar Celebrities */}
                <section>
                    <h2 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#e94f37] to-[#ff6b58] flex items-center justify-center">
                            <Users className="w-5 h-5 text-white" />
                        </div>
                        You May Also Like
                    </h2>

                    {similarPeople.length > 0 ? (
                        <Carousel items={similarPeople} />
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {[...Array(6)].map((_, idx) => (
                                <div key={idx} className="group cursor-pointer">
                                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-gray-800 mb-3">
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Users className="w-12 h-12 text-gray-600" />
                                        </div>
                                    </div>
                                    <h3 className="text-white font-semibold text-sm text-center">Loading...</h3>
                                    <p className="text-gray-500 text-xs text-center">{person.known_for_department}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {similarPeople.length > 0 && (
                        <div className="mt-6 text-center">
                            <p className="text-gray-500 text-sm">
                                Based on {person.known_for_department} with similar style
                            </p>
                        </div>
                    )}
                </section>


                {/* Filmography */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-3xl font-black text-white flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#e94f37] to-[#ff6b58] flex items-center justify-center">
                                <Film className="w-5 h-5 text-white" />
                            </div>
                            Filmography
                        </h2>

                        {/* Tab Filter */}
                        <div className="flex items-center gap-2 bg-[#111] rounded-xl p-1 border border-gray-800">
                            <button
                                onClick={() => { setSelectedTab('all'); setShowAllCredits(false); }}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${selectedTab === 'all'
                                    ? 'bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                All ({allCredits.length})
                            </button>
                            <button
                                onClick={() => { setSelectedTab('movies'); setShowAllCredits(false); }}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${selectedTab === 'movies'
                                    ? 'bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                Movies ({movieCredits.length})
                            </button>
                            <button
                                onClick={() => { setSelectedTab('tv'); setShowAllCredits(false); }}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${selectedTab === 'tv'
                                    ? 'bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                TV ({tvCredits.length})
                            </button>
                        </div>
                    </div>

                    {/* Credits Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {visibleCredits.map((credit, index) => (
                            <motion.div
                                key={`${credit.id}-${index}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="group"
                            >
                                <Link href={`/${credit.media_type === "tv" ? "tv" : "movies"}/${credit.id}`}>
                                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#111] mb-3 group-hover:ring-2 group-hover:ring-[#e94f37] transition-all">
                                        <Image
                                            src={
                                                credit.poster_path
                                                    ? `https://image.tmdb.org/t/p/w342${credit.poster_path}`
                                                    : "/coming-soon.png"
                                            }
                                            alt={credit.title || credit.name || ""}
                                            fill
                                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                                        />
                                        {credit.vote_average > 0 && (
                                            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-lg">
                                                <Star className="w-3 h-3 text-yellow-400" fill="currentColor" />
                                                <span className="text-white text-xs font-bold">{credit.vote_average.toFixed(1)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1">
                                        {credit.title || credit.name}
                                    </h3>
                                    {credit.character && (
                                        <p className="text-gray-500 text-xs line-clamp-1">as {credit.character}</p>
                                    )}
                                </Link>
                            </motion.div>
                        ))}
                    </div>

                    {/* View All Button */}
                    {displayCredits.length > 12 && (
                        <div className="mt-8 text-center">
                            <button
                                onClick={() => setShowAllCredits(!showAllCredits)}
                                className="px-8 py-3 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-[#e94f37]/50 transition-all flex items-center gap-2 mx-auto"
                            >
                                {showAllCredits ? (
                                    <>Show Less <ChevronUp className="w-5 h-5" /></>
                                ) : (
                                    <>View All {displayCredits.length} <ChevronDown className="w-5 h-5" /></>
                                )}
                            </button>
                        </div>
                    )}
                </section>
            </div>

            {/* Image Modal */}
            <AnimatePresence>
                {selectedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
                        onClick={() => setSelectedImage(null)}
                    >
                        <button
                            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
                            onClick={() => setSelectedImage(null)}
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="relative max-w-4xl max-h-[90vh] w-full h-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Image
                                src={selectedImage}
                                alt="Full size"
                                fill
                                className="object-contain"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}