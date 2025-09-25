// app/search/page.tsx
"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Star,
    Calendar,
    Users,
    Play,
    Info,
    Filter,
    Grid3X3,
    List,
    Tv,
    Film,
    Search,
    X,
    ChevronDown,
    SlidersHorizontal,
    Globe,
    Sparkles,
    ExternalLink
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { All } from '@/types/all';
import dynamic from "next/dynamic";

// dynamic import (no SSR)
const TrailerModal = dynamic(() => import("../../components/sections/TrailerModal"), { ssr: false });


interface SearchResult {
    id: number;
    title?: string;
    name?: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date?: string;
    first_air_date?: string;
    vote_average: number;
    vote_count: number;
    type: 'movie' | 'tv';
    genre_ids: number[];
    genres: string[];
    popularity: number;
    adult?: boolean;
    origin_country?: string[];
    trailer_key?: string | null;
}

interface SearchResponse {
    results: SearchResult[];
    total_results: number;
    total_pages: number;
    page: number;
    best_match?: SearchResult;
    applied_filters?: {
        type?: string;
        sort?: string;
        year_range?: { min?: number; max?: number };
        rating_range?: { min?: number; max?: number };
        genres?: string[];
        countries?: string[];
    };
}

const GENRE_OPTIONS = [
    'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
    'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery',
    'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'
];

const COUNTRY_OPTIONS = [
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'CA', name: 'Canada' },
    { code: 'AU', name: 'Australia' },
    { code: 'FR', name: 'France' },
    { code: 'DE', name: 'Germany' },
    { code: 'IT', name: 'Italy' },
    { code: 'ES', name: 'Spain' },
    { code: 'JP', name: 'Japan' },
    { code: 'KR', name: 'South Korea' },
    { code: 'CN', name: 'China' },
    { code: 'IN', name: 'India' },
    { code: 'BR', name: 'Brazil' },
    { code: 'MX', name: 'Mexico' },
    { code: 'RU', name: 'Russia' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'SE', name: 'Sweden' },
    { code: 'NO', name: 'Norway' },
    { code: 'DK', name: 'Denmark' },
    { code: 'FI', name: 'Finland' }
];

const YEAR_OPTIONS = Array.from({ length: 2025 - 1950 + 1 }, (_, i) => 2025 - i);

export default function SearchResultsPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const query = searchParams.get('q') || '';

    const [results, setResults] = useState<SearchResult[]>([]);
    const [bestMatch, setBestMatch] = useState<SearchResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalResults, setTotalResults] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [availableGenres, setAvailableGenres] = useState<string[]>([]);
    const [availableCountries, setAvailableCountries] = useState(COUNTRY_OPTIONS);

    // UI State
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<'relevance' | 'rating' | 'date' | 'popularity'>('relevance');
    const [filterType, setFilterType] = useState<'all' | 'movie' | 'tv'>('all');
    const [showFilters, setShowFilters] = useState(false);

    // Enhanced filter states
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [yearMin, setYearMin] = useState<number | null>(null);
    const [yearMax, setYearMax] = useState<number | null>(null);
    const [ratingMin, setRatingMin] = useState<number | null>(null);
    const [ratingMax, setRatingMax] = useState<number | null>(null);
    const [includeAdult, setIncludeAdult] = useState(false);

    // state to manage inline iframe trailer playback
    // Trailer modal state
    const [selectedTrailer, setSelectedTrailer] = useState<All | null>(null);

    // Convert SearchResult to All type for TrailerModal
    const convertToTrailerData = (item: SearchResult): All => {

        return {
            id: item.id,
            title: getTitle(item),
            overview: item.overview ?? "",
            poster_path: item.poster_path ?? null,
            backdrop_path: item.backdrop_path ?? null,
            // keep same union shape as All; use null when unknown
            release_date: item.release_date ?? item.first_air_date ?? null,
            // numeric fields with defaults
            vote_average: item.vote_average ?? 0,
            popularity: item.popularity ?? 0,
            // arrays / optional maps
            origin_country: (item as any).origin_country ?? [],
            genres: item.genres,
            // fields that may not be in SearchResult — default to null
            runtime: (item as any).runtime ?? null,
            number_of_episodes: (item as any).number_of_episodes ?? null,
            // trailer key if you stored it in search results; null otherwise
            trailer_key: (item as any).trailer_key ?? null,
            // recommendations default empty array
            recommendations: [] as All["recommendations"],
            // THIS WAS MISSING and caused the TS error
            type: item.type,
        };
    };

    // Handle play trailer button click
    const handlePlayTrailer = async (item: SearchResult) => {
        try {
            console.log(item.trailer_key);
            // First try to get trailer from the item itself
            if (item.trailer_key) {
                const trailerData = convertToTrailerData({ ...item, trailer_key: item.trailer_key });
                setSelectedTrailer(trailerData);
                return;
            }

            // If no trailer key, try to fetch it from the API
            const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
            const endpoint = item.type === 'tv' ? 'tv' : 'movies';

            const response = await fetch(`${base}/${endpoint}/${item.id}/videos`);
            if (response.ok) {
                const videoData = await response.json();
                const trailer = videoData.results?.find((video: any) =>
                    video.type === 'Trailer' && video.site === 'YouTube'
                ) || videoData.results?.[0];

                if (trailer) {
                    const trailerData = convertToTrailerData({
                        ...item,
                        trailer_key: trailer.key
                    });
                    setSelectedTrailer(trailerData);
                } else {
                    // Fallback: open YouTube search
                    const searchQuery = encodeURIComponent(`${getTitle(item)} trailer`);
                    window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
                }
            } else {
                // Fallback: open YouTube search
                const searchQuery = encodeURIComponent(`${getTitle(item)} trailer`);
                window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
            }
        } catch (error) {
            console.error('Error fetching trailer:', error);
            // Fallback: open YouTube search
            const searchQuery = encodeURIComponent(`${getTitle(item)} trailer`);
            window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
        }
    };

    // Handle trailer modal close
    const handleCloseTrailer = () => {
        setSelectedTrailer(null);
    };

    // Handle selecting a trailer from recommendations
    const handleSelectTrailer = async (trailer: All) => {
        setSelectedTrailer(trailer);
    };





    // Load available genres and countries
    useEffect(() => {
        const loadGenres = async () => {
            try {
                const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
                const response = await fetch(`${base}/search/genres`);
                if (response.ok) {
                    const data = await response.json();
                    setAvailableGenres(data.genres || GENRE_OPTIONS);
                } else {
                    setAvailableGenres(GENRE_OPTIONS);
                }
            } catch (error) {
                setAvailableGenres(GENRE_OPTIONS);
            }
        };
        loadGenres();
    }, []);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [currentPage]);

    // Fetch search results
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setBestMatch(null);
            setLoading(false);
            return;
        }

        const fetchResults = async () => {
            setLoading(true);
            setError(null);

            try {
                const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
                const params = new URLSearchParams({
                    q: query,
                    page: currentPage.toString(),
                    type: filterType,
                    sort: sortBy,
                    include_adult: includeAdult.toString(),
                });

                // Add filter parameters
                if (selectedGenres.length > 0) {
                    params.append('genres', selectedGenres.join(','));
                }
                if (selectedCountries.length > 0) {
                    params.append('countries', selectedCountries.join(','));
                }
                if (yearMin !== null) {
                    params.append('year_min', yearMin.toString());
                }
                if (yearMax !== null) {
                    params.append('year_max', yearMax.toString());
                }
                if (ratingMin !== null) {
                    params.append('rating_min', ratingMin.toString());
                }
                if (ratingMax !== null) {
                    params.append('rating_max', ratingMax.toString());
                }

                const response = await fetch(`${base}/search?${params}`);

                if (!response.ok) throw new Error('Search failed');

                const data: SearchResponse = await response.json();
                setResults(data.results || []);
                setBestMatch(data.best_match || null);
                setTotalResults(data.total_results || 0);
                setTotalPages(data.total_pages || 0);
            } catch (err) {
                setError('Failed to search. Please try again.');
                console.error('Search error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [query, currentPage, filterType, sortBy, selectedGenres, selectedCountries, yearMin, yearMax, ratingMin, ratingMax, includeAdult]);

    // Helper functions
    const getTitle = (item: SearchResult) => item.title || item.name || 'Unknown Title';
    const getReleaseYear = (item: SearchResult) => {
        const date = item.release_date || item.first_air_date;
        return date ? new Date(date).getFullYear() : null;
    };

    const getPosterUrl = (item: SearchResult) => {
        return item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : '/placeholder.jpg';
    };

    const getBackdropUrl = (item: SearchResult) => {
        return item.backdrop_path
            ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
            : '/placeholder-backdrop.jpg';
    };

    const getGenres = (item: SearchResult) => {
        return item.genres?.slice(0, 2) || [];
    };

    const getCountryName = (code: string) => {
        return COUNTRY_OPTIONS.find(c => c.code === code)?.name || code;
    };

    const handleCardClick = (item: SearchResult) => {
        const path = item.type === 'tv' ? '/tv' : '/movies';
        router.push(`${path}/${item.id}`);
    };

    const handleGenreToggle = (genre: string) => {
        setSelectedGenres(prev =>
            prev.includes(genre)
                ? prev.filter(g => g !== genre)
                : [...prev, genre]
        );
    };

    const handleCountryToggle = (country: string) => {
        setSelectedCountries(prev =>
            prev.includes(country)
                ? prev.filter(c => c !== country)
                : [...prev, country]
        );
    };

    const clearAllFilters = () => {
        setSelectedGenres([]);
        setSelectedCountries([]);
        setYearMin(null);
        setYearMax(null);
        setRatingMin(null);
        setRatingMax(null);
        setFilterType('all');
        setSortBy('relevance');
        setIncludeAdult(false);
    };

    const hasActiveFilters = selectedGenres.length > 0 || selectedCountries.length > 0 ||
        yearMin !== null || yearMax !== null || ratingMin !== null ||
        ratingMax !== null || filterType !== 'all' || includeAdult;

    const getActiveFilterCount = () => {
        return selectedGenres.length + selectedCountries.length +
            (yearMin !== null ? 1 : 0) + (yearMax !== null ? 1 : 0) +
            (ratingMin !== null ? 1 : 0) + (ratingMax !== null ? 1 : 0) +
            (filterType !== 'all' ? 1 : 0) + (includeAdult ? 1 : 0);
    };

    if (!query.trim()) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white">
                <div className="container mx-auto px-4 pt-24 pb-20 text-center">
                    <Search className="mx-auto mb-6 h-20 w-20 text-gray-500" />
                    <h1 className="text-3xl font-bold text-gray-300 mb-3">Start Your Search</h1>
                    <p className="text-gray-400 text-lg">Enter a search term to discover amazing movies and TV shows</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black  text-white">
            <div className="container mx-auto px-15 pt-25 pb-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent mb-2">
                                Search results for "{query}"
                            </h1>
                            {!loading && (
                                <p className="text-gray-400 text-md flex items-center gap-2">
                                    <span>{totalResults.toLocaleString()} results found</span>
                                    {hasActiveFilters && (
                                        <Badge variant="outline" className="text-orange-400 border-orange-400/50 bg-orange-500/10">
                                            {getActiveFilterCount()} filters applied
                                        </Badge>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Enhanced Filters Section */}
                    <div className="bg-gray-800/40 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 shadow-xl mb-8">
                        <div className="flex flex-wrap items-center gap-4">
                            <Button
                                variant="outline"
                                onClick={() => setShowFilters(!showFilters)}
                                className={`bg-gradient-to-r from-gray-800/80 to-gray-700/80 backdrop-blur-sm border-gray-600 text-white hover:from-gray-700 hover:to-gray-600 transition-all duration-200 ${hasActiveFilters ? 'border-orange-500/50 text-orange-300 shadow-orange-500/20 shadow-lg' : ''
                                    }`}
                            >
                                <SlidersHorizontal size={16} className="mr-2" />
                                Advanced Filters
                                {hasActiveFilters && (
                                    <Badge variant="secondary" className="ml-2 bg-orange-500 text-white">
                                        {getActiveFilterCount()}
                                    </Badge>
                                )}
                                <ChevronDown
                                    size={16}
                                    className={`ml-2 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`}
                                />
                            </Button>

                            {/* Quick Filters */}
                            <div className="flex gap-3">
                                {(['all', 'movie', 'tv'] as const).map((type) => (
                                    <Badge
                                        key={type}
                                        variant={filterType === type ? 'default' : 'outline'}
                                        className={`cursor-pointer transition-all duration-200 px-4 py-2 font-medium ${filterType === type
                                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white border-transparent shadow-lg hover:shadow-orange-500/25'
                                            : 'border-gray-600 text-gray-300 hover:text-white hover:border-orange-400 hover:bg-orange-500/20 hover:shadow-lg'
                                            }`}
                                        onClick={() => setFilterType(type)}
                                    >
                                        {type === 'all' ? (
                                            <>
                                                <Sparkles size={12} className="mr-1" />
                                                All
                                            </>
                                        ) : type === 'movie' ? (
                                            <>
                                                <Film size={12} className="mr-1" />
                                                Movies
                                            </>
                                        ) : (
                                            <>
                                                <Tv size={12} className="mr-1" />
                                                TV Shows
                                            </>
                                        )}
                                    </Badge>
                                ))}
                            </div>

                            {hasActiveFilters && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearAllFilters}
                                    className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                                >
                                    <X size={14} className="mr-1" />
                                    Clear all
                                </Button>
                            )}
                        </div>

                        {/* Expanded Filters */}
                        <AnimatePresence>
                            {showFilters && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0, y: -10 }}
                                    animate={{ height: 'auto', opacity: 1, y: 0 }}
                                    exit={{ height: 0, opacity: 0, y: -10 }}
                                    transition={{ duration: 0.3, ease: "easeOut" }}
                                    className="border-t border-gray-700/50 pt-6 mt-4"
                                >
                                    <div className="grid gap-6">

                                        {/* Top row: Sort + Reset */}
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

                                            {/* Sort */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-gray-200 inline-flex items-center gap-2">
                                                    <SlidersHorizontal size={14} className="text-orange-400" />
                                                    Sort Results
                                                </label>
                                                <div className="inline-flex bg-gray-900/70 border border-gray-700 rounded-xl p-1 shadow-inner">
                                                    {[
                                                        { key: "relevance", label: "Relevance" },
                                                        { key: "rating", label: "Top Rated" },
                                                        { key: "date", label: "Newest" },
                                                        { key: "popularity", label: "Popular" },
                                                    ].map((opt) => {
                                                        const active = sortBy === opt.key;
                                                        return (
                                                            <button
                                                                key={opt.key}
                                                                onClick={() => setSortBy(opt.key as any)}
                                                                className={`px-3 py-1.5 text-xs rounded-lg transition 
                ${active
                                                                        ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md"
                                                                        : "text-gray-400 hover:bg-gray-800/80 hover:text-white"
                                                                    }`}
                                                                aria-pressed={active}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Content + Reset */}
                                            <div className="flex items-center gap-3">
                                                {/* Adult toggle */}
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-300">Adult</span>
                                                    <div
                                                        role="switch"
                                                        aria-checked={includeAdult}
                                                        onClick={() => setIncludeAdult((s) => !s)}
                                                        className={`relative inline-flex items-center h-5 w-10 rounded-full transition cursor-pointer 
            ${includeAdult ? "bg-red-500/90" : "bg-gray-600/70"}`}
                                                    >
                                                        <span
                                                            className={`absolute left-1 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform 
              ${includeAdult ? "translate-x-5" : "translate-x-0"}`}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Reset button */}
                                                <button
                                                    onClick={clearAllFilters}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-medium 
          bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-red-500 hover:to-orange-500 
          transition shadow"
                                                >
                                                    Reset
                                                </button>
                                            </div>
                                        </div>

                                        {/* Year Range */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-gray-200 inline-flex items-center gap-2">
                                                <Calendar size={14} className="text-blue-400" />
                                                Year
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={yearMin ?? ""}
                                                    onChange={(e) => setYearMin(e.target.value ? parseInt(e.target.value) : null)}
                                                    className="w-28 bg-gray-900/80 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white"
                                                >
                                                    <option value="">From</option>
                                                    {YEAR_OPTIONS.map((y) => (
                                                        <option key={y} value={y}>{y}</option>
                                                    ))}
                                                </select>

                                                <span className="text-gray-400 text-xs">—</span>

                                                <select
                                                    value={yearMax ?? ""}
                                                    onChange={(e) => setYearMax(e.target.value ? parseInt(e.target.value) : null)}
                                                    className="w-28 bg-gray-900/80 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white"
                                                >
                                                    <option value="">To</option>
                                                    {YEAR_OPTIONS.map((y) => (
                                                        <option key={y} value={y}>{y}</option>
                                                    ))}
                                                </select>

                                                {/* Quick chips */}
                                                <div className="flex gap-1 ml-2">
                                                    {[2025, 2020, 2010].map((y) => (
                                                        <button
                                                            key={y}
                                                            onClick={() => {
                                                                setYearMin(y);
                                                                setYearMax(y + 5);
                                                            }}
                                                            className="px-2 py-1 rounded bg-gray-800/70 border border-gray-700 text-xs text-gray-300 hover:bg-blue-600 hover:text-white"
                                                        >
                                                            {y}+
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Rating Range */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-gray-200 inline-flex items-center gap-2">
                                                <Star size={14} className="text-yellow-400" />
                                                Rating
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={10}
                                                    step={0.5}
                                                    value={ratingMin ?? 0}
                                                    onChange={(e) => setRatingMin(e.target.value ? parseFloat(e.target.value) : null)}
                                                    className="w-16 bg-gray-900/80 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white"
                                                />
                                                <span className="text-gray-400 text-xs">—</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={10}
                                                    step={0.5}
                                                    value={ratingMax ?? 10}
                                                    onChange={(e) => setRatingMax(e.target.value ? parseFloat(e.target.value) : null)}
                                                    className="w-16 bg-gray-900/80 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white"
                                                />
                                                <div className="flex gap-1">
                                                    {[2, 5, 8].map((v) => (
                                                        <button
                                                            key={v}
                                                            onClick={() => {
                                                                setRatingMin(v);
                                                                setRatingMax(10);
                                                            }}
                                                            className="px-2 py-1 rounded bg-gray-800/70 border border-gray-700 text-xs text-gray-300 hover:bg-yellow-500 hover:text-black"
                                                        >
                                                            {v}+
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>



                                        {/* Countries */}
                                        <div>
                                            <label className="text-sm font-semibold text-gray-200 mb-4 block flex items-center gap-2">
                                                <Globe size={16} className="text-green-400" />
                                                Countries
                                            </label>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                                {availableCountries.map((country) => (
                                                    <Badge
                                                        key={country.code}
                                                        variant={selectedCountries.includes(country.code) ? 'default' : 'outline'}
                                                        className={`cursor-pointer text-center justify-center transition-all duration-200 px-3 py-2 ${selectedCountries.includes(country.code)
                                                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white border-transparent shadow-lg'
                                                            : 'border-gray-600 text-gray-300 hover:text-white hover:border-green-400 hover:bg-green-500/20 hover:shadow-lg'
                                                            }`}
                                                        onClick={() => handleCountryToggle(country.code)}
                                                    >
                                                        {country.name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Genres */}
                                        <div>
                                            <label className="text-sm font-semibold text-gray-200 mb-4 block flex items-center gap-2">
                                                <Film size={16} className="text-purple-400" />
                                                Genres
                                            </label>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                                {availableGenres.map((genre) => (
                                                    <Badge
                                                        key={genre}
                                                        variant={selectedGenres.includes(genre) ? 'default' : 'outline'}
                                                        className={`cursor-pointer text-center justify-center transition-all duration-200 px-3 py-2 ${selectedGenres.includes(genre)
                                                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent shadow-lg'
                                                            : 'border-gray-600 text-gray-300 hover:text-white hover:border-purple-400 hover:bg-purple-500/20 hover:shadow-lg'
                                                            }`}
                                                        onClick={() => handleGenreToggle(genre)}
                                                    >
                                                        {genre}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="space-y-8">
                        {/* Best Match Skeleton */}
                        <div className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700">
                            <Skeleton className="h-6 w-48 bg-gray-700 mb-4" />
                            <div className="flex gap-6">
                                <Skeleton className="w-32 h-48 bg-gray-700 rounded-lg flex-shrink-0" />
                                <div className="flex-1 space-y-4">
                                    <Skeleton className="h-8 w-3/4 bg-gray-700" />
                                    <Skeleton className="h-4 w-full bg-gray-700" />
                                    <Skeleton className="h-4 w-2/3 bg-gray-700" />
                                    <div className="flex gap-2">
                                        <Skeleton className="h-6 w-16 bg-gray-700" />
                                        <Skeleton className="h-6 w-20 bg-gray-700" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Grid Skeleton */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="space-y-3">
                                    <Skeleton className="aspect-[2/3] w-full bg-gray-800/50 rounded-xl" />
                                    <Skeleton className="h-4 w-full bg-gray-800/50" />
                                    <Skeleton className="h-3 w-3/4 bg-gray-800/50" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="text-center py-16">
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 max-w-md mx-auto">
                            <X className="mx-auto mb-4 h-16 w-16 text-red-400" />
                            <h2 className="text-2xl font-semibold text-red-300 mb-3">Search Failed</h2>
                            <p className="text-gray-400 mb-6">{error}</p>
                            <Button
                                onClick={() => window.location.reload()}
                                className="bg-red-500 hover:bg-red-600 text-white"
                            >
                                Try Again
                            </Button>
                        </div>
                    </div>
                )}

                {/* Results */}
                {!loading && !error && (
                    <>
                        {results.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="bg-gray-800/30 border border-gray-700 rounded-2xl p-12 max-w-lg mx-auto">
                                    <Search className="mx-auto mb-6 h-20 w-20 text-gray-500" />
                                    <h2 className="text-2xl font-semibold text-gray-300 mb-4">No results found</h2>
                                    <p className="text-gray-400 mb-6">
                                        Try adjusting your search terms or filters to discover more content
                                    </p>
                                    {hasActiveFilters && (
                                        <Button
                                            onClick={clearAllFilters}
                                            variant="outline"
                                            className="border-orange-500 text-orange-400 hover:bg-orange-500/10"
                                        >
                                            Clear all filters
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Your Best Match Section */}
                                {bestMatch && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mb-12"
                                    >
                                        <div className="flex items-center gap-3 mb-6">
                                            <Sparkles className="text-gold-400" size={24} />
                                            <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                                                Your Best Match
                                            </h2>
                                        </div>

                                        <div className="bg-gradient-to-r from-gray-800/50 via-gray-800/30 to-gray-800/50 backdrop-blur-md rounded-3xl p-8 border border-gray-700/50 shadow-2xl">
                                            <div className="flex flex-col lg:flex-row gap-8">
                                                {/* Poster */}
                                                <div className="flex-shrink-0">
                                                    <div className="relative group cursor-pointer" onClick={() => handleCardClick(bestMatch)}>
                                                        <div className="relative w-48 h-72 rounded-2xl overflow-hidden border-2 border-gray-600 group-hover:border-orange-500/50 transition-all duration-300">
                                                            <Image
                                                                src={getPosterUrl(bestMatch)}
                                                                alt={getTitle(bestMatch)}
                                                                fill
                                                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                            />
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                                    <div className="bg-orange-500/20 backdrop-blur-sm rounded-full p-4 border border-orange-500/50">
                                                                        <Play className="text-white" size={24} fill="white" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 space-y-6">
                                                    <div>
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <Badge className={`${bestMatch.type === 'tv'
                                                                ? 'bg-blue-500 text-white'
                                                                : 'bg-purple-500 text-white'
                                                                }`}>
                                                                {bestMatch.type === 'tv' ? (
                                                                    <>
                                                                        <Tv size={12} className="mr-1" />
                                                                        TV Series
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Film size={12} className="mr-1" />
                                                                        Movie
                                                                    </>
                                                                )}
                                                            </Badge>
                                                            <div className="flex items-center gap-1">
                                                                <Star className="text-yellow-400" size={16} fill="currentColor" />
                                                                <span className="text-white font-semibold">{bestMatch.vote_average.toFixed(1)}</span>
                                                                <span className="text-gray-400">({(bestMatch.vote_count / 1000).toFixed(1)}K votes)</span>
                                                            </div>
                                                        </div>

                                                        <h3 className="text-3xl font-bold text-white mb-2">{getTitle(bestMatch)}</h3>

                                                        <div className="flex items-center gap-4 text-gray-300 mb-4">
                                                            {getReleaseYear(bestMatch) && (
                                                                <div className="flex items-center gap-1">
                                                                    <Calendar size={16} />
                                                                    <span>{getReleaseYear(bestMatch)}</span>
                                                                </div>
                                                            )}
                                                            {bestMatch.origin_country && bestMatch.origin_country.length > 0 && (
                                                                <div className="flex items-center gap-1">
                                                                    <Globe size={16} />
                                                                    <span>{getCountryName(bestMatch.origin_country[0])}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <p className="text-gray-300 text-lg leading-relaxed">
                                                        {bestMatch.overview}
                                                    </p>

                                                    {getGenres(bestMatch).length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {getGenres(bestMatch).map((genre) => (
                                                                <Badge key={genre} variant="outline" className="border-gray-500 text-gray-300 bg-gray-700/50">
                                                                    {genre}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className="flex gap-4">
                                                        <Button
                                                            onClick={() => handlePlayTrailer(bestMatch)}
                                                            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-orange-500/25 transition-all duration-200"
                                                        >
                                                            <Play size={16} className="mr-2" fill="currentColor" />
                                                            Play Trailer
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleCardClick(bestMatch)}
                                                            variant="outline"
                                                            className="border-gray-600 text-black hover:bg-gray-700/50 hover:text-white"
                                                        >
                                                            <Info size={16} className="mr-2" />
                                                            More Info
                                                        </Button>
                                                    </div>
                                                    {/* Lazy modal */}
                                                    {selectedTrailer && (
                                                        <TrailerModal
                                                            trailer={selectedTrailer}
                                                            onClose={() => setSelectedTrailer(null)}
                                                            onSelectTrailer={handleSelectTrailer}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}


                                {/* Featured Results (Top 2) */}
                                {results.length > 0 && (
                                    <div className="mb-12">
                                        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                                            Top Results
                                        </h2>
                                        <div className="grid md:grid-cols-2 gap-8">
                                            {results.slice(0, 2).map((item) => (
                                                <motion.div
                                                    key={`featured-${item.id}`}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="relative group cursor-pointer rounded-2xl overflow-hidden bg-gray-800/30 backdrop-blur-sm border border-gray-700 hover:border-orange-500/50 transition-all duration-300"
                                                    onClick={() => handleCardClick(item)}
                                                >
                                                    <div className="relative h-64 md:h-80">
                                                        <Image
                                                            src={getBackdropUrl(item)}
                                                            alt={getTitle(item)}
                                                            fill
                                                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                                                        {/* Play Button */}
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                            <div className="bg-orange-500/20 backdrop-blur-sm rounded-full p-6 border border-orange-500/50">
                                                                <Play className="text-white drop-shadow-lg" size={28} fill="white" />
                                                            </div>
                                                        </div>

                                                        {/* Content */}
                                                        <div className="absolute bottom-0 left-0 right-0 p-6">
                                                            <div className="flex items-center gap-3 mb-3">
                                                                <Badge
                                                                    variant="outline"
                                                                    className="bg-black/60 backdrop-blur-sm text-white border-white/30 font-medium"
                                                                >
                                                                    {item.type === 'tv' ? <Tv size={12} className="mr-1" /> : <Film size={12} className="mr-1" />}
                                                                    {item.type === 'tv' ? 'Series' : 'Movie'}
                                                                </Badge>
                                                                <div className="flex items-center gap-1 text-orange-400">
                                                                    <Star size={14} fill="currentColor" />
                                                                    <span className="text-sm font-semibold text-white">{item.vote_average.toFixed(1)}</span>
                                                                </div>
                                                            </div>

                                                            <h3 className="text-2xl font-bold text-white mb-3 drop-shadow-lg">{getTitle(item)}</h3>

                                                            <div className="flex items-center gap-4 text-sm text-gray-200 mb-4">
                                                                {getReleaseYear(item) && (
                                                                    <div className="flex items-center gap-1">
                                                                        <Calendar size={14} />
                                                                        <span>{getReleaseYear(item)}</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center gap-1">
                                                                    <Users size={14} />
                                                                    <span>{(item.vote_count / 1000).toFixed(1)}K</span>
                                                                </div>
                                                            </div>

                                                            <p className="text-gray-200 text-sm line-clamp-2 mb-4 drop-shadow">
                                                                {item.overview}
                                                            </p>

                                                            {getGenres(item).length > 0 && (
                                                                <div className="flex gap-2">
                                                                    {getGenres(item).map((genre) => (
                                                                        <Badge
                                                                            key={genre}
                                                                            variant="outline"
                                                                            className="text-xs border-gray-400 text-gray-200 bg-black/30 backdrop-blur-sm"
                                                                        >
                                                                            {genre}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* All Results */}
                                <div className="mb-8">
                                    <div className="flex items-center justify-between mb-6">

                                        <h2 className="text-2xl font-bold mb-6 text-gray-200 flex items-center gap-2">
                                            <Search size={20} />
                                            All Results
                                        </h2>
                                        {/* View Toggle */}
                                        <div className="flex items-center gap-2">
                                            <div className="bg-gray-800/60 backdrop-blur-md rounded-xl p-1 flex border border-gray-600/50 shadow-lg">
                                                <button
                                                    onClick={() => setViewMode('grid')}
                                                    className={`p-3 rounded-lg transition-all duration-200 ${viewMode === 'grid'
                                                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg scale-105'
                                                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                                                        }`}
                                                    aria-label="Grid view"
                                                >
                                                    <Grid3X3 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => setViewMode('list')}
                                                    className={`p-3 rounded-lg transition-all duration-200 ${viewMode === 'list'
                                                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg scale-105'
                                                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                                                        }`}
                                                    aria-label="List view"
                                                >
                                                    <List size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {viewMode === 'grid' ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                            {results.map((item, index) => (
                                                <motion.div
                                                    key={item.id}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.03 }}
                                                    className="group cursor-pointer"
                                                    onClick={() => handleCardClick(item)}
                                                >
                                                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-gray-800/50 mb-3 border border-gray-700 group-hover:border-orange-500/50 transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-orange-500/10">
                                                        <Image
                                                            src={getPosterUrl(item)}
                                                            alt={getTitle(item)}
                                                            fill
                                                            className="object-cover group-hover:scale-110 transition-transform duration-500"
                                                        />

                                                        {/* Overlay */}
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors duration-300" />

                                                        {/* Rating */}
                                                        <div className="absolute top-3 right-3">
                                                            <div className="flex items-center gap-1 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs border border-gray-600">
                                                                <Star size={10} className="text-orange-400" fill="currentColor" />
                                                                <span className="text-white font-medium">{item.vote_average.toFixed(1)}</span>
                                                            </div>
                                                        </div>

                                                        {/* Type Badge */}
                                                        <div className="absolute bottom-3 left-3">
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-xs font-medium ${item.type === 'tv'
                                                                    ? 'bg-blue-500/90 border-blue-400 text-white backdrop-blur-sm'
                                                                    : 'bg-purple-500/90 border-purple-400 text-white backdrop-blur-sm'
                                                                    }`}
                                                            >
                                                                {item.type === 'tv' ? 'Series' : 'Movie'}
                                                            </Badge>
                                                        </div>

                                                        {/* Play Button */}
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                            <div className="bg-orange-500/30 backdrop-blur-sm rounded-full p-3 border border-orange-500/50">
                                                                <Play className="text-white" size={18} fill="white" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2 mt-3">
                                                        <h3 className="font-semibold text-sm text-white line-clamp-2 group-hover:text-orange-300 transition-colors">
                                                            {getTitle(item)}
                                                        </h3>
                                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                                            {getReleaseYear(item) && <span className="text-gray-300">{getReleaseYear(item)}</span>}
                                                            {getGenres(item)[0] && <span className="text-gray-500">• {getGenres(item)[0]}</span>}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {results.map((item, index) => (
                                                <motion.div
                                                    key={item.id}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: index * 0.02 }}
                                                    className="flex gap-6 bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:bg-gray-700/30 hover:border-orange-500/50 transition-all duration-300 cursor-pointer group"
                                                    onClick={() => handleCardClick(item)}
                                                >
                                                    <div className="relative w-20 h-28 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0 border border-gray-600 group-hover:border-orange-500/50 transition-colors">
                                                        <Image
                                                            src={getPosterUrl(item)}
                                                            alt={getTitle(item)}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between mb-3">
                                                            <h3 className="font-semibold text-white text-xl line-clamp-1 group-hover:text-orange-300 transition-colors">
                                                                {getTitle(item)}
                                                            </h3>
                                                            <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                                                                <div className="flex items-center gap-1 text-orange-400">
                                                                    <Star size={16} fill="currentColor" />
                                                                    <span className="text-sm font-medium text-white">{item.vote_average.toFixed(1)}</span>
                                                                </div>
                                                                <Badge
                                                                    variant="outline"
                                                                    className={`text-xs font-medium ${item.type === 'tv'
                                                                        ? 'border-blue-400 text-blue-300 bg-blue-500/10'
                                                                        : 'border-purple-400 text-purple-300 bg-purple-500/10'
                                                                        }`}
                                                                >
                                                                    {item.type === 'tv' ? 'Series' : 'Movie'}
                                                                </Badge>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                                                            {getReleaseYear(item) && (
                                                                <div className="flex items-center gap-1">
                                                                    <Calendar size={14} />
                                                                    <span className="text-gray-300">{getReleaseYear(item)}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-1">
                                                                <Users size={14} />
                                                                <span className="text-gray-300">{(item.vote_count / 1000).toFixed(1)}K votes</span>
                                                            </div>
                                                            {item.origin_country && item.origin_country.length > 0 && (
                                                                <div className="flex items-center gap-1">
                                                                    <Globe size={14} />
                                                                    <span className="text-gray-300">{getCountryName(item.origin_country[0])}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <p className="text-gray-300 text-sm line-clamp-2 mb-3">
                                                            {item.overview}
                                                        </p>

                                                        {getGenres(item).length > 0 && (
                                                            <div className="flex gap-2">
                                                                {getGenres(item).map((genre) => (
                                                                    <Badge
                                                                        key={genre}
                                                                        variant="outline"
                                                                        className="text-xs border-gray-500 text-gray-300 bg-gray-700/30"
                                                                    >
                                                                        {genre}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                )
                }

                {/* Enhanced Pagination */}
                {
                    totalPages > 1 && (
                        <div className="flex justify-center items-center gap-3 mt-12">
                            <Button
                                variant="outline"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                                className="bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </Button>

                            <div className="flex items-center gap-2">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    const page = Math.max(1, Math.min(totalPages, currentPage - 2 + i));
                                    if (i > 0 && page === Math.max(1, Math.min(totalPages, currentPage - 2 + i - 1))) return null;

                                    return (
                                        <Button
                                            key={page}
                                            variant={page === currentPage ? "default" : "outline"}
                                            onClick={() => setCurrentPage(page)}
                                            className={`w-12 h-12 transition-all duration-200 ${page === currentPage
                                                ? "bg-gradient-to-r from-orange-500 to-red-500 text-white border-transparent shadow-lg hover:shadow-orange-500/25"
                                                : "bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-orange-400"
                                                }`}
                                        >
                                            {page}
                                        </Button>
                                    );
                                })}

                                {currentPage < totalPages - 2 && (
                                    <>
                                        <span className="text-gray-500 px-2">...</span>
                                        <Button
                                            variant="outline"
                                            onClick={() => setCurrentPage(totalPages)}
                                            className="w-12 h-12 bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-orange-400 transition-all duration-200"
                                        >
                                            {totalPages}
                                        </Button>
                                    </>
                                )}
                            </div>

                            <Button
                                variant="outline"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}
                                className="bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </Button>
                        </div>
                    )
                }

                {/* Results Summary */}
                {
                    !loading && !error && results.length > 0 && (
                        <div className="text-center mt-8">
                            <div className="inline-flex items-center gap-2 bg-gray-800/40 backdrop-blur-sm rounded-lg px-6 py-3 border border-gray-700/50">
                                <span className="text-gray-300">
                                    Showing {((currentPage - 1) * 20) + 1} - {Math.min(currentPage * 20, totalResults)} of {totalResults.toLocaleString()} results
                                </span>
                                {hasActiveFilters && (
                                    <Badge variant="outline" className="text-orange-400 border-orange-400/50 bg-orange-500/10 ml-2">
                                        {getActiveFilterCount()} filters active
                                    </Badge>
                                )}
                            </div>
                        </div>
                    )
                }
            </div >
        </div >
    );
}