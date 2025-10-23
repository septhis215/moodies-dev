// app/search/page.tsx
"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
    ExternalLink,
    TrendingUp,
    Clock,
    Award,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    RotateCcw,
    ArrowRight,
    Check
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { All } from '@/types/all';
import dynamic from "next/dynamic";
import { createPortal } from 'react-dom';
import { IconTrendingUp, IconX } from '@tabler/icons-react';

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

const YEAR_OPTIONS = Array.from({ length: 2025 - 1980 + 1 }, (_, i) => 2025 - i);

// Enhanced year presets
const YEAR_PRESETS = [
    { label: '2020s', min: 2020, max: 2025 },
    { label: '2010s', min: 2010, max: 2019 },
    { label: '2000s', min: 2000, max: 2009 },
    { label: '90s', min: 1990, max: 1999 },
    { label: '80s', min: 1980, max: 1989 }
];

// Enhanced rating presets
const RATING_PRESETS = [
    { label: 'Masterpiece', min: 9, max: 10, color: 'from-yellow-400 to-orange-500' },
    { label: 'Excellent', min: 8, max: 10, color: 'from-green-400 to-emerald-500' },
    { label: 'Great', min: 7, max: 10, color: 'from-blue-400 to-cyan-500' },
    { label: 'Good', min: 6, max: 10, color: 'from-purple-400 to-pink-500' },
    { label: 'Any Rating', min: 0, max: 10, color: 'from-gray-400 to-gray-500' }
];

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

    // Enhanced UI states for sliders
    const [yearRange, setYearRange] = useState([1980, 2025]);
    const [ratingRange, setRatingRange] = useState([0, 10]);
    const [yearDropdownOpen, setYearDropdownOpen] = useState({ from: false, to: false });
    const [ratingDropdownOpen, setRatingDropdownOpen] = useState({ min: false, max: false });

    const [activeFilter, setActiveFilter] = useState(null);

    const years = Array.from({ length: 2025 - 1980 + 1 }, (_, i) => 1980 + i);
    const ratings = Array.from({ length: 11 }, (_, i) => i);
    const decades = [
        { label: '1980s', start: 1980, end: 1989 },
        { label: '1990s', start: 1990, end: 1999 },
        { label: '2000s', start: 2000, end: 2009 },
        { label: '2010s', start: 2010, end: 2019 },
        { label: '2020s', start: 2020, end: 2025 },
    ];

    const setDecade = (start, end) => {
        setYearRange([start, end]);
    };

    // Quick rating presets
    const quickRatingPresets = [
        { label: 'All Ratings', min: 0, max: 10 },
        { label: 'Good (7+)', min: 7, max: 10 },
        { label: 'Great (8+)', min: 8, max: 10 },
        { label: 'Excellent (9+)', min: 9, max: 10 },
    ];

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
            release_date: item.release_date ?? item.first_air_date ?? null,
            vote_average: item.vote_average ?? 0,
            popularity: item.popularity ?? 0,
            origin_country: (item as any).origin_country ?? [],
            genres: item.genres,
            runtime: (item as any).runtime ?? null,
            number_of_episodes: (item as any).number_of_episodes ?? null,
            trailer_key: (item as any).trailer_key ?? null,
            recommendations: [] as All["recommendations"],
            type: item.type,
        };
    };

    // Handle play trailer button click
    const handlePlayTrailer = async (item: SearchResult) => {
        try {
            console.log(item.trailer_key);
            if (item.trailer_key) {
                const trailerData = convertToTrailerData({ ...item, trailer_key: item.trailer_key });
                setSelectedTrailer(trailerData);
                return;
            }

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
                    const searchQuery = encodeURIComponent(`${getTitle(item)} trailer`);
                    window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
                }
            } else {
                const searchQuery = encodeURIComponent(`${getTitle(item)} trailer`);
                window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
            }
        } catch (error) {
            console.error('Error fetching trailer:', error);
            const searchQuery = encodeURIComponent(`${getTitle(item)} trailer`);
            window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
        }
    };

    const handleCloseTrailer = () => {
        setSelectedTrailer(null);
    };

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

    // Update filter states when range changes
    useEffect(() => {
        setYearMin(yearRange[0] === 1980 ? null : yearRange[0]);
        setYearMax(yearRange[1] === 2025 ? null : yearRange[1]);
    }, [yearRange]);

    useEffect(() => {
        setRatingMin(ratingRange[0] === 0 ? null : ratingRange[0]);
        setRatingMax(ratingRange[1] === 10 ? null : ratingRange[1]);
    }, [ratingRange]);

    // Automatically reset to page 1 when filters or sorting change
    useEffect(() => {
        setCurrentPage(1);
    }, [
        filterType,
        sortBy,
        selectedGenres,
        selectedCountries,
        yearMin,
        yearMax,
        ratingMin,
        ratingMax,
        includeAdult
    ]);

    useEffect(() => {
        // Condition: don't fetch if user hasn't typed AND hasn't applied filters
        const noQueryAndNoFilters =
            !query.trim() &&
            selectedGenres.length === 0 &&
            selectedCountries.length === 0 &&
            yearMin === null &&
            yearMax === null &&
            ratingMin === null &&
            ratingMax === null;

        if (noQueryAndNoFilters) {
            setResults([]);
            setBestMatch(null);
            setTotalResults(0);
            setTotalPages(0);
            setLoading(false);
            return;
        }

        const controller = new AbortController();

        const fetchResults = async () => {
            setLoading(true);
            setError(null);

            try {
                const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
                const params = new URLSearchParams();

                // ✅ Always include query if it exists
                if (query.trim()) params.append("q", query.trim());

                // ✅ Always include filters even if query exists
                params.append("page", currentPage.toString());
                params.append("type", filterType);
                params.append("sort", sortBy);
                params.append("include_adult", includeAdult.toString());

                if (selectedGenres.length > 0)
                    params.append("genres", selectedGenres.join(","));
                if (selectedCountries.length > 0)
                    params.append("countries", selectedCountries.join(","));
                if (yearMin !== null)
                    params.append("year_min", yearMin.toString());
                if (yearMax !== null)
                    params.append("year_max", yearMax.toString());
                if (ratingMin !== null)
                    params.append("rating_min", ratingMin.toString());
                if (ratingMax !== null)
                    params.append("rating_max", ratingMax.toString());

                const response = await fetch(`${base}/search?${params}`, {
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error("Search failed");

                const data: SearchResponse = await response.json();

                setResults(data.results || []);
                setBestMatch(data.best_match || null);
                setTotalResults(data.total_results || 0);
                setTotalPages(Math.ceil((data.total_results || 0) / 20));
            } catch (err: any) {
                if (err.name !== "AbortError") {
                    setError("Failed to search. Please try again.");
                    console.error("Search error:", err);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchResults();

        return () => controller.abort();
    }, [
        query,
        currentPage,
        filterType,
        sortBy,
        selectedGenres.join(","), // join arrays to prevent false rerenders
        selectedCountries.join(","),
        yearMin,
        yearMax,
        ratingMin,
        ratingMax,
        includeAdult,
    ]);


    // Helper functions
    const getTitle = (item: SearchResult) => item.title || item.name || 'Unknown Title';
    const getReleaseYear = (item: SearchResult) => {
        const date = item.release_date || item.first_air_date;
        return date ? new Date(date).getFullYear() : null;
    };

    const getPosterUrl = (item: SearchResult) => {
        return item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : '/coming-soon.png';
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
        setYearRange([1980, 2025]);
        setRatingRange([0, 10]);
        setFilterType('all');
        setSortBy('relevance');
        setIncludeAdult(false);
    };

    const hasActiveFilters = selectedGenres.length > 0 || selectedCountries.length > 0 ||
        yearRange[0] !== 1950 || yearRange[1] !== 2025 || ratingRange[0] !== 0 ||
        ratingRange[1] !== 10 || filterType !== 'all' || includeAdult;

    const getActiveFilterCount = () => {
        return selectedGenres.length + selectedCountries.length +
            (yearRange[0] !== 1950 ? 1 : 0) + (yearRange[1] !== 2025 ? 1 : 0) +
            (ratingRange[0] !== 0 ? 1 : 0) + (ratingRange[1] !== 10 ? 1 : 0) +
            (filterType !== 'all' ? 1 : 0) + (includeAdult ? 1 : 0);
    };

    // Enhanced pagination component
    const renderPagination = () => {
        if (totalPages <= 1) return null;

        const getVisiblePages = () => {
            const delta = 2;
            const range = [];
            const rangeWithDots = [];

            for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
                range.push(i);
            }

            if (currentPage - delta > 2) {
                rangeWithDots.push(1, '...');
            } else {
                rangeWithDots.push(1);
            }

            rangeWithDots.push(...range);

            if (currentPage + delta < totalPages - 1) {
                rangeWithDots.push('...', totalPages);
            } else {
                rangeWithDots.push(totalPages);
            }

            return rangeWithDots;
        };

        const visiblePages = getVisiblePages();

        return (
            <div className="flex flex-col items-center gap-6 mt-16">
                {/* Main pagination controls */}
                <div className="flex items-center gap-2">
                    {/* Previous button */}
                    <Button
                        variant="outline"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        className="h-12 px-4 bg-gray-800/60 border-gray-600/50 text-gray-300 hover:bg-gray-700/80 hover:text-white hover:border-orange-400/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 backdrop-blur-sm"
                    >
                        <ChevronLeft size={18} className="mr-1" />
                        Previous
                    </Button>

                    {/* Page numbers */}
                    <div className="flex items-center gap-3 mx-4">
                        {visiblePages.map((page, index) => {
                            if (page === '...') {
                                return (
                                    <div key={`dots-${index}`} className="flex items-center justify-center w-12 h-12 text-gray-500">
                                        <MoreHorizontal size={16} />
                                    </div>
                                );
                            }

                            const isActive = page === currentPage;
                            return (
                                <Button
                                    key={page}
                                    variant={isActive ? "default" : "outline"}
                                    onClick={() => setCurrentPage(page as number)}
                                    className={`w-10 h-10 text-sm font-medium transition-all duration-300 backdrop-blur-sm ${isActive
                                        ? "bg-gradient-to-r from-orange-500 to-red-500 text-white border-transparent shadow-lg hover:shadow-orange-500/30 scale-105"
                                        : "bg-gray-800/60 border-gray-600/50 text-gray-300 hover:bg-gray-700/80 hover:text-white hover:border-orange-400/50 hover:scale-105"
                                        }`}
                                >
                                    {page}
                                </Button>
                            );
                        })}
                    </div>

                    {/* Next button */}
                    <Button
                        variant="outline"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="h-12 px-4 bg-gray-800/60 border-gray-600/50 text-gray-300 hover:bg-gray-700/80 hover:text-white hover:border-orange-400/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 backdrop-blur-sm"
                    >
                        Next
                        <ChevronRight size={18} className="ml-1" />
                    </Button>
                </div>

                {/* Enhanced pagination info */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span>Page {currentPage} of {totalPages.toLocaleString()}</span>
                        <span>•</span>
                        <span>{totalResults.toLocaleString()} total results</span>
                    </div>

                    {/* Quick jump controls */}
                    <div className="flex items-center gap-2">
                        {currentPage > 1 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCurrentPage(1)}
                                className="text-xs text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 transition-all duration-200"
                            >
                                First page
                            </Button>
                        )}
                        {currentPage < totalPages && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCurrentPage(totalPages)}
                                className="text-xs text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 transition-all duration-200"
                            >
                                Last page
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        );
    };
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [trendingTerms, setTrendingTerms] = useState<string[]>([
        'Avengers', 'Stranger Things', 'Batman', 'Marvel', 'Game of Thrones', 'Breaking Bad'
    ]);
    const [loadingTrending, setLoadingTrending] = useState(false);

    useEffect(() => {
        const fetchTrendingTerms = async () => {
            setLoadingTrending(true);
            try {
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/all/search/trending-terms`
                );
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.length > 0) {
                        setTrendingTerms(data);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch trending terms:', error);
                // Keep fallback terms on error
            } finally {
                setLoadingTrending(false);
            }
        };

        fetchTrendingTerms();
    }, []);

    if (!query.trim()) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white">
                <div className="container mx-auto px-4 pt-20 pb-10">
                    <div className="max-w-2xl mx-auto">
                        {/* Header Section */}
                        <div className="text-center mb-10">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-800/50 rounded-full mb-6 border border-gray-700">
                                <Search className="h-8 w-8 text-gray-400" />
                            </div>

                            <h1 className="text-4xl font-bold text-white mb-2">
                                Start Your Search
                            </h1>
                            <p className="text-gray-400 text-md">
                                Discover movies and TV shows you'll love
                            </p>
                        </div>

                        {/* Search Input */}
                        <div className="relative mb-8">
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search for movies, series..."
                                className="w-full bg-gray-800/50 backdrop-blur-sm placeholder:text-gray-500 text-white rounded-full px-6 py-4 text-lg outline-none border border-gray-700 focus:border-[#e94f37] focus:ring-1 focus:ring-[#e94f37] transition-all"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const value = (e.target as HTMLInputElement).value.trim();
                                        if (value) {
                                            router.push(`/search?q=${encodeURIComponent(value)}`);
                                        }
                                    }
                                }}
                                autoFocus
                            />
                            <button
                                onClick={() => {
                                    const value = searchInputRef.current?.value.trim();
                                    if (value) {
                                        router.push(`/search?q=${encodeURIComponent(value)}`);
                                    }
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#e94f37] hover:bg-[#e94f37]/90 rounded-full p-2.5 transition-colors"
                            >
                                <Search className="h-5 w-5 text-white" />
                            </button>
                        </div>

                        {/* Trending Searches */}
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                                <TrendingUp size={20} className="text-[#e94f37]" />
                                Trending Searches
                            </h2>

                            {loadingTrending ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-700 border-t-[#e94f37]"></div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {trendingTerms.map((term, index) => (
                                        <button
                                            key={term}
                                            onClick={() => router.push(`/search?q=${encodeURIComponent(term)}`)}
                                            className="bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-[#e94f37]/50 rounded-lg px-4 py-3 text-sm font-medium text-gray-300 hover:text-white transition-all text-left"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-[#e94f37] font-semibold mr-1">#{index + 1}</span>
                                                <span>{term}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="container mx-auto px-4 pt-24 pb-8">
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
                    {/* Enhanced Advanced Filters Section */}
                    <div className="bg-gray-800/40 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 shadow-2xl mb-8">
                        <div className="flex flex-wrap items-center gap-4">
                            <Button
                                variant="outline"
                                onClick={() => setShowFilters(!showFilters)}
                                className={`bg-gradient-to-r from-gray-800/80 to-gray-700/80 backdrop-blur-sm border-gray-600 text-white hover:from-gray-700 hover:to-gray-600 transition-all duration-300 ${hasActiveFilters ? 'border-orange-500/50 text-orange-300 shadow-orange-500/20 shadow-lg' : ''
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
                                    className={`ml-2 transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`}
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
                                    <RotateCcw size={14} className="mr-1" />
                                    Reset all
                                </Button>
                            )}
                        </div>

                        {/* Expanded Advanced Filters */}
                        <AnimatePresence>
                            {showFilters && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0, y: -20 }}
                                    animate={{ height: 'auto', opacity: 1, y: 0 }}
                                    exit={{ height: 0, opacity: 0, y: -20 }}
                                    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                                    className="border-t border-gray-700/50 pt-8 mt-6"
                                >
                                    <div className="grid gap-8">
                                        {/* Sort & Content Type Row */}
                                        <div className="flex flex-col lg:flex-row gap-8">
                                            {/* Sort Options */}
                                            <div className="flex-1 space-y-4">
                                                <label className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                                                    <TrendingUp size={16} className="text-blue-400" />
                                                    Sort Results By
                                                </label>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    {[
                                                        { key: "relevance", label: "Most Relevant", icon: Search },
                                                        { key: "rating", label: "Highest Rated", icon: Award },
                                                        { key: "date", label: "Most Recent", icon: Clock },
                                                        { key: "popularity", label: "Most Popular", icon: TrendingUp },
                                                    ].map((option) => {
                                                        const Icon = option.icon;
                                                        const isActive = sortBy === option.key;
                                                        return (
                                                            <button
                                                                key={option.key}
                                                                onClick={() => setSortBy(option.key as any)}
                                                                className={`flex items-center gap-2 p-2 rounded-xl text-sm font-small transition-all duration-300 border ${isActive
                                                                    ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-blue-400/50 shadow-lg scale-105"
                                                                    : "bg-gray-800/60 text-gray-300 border-gray-600/50 hover:bg-gray-700/80 hover:text-white hover:border-blue-400/50 hover:scale-102"
                                                                    }`}
                                                            >
                                                                <Icon size={16} />
                                                                {option.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Adult Content Toggle */}
                                            <div className="flex flex-col items-start gap-4">
                                                <label className="text-sm font-semibold text-gray-200">Content Rating</label>
                                                <div className="flex items-center gap-3 bg-gray-800/60 p-2 rounded-xl border border-gray-600/50">
                                                    <span className="text-sm text-gray-300">Include Adult Content</span>
                                                    <div
                                                        role="switch"
                                                        aria-checked={includeAdult}
                                                        onClick={() => setIncludeAdult(!includeAdult)}
                                                        className={`relative inline-flex items-center h-5 w-10 rounded-full transition-all duration-300 cursor-pointer ${includeAdult ? "bg-red-500" : "bg-gray-600"
                                                            }`}
                                                    >
                                                        <span
                                                            className={`absolute left-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ${includeAdult ? "translate-x-6" : "translate-x-0"
                                                                }`}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Year & Rating Filters - Compact Side by Side */}
                                        <div className="grid md:grid-cols-2 gap-6">
                                            {/* Year Range Filter */}
                                            <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-700/50">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="p-2 bg-blue-500/20 rounded-lg">
                                                        <Calendar size={16} className="text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-white">Release Year</h3>
                                                        <p className="text-xs text-gray-400">Filter by release date</p>
                                                    </div>
                                                </div>

                                                {/* Quick Decade Selection */}
                                                <div className="mb-4">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {decades.map((decade) => {
                                                            const isSelected = yearRange[0] === decade.start && yearRange[1] === decade.end;
                                                            return (
                                                                <button
                                                                    key={decade.label}
                                                                    onClick={() => setDecade(decade.start, decade.end)}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${isSelected
                                                                        ? 'bg-blue-500 text-white shadow-md'
                                                                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white'
                                                                        }`}
                                                                >
                                                                    {decade.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Custom Year Selection */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs text-gray-400 mb-1.5 block">From</label>
                                                        <select
                                                            value={yearRange[0]}
                                                            onChange={(e) => setYearRange([parseInt(e.target.value), yearRange[1]])}
                                                            className="w-full px-3 py-2 bg-gray-900/80 border border-gray-600 rounded-lg 
                        text-white text-xs focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 
                        transition-all cursor-pointer"
                                                        >
                                                            {years.map((year) => (
                                                                <option key={year} value={year}>{year}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="text-xs text-gray-400 mb-1.5 block">To</label>
                                                        <select
                                                            value={yearRange[1]}
                                                            onChange={(e) => setYearRange([yearRange[0], parseInt(e.target.value)])}
                                                            className="w-full px-3 py-2 bg-gray-900/80 border border-gray-600 rounded-lg 
                        text-white text-xs focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 
                        transition-all cursor-pointer"
                                                        >
                                                            {years.map((year) => (
                                                                <option key={year} value={year}>{year}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Selected Range Display */}
                                                <div className="mt-3 flex items-center justify-between px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                                    <span className="text-xs text-gray-400">Range:</span>
                                                    <span className="text-xs font-bold text-blue-400">
                                                        {yearRange[0]} - {yearRange[1]}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Rating Range Filter */}
                                            <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-700/50">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                                                        <Star size={16} className="text-yellow-400 fill-yellow-400" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-white">Rating Filter</h3>
                                                        <p className="text-xs text-gray-400">Show specific ratings</p>
                                                    </div>
                                                </div>

                                                {/* Quick Rating Presets */}
                                                <div className="mb-4">
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        {quickRatingPresets.map((preset) => {
                                                            const isSelected = ratingRange[0] === preset.min && ratingRange[1] === preset.max;
                                                            return (
                                                                <button
                                                                    key={preset.label}
                                                                    onClick={() => setRatingRange([preset.min, preset.max])}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-center gap-1.5 ${isSelected
                                                                        ? 'bg-yellow-500 text-gray-900 shadow-md'
                                                                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white'
                                                                        }`}
                                                                >
                                                                    {isSelected && <Check size={12} />}
                                                                    {preset.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Custom Min/Max Selection */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs text-gray-400 mb-1.5 block">Min</label>
                                                        <select
                                                            value={ratingRange[0]}
                                                            onChange={(e) => setRatingRange([parseInt(e.target.value), ratingRange[1]])}
                                                            className="w-full px-3 py-2 bg-gray-900/80 border border-gray-600 rounded-lg 
                        text-white text-xs focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 
                        transition-all cursor-pointer"
                                                        >
                                                            {ratings.map((rating) => (
                                                                <option key={rating} value={rating}>{rating} ★</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="text-xs text-gray-400 mb-1.5 block">Max</label>
                                                        <select
                                                            value={ratingRange[1]}
                                                            onChange={(e) => setRatingRange([ratingRange[0], parseInt(e.target.value)])}
                                                            className="w-full px-3 py-2 bg-gray-900/80 border border-gray-600 rounded-lg 
                        text-white text-xs focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 
                        transition-all cursor-pointer"
                                                        >
                                                            {ratings.map((rating) => (
                                                                <option key={rating} value={rating}>{rating} ★</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Selected Rating Display */}
                                                <div className="mt-3 flex items-center justify-between px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                                    <span className="text-xs text-gray-400">Range:</span>
                                                    <span className="text-xs font-bold text-yellow-400">
                                                        {ratingRange[0]} ★ - {ratingRange[1]} ★
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Genres */}
                                    <div className='mt-8'>
                                        <label className="text-sm font-medium text-gray-200 mb-4 block flex items-center gap-2">
                                            <Film size={16} className="text-purple-400" />
                                            Genres
                                            {selectedGenres.length > 0 && (
                                                <Badge variant="outline" className="text-xs bg-purple-500/20 border-purple-400/50 text-purple-300">
                                                    {selectedGenres.length} selected
                                                </Badge>
                                            )}
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                            {availableGenres.map((genre) => {
                                                const isSelected = selectedGenres.includes(genre);
                                                return (
                                                    <Badge
                                                        key={genre}
                                                        variant={isSelected ? 'default' : 'outline'}
                                                        className={`cursor-pointer text-center justify-center transition-all duration-300 px-2.5 py-2 font-small ${isSelected
                                                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent shadow-lg scale-105 hover:scale-110'
                                                            : 'border-gray-600 text-gray-300 hover:text-white hover:border-purple-400 hover:bg-purple-500/20 hover:shadow-lg hover:scale-105'
                                                            }`}
                                                        onClick={() => handleGenreToggle(genre)}
                                                    >
                                                        {genre}
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Countries */}
                                    <div className='mt-8'>
                                        <label className="text-sm font-medium text-gray-200 mb-4 block flex items-center gap-2">
                                            <Globe size={16} className="text-green-400" />
                                            Countries
                                            {selectedCountries.length > 0 && (
                                                <Badge variant="outline" className="text-xs bg-green-500/20 border-green-400/50 text-green-300">
                                                    {selectedCountries.length} selected
                                                </Badge>
                                            )}
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                            {availableCountries.map((country) => {
                                                const isSelected = selectedCountries.includes(country.code);
                                                return (
                                                    <Badge
                                                        key={country.code}
                                                        variant={isSelected ? 'default' : 'outline'}
                                                        className={`cursor-pointer text-center justify-center transition-all duration-300 px-2.5 py-2 font-small ${isSelected
                                                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white border-transparent shadow-lg scale-105 hover:scale-110'
                                                            : 'border-gray-600 text-gray-300 hover:text-white hover:border-green-400 hover:bg-green-500/20 hover:shadow-lg hover:scale-105'
                                                            }`}
                                                        onClick={() => handleCountryToggle(country.code)}
                                                    >
                                                        {country.name}
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Filter Actions */}
                                    <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-700/50">
                                        <div className="text-sm text-gray-400">
                                            {hasActiveFilters ? `${getActiveFilterCount()} filters active` : 'No filters applied'}
                                        </div>

                                        <div className="flex gap-3">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={clearAllFilters}
                                                disabled={!hasActiveFilters}
                                                className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <RotateCcw size={14} className="mr-1" />
                                                Reset All
                                            </Button>

                                            <Button
                                                size="sm"
                                                onClick={() => setShowFilters(false)}
                                                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                                            >
                                                Apply Filters
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Loading State */}
                {
                    loading && (
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
                    )
                }

                {/* Error State */}
                {
                    error && (
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
                    )
                }

                {/* Results */}
                {
                    !loading && !error && (
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
                                    {/* Best Match Section */}
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
                                            <h2 className="text-2xl font-bold text-gray-200 flex items-center gap-2">
                                                <Search size={20} />
                                                All Results
                                            </h2>

                                            {/* View Toggle */}
                                            <div className="flex items-center gap-2">
                                                <div className="bg-gray-800/60 backdrop-blur-md rounded-xl p-1 flex border border-gray-600/50 shadow-lg">
                                                    <button
                                                        onClick={() => setViewMode('grid')}
                                                        className={`p-3 rounded-lg transition-all duration-300 ${viewMode === 'grid'
                                                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg scale-105'
                                                            : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                                                            }`}
                                                        aria-label="Grid view"
                                                    >
                                                        <Grid3X3 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => setViewMode('list')}
                                                        className={`p-3 rounded-lg transition-all duration-300 ${viewMode === 'list'
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
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
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
                                                                    <span className="text-white font-medium">{item.vote_average > 0 ? item.vote_average.toFixed(1) : "New"}</span>
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
                {renderPagination()}

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

                {/* Trailer Modal */}
                {
                    selectedTrailer && (
                        <TrailerModal
                            trailer={selectedTrailer}
                            onClose={handleCloseTrailer}
                            onSelectTrailer={handleSelectTrailer}
                        />
                    )
                }
            </div >
        </div >
    );
}