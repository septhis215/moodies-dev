"use client";

import { useState, useEffect } from 'react';
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
    Sparkles,
    TrendingUp,
    Star,
    ChevronDown,
    ChevronUp,
    Camera,
    Users,
    Trophy,
    Heart
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
    external_ids: {
        instagram_id: string;
        twitter_id: string;
        facebook_id: string;
        imdb_id: string;
    };
    images: {
        profiles: Array<{ file_path: string; vote_average: number }>;
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

export default function CelebrityDetailPage({ params }: { params: { id: string } }) {
    const [person, setPerson] = useState<Person | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedTab, setSelectedTab] = useState<'movies' | 'tv'>('movies');
    const [bioExpanded, setBioExpanded] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    // Error: Route "/celeb/[id]" used `params.id`. `params` should be awaited before using its properties. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis
    //     at CelebrityDetailPage (app\celeb\[id]\page.tsx:97:16)
    //    95 |
    //    96 |         fetchPerson();
    // >  97 |     }, [params.id]);
    //       |                ^
    //    98 |
    //    99 |     if (loading) {
    //   100 |         return (
    useEffect(() => {
        const fetchPerson = async () => {
            try {
                const base = process.env.NEXT_PUBLIC_NEST_API_URL || 'http://localhost:4000';
                const res = await fetch(`${base}/people/${params.id}`);
                const data = await res.json();
                setPerson(data);
            } catch (error) {
                console.error('Error fetching celebrity:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPerson();
    }, [params.id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-white text-xl font-semibold">Loading celebrity profile...</p>
                </div>
            </div>
        );
    }

    if (!person) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <Trophy className="w-20 h-20 text-gray-600 mx-auto mb-4" />
                    <h2 className="text-white text-2xl font-bold mb-2">Celebrity not found</h2>
                    <p className="text-gray-400">The celebrity you're looking for doesn't exist.</p>
                </div>
            </div>
        );
    }

    const movieCredits = person.combined_credits?.cast.filter(c => c.media_type === 'movie').sort((a, b) => b.vote_average - a.vote_average) || [];
    const tvCredits = person.combined_credits?.cast.filter(c => c.media_type === 'tv').sort((a, b) => b.vote_average - a.vote_average) || [];
    const displayCredits = selectedTab === 'movies' ? movieCredits : tvCredits;

    const age = person.birthday ? new Date().getFullYear() - new Date(person.birthday).getFullYear() : null;
    const shouldTruncateBio = person.biography && person.biography.length > 400;
    const displayBio = shouldTruncateBio && !bioExpanded ? person.biography.slice(0, 400) + '...' : person.biography;

    // Get backdrop image (highest rated profile)
    const backdropImage = person.images?.profiles?.sort((a, b) => b.vote_average - a.vote_average)[0]?.file_path || person.images?.profiles?.[0]?.file_path;

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Enhanced Hero Section */}
            <div className="relative h-screen max-h-[900px] overflow-hidden">
                {/* Backdrop with Parallax Effect */}
                <motion.div
                    className="absolute inset-0"
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 1.5 }}
                >
                    {backdropImage && (
                        <Image
                            src={`https://image.tmdb.org/t/p/original${backdropImage}`}
                            alt={person.name}
                            fill
                            className="object-cover object-center filter brightness-50"
                            priority
                        />
                    )}
                    {/* Multi-layer gradients for depth */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/80"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                </motion.div>

                {/* Floating Particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(15)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute w-1 h-1 bg-white rounded-full opacity-30"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                            }}
                            animate={{
                                y: [0, -30, 0],
                                opacity: [0.3, 0.6, 0.3],
                            }}
                            transition={{
                                duration: 3 + Math.random() * 2,
                                repeat: Infinity,
                                delay: Math.random() * 2,
                            }}
                        />
                    ))}
                </div>

                {/* Content */}
                <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-end pb-16">
                    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 w-full items-center lg:items-end">
                        {/* Profile Image with Enhanced Design */}
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="relative flex-shrink-0 group"
                        >
                            <div className="absolute -inset-4 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 rounded-3xl blur-2xl opacity-50 group-hover:opacity-70 transition-opacity"></div>
                            <div className="relative w-64 h-96 sm:w-72 sm:h-[430px] rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white/20">
                                <Image
                                    src={
                                        person.profile_path
                                            ? `https://image.tmdb.org/t/p/w500${person.profile_path}`
                                            : '/placeholder.jpg'
                                    }
                                    alt={person.name}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                                {/* Overlay gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </div>

                            {/* Stats Badge */}
                            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-black/80 backdrop-blur-xl border border-white/20 shadow-xl">
                                <TrendingUp className="w-4 h-4 text-orange-400" />
                                <span className="text-sm font-bold">{person.popularity.toFixed(1)}</span>
                                <span className="text-xs text-gray-400">Popularity</span>
                            </div>
                        </motion.div>

                        {/* Info Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="flex-1 text-center lg:text-left"
                        >
                            {/* Department Badge */}
                            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600/30 to-pink-600/30 backdrop-blur-md border border-purple-500/50 text-white px-5 py-2 rounded-full text-sm font-bold mb-4 shadow-lg">
                                <Award className="w-4 h-4" />
                                <span>{person.known_for_department}</span>
                            </div>

                            {/* Name */}
                            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black mb-4 tracking-tight">
                                <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent drop-shadow-2xl">
                                    {person.name}
                                </span>
                            </h1>

                            {/* Also Known As */}
                            {person.also_known_as && person.also_known_as.length > 0 && (
                                <p className="text-gray-400 text-sm mb-6 italic">
                                    Also known as: {person.also_known_as.slice(0, 2).join(', ')}
                                </p>
                            )}

                            {/* Info Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 max-w-2xl mx-auto lg:mx-0">
                                {person.birthday && (
                                    <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                                        <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
                                            <Calendar className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 font-medium">Born</p>
                                            <p className="text-white font-semibold">
                                                {new Date(person.birthday).toLocaleDateString('en-US', {
                                                    month: 'long',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </p>
                                            {age && <p className="text-xs text-gray-500">{age} years old</p>}
                                        </div>
                                    </div>
                                )}

                                {person.place_of_birth && (
                                    <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                                        <div className="w-10 h-10 rounded-full bg-pink-600/20 flex items-center justify-center">
                                            <MapPin className="w-5 h-5 text-pink-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-gray-400 font-medium">Birthplace</p>
                                            <p className="text-white font-semibold truncate">
                                                {person.place_of_birth}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Social Links */}
                            <div className="flex items-center justify-center lg:justify-start gap-3">
                                {person.external_ids?.instagram_id && (
                                    <a
                                        href={`https://instagram.com/${person.external_ids.instagram_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center hover:scale-110 transition-all shadow-lg hover:shadow-purple-500/50"
                                    >
                                        <Instagram className="w-6 h-6" />
                                    </a>
                                )}
                                {person.external_ids?.twitter_id && (
                                    <a
                                        href={`https://twitter.com/${person.external_ids.twitter_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center hover:scale-110 transition-all shadow-lg hover:shadow-blue-500/50"
                                    >
                                        <Twitter className="w-6 h-6" />
                                    </a>
                                )}
                                {person.external_ids?.facebook_id && (
                                    <a
                                        href={`https://facebook.com/${person.external_ids.facebook_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-700 to-blue-500 flex items-center justify-center hover:scale-110 transition-all shadow-lg hover:shadow-blue-500/50"
                                    >
                                        <Facebook className="w-6 h-6" />
                                    </a>
                                )}
                                {person.external_ids?.imdb_id && (
                                    <a
                                        href={`https://www.imdb.com/name/${person.external_ids.imdb_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center hover:scale-110 transition-all"
                                    >
                                        <Star className="w-6 h-6" />
                                    </a>
                                )}

                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
                {/* Biography Section - Improved */}
                {person.biography && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="relative"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 flex items-center justify-center">
                                <Sparkles className="w-6 h-6 text-purple-400" />
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-black">Biography</h2>
                        </div>

                        <div className="relative bg-gradient-to-br from-white/5 to-white/[0.02] rounded-2xl p-6 sm:p-8 border border-white/10 backdrop-blur-sm">
                            <p className="text-gray-300 leading-relaxed text-base sm:text-lg">
                                {displayBio}
                            </p>

                            {shouldTruncateBio && (
                                <button
                                    onClick={() => setBioExpanded(!bioExpanded)}
                                    className="mt-4 inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                                >
                                    {bioExpanded ? (
                                        <>
                                            <span>Read less</span>
                                            <ChevronUp className="w-4 h-4" />
                                        </>
                                    ) : (
                                        <>
                                            <span>Read more</span>
                                            <ChevronDown className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Photo Gallery Section */}
                {person.images?.profiles && person.images.profiles.length > 1 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600/20 to-cyan-600/20 flex items-center justify-center">
                                <Camera className="w-6 h-6 text-blue-400" />
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-black">Photo Gallery</h2>
                            <span className="text-sm text-gray-500 ml-2">{person.images.profiles.length} photos</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                            {person.images.profiles.slice(0, 12).map((image, index) => (
                                <motion.div
                                    key={index}
                                    whileHover={{ scale: 1.05 }}
                                    className="relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer group"
                                    onClick={() => setSelectedImageIndex(index)}
                                >
                                    <Image
                                        src={`https://image.tmdb.org/t/p/w342${image.file_path}`}
                                        alt={`${person.name} photo ${index + 1}`}
                                        fill
                                        className="object-cover transition-transform duration-300 group-hover:scale-110"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}


                {/* Photo Gallery Section */}
                {person.tagged_images?.results?.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="mt-10"
                    >
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 flex items-center justify-center">
                                <Camera className="w-6 h-6 text-pink-400" />
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-black">Tagged Images</h2>
                            <span className="text-sm text-gray-500 ml-2">
                                {person.tagged_images.results.length} tags
                            </span>
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                            {person.tagged_images.results.slice(0, 12).map((tagged, index) => (
                                <motion.div
                                    key={tagged.media?.id || index}
                                    whileHover={{ scale: 1.05 }}
                                    className="relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer group"
                                >
                                    <Link
                                        href={`/${tagged.media?.media_type === "tv" ? "tv" : "movies"}/${tagged.media?.id}`}
                                        className="block relative w-full h-full"
                                    >
                                        <Image
                                            src={`https://image.tmdb.org/t/p/w342${tagged.file_path}`}
                                            alt={`${person.name} tagged image ${index + 1}`}
                                            fill
                                            className="object-cover transition-transform duration-300 group-hover:scale-110"
                                        />

                                        {/* Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                        {/* Caption */}
                                        <div className="absolute bottom-0 p-3 text-sm">
                                            {tagged.media?.title || tagged.media?.name ? (
                                                <p className="text-white font-semibold line-clamp-2">
                                                    {tagged.media?.title || tagged.media?.name}
                                                </p>
                                            ) : (
                                                <p className="text-gray-300 italic">Untitled</p>
                                            )}
                                            {tagged.media && tagged.media?.vote_average > 0 && (
                                                <div className="flex items-center gap-1 text-yellow-400 text-xs mt-1">
                                                    <Star className="w-3 h-3" fill="currentColor" />
                                                    {tagged.media.vote_average.toFixed(1)}
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}


                {/* Career Stats */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="grid grid-cols-2 sm:grid-cols-4 gap-4"
                >
                    <div className="bg-gradient-to-br from-purple-600/10 to-purple-600/5 rounded-2xl p-6 border border-purple-500/20">
                        <Film className="w-8 h-8 text-purple-400 mb-3" />
                        <p className="text-3xl font-black text-white mb-1">{movieCredits.length}</p>
                        <p className="text-sm text-gray-400 font-medium">Movies</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-600/10 to-blue-600/5 rounded-2xl p-6 border border-blue-500/20">
                        <Tv className="w-8 h-8 text-blue-400 mb-3" />
                        <p className="text-3xl font-black text-white mb-1">{tvCredits.length}</p>
                        <p className="text-sm text-gray-400 font-medium">TV Shows</p>
                    </div>
                    <div className="bg-gradient-to-br from-pink-600/10 to-pink-600/5 rounded-2xl p-6 border border-pink-500/20">
                        <Users className="w-8 h-8 text-pink-400 mb-3" />
                        <p className="text-3xl font-black text-white mb-1">{(movieCredits.length + tvCredits.length)}</p>
                        <p className="text-sm text-gray-400 font-medium">Total Credits</p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-600/10 to-orange-600/5 rounded-2xl p-6 border border-orange-500/20">
                        <Trophy className="w-8 h-8 text-orange-400 mb-3" />
                        <p className="text-3xl font-black text-white mb-1">
                            {displayCredits.filter(c => c.vote_average >= 7).length}
                        </p>
                        <p className="text-sm text-gray-400 font-medium">Highly Rated</p>
                    </div>
                </motion.div>

                {/* Known For Section - Enhanced */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-600/20 to-red-600/20 flex items-center justify-center">
                                <Film className="w-6 h-6 text-orange-400" />
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-black">Known For</h2>
                        </div>

                        {/* Enhanced Tab Switcher */}
                        <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm rounded-full p-1.5 border border-white/10">
                            <button
                                onClick={() => setSelectedTab('movies')}
                                className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${selectedTab === 'movies'
                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                <span className="flex items-center gap-2">
                                    <Film className="w-4 h-4" />
                                    Movies ({movieCredits.length})
                                </span>
                            </button>
                            <button
                                onClick={() => setSelectedTab('tv')}
                                className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${selectedTab === 'tv'
                                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                <span className="flex items-center gap-2">
                                    <Tv className="w-4 h-4" />
                                    TV ({tvCredits.length})
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Credits Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                        <AnimatePresence mode="popLayout">
                            {displayCredits.slice(0, 18).map((credit, index) => (
                                <motion.div
                                    key={`${credit.id}-${index}`}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ delay: index * 0.03 }}
                                    className="relative group cursor-pointer"
                                >
                                    <Link
                                        href={`/${credit.media_type === "tv" ? "tv" : "movies"}/${credit.id}`}
                                        className="block relative aspect-[2/3] rounded-2xl overflow-hidden bg-gray-900 shadow-xl"
                                    >
                                        <Image
                                            src={
                                                credit.poster_path
                                                    ? `https://image.tmdb.org/t/p/w342${credit.poster_path}`
                                                    : "/placeholder.jpg"
                                            }
                                            alt={credit.title || credit.name || ""}
                                            fill
                                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                                        />

                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>

                                        {credit.vote_average > 0 && (
                                            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-500/90 backdrop-blur-sm text-black text-xs font-bold shadow-lg">
                                                <Star className="w-3 h-3" fill="currentColor" />
                                                {credit.vote_average.toFixed(1)}
                                            </div>
                                        )}

                                        <div className="absolute bottom-0 left-0 right-0 p-4">
                                            <h3 className="text-white font-bold text-sm line-clamp-2 mb-1 drop-shadow-lg">
                                                {credit.title || credit.name}
                                            </h3>
                                            {credit.character && (
                                                <p className="text-gray-300 text-xs line-clamp-1">as {credit.character}</p>
                                            )}
                                        </div>

                                        {/* Hover Glow */}
                                        <motion.div
                                            initial={false}
                                            animate={{ opacity: 0 }}
                                            whileHover={{ opacity: 1 }}
                                            className="absolute inset-0 ring-2 ring-purple-500/50 rounded-2xl pointer-events-none"
                                        />
                                    </Link>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    {displayCredits.length > 18 && (
                        <div className="mt-10 text-center">
                            <button className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-bold hover:scale-105 transition-all shadow-lg hover:shadow-purple-500/50 flex items-center gap-2 mx-auto">
                                View All {displayCredits.length} {selectedTab === 'movies' ? 'Movies' : 'Shows'}
                                <ChevronDown className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
                            </button>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}