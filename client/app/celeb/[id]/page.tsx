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
        <div className="min-h-screen bg-black">
            {/* Hero Section with Enhanced Design */}
            <div className="relative overflow-hidden">
                {/* Animated Background */}
                <div className="absolute inset-0">
                    {/* Base gradients */}
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-800/20 to-black" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-gray-900/60 to-transparent" />

                    {/* Animated orbs */}
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
                        className="absolute -top-40 -left-40 w-80 h-80 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full blur-3xl"
                    />
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
                        className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"
                    />
                    <motion.div
                        animate={{
                            scale: [1, 1.3, 1],
                            x: [0, 50, 0],
                        }}
                        transition={{
                            duration: 25,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        className="absolute top-1/2 left-1/2 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-3xl"
                    />

                    <div className="absolute inset-0 opacity-10" style={{
                        backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                        backgroundSize: '40px 40px'
                    }} />
                </div>

                {/* Content */}
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-32">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        {/* Profile Image */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5 }}
                            className="relative flex justify-center lg:justify-start"
                        >
                            <div className="relative group">
                                <div className="absolute -inset-4 bg-gradient-to-r from-red-500 via-purple-500 to-blue-500 rounded-3xl opacity-75 blur-2xl group-hover:opacity-100 transition duration-500" />
                                <div className="relative w-80 h-[480px] rounded-3xl overflow-hidden ring-4 ring-white/20 group-hover:ring-white/40 transition-all duration-300 shadow-2xl">
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
                            </div>
                        </motion.div>

                        {/* Info */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="space-y-6"
                        >
                            {/* Department Badge */}
                            {person.known_for_department && (
                                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500/20 to-orange-500/20 backdrop-blur-xl px-6 py-3 rounded-full border border-red-500/30">
                                    <Award className="w-5 h-5 text-red-400" />
                                    <span className="text-red-400 font-bold text-sm">{person.known_for_department}</span>
                                </div>
                            )}

                            {/* Name */}
                            <h1 className="text-6xl lg:text-7xl font-black leading-tight">
                                <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                                    {person.name}
                                </span>
                            </h1>

                            {/* Quick Info Pills */}
                            <div className="flex flex-wrap gap-3">
                                {person.birthday && (
                                    <div className="bg-white/5 backdrop-blur-xl px-5 py-2.5 rounded-full flex items-center gap-2 border border-white/10">
                                        <Calendar className="w-4 h-4 text-red-400" />
                                        <span className="text-sm font-semibold text-white">
                                            {new Date(person.birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            {age && ` (${age})`}
                                        </span>
                                    </div>
                                )}
                                {person.place_of_birth && (
                                    <div className="bg-white/5 backdrop-blur-xl px-5 py-2.5 rounded-full flex items-center gap-2 border border-white/10">
                                        <MapPin className="w-4 h-4 text-blue-400" />
                                        <span className="text-sm font-semibold text-white truncate max-w-xs">
                                            {person.place_of_birth}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4 pt-4">
                                <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 text-center border border-white/10 hover:border-red-500/50 transition-all group relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                    <div className="relative text-4xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent mb-1">
                                        {allCredits.length}
                                    </div>
                                    <div className="relative text-sm text-gray-400 font-medium">Projects</div>
                                </div>

                                <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 text-center border border-white/10 hover:border-purple-500/50 transition-all group relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                    <div className="relative text-4xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent mb-1">
                                        {person.popularity?.toFixed(0) || 0}
                                    </div>
                                    <div className="relative text-sm text-gray-400 font-medium">Popularity</div>
                                </div>

                                <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 text-center border border-white/10 hover:border-yellow-500/50 transition-all group relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                    <div className="relative text-4xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent mb-1">
                                        {displayCredits.filter(c => c.vote_average >= 7).length}
                                    </div>
                                    <div className="relative text-sm text-gray-400 font-medium">Top Rated</div>
                                </div>
                            </div>

                            {/* Social Links */}
                            {person.external_ids && (
                                <div className="flex gap-3 pt-2">
                                    {person.external_ids.instagram_id && (
                                        <a
                                            href={`https://instagram.com/${person.external_ids.instagram_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-12 h-12 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 hover:bg-gradient-to-r hover:from-red-500/20 hover:to-orange-500/20 hover:border-red-500/30 transition-all"
                                        >
                                            <Instagram className="w-5 h-5 text-white" />
                                        </a>
                                    )}
                                    {person.external_ids.twitter_id && (
                                        <a
                                            href={`https://twitter.com/${person.external_ids.twitter_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-12 h-12 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 hover:bg-gradient-to-r hover:from-blue-500/20 hover:to-cyan-500/20 hover:border-blue-500/30 transition-all"
                                        >
                                            <Twitter className="w-5 h-5 text-white" />
                                        </a>
                                    )}
                                    {person.external_ids.facebook_id && (
                                        <a
                                            href={`https://facebook.com/${person.external_ids.facebook_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-12 h-12 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-indigo-600/20 hover:border-blue-600/30 transition-all"
                                        >
                                            <Facebook className="w-5 h-5 text-white" />
                                        </a>
                                    )}
                                    {person.external_ids.imdb_id && (
                                        <a
                                            href={`https://www.imdb.com/name/${person.external_ids.imdb_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-12 h-12 bg-white/5 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 hover:bg-gradient-to-r hover:from-yellow-500/20 hover:to-amber-500/20 hover:border-yellow-500/30 transition-all"
                                        >
                                            <Star className="w-5 h-5 text-white" />
                                        </a>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </div>
                </div>

                {/* Wave Divider */}
                <div className="absolute bottom-0 left-0 right-0">
                    <svg viewBox="0 0 1440 120" fill="none" className="w-full h-16">
                        <path d="M0 0L60 10C120 20 240 40 360 46.7C480 53 600 47 720 43.3C840 40 960 40 1080 46.7C1200 53 1320 67 1380 73.3L1440 80V120H0V0Z" fill="#000000" />
                    </svg>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">
                {/* Biography */}
                {person.biography && (
                    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-xl shadow-red-500/20">
                                <Sparkles className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-5xl font-black text-white">About {person.name.split(' ')[0]}</h2>
                        </div>
                        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 hover:border-white/20 transition-all">
                            <p className="text-gray-300 leading-relaxed text-lg">{displayBio}</p>
                            {shouldTruncateBio && (
                                <button
                                    onClick={() => setBioExpanded(!bioExpanded)}
                                    className="mt-6 text-red-400 hover:text-red-300 font-semibold text-sm flex items-center gap-2 transition-colors"
                                >
                                    {bioExpanded ? (
                                        <>
                                            <ChevronUp className="w-4 h-4" /> Show less
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="w-4 h-4" /> Read more
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </motion.section>
                )}

                {/* Collaborations */}
                {collaborations && collaborations.length > 0 && (
                    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-xl shadow-green-500/20">
                                <Users className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-5xl font-black text-white">Frequent Collaborators</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {collaborations.slice(0, 6).map((collab, idx) => (
                                <Link key={collab.id} href={`/celeb/${collab.id}`} className="block">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-green-500/50 hover:scale-105 transition-all group cursor-pointer"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <h3 className="text-white font-bold text-xl mb-1 group-hover:text-green-400 transition-colors">
                                                    {collab.name}
                                                </h3>
                                                <p className="text-gray-500 text-sm">
                                                    Co-starred in {collab.count} project{collab.count > 1 ? "s" : ""}
                                                </p>
                                            </div>
                                            <div className="px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-full border border-green-500/30">
                                                <span className="text-green-400 text-xl font-black">{collab.count}</span>
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

                {/* Career Statistics */}
                <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-xl shadow-yellow-500/20">
                            <Trophy className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-5xl font-black text-white">Career Statistics</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-xl rounded-2xl p-8 border border-blue-500/20 hover:border-blue-500/40 hover:scale-105 transition-all group text-center"
                        >
                            <Film className="w-12 h-12 text-blue-400 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                            <div className="text-5xl font-black text-white mb-2">{movieCredits.length}</div>
                            <div className="text-sm text-gray-400 font-medium">Feature Films</div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-xl rounded-2xl p-8 border border-purple-500/20 hover:border-purple-500/40 hover:scale-105 transition-all group text-center"
                        >
                            <Tv className="w-12 h-12 text-purple-400 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                            <div className="text-5xl font-black text-white mb-2">{tvCredits.length}</div>
                            <div className="text-sm text-gray-400 font-medium">TV Productions</div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 backdrop-blur-xl rounded-2xl p-8 border border-yellow-500/20 hover:border-yellow-500/40 hover:scale-105 transition-all group text-center"
                        >
                            <Star className="w-12 h-12 text-yellow-400 mx-auto mb-4 group-hover:scale-110 transition-transform" fill="currentColor" />
                            <div className="text-5xl font-black text-white mb-2">
                                {allCredits.filter(c => c.vote_average >= 7).length}
                            </div>
                            <div className="text-sm text-gray-400 font-medium">Highly Rated</div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-xl rounded-2xl p-8 border border-green-500/20 hover:border-green-500/40 hover:scale-105 transition-all group text-center"
                        >
                            <Clock className="w-12 h-12 text-green-400 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                            <div className="text-5xl font-black text-white mb-2">
                                {person.birthday ? new Date().getFullYear() - new Date(person.birthday).getFullYear() : 0}+
                            </div>
                            <div className="text-sm text-gray-400 font-medium">Years Active</div>
                        </motion.div>
                    </div>
                </motion.section>

                {/* Genre Stats */}
                {topGenres.length > 0 && (
                    <section>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-xl shadow-purple-500/20">
                                <Film className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-5xl font-black text-white">Genre Breakdown</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Genre Chart */}
                            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10">
                                <h3 className="text-2xl font-bold mb-6 text-white">Top Genres</h3>
                                <div className="space-y-6">
                                    {topGenres.map(([genre, count], idx) => {
                                        const percentage = totalGenreWorks > 0 ? (count / totalGenreWorks) * 100 : 0;
                                        const colors = [
                                            'from-red-500 to-orange-500',
                                            'from-purple-500 to-pink-500',
                                            'from-blue-500 to-cyan-500',
                                            'from-green-500 to-emerald-500',
                                            'from-yellow-500 to-amber-500'
                                        ];
                                        return (
                                            <div key={genre}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-white font-semibold">{genre}</span>
                                                    <span className="text-gray-400 text-sm">
                                                        {count} works ({percentage.toFixed(0)}%)
                                                    </span>
                                                </div>
                                                <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${percentage}%` }}
                                                        transition={{ duration: 1, delay: idx * 0.1 }}
                                                        className={`h-full bg-gradient-to-r ${colors[idx]}`}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Genre Summary */}
                            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 space-y-8">
                                <div>
                                    <p className="text-gray-400 text-sm mb-3">Most Frequent</p>
                                    <p className="text-4xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                                        {topGenres[0]?.[0] || 'N/A'}
                                    </p>
                                    <p className="text-red-400 font-semibold mt-1">{topGenres[0]?.[1] || 0} works</p>
                                </div>
                                <div className="border-t border-white/10 pt-8">
                                    <p className="text-gray-400 text-sm mb-3">Total Genres</p>
                                    <p className="text-4xl font-black text-white">{Object.keys(genreStats).length}</p>
                                    <p className="text-gray-500 text-sm mt-1">Across {allCredits.length} productions</p>
                                </div>
                                <div className="border-t border-white/10 pt-8">
                                    <p className="text-gray-400 text-sm mb-4">Specialization</p>
                                    <div className="flex flex-wrap gap-2">
                                        {topGenres.slice(0, 3).map(([genre]) => (
                                            <span
                                                key={genre}
                                                className="px-4 py-2 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-full text-red-400 text-sm font-bold hover:scale-105 transition-transform cursor-pointer"
                                            >
                                                {genre}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Photos */}
                {person.images?.profiles && person.images.profiles.length > 0 && (
                    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-xl shadow-pink-500/20">
                                    <Camera className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-5xl font-black text-white">Gallery</h2>
                                    <p className="text-gray-500 text-sm mt-1">{person.images.profiles.length} photos</p>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {person.images.profiles.slice(0, 12).map((img, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: idx * 0.05 }}
                                    whileHover={{ scale: 1.05 }}
                                    className="relative aspect-[2/3] rounded-2xl overflow-hidden cursor-pointer group bg-gray-900 ring-2 ring-white/10 hover:ring-pink-500/50 transition-all"
                                    onClick={() => setSelectedImage(`https://image.tmdb.org/t/p/original${img.file_path}`)}
                                >
                                    <Image
                                        src={`https://image.tmdb.org/t/p/w342${img.file_path}`}
                                        alt={`${person.name} photo`}
                                        fill
                                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                        <Camera className="w-6 h-6 text-white" />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.section>
                )}

                {/* Upcoming Projects */}
                {upcomingProjects && upcomingProjects.length > 0 && (
                    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-xl shadow-cyan-500/20">
                                <Calendar className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-5xl font-black text-white">Coming Soon</h2>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                            {upcomingProjects.slice(0, 6).map((project, idx) => (
                                <motion.div
                                    key={project.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="group"
                                >
                                    <Link href={`/${project.media_type === "tv" ? "tv" : "movies"}/${project.id}`}>
                                        <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-gray-900 mb-3 ring-2 ring-white/10 group-hover:ring-cyan-500/50 transition-all shadow-lg">
                                            <Image
                                                src={
                                                    project.poster_path
                                                        ? `https://image.tmdb.org/t/p/w342${project.poster_path}`
                                                        : "/coming-soon.png"
                                                }
                                                alt={project.title || project.name || ""}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-110"
                                            />
                                            <div className="absolute top-3 left-3 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg shadow-lg">
                                                <span className="text-white text-xs font-bold">Upcoming</span>
                                            </div>
                                        </div>
                                        <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1">
                                            {project.title || project.name}
                                        </h3>
                                        <p className="text-gray-500 text-xs">
                                            {(project.release_date || project.first_air_date)
                                                ? new Date(project.release_date || project.first_air_date).toLocaleDateString('en-US', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })
                                                : "TBA"}
                                        </p>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </motion.section>
                )}

                {/* Similar Celebrities */}
                {similarPeople && similarPeople.length > 0 && (
                    <section>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-xl shadow-indigo-500/20">
                                <Users className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h2 className="text-5xl font-black text-white">You May Also Like</h2>
                                <p className="text-gray-500 text-sm mt-1">Based on {person.known_for_department} with similar style</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                            {similarPeople.slice(0, 6).map((similar, idx) => (
                                <Link key={similar.id} href={`/celeb/${similar.id}`}>
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="group cursor-pointer"
                                    >
                                        <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-gray-900 mb-3 ring-2 ring-white/10 group-hover:ring-indigo-500/50 transition-all">
                                            <Image
                                                src={
                                                    similar.profile_path
                                                        ? `https://image.tmdb.org/t/p/w342${similar.profile_path}`
                                                        : '/coming-soon.png'
                                                }
                                                alt={similar.name}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-110"
                                            />
                                        </div>
                                        <h3 className="text-white font-bold text-sm text-center line-clamp-2">{similar.name}</h3>
                                        <p className="text-gray-500 text-xs text-center">
                                            {similar.known_for_department || 'Actor'}
                                        </p>
                                    </motion.div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Filmography */}
                <section>
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-xl shadow-cyan-500/20">
                                <Film className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-5xl font-black text-white">Filmography</h2>
                        </div>

                        {/* Tab Filter */}
                        <div className="flex gap-2 bg-white/5 backdrop-blur-xl rounded-2xl p-1.5 border border-white/10">
                            <button
                                onClick={() => {
                                    setSelectedTab('all');
                                    setShowAllCredits(false);
                                }}
                                className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${selectedTab === 'all'
                                    ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                All ({allCredits.length})
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedTab('movies');
                                    setShowAllCredits(false);
                                }}
                                className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${selectedTab === 'movies'
                                    ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                Movies ({movieCredits.length})
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedTab('tv');
                                    setShowAllCredits(false);
                                }}
                                className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${selectedTab === 'tv'
                                    ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                TV ({tvCredits.length})
                            </button>
                        </div>
                    </div>

                    {/* Credits Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {visibleCredits.map((credit, index) => (
                            <motion.div
                                key={`${credit.id}-${index}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="group"
                            >
                                <Link href={`/${credit.media_type === "tv" ? "tv" : "movies"}/${credit.id}`}>
                                    <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-gray-900 mb-3 ring-2 ring-white/10 group-hover:ring-red-500/50 transition-all">
                                        <Image
                                            src={
                                                credit.poster_path
                                                    ? `https://image.tmdb.org/t/p/w342${credit.poster_path}`
                                                    : "/coming-soon.png"
                                            }
                                            alt={credit.title || credit.name || ""}
                                            fill
                                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                        {credit.vote_average > 0 && (
                                            <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                                                <Star className="w-4 h-4 text-yellow-400" fill="currentColor" />
                                                <span className="text-white text-sm font-bold">
                                                    {credit.vote_average.toFixed(1)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="text-white font-bold text-sm line-clamp-2 mb-1">
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
                                className="px-10 py-4 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-2xl font-bold hover:shadow-2xl hover:shadow-red-500/50 transition-all hover:scale-105 flex items-center gap-3 mx-auto"
                            >
                                {showAllCredits ? (
                                    <>
                                        Show Less <ChevronUp className="w-5 h-5" />
                                    </>
                                ) : (
                                    <>
                                        View All {displayCredits.length} <ChevronDown className="w-5 h-5" />
                                    </>
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
                            className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-colors border border-white/20"
                            onClick={() => setSelectedImage(null)}
                        >
                            <X className="w-6 h-6 text-white" />
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