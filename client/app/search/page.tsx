// app/search/page.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
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
  Check,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { All } from "@/types/all";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { IconTrendingUp, IconX } from "@tabler/icons-react";
import Pagination from "@/components/ui/pagination";

// dynamic import (no SSR)
const TrailerModal = dynamic(
  () => import("../../components/sections/TrailerModal"),
  { ssr: false }
);

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
  type: "movie" | "tv";
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
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
  "War",
  "Western",
];

const COUNTRY_OPTIONS = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "CN", name: "China" },
  { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "RU", name: "Russia" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
];

const YEAR_OPTIONS = Array.from(
  { length: 2025 - 1980 + 1 },
  (_, i) => 2025 - i
);

// Enhanced year presets
const YEAR_PRESETS = [
  { label: "2020s", min: 2020, max: 2025 },
  { label: "2010s", min: 2010, max: 2019 },
  { label: "2000s", min: 2000, max: 2009 },
  { label: "90s", min: 1990, max: 1999 },
  { label: "80s", min: 1980, max: 1989 },
];

// Enhanced rating presets
const RATING_PRESETS = [
  {
    label: "Masterpiece",
    min: 9,
    max: 10,
    color: "from-yellow-400 to-orange-500",
  },
  {
    label: "Excellent",
    min: 8,
    max: 10,
    color: "from-green-400 to-emerald-500",
  },
  { label: "Great", min: 7, max: 10, color: "from-blue-400 to-cyan-500" },
  { label: "Good", min: 6, max: 10, color: "from-purple-400 to-pink-500" },
  { label: "Any Rating", min: 0, max: 10, color: "from-gray-400 to-gray-500" },
];

export default function SearchResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";

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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<
    "relevance" | "rating" | "date" | "popularity"
  >("relevance");
  const [filterType, setFilterType] = useState<"all" | "movie" | "tv">("all");
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
  const [yearDropdownOpen, setYearDropdownOpen] = useState({
    from: false,
    to: false,
  });
  const [ratingDropdownOpen, setRatingDropdownOpen] = useState({
    min: false,
    max: false,
  });

  const [activeFilter, setActiveFilter] = useState(null);

  const years = Array.from({ length: 2025 - 1980 + 1 }, (_, i) => 1980 + i);
  const ratings = Array.from({ length: 11 }, (_, i) => i);
  const decades = [
    { label: "1980s", start: 1980, end: 1989 },
    { label: "1990s", start: 1990, end: 1999 },
    { label: "2000s", start: 2000, end: 2009 },
    { label: "2010s", start: 2010, end: 2019 },
    { label: "2020s", start: 2020, end: 2025 },
  ];

  const setDecade = (start, end) => {
    setYearRange([start, end]);
  };

  // Quick rating presets
  const quickRatingPresets = [
    { label: "All Ratings", min: 0, max: 10 },
    { label: "Good (7+)", min: 7, max: 10 },
    { label: "Great (8+)", min: 8, max: 10 },
    { label: "Excellent (9+)", min: 9, max: 10 },
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
        const trailerData = convertToTrailerData({
          ...item,
          trailer_key: item.trailer_key,
        });
        setSelectedTrailer(trailerData);
        return;
      }

      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const endpoint = item.type === "tv" ? "tv" : "movies";

      const response = await fetch(`${base}/${endpoint}/${item.id}/videos`);
      if (response.ok) {
        const videoData = await response.json();
        const trailer =
          videoData.results?.find(
            (video: any) => video.type === "Trailer" && video.site === "YouTube"
          ) || videoData.results?.[0];

        if (trailer) {
          const trailerData = convertToTrailerData({
            ...item,
            trailer_key: trailer.key,
          });
          setSelectedTrailer(trailerData);
        } else {
          const searchQuery = encodeURIComponent(`${getTitle(item)} trailer`);
          window.open(
            `https://www.youtube.com/results?search_query=${searchQuery}`,
            "_blank"
          );
        }
      } else {
        const searchQuery = encodeURIComponent(`${getTitle(item)} trailer`);
        window.open(
          `https://www.youtube.com/results?search_query=${searchQuery}`,
          "_blank"
        );
      }
    } catch (error) {
      console.error("Error fetching trailer:", error);
      const searchQuery = encodeURIComponent(`${getTitle(item)} trailer`);
      window.open(
        `https://www.youtube.com/results?search_query=${searchQuery}`,
        "_blank"
      );
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
        const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
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
    includeAdult,
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
        const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const params = new URLSearchParams();

        // Always include query if it exists
        if (query.trim()) params.append("q", query.trim());

        // Always include filters even if query exists
        params.append("page", currentPage.toString());
        params.append("type", filterType);
        params.append("sort", sortBy);
        params.append("include_adult", includeAdult.toString());

        if (selectedGenres.length > 0)
          params.append("genres", selectedGenres.join(","));
        if (selectedCountries.length > 0)
          params.append("countries", selectedCountries.join(","));
        if (yearMin !== null) params.append("year_min", yearMin.toString());
        if (yearMax !== null) params.append("year_max", yearMax.toString());
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
  const getTitle = (item: SearchResult) =>
    item.title || item.name || "Unknown Title";
  const getReleaseYear = (item: SearchResult) => {
    const date = item.release_date || item.first_air_date;
    return date ? new Date(date).getFullYear() : null;
  };

  const getPosterUrl = (item: SearchResult) => {
    return item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "/coming-soon.png";
  };

  const getBackdropUrl = (item: SearchResult) => {
    return item.backdrop_path
      ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
      : "/placeholder-backdrop.jpg";
  };

  const getGenres = (item: SearchResult) => {
    return item.genres?.slice(0, 2) || [];
  };

  const getCountryName = (code: string) => {
    return COUNTRY_OPTIONS.find((c) => c.code === code)?.name || code;
  };

  const handleCardClick = (item: SearchResult) => {
    const path = item.type === "tv" ? "/tv" : "/movies";
    router.push(`${path}/${item.id}`);
  };

  const handleGenreToggle = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleCountryToggle = (country: string) => {
    setSelectedCountries((prev) =>
      prev.includes(country)
        ? prev.filter((c) => c !== country)
        : [...prev, country]
    );
  };

  const clearAllFilters = () => {
    setSelectedGenres([]);
    setSelectedCountries([]);
    setYearRange([1980, 2025]);
    setRatingRange([0, 10]);
    setFilterType("all");
    setSortBy("relevance");
    setIncludeAdult(false);
  };

  const hasActiveFilters =
    selectedGenres.length > 0 ||
    selectedCountries.length > 0 ||
    yearRange[0] !== 1950 ||
    yearRange[1] !== 2025 ||
    ratingRange[0] !== 0 ||
    ratingRange[1] !== 10 ||
    filterType !== "all" ||
    includeAdult;

  const getActiveFilterCount = () => {
    return (
      selectedGenres.length +
      selectedCountries.length +
      (yearRange[0] !== 1950 ? 1 : 0) +
      (yearRange[1] !== 2025 ? 1 : 0) +
      (ratingRange[0] !== 0 ? 1 : 0) +
      (ratingRange[1] !== 10 ? 1 : 0) +
      (filterType !== "all" ? 1 : 0) +
      (includeAdult ? 1 : 0)
    );
  };
  const [pageSize, setPageSize] = useState(25);

  // Enhanced pagination component
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalResults={totalResults}
        onPageChange={(p) => setCurrentPage(p)}
      />
    );
  };

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [trendingTerms, setTrendingTerms] = useState<any[]>([
    { id: 0, title: "Avengers", media_type: "movie" },
    { id: 0, title: "Stranger Things", media_type: "tv" },
    { id: 0, title: "Batman", media_type: "movie" },
  ]);
  const [loadingTrending, setLoadingTrending] = useState(false);

  useEffect(() => {
    const fetchTrendingTerms = async () => {
      setLoadingTrending(true);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
          }/all/search/trending-terms`
        );
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            setTrendingTerms(data);
          }
          console.log("Terms: ", trendingTerms);
        }
      } catch (error) {
        console.error("Failed to fetch trending terms:", error);
        // Keep fallback terms on error
      } finally {
        setLoadingTrending(false);
      }
    };

    fetchTrendingTerms();
  }, []);

  if (!query.trim()) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Added px-4 for horizontal padding */}
        <div className="container mx-auto px-4 pt-20 pb-10">
          {/* Added px-4 for extra horizontal padding */}
          <div className="max-w-7xl mx-auto">
            {/* Content is centered and constrained */}
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
                  if (e.key === "Enter") {
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
                      key={term.id || term.title}
                      onClick={() =>
                        router.push(`/${term.media_type}/${term.id}`)
                      }
                      className="bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-[#e94f37]/50 rounded-lg px-4 py-3 text-sm font-medium text-gray-300 hover:text-white transition-all text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#e94f37] font-semibold mr-1">
                          #{index + 1}
                        </span>
                        <span>{term.title}</span>
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
      <div className="max-w-7xl mx-auto px-6 sm:px-6 lg:px-8 pt-32 pb-10">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div className="w-full sm:w-auto text-left sm:text-left">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent mb-2 break-words">
              Search results for "{query}"
            </h1>
            {!loading && (
              <p className="text-gray-400 text-sm sm:text-md flex items-center gap-2">
                <span>{totalResults.toLocaleString()} results found</span>
                {hasActiveFilters && (
                  <Badge
                    variant="outline"
                    className="text-orange-400 border-orange-400/50 bg-orange-500/10 ml-2"
                  >
                    {getActiveFilterCount()} filters applied
                  </Badge>
                )}
              </p>
            )}
          </div>

          {/* Top controls on the right (stack on mobile) */}
          <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-300 ${hasActiveFilters
                ? "bg-gradient-to-r from-orange-500 to-red-500 border-orange-500/50 text-white-300 shadow-lg"
                : "border-gray-600 text-white"
                }`}
              aria-expanded={showFilters}
            >
              <SlidersHorizontal size={16} />
              <span className="truncate">Advanced Filters</span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2 bg-gray-500 text-white">
                  {getActiveFilterCount()}
                </Badge>
              )}
              <ChevronDown
                size={16}
                className={`ml-1 transition-transform duration-300 ${showFilters ? "rotate-180" : ""}`}
              />
            </Button>

            <div className="flex gap-2 mt-2 sm:mt-0">
              {(["all", "movie", "tv"] as const).map((type) => (
                <Badge
                  key={type}
                  variant={filterType === type ? "default" : "outline"}
                  className={`cursor-pointer transition-all duration-200 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg flex items-center gap-2 ${filterType === type
                    ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg"
                    : "border-gray-600 text-gray-300 hover:text-white hover:border-orange-400"
                    }`}
                  onClick={() => setFilterType(type)}
                >
                  {type === "all" ? (
                    <>
                      <Sparkles size={12} />
                      <span className="hidden sm:inline">All</span>
                    </>
                  ) : type === "movie" ? (
                    <>
                      <Film size={12} />
                      <span className="hidden sm:inline">Movies</span>
                    </>
                  ) : (
                    <>
                      <Tv size={12} />
                      <span className="hidden sm:inline">TV</span>
                    </>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Filters Panel (collapsible) */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="mb-6 bg-gray-800/40 backdrop-blur-md rounded-2xl p-4 sm:p-6 border border-gray-700/50 shadow-sm"
            >
              {/* Row 1: Sort + Content Toggle + Adult */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Sort */}
                <div className="sm:col-span-2">
                  <label className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-2">
                    <TrendingUp size={16} />
                    Sort Results By
                  </label>
                  <div className="flex flex-wrap gap-2">
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
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${isActive
                            ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-blue-400/50 shadow"
                            : "bg-gray-800/60 text-gray-300 border-gray-600/50 hover:bg-gray-700/80"
                            }`}
                        >
                          <Icon size={14} />
                          <span className="truncate">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Adult Toggle */}
                <div className="flex items-start sm:items-center gap-3">
                  <div className="flex-1">
                    <label className="text-sm font-semibold text-gray-200">Content Rating</label>
                    <p className="text-xs text-gray-400">Include adult content in results</p>
                  </div>
                  <div
                    role="switch"
                    aria-checked={includeAdult}
                    onClick={() => setIncludeAdult(!includeAdult)}
                    className={`relative inline-flex items-center h-6 w-12 rounded-full transition-colors duration-200 cursor-pointer ${includeAdult ? "bg-red-500" : "bg-gray-600"
                      }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${includeAdult ? "translate-x-6" : "translate-x-1"
                        }`}
                    />
                  </div>
                </div>
              </div>

              {/* Year & Rating (stack on mobile) */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Year */}
                <div className="rounded-2xl p-4 border border-gray-700/50 bg-gradient-to-br from-gray-800/60 to-gray-900/60">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Calendar size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Release Year</h3>
                      <p className="text-xs text-gray-400">Filter by release date</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {decades.map((decade) => {
                      const isSelected = yearRange[0] === decade.start && yearRange[1] === decade.end;
                      return (
                        <button
                          key={decade.label}
                          onClick={() => setDecade(decade.start, decade.end)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${isSelected ? "bg-blue-500 text-white" : "bg-gray-700/50 text-gray-300"
                            }`}
                        >
                          {decade.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">From</label>
                      <select
                        value={yearRange[0]}
                        onChange={(e) => setYearRange([parseInt(e.target.value), yearRange[1]])}
                        className="w-full px-3 py-2 bg-gray-900/80 border border-gray-600 rounded-lg text-white text-xs"
                      >
                        {years.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">To</label>
                      <select
                        value={yearRange[1]}
                        onChange={(e) => setYearRange([yearRange[0], parseInt(e.target.value)])}
                        className="w-full px-3 py-2 bg-gray-900/80 border border-gray-600 rounded-lg text-white text-xs"
                      >
                        {years.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs">
                    <span className="text-gray-400">Range:</span>
                    <span className="font-bold text-blue-400 text-sm">
                      {yearRange[0]} - {yearRange[1]}
                    </span>
                  </div>
                </div>

                {/* Rating */}
                <div className="rounded-2xl p-4 border border-gray-700/50 bg-gradient-to-br from-gray-800/60 to-gray-900/60">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                      <Star size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Rating Filter</h3>
                      <p className="text-xs text-gray-400">Show specific ratings</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {quickRatingPresets.map((preset) => {
                      const isSelected = ratingRange[0] === preset.min && ratingRange[1] === preset.max;
                      return (
                        <button
                          key={preset.label}
                          onClick={() => setRatingRange([preset.min, preset.max])}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 ${isSelected ? "bg-yellow-600 text-white-900" : "bg-gray-700/50 text-gray-300"
                            }`}
                        >
                          {isSelected && <Check size={12} />}
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Min</label>
                      <select
                        value={ratingRange[0]}
                        onChange={(e) => setRatingRange([parseInt(e.target.value), ratingRange[1]])}
                        className="w-full px-3 py-2 bg-gray-900/80 border border-gray-600 rounded-lg text-white text-xs"
                      >
                        {ratings.map((rating) => (
                          <option key={rating} value={rating}>
                            {rating} ★
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Max</label>
                      <select
                        value={ratingRange[1]}
                        onChange={(e) => setRatingRange([ratingRange[0], parseInt(e.target.value)])}
                        className="w-full px-3 py-2 bg-gray-900/80 border border-gray-600 rounded-lg text-white text-xs"
                      >
                        {ratings.map((rating) => (
                          <option key={rating} value={rating}>
                            {rating} ★
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs">
                    <span className="text-gray-400">Range:</span>
                    <span className="font-bold text-yellow-400 text-sm">
                      {ratingRange[0]} ★ - {ratingRange[1]} ★
                    </span>
                  </div>
                </div>
              </div>

              {/* Genres & Countries stacked for mobile */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-200 mb-3 block flex items-center gap-2">
                    <Film size={16} />
                    Genres
                    {selectedGenres.length > 0 && (
                      <Badge variant="outline" className="text-xs text-gray-200 bg-purple-500/20 ml-2">
                        {selectedGenres.length} selected
                      </Badge>
                    )}
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {availableGenres.map((genre) => {
                      const isSelected = selectedGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          onClick={() => handleGenreToggle(genre)}
                          className={`px-2 py-2 text-xs rounded-lg text-center font-medium transition-all duration-150 ${isSelected
                            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                            : "bg-gray-700/50 text-gray-300"
                            }`}
                        >
                          {genre}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-200 mb-3 block flex items-center gap-2">
                    <Globe size={16} />
                    Countries
                    {selectedCountries.length > 0 && (
                      <Badge variant="outline" className="text-xs text-gray-200 bg-green-500/20 ml-2">
                        {selectedCountries.length} selected
                      </Badge>
                    )}
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {availableCountries.map((country) => {
                      const isSelected = selectedCountries.includes(country.code);
                      return (
                        <button
                          key={country.code}
                          onClick={() => handleCountryToggle(country.code)}
                          className={`px-2 py-2 text-xs rounded-lg text-center font-medium transition-all duration-150 ${isSelected
                            ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                            : "bg-gray-700/50 text-gray-300"
                            }`}
                        >
                          {country.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">

                {/* Filter count */}
                <div className="text-sm text-gray-400">
                  {hasActiveFilters ? `${getActiveFilterCount()} filters active` : "No filters applied"}
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-2 w-full sm:w-auto">

                  {/* Reset button (text on desktop, icon-only on mobile) */}
                  <Button
                    size="sm"
                    onClick={clearAllFilters}
                    disabled={!hasActiveFilters}
                    className="
    flex items-center gap-1 justify-center
    rounded-lg px-3 py-1.5
    border border-slate-400/30
    text-slate-300
    hover:bg-slate-400/10 hover:border-slate-400/60
    active:scale-95 transition
    disabled:opacity-40
  "
                  >
                    <RotateCcw size={14} />

                    {/* Hide label on mobile */}
                    <span className="hidden sm:inline">Reset</span>
                  </Button>

                  {/* Apply button */}
                  <Button
                    size="sm"
                    onClick={() => setShowFilters(false)}
                    className="
        flex-1 sm:flex-none
        bg-gradient-to-r from-orange-400 to-red-500 
        text-white shadow-sm
        py-2.5 rounded-xl
      "
                  >
                    Apply
                  </Button>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading && (
          <div className="space-y-6">
            <div className="bg-gray-800/30 rounded-2xl p-4 border border-gray-700">
              <Skeleton className="h-5 w-40 bg-gray-700 mb-3" />
              <div className="flex gap-4">
                <Skeleton className="w-24 h-36 bg-gray-700 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-6 w-3/4 bg-gray-700" />
                  <Skeleton className="h-4 w-full bg-gray-700" />
                  <Skeleton className="h-4 w-2/3 bg-gray-700" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-[2/3] w-full bg-gray-800/50 rounded-lg" />
                  <Skeleton className="h-4 w-full bg-gray-800/50" />
                  <Skeleton className="h-3 w-3/4 bg-gray-800/50" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-12">
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 max-w-md mx-auto">
              <X className="mx-auto mb-3 h-14 w-14 text-red-400" />
              <h2 className="text-xl font-semibold text-red-300 mb-2">Search Failed</h2>
              <p className="text-gray-400 mb-4">{error}</p>
              <Button onClick={() => window.location.reload()} className="bg-red-500 hover:bg-red-600 text-white w-full">
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && !error && (
          <>
            {results.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-gray-800/30 border border-gray-700 rounded-2xl p-8 max-w-lg mx-auto">
                  <Search className="mx-auto mb-4 h-16 w-16 text-gray-500" />
                  <h2 className="text-xl font-semibold text-gray-300 mb-2">No results found</h2>
                  <p className="text-gray-400 mb-4">Try adjusting your search terms or filters to discover more content</p>
                  {hasActiveFilters && (
                    <Button onClick={clearAllFilters} variant="outline" className="border-orange-500 text-orange-400">
                      Clear all filters
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Best Match */}
                {bestMatch && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                    <div className="flex flex-col sm:flex-row gap-4 items-start bg-gradient-to-r from-gray-800/50 to-gray-800/30 rounded-3xl p-4 border border-gray-700/50">
                      <div className="flex-shrink-0">
                        <div
                          className="relative w-36 h-52 sm:w-48 sm:h-72 rounded-2xl overflow-hidden border-2 border-gray-600 group hover:border-orange-500/50 transition-all duration-300 cursor-pointer"
                          onClick={() => handleCardClick(bestMatch)}
                        >
                          <Image
                            src={getPosterUrl(bestMatch)}
                            alt={getTitle(bestMatch)}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <div className="bg-orange-500/20 backdrop-blur-sm rounded-full p-3 border border-orange-500/50">
                                <Play className="text-white" size={20} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <Badge className={`${bestMatch.type === "tv" ? "bg-blue-500" : "bg-purple-500"} text-white`}>
                            {bestMatch.type === "tv" ? <><Tv size={12} className="mr-1" />TV Series</> : <><Film size={12} className="mr-1" />Movie</>}
                          </Badge>

                          <div className="flex items-center gap-2">
                            <Star size={14} className="text-yellow-400" fill="currentColor" />
                            <span className="text-white font-semibold">{bestMatch.vote_average.toFixed(1)}</span>
                            <span className="text-gray-400 text-xs">({(bestMatch.vote_count / 1000).toFixed(1)}K votes)</span>
                          </div>
                        </div>

                        <h3 className="text-xl sm:text-2xl font-bold text-white">{getTitle(bestMatch)}</h3>

                        <div className="flex items-center gap-4 text-gray-300 text-sm">
                          {getReleaseYear(bestMatch) && (
                            <div className="flex items-center gap-1">
                              <Calendar size={14} />
                              <span>{getReleaseYear(bestMatch)}</span>
                            </div>
                          )}
                          {bestMatch.origin_country?.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Globe size={14} />
                              <span>{getCountryName(bestMatch.origin_country[0])}</span>
                            </div>
                          )}
                        </div>

                        <p className="text-gray-300 text-sm line-clamp-4">{bestMatch.overview}</p>

                        {getGenres(bestMatch).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {getGenres(bestMatch).map((genre) => (
                              <Badge key={genre} variant="outline" className="border-gray-500 text-gray-300 bg-gray-700/50">
                                {genre}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-row gap-2 mt-10 w-full">

                          {/* Play Trailer */}
                          <Button
                            onClick={() => handlePlayTrailer(bestMatch)}
                            className="
      flex-1 sm:flex-none
      bg-gradient-to-r from-orange-400 to-rose-500
      text-white font-medium
      hover:opacity-90 active:scale-95
      transition rounded-xl
      flex items-center justify-center
    "
                          >
                            <Play size={18} className="mr-0 sm:mr-2" />
                            <span className="hidden sm:inline">Play Trailer</span>
                          </Button>

                          {/* More Info */}
                          <Button
                            onClick={() => handleCardClick(bestMatch)}
                            variant="outline"
                            className="
      flex-1 sm:flex-none
    border border-slate-400/30
    text-slate-300
    bg-primary
    hover:bg-slate-400/10 hover:border-slate-400/60
    active:scale-95 transition
    disabled:opacity-40 rounded-xl
      flex items-center justify-center
    "
                          >
                            <Info size={18} className="mr-0 sm:mr-2 " />
                            <span className="hidden sm:inline">More Info</span>
                          </Button>

                        </div>

                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Top Results */}
                {results.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-lg sm:text-2xl font-bold mb-4 bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                      Top Results
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {results.slice(0, 2).map((item) => (
                        <motion.div
                          key={`featured-${item.id}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="relative group cursor-pointer rounded-2xl overflow-hidden bg-gray-800/30 p-0 border border-gray-700 hover:border-orange-500/50 transition-all duration-300"
                          onClick={() => handleCardClick(item)}
                        >
                          <div className="relative h-44 sm:h-64">
                            <Image
                              src={getBackdropUrl(item)}
                              alt={getTitle(item)}
                              fill
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                            <div className="absolute bottom-3 left-3 right-3">
                              <div className="flex items-center gap-3 mb-2">
                                <Badge className={`${item.type === "tv" ? "bg-blue-500" : "bg-purple-500"} text-white`}>
                                  {item.type === "tv" ? <><Tv size={12} className="mr-1" />Series</> : <><Film size={12} className="mr-1" />Movie</>}
                                </Badge>

                                <div className="flex items-center gap-1 text-orange-400">
                                  <Star size={14} fill="currentColor" />
                                  <span className="text-sm font-semibold text-white">{item.vote_average.toFixed(1)}</span>
                                </div>
                              </div>

                              <h3 className="text-lg sm:text-2xl font-bold text-white drop-shadow-lg line-clamp-2">{getTitle(item)}</h3>

                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All Results / Grid or List */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg sm:text-2xl font-bold text-gray-200 flex items-center gap-2">
                      <Search size={18} />
                      All Results
                    </h2>

                    <div className="flex items-center gap-2">
                      <div className="bg-gray-800/60 rounded-xl p-1 flex border border-gray-600/50">
                        <button
                          onClick={() => setViewMode("grid")}
                          className={`p-2 rounded-lg transition-all duration-200 ${viewMode === "grid" ? "bg-gradient-to-r from-orange-500 to-red-500 text-white" : "text-gray-400 hover:text-white"}`}
                          aria-label="Grid view"
                        >
                          <Grid3X3 size={18} />
                        </button>
                        <button
                          onClick={() => setViewMode("list")}
                          className={`p-2 rounded-lg transition-all duration-200 ${viewMode === "list" ? "bg-gradient-to-r from-orange-500 to-red-500 text-white" : "text-gray-400 hover:text-white"}`}
                          aria-label="List view"
                        >
                          <List size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {results.map((item, index) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className="group cursor-pointer"
                          onClick={() => handleCardClick(item)}
                        >
                          <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800/50 border border-gray-700 group-hover:border-orange-500/50 transition-all">
                            <Image src={getPosterUrl(item)} alt={getTitle(item)} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                            <div className="absolute top-2 right-2">
                              <div className="flex items-center gap-1 bg-black/80 rounded-lg px-2 py-1 text-xs border border-gray-600">
                                <Star size={10} className="text-orange-400" fill="currentColor" />
                                <span className="text-white text-xs font-medium">{item.vote_average > 0 ? item.vote_average.toFixed(1) : "New"}</span>
                              </div>
                            </div>
                            <div className="absolute bottom-2 left-2">
                              <Badge className={`${item.type === "tv" ? "bg-blue-500" : "bg-purple-500"} text-white`}>
                                {item.type === "tv" ? <><Tv size={12} className="mr-1" />Series</> : <><Film size={12} className="mr-1" />Movie</>}
                              </Badge>
                            </div>
                          </div>

                          <div className="mt-2">
                            <h3 className="font-semibold text-sm text-white line-clamp-2 group-hover:text-orange-300">{getTitle(item)}</h3>
                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                              {getReleaseYear(item) && <span className="text-gray-300">{getReleaseYear(item)}</span>}
                              {getGenres(item)[0] && <span className="text-gray-500">• {getGenres(item)[0]}</span>}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {results.map((item, index) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.01 }}
                          className="flex gap-4 bg-gray-800/30 rounded-lg p-3 border border-gray-700 hover:border-orange-500/50 transition-all cursor-pointer"
                          onClick={() => handleCardClick(item)}
                        >
                          <div className="relative w-20 h-28 rounded-md overflow-hidden flex-shrink-0 border border-gray-600">
                            <Image src={getPosterUrl(item)} alt={getTitle(item)} fill className="object-cover" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <h3 className="font-semibold text-white text-base line-clamp-2">{getTitle(item)}</h3>
                              <div className="flex items-center gap-3 ml-2">
                                <div className="flex items-center gap-1 text-orange-400">
                                  <Star size={14} fill="currentColor" />
                                  <span className="text-sm font-medium text-white">{item.vote_average}</span>
                                </div>
                                <Badge className={`${item.type === "tv" ? "bg-blue-500" : "bg-purple-500"} text-white`}>
                                  {item.type === "tv" ? <><Tv size={12} className="mr-1" />Series</> : <><Film size={12} className="mr-1" />Movie</>}
                                </Badge>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 text-sm text-gray-400 mt-2">
                              {getReleaseYear(item) && (
                                <div className="flex items-center gap-1">
                                  <Calendar size={14} />
                                  <span className="text-gray-300">{getReleaseYear(item)}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Users size={14} />
                                <span className="text-gray-300">{(item.vote_count / 1000)}K votes</span>
                              </div>
                              {item.origin_country?.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Globe size={14} />
                                  <span className="text-gray-300">{getCountryName(item.origin_country[0])}</span>
                                </div>
                              )}
                            </div>

                            <p className="text-gray-300 text-sm line-clamp-3 mt-2">{item.overview}</p>

                            {getGenres(item).length > 0 && (
                              <div className="flex gap-2 mt-2">
                                {getGenres(item).map((genre) => (
                                  <Badge key={genre} variant="outline" className="text-xs border-gray-500 text-gray-300">
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
        )}

        {/* Pagination */}
        {renderPagination()}

        {/* Results Summary Footer */}
        {!loading && !error && results.length > 0 && (
          <div className="text-center mt-6">
            <div className="inline-flex items-center gap-2 bg-gray-800/40 backdrop-blur-sm rounded-lg px-4 py-2 border border-gray-700/50">
              <span className="text-gray-300 text-sm">
                Showing {(currentPage - 1) * 20 + 1} - {Math.min(currentPage * 20, totalResults)} of {totalResults.toLocaleString()} results
              </span>
              {hasActiveFilters && (
                <Badge variant="outline" className="text-orange-400 border-orange-400/50 bg-orange-500/10 ml-2">
                  {getActiveFilterCount()} filters active
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Trailer Modal */}
        {selectedTrailer && (
          <TrailerModal
            trailer={selectedTrailer}
            onClose={handleCloseTrailer}
            onSelectTrailer={handleSelectTrailer}
          />
        )}
      </div>
    </div>
  );

}
