// app/search/page.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Calendar,
  Users,
  Play,
  Info,
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
  TrendingUp,
  Clock,
  Award,
  RotateCcw,
  Check,
  User,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingBadge } from "@/components/ui/rating-badge";
import dynamic from "next/dynamic";
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
  profile_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  type: "movie" | "tv" | "person";
  genre_ids: number[];
  genres: string[];
  popularity: number;
  adult?: boolean;
  origin_country?: string[];
  trailer_key?: string | null;
  known_for_department?: string;
  runtime?: number | null;
  number_of_episodes?: number | null;
}

interface VideoResult {
  key: string;
  site?: string;
  type?: string;
}

interface TrendingTerm {
  id: number;
  title: string;
  media_type: "movie" | "tv" | "person";
}

type SearchSort = "relevance" | "rating" | "date" | "popularity";
type SearchStatus = "idle" | "loading" | "success" | "empty" | "error";

type TrailerItem = {
  id: number;
  title: string;
  poster_path?: string;
  trailer_key?: string;
  release_date?: string;
  runtime?: number;
  number_of_episodes?: number;
  genres?: string[];
  overview?: string;
  vote_average?: number;
  recommendations?: TrailerItem[];
  media_type?: string;
  type?: string;
};

interface SearchResponse {
  results: SearchResult[];
  total_results: number;
  total_pages: number;
  page: number;
  best_match?: SearchResult;
  status?: "success" | "empty" | "partial" | "error";
  is_partial?: boolean;
  query?: string;
  request_id?: string;
  cached?: boolean;
  completed_at?: string;
  error?: string;
  sources?: Array<{
    source: string;
    status: "fulfilled" | "rejected" | "timeout";
    error?: string;
  }>;
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

const FILTER_SURFACE =
  "rounded-xl border border-white/10 bg-white/[0.04] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]";
const FILTER_SECTION_TITLE =
  "text-sm font-semibold text-gray-100 flex items-center gap-2";
const FILTER_CHIP =
  "border border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] hover:text-white hover:border-[#e94f37]/40";
const FILTER_CHIP_ACTIVE =
  "border-[#e94f37]/70 bg-[#e94f37]/15 text-white shadow-[0_0_0_1px_rgba(233,79,55,0.18)]";
const RESULT_CARD_CLASS =
  "border border-white/10 bg-white/[0.04] hover:border-[#e94f37]/50 hover:bg-white/[0.07] transition-all";
const MIN_FILTER_YEAR = 1980;
const MAX_FILTER_YEAR = 2026;
const SEARCH_PAGE_SIZE = 20;

const parseSearchPage = (value: string | null) => {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
};

const parseSearchType = (
  value: string | null
): "all" | "movie" | "tv" | "person" =>
  value === "movie" || value === "tv" || value === "person" ? value : "all";

export default function SearchResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const requestedPage = parseSearchPage(searchParams.get("page"));
  const requestedType = parseSearchType(searchParams.get("type"));
  const searchIdentity = `${query.trim()}::${requestedType}`;
  const routeSearchIdentity = `${searchIdentity}::${requestedPage}`;

  const [results, setResults] = useState<SearchResult[]>([]);
  const [bestMatch, setBestMatch] = useState<SearchResult | null>(null);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>(
    query.trim() ? "loading" : "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(requestedPage);
  const [totalPages, setTotalPages] = useState(0);
  const [completedSearchKey, setCompletedSearchKey] = useState<string | null>(null);
  const [navigationReadyKey, setNavigationReadyKey] =
    useState(routeSearchIdentity);
  const latestSearchKeyRef = useRef<string>("");
  const requestSequenceRef = useRef(0);
  const activeSearchAbortRef = useRef<AbortController | null>(null);
  const previousSearchIdentityRef = useRef(searchIdentity);
  const previousRouteIdentityRef = useRef("");
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const availableCountries = COUNTRY_OPTIONS;

  // UI State
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<SearchSort>("relevance");
  const [filterType, setFilterType] = useState<"all" | "movie" | "tv" | "person">(
    requestedType
  );
  const [showFilters, setShowFilters] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [openYearDropdown, setOpenYearDropdown] = useState<"from" | "to" | null>(null);
  const [openRatingDropdown, setOpenRatingDropdown] = useState<"min" | "max" | null>(null);

  // Enhanced filter states
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [includeAdult, setIncludeAdult] = useState(false);
  const [appliedFilterType, setAppliedFilterType] = useState(filterType);
  const [appliedSortBy, setAppliedSortBy] = useState(sortBy);
  const [appliedSelectedGenres, setAppliedSelectedGenres] = useState<string[]>([]);
  const [appliedSelectedCountries, setAppliedSelectedCountries] = useState<string[]>([]);
  const [appliedYearRange, setAppliedYearRange] = useState([
    MIN_FILTER_YEAR,
    MAX_FILTER_YEAR,
  ]);
  const [appliedRatingRange, setAppliedRatingRange] = useState([0, 10]);
  const [appliedIncludeAdult, setAppliedIncludeAdult] = useState(false);

  // Enhanced UI states for sliders
  const [yearRange, setYearRange] = useState([
    MIN_FILTER_YEAR,
    MAX_FILTER_YEAR,
  ]);
  const [ratingRange, setRatingRange] = useState([0, 10]);
  const years = Array.from(
    { length: MAX_FILTER_YEAR - MIN_FILTER_YEAR + 1 },
    (_, i) => MIN_FILTER_YEAR + i
  );
  const ratings = Array.from({ length: 11 }, (_, i) => i);
  const decades = [
    { label: "1980s", start: 1980, end: 1989 },
    { label: "1990s", start: 1990, end: 1999 },
    { label: "2000s", start: 2000, end: 2009 },
    { label: "2010s", start: 2010, end: 2019 },
    { label: "2020s", start: 2020, end: MAX_FILTER_YEAR },
  ];

  const setDecade = (start: number, end: number) => {
    setYearRange([start, end]);
    setOpenYearDropdown(null);
  };

  const setYearFrom = (year: number) => {
    setYearRange((prev) => [year, Math.max(year, prev[1])]);
    setOpenYearDropdown(null);
  };

  const setYearTo = (year: number) => {
    setYearRange((prev) => [Math.min(prev[0], year), year]);
    setOpenYearDropdown(null);
  };

  const setRatingMinValue = (rating: number) => {
    setRatingRange((prev) => [rating, Math.max(rating, prev[1])]);
    setOpenRatingDropdown(null);
  };

  const setRatingMaxValue = (rating: number) => {
    setRatingRange((prev) => [Math.min(prev[0], rating), rating]);
    setOpenRatingDropdown(null);
  };

  // Quick rating presets
  const quickRatingPresets = [
    { label: "All Ratings", min: 0, max: 10 },
    { label: "Good (7+)", min: 7, max: 10 },
    { label: "Great (8+)", min: 8, max: 10 },
    { label: "Excellent (9+)", min: 9, max: 10 },
  ];

  // Trailer modal state
  const [selectedTrailer, setSelectedTrailer] = useState<TrailerItem | null>(null);

  const buildSearchKey = useMemo(
    () =>
      [
        query.trim(),
        currentPage,
        appliedFilterType,
        appliedSortBy,
        appliedSelectedGenres.join("|"),
        appliedSelectedCountries.join("|"),
        appliedYearRange.join("-"),
        appliedRatingRange.join("-"),
        appliedIncludeAdult,
      ].join("::"),
    [
      query,
      currentPage,
      appliedFilterType,
      appliedSortBy,
      appliedSelectedGenres,
      appliedSelectedCountries,
      appliedYearRange,
      appliedRatingRange,
      appliedIncludeAdult,
    ]
  );

  const loading = searchStatus === "loading";
  const hasCompletedCurrentSearch = completedSearchKey === buildSearchKey;

  const navigateToNewSearch = (
    rawQuery: string,
    type: "all" | "movie" | "tv" | "person" = "all"
  ) => {
    const trimmedQuery = rawQuery.trim();
    if (!trimmedQuery) return;

    const params = new URLSearchParams();
    params.set("q", trimmedQuery);
    params.set("page", "1");
    if (type !== "all") params.set("type", type);

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    router.push(`/search?${params.toString()}`, { scroll: false });
  };

  const navigateToSearchPage = (
    page: number,
    options: { replace?: boolean; type?: "all" | "movie" | "tv" | "person" } = {}
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(Math.max(1, page)));

    if (options.type) {
      if (options.type === "all") params.delete("type");
      else params.set("type", options.type);
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const href = `/search?${params.toString()}`;
    if (options.replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  };

  // Convert SearchResult to All type for TrailerModal
  const convertToTrailerData = (item: SearchResult): TrailerItem => {
    return {
      id: item.id,
      title: getTitle(item),
      overview: item.overview ?? "",
      poster_path: item.poster_path ?? undefined,
      release_date: item.release_date ?? item.first_air_date ?? undefined,
      vote_average: item.vote_average ?? 0,
      genres: item.genres,
      runtime: item.runtime ?? undefined,
      number_of_episodes: item.number_of_episodes ?? undefined,
      trailer_key: item.trailer_key ?? undefined,
      recommendations: [],
      type: item.type === "person" ? "movie" : item.type,
    };
  };

  // Handle play trailer button click
  const handlePlayTrailer = async (item: SearchResult) => {
    try {
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
          (videoData.results as VideoResult[] | undefined)?.find(
            (video) => video.type === "Trailer" && video.site === "YouTube"
          ) || (videoData.results as VideoResult[] | undefined)?.[0];

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

  const handleSelectTrailer = async (trailer: TrailerItem) => {
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
      } catch {
        setAvailableGenres(GENRE_OPTIONS);
      }
    };
    loadGenres();
  }, []);

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  useEffect(() => {
    if (previousRouteIdentityRef.current === routeSearchIdentity) return;

    const queryChanged =
      previousSearchIdentityRef.current !== searchIdentity;

    activeSearchAbortRef.current?.abort();
    activeSearchAbortRef.current = null;
    requestSequenceRef.current += 1;
    latestSearchKeyRef.current = "";

    setResults([]);
    setBestMatch(null);
    setTotalResults(0);
    setTotalPages(0);
    setCompletedSearchKey(null);
    setError(null);
    setExpandedSections({});
    setSelectedTrailer(null);
    setCurrentPage(requestedPage);
    setSearchStatus(query.trim() ? "loading" : "idle");

    if (queryChanged) {
      setFilterType(requestedType);
      setSortBy("relevance");
      setSelectedGenres([]);
      setSelectedCountries([]);
      setYearRange([MIN_FILTER_YEAR, MAX_FILTER_YEAR]);
      setRatingRange([0, 10]);
      setIncludeAdult(false);
      setAppliedFilterType(requestedType);
      setAppliedSortBy("relevance");
      setAppliedSelectedGenres([]);
      setAppliedSelectedCountries([]);
      setAppliedYearRange([MIN_FILTER_YEAR, MAX_FILTER_YEAR]);
      setAppliedRatingRange([0, 10]);
      setAppliedIncludeAdult(false);
      setShowFilters(false);
    }

    previousSearchIdentityRef.current = searchIdentity;
    previousRouteIdentityRef.current = routeSearchIdentity;
    setNavigationReadyKey(routeSearchIdentity);

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }, 120);
    });
  }, [
    query,
    requestedPage,
    requestedType,
    routeSearchIdentity,
    searchIdentity,
  ]);

  useEffect(() => {
    if (
      navigationReadyKey !== routeSearchIdentity ||
      currentPage !== requestedPage
    ) {
      return;
    }

    latestSearchKeyRef.current = buildSearchKey;

    // Condition: don't fetch if user hasn't typed AND hasn't applied filters
    const noQueryAndNoFilters =
      !query.trim() &&
      appliedSelectedGenres.length === 0 &&
      appliedSelectedCountries.length === 0 &&
      appliedYearRange[0] === MIN_FILTER_YEAR &&
      appliedYearRange[1] === MAX_FILTER_YEAR &&
      appliedRatingRange[0] === 0 &&
      appliedRatingRange[1] === 10 &&
      appliedFilterType === "all" &&
      !appliedIncludeAdult;

    if (noQueryAndNoFilters) {
      setResults([]);
      setBestMatch(null);
      setTotalResults(0);
      setTotalPages(0);
      setCompletedSearchKey(null);
      setSearchStatus("idle");
      setError(null);
      return;
    }

    activeSearchAbortRef.current?.abort();
    const controller = new AbortController();
    activeSearchAbortRef.current = controller;
    const requestId = ++requestSequenceRef.current;
    setSearchStatus("loading");
    setError(null);

    const fetchResults = async () => {
      setSearchStatus("loading");
      setError(null);

      try {
        const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const params = new URLSearchParams();

        // Always include query if it exists
        if (query.trim()) params.append("q", query.trim());

        // Always include filters even if query exists
        params.append("page", currentPage.toString());
        params.append("type", appliedFilterType);
        params.append("sort", appliedSortBy);
        params.append("include_adult", appliedIncludeAdult.toString());

        if (appliedSelectedGenres.length > 0)
          params.append("genres", appliedSelectedGenres.join(","));
        if (appliedSelectedCountries.length > 0)
          params.append("countries", appliedSelectedCountries.join(","));
        if (appliedYearRange[0] !== MIN_FILTER_YEAR)
          params.append("year_min", appliedYearRange[0].toString());
        if (appliedYearRange[1] !== MAX_FILTER_YEAR)
          params.append("year_max", appliedYearRange[1].toString());
        if (appliedRatingRange[0] !== 0)
          params.append("rating_min", appliedRatingRange[0].toString());
        if (appliedRatingRange[1] !== 10)
          params.append("rating_max", appliedRatingRange[1].toString());

        const response = await fetch(`${base}/search?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search failed");

        const data: SearchResponse = await response.json();
        if (
          controller.signal.aborted ||
          requestId !== requestSequenceRef.current ||
          latestSearchKeyRef.current !== buildSearchKey
        ) {
          return;
        }

        if (data.status === "error") {
          setResults([]);
          setBestMatch(null);
          setTotalResults(0);
          setTotalPages(0);
          setCompletedSearchKey(buildSearchKey);
          setError(data.error || "Failed to search. Please try again.");
          setSearchStatus("error");
          return;
        }

        const nextResults = data.results || [];
        const apiTotalResults = data.total_results || 0;
        const apiTotalPages =
          data.total_pages || Math.ceil(apiTotalResults / SEARCH_PAGE_SIZE);

        setResults(nextResults);
        setBestMatch(data.best_match || null);
        setTotalResults(apiTotalResults);
        setTotalPages(apiTotalPages);
        setCompletedSearchKey(buildSearchKey);
        setSearchStatus(nextResults.length > 0 ? "success" : "empty");
      } catch (err: unknown) {
        if (!(err instanceof DOMException) || err.name !== "AbortError") {
          if (
            requestId !== requestSequenceRef.current ||
            latestSearchKeyRef.current !== buildSearchKey
          ) {
            return;
          }
          setError("Failed to search. Please try again.");
          setCompletedSearchKey(buildSearchKey);
          setSearchStatus("error");
          console.error("Search error:", err);
        }
      } finally {
        if (
          !controller.signal.aborted &&
          requestId === requestSequenceRef.current &&
          latestSearchKeyRef.current === buildSearchKey
        ) {
          setSearchStatus((status) => (status === "loading" ? "empty" : status));
        }
      }
    };

    const debounceMs = currentPage === 1 ? 180 : 0;
    const timeoutId = window.setTimeout(fetchResults, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
      if (activeSearchAbortRef.current === controller) {
        activeSearchAbortRef.current = null;
      }
    };
  }, [
    buildSearchKey,
    query,
    currentPage,
    requestedPage,
    routeSearchIdentity,
    navigationReadyKey,
    appliedFilterType,
    appliedSortBy,
    appliedSelectedGenres,
    appliedSelectedCountries,
    appliedYearRange,
    appliedRatingRange,
    appliedIncludeAdult,
  ]);

  // Helper functions
  const getTitle = (item: SearchResult) =>
    item.title || item.name || "Unknown Title";
  const getReleaseYear = (item: SearchResult) => {
    const date = item.release_date || item.first_air_date;
    return date ? new Date(date).getFullYear() : null;
  };

  const getPosterUrl = (item: SearchResult) => {
    if (item.type === "person") {
      return item.profile_path
        ? `https://image.tmdb.org/t/p/w500${item.profile_path}`
        : "/placeholder-person.svg";
    }

    return item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "/placeholder-poster.svg";
  };

  const getBackdropUrl = (item: SearchResult) => {
    return item.backdrop_path
      ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
      : "/placeholder-backdrop.svg";
  };

  const getGenres = (item: SearchResult) => {
    return item.genres?.slice(0, 2) || [];
  };

  const getCountryName = (code: string) => {
    return COUNTRY_OPTIONS.find((c) => c.code === code)?.name || code;
  };

  const handleCardClick = (item: SearchResult) => {
    const path =
      item.type === "tv" ? "/tv" : item.type === "person" ? "/celeb" : "/movies";
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
    if (requestedPage !== 1) {
      setNavigationReadyKey("");
      activeSearchAbortRef.current?.abort();
      requestSequenceRef.current += 1;
    }
    setSelectedGenres([]);
    setSelectedCountries([]);
    setYearRange([MIN_FILTER_YEAR, MAX_FILTER_YEAR]);
    setRatingRange([0, 10]);
    setFilterType("all");
    setSortBy("relevance");
    setIncludeAdult(false);
    setAppliedSelectedGenres([]);
    setAppliedSelectedCountries([]);
    setAppliedYearRange([MIN_FILTER_YEAR, MAX_FILTER_YEAR]);
    setAppliedRatingRange([0, 10]);
    setAppliedFilterType("all");
    setAppliedSortBy("relevance");
    setAppliedIncludeAdult(false);
    setExpandedSections({});
    if (requestedPage !== 1) navigateToSearchPage(1, { replace: true });
    else window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const applyFilters = () => {
    if (requestedPage !== 1) {
      setNavigationReadyKey("");
      activeSearchAbortRef.current?.abort();
      requestSequenceRef.current += 1;
    }
    setAppliedSelectedGenres(selectedGenres);
    setAppliedSelectedCountries(selectedCountries);
    setAppliedYearRange(yearRange);
    setAppliedRatingRange(ratingRange);
    setAppliedFilterType(filterType);
    setAppliedSortBy(sortBy);
    setAppliedIncludeAdult(includeAdult);
    setExpandedSections({});
    setShowFilters(false);
    if (requestedPage !== 1) navigateToSearchPage(1, { replace: true });
    else window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const hasActiveFilters =
    appliedSelectedGenres.length > 0 ||
    appliedSelectedCountries.length > 0 ||
    appliedYearRange[0] !== MIN_FILTER_YEAR ||
    appliedYearRange[1] !== MAX_FILTER_YEAR ||
    appliedRatingRange[0] !== 0 ||
    appliedRatingRange[1] !== 10 ||
    appliedFilterType !== "all" ||
    appliedIncludeAdult;

  const hasPendingFilterChanges =
    selectedGenres.join(",") !== appliedSelectedGenres.join(",") ||
    selectedCountries.join(",") !== appliedSelectedCountries.join(",") ||
    yearRange[0] !== appliedYearRange[0] ||
    yearRange[1] !== appliedYearRange[1] ||
    ratingRange[0] !== appliedRatingRange[0] ||
    ratingRange[1] !== appliedRatingRange[1] ||
    filterType !== appliedFilterType ||
    sortBy !== appliedSortBy ||
    includeAdult !== appliedIncludeAdult;

  const getActiveFilterCount = () => {
    return (
      appliedSelectedGenres.length +
      appliedSelectedCountries.length +
      (appliedYearRange[0] !== MIN_FILTER_YEAR ? 1 : 0) +
      (appliedYearRange[1] !== MAX_FILTER_YEAR ? 1 : 0) +
      (appliedRatingRange[0] !== 0 ? 1 : 0) +
      (appliedRatingRange[1] !== 10 ? 1 : 0) +
      (appliedFilterType !== "all" ? 1 : 0) +
      (appliedIncludeAdult ? 1 : 0)
    );
  };
  const mediaResults = results.filter((item) => item.type !== "person");
  const movieResults = results.filter((item) => item.type === "movie");
  const tvResults = results.filter((item) => item.type === "tv");
  const personResults = results.filter((item) => item.type === "person");
  const groupedResultSections = [
    { key: "movie", title: "Movies", icon: Film, results: movieResults },
    { key: "tv", title: "TV Shows", icon: Tv, results: tvResults },
    { key: "person", title: "People", icon: User, results: personResults },
  ].filter((section) => section.results.length > 0);

  const getTypeLabel = (item: SearchResult) =>
    item.type === "tv" ? "Series" : item.type === "person" ? "Person" : "Movie";

  const getTypeIcon = (type: SearchResult["type"]) =>
    type === "tv" ? Tv : type === "person" ? User : Film;

  const getSectionPreviewLimit = () => (viewMode === "grid" ? 10 : 8);

  const renderTypeBadge = (item: SearchResult, label = getTypeLabel(item)) => {
    const contentType = item.type;
    const TypeIcon = getTypeIcon(contentType);
    const badgeClass =
      contentType === "tv"
        ? "bg-blue-500/85 text-white"
        : contentType === "person"
          ? "bg-pink-500/85 text-white"
          : "bg-purple-500/85 text-white";

    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-lg backdrop-blur-md ${badgeClass}`}
      >
        <TypeIcon size={11} />
        {label}
      </span>
    );
  };

  const renderYearDropdown = (
    id: "from" | "to",
    label: string,
    value: number,
    onChange: (year: number) => void
  ) => {
    const isOpen = openYearDropdown === id;

    return (
      <div className="relative">
        <label className="text-xs text-gray-400 mb-1.5 block">{label}</label>
        <button
          type="button"
          onClick={() => {
            setOpenRatingDropdown(null);
            setOpenYearDropdown(isOpen ? null : id);
          }}
          className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${isOpen
            ? "border-[#e94f37]/70 bg-[#e94f37]/10 text-white"
            : "border-white/10 bg-black/40 text-gray-100 hover:border-[#e94f37]/45 hover:bg-white/[0.06]"
            }`}
          aria-expanded={isOpen}
        >
          <span className="font-semibold">{value}</span>
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 right-0 z-30 mt-2 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#151515] p-2 shadow-2xl"
            >
              <div className="grid grid-cols-3 gap-1.5">
                {years.map((year) => {
                  const isSelected = value === year;

                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => onChange(year)}
                      className={`rounded-lg px-2 py-2 text-xs font-medium transition-colors ${isSelected
                        ? "bg-[#e94f37] text-white"
                        : "text-gray-300 hover:bg-white/[0.07] hover:text-white"
                        }`}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderRatingDropdown = (
    id: "min" | "max",
    label: string,
    value: number,
    onChange: (rating: number) => void
  ) => {
    const isOpen = openRatingDropdown === id;

    return (
      <div className="relative">
        <label className="text-xs text-gray-400 mb-1.5 block">{label}</label>
        <button
          type="button"
          onClick={() => {
            setOpenYearDropdown(null);
            setOpenRatingDropdown(isOpen ? null : id);
          }}
          className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${isOpen
            ? "border-[#e94f37]/70 bg-[#e94f37]/10 text-white"
            : "border-white/10 bg-black/40 text-gray-100 hover:border-[#e94f37]/45 hover:bg-white/[0.06]"
            }`}
          aria-expanded={isOpen}
        >
          <span className="font-semibold">{value} stars</span>
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 right-0 z-30 mt-2 rounded-xl border border-white/10 bg-[#151515] p-2 shadow-2xl"
            >
              <div className="grid grid-cols-2 gap-1.5">
                {ratings.map((rating) => {
                  const isSelected = value === rating;

                  return (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => onChange(rating)}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${isSelected
                        ? "bg-[#e94f37] text-white"
                        : "text-gray-300 hover:bg-white/[0.07] hover:text-white"
                        }`}
                    >
                      <span>{rating}</span>
                      <Star size={12} fill="currentColor" />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderGridResults = (sectionResults: SearchResult[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
      {sectionResults.map((item, index) => (
        <motion.div
          key={`${item.type}-${item.id}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.02 }}
          className="group cursor-pointer"
          onClick={() => handleCardClick(item)}
        >
          <div className={`relative aspect-[2/3] mt-2.5 rounded-lg overflow-hidden ${RESULT_CARD_CLASS}`}>
            <Image
              src={getPosterUrl(item)}
              alt={getTitle(item)}
              fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
            {item.type !== "person" && (
              <div className="absolute top-2 right-2">
                <RatingBadge rating={item.vote_average} variant="colored" size="sm" />
              </div>
            )}
            <div className="absolute bottom-2 left-2">{renderTypeBadge(item)}</div>
          </div>

          <div className="mt-2">
            <h3 className="font-semibold text-sm text-white line-clamp-2 group-hover:text-orange-300">
              {getTitle(item)}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
              {item.type === "person" && item.known_for_department ? (
                <span className="text-gray-300">{item.known_for_department}</span>
              ) : (
                <>
                  {getReleaseYear(item) && <span className="text-gray-300">{getReleaseYear(item)}</span>}
                </>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );

  const renderListResults = (sectionResults: SearchResult[]) => (
    <div className="space-y-3">
      {sectionResults.map((item, index) => (
        <motion.div
          key={`${item.type}-${item.id}`}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.01 }}
          className={`flex gap-4 rounded-lg p-3 cursor-pointer ${RESULT_CARD_CLASS}`}
          onClick={() => handleCardClick(item)}
        >
          <div className="relative w-20 h-28 rounded-md overflow-hidden flex-shrink-0 border border-white/10 bg-white/[0.04]">
            <Image src={getPosterUrl(item)} alt={getTitle(item)} fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" className="object-cover" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <h3 className="font-semibold text-white text-base line-clamp-2">{getTitle(item)}</h3>
              <div className="flex items-center gap-3 sm:ml-2">
                {item.type !== "person" && (
                  <RatingBadge rating={item.vote_average} variant="colored" size="sm" />
                )}
                {renderTypeBadge(item)}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mt-2">
              {item.type === "person" && item.known_for_department && (
                <div className="flex items-center gap-1">
                  <User size={14} />
                  <span className="text-gray-300">{item.known_for_department}</span>
                </div>
              )}
              {getReleaseYear(item) && (
                <div className="flex items-center gap-1">
                  <Calendar size={14} />
                  <span className="text-gray-300">{getReleaseYear(item)}</span>
                </div>
              )}
              {item.type !== "person" && (
                <div className="flex items-center gap-1">
                  <Users size={14} />
                  <span className="text-gray-300">
                    {item.vote_count ? (item.vote_count / 1000).toFixed(1) : "0.0"}K votes
                  </span>
                </div>
              )}
              {item.origin_country && item.origin_country?.length > 0 && (
                <div className="flex items-center gap-1">
                  <Globe size={14} />
                  <span className="text-gray-300">{getCountryName(item.origin_country[0])}</span>
                </div>
              )}
            </div>

            {item.overview && <p className="text-gray-300 text-sm line-clamp-3 mt-2">{item.overview}</p>}

            {getGenres(item).length > 0 && (
              <div className="flex gap-2 mt-2">
                {getGenres(item).map((genre) => (
                  <Badge key={genre} variant="outline" className="text-xs border-white/10 bg-white/[0.04] text-gray-300">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );

  // Enhanced pagination component
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalResults={totalResults}
        onPageChange={(page) => navigateToSearchPage(page)}
      />
    );
  };

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [trendingTerms, setTrendingTerms] = useState<TrendingTerm[]>([
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
        <div className="container mx-auto px-4 pb-10 pt-6 sm:pt-20">
          {/* Added px-4 for extra horizontal padding */}
          <div className="max-w-7xl mx-auto">
            {/* Content is centered and constrained */}
            {/* Header Section */}
            <div className="mb-8 text-center sm:mb-10">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-gray-700 bg-gray-800/50 sm:mb-6 sm:h-16 sm:w-16">
                <Search className="h-7 w-7 text-gray-400 sm:h-8 sm:w-8" />
              </div>

              <h1 className="mb-2 text-3xl font-bold text-white sm:text-4xl">
                Start Your Search
              </h1>
              <p className="text-sm text-gray-400 sm:text-base">
                Discover movies and TV shows you&apos;ll love
              </p>
            </div>
            {/* Search Input */}
            <div className="relative mb-8">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search for movies, series..."
                className="min-h-12 w-full rounded-full border border-gray-700 bg-gray-800/50 px-5 py-3.5 text-base text-white outline-none backdrop-blur-sm transition-all placeholder:text-gray-500 focus:border-[#e94f37] focus:ring-1 focus:ring-[#e94f37] sm:px-6 sm:py-4 sm:text-lg"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const value = (e.target as HTMLInputElement).value.trim();
                    if (value) {
                      navigateToNewSearch(value);
                    }
                  }
                }}
                autoFocus
              />
              <button
                onClick={() => {
                  const value = searchInputRef.current?.value.trim();
                  if (value) {
                    navigateToNewSearch(value);
                  }
                }}
                className="absolute right-2 top-1/2 grid min-h-10 min-w-10 -translate-y-1/2 place-items-center rounded-full bg-[#e94f37] p-2.5 transition-colors hover:bg-[#e94f37]/90 sm:right-3"
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
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
                  {trendingTerms.map((term, index) => (
                    <button
                      key={term.id || term.title}
                      onClick={() =>
                        router.push(`/${term.media_type}/${term.id}`)
                      }
                      className="min-h-12 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 text-left text-sm font-medium text-gray-300 transition-all hover:border-[#e94f37]/50 hover:bg-gray-800 hover:text-white"
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
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 sm:pt-32 lg:px-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div className="w-full sm:w-auto text-left sm:text-left">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent mb-2 break-words">
              Search results for &quot;{query}&quot;
            </h1>
            {hasCompletedCurrentSearch && searchStatus !== "error" && (
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
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-300 cursor-pointer ${hasActiveFilters
                ? "border-[#e94f37]/60 bg-[#e94f37]/15 text-white"
                : "border-white/10 bg-white/[0.04] text-gray-200 hover:bg-white/[0.08] hover:text-white"
                }`}
              aria-expanded={showFilters}
            >
              <SlidersHorizontal size={16} />
              <span className="truncate">Advanced Filters</span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2 bg-white/10 text-white">
                  {getActiveFilterCount()}
                </Badge>
              )}
              {hasPendingFilterChanges && (
                <span className="h-2 w-2 rounded-full bg-[#e94f37]" aria-hidden="true" />
              )}
              <ChevronDown
                size={16}
                className={`ml-1 transition-transform duration-300 ${showFilters ? "rotate-180" : ""}`}
              />
            </Button>

            <div className="mt-2 flex max-w-full gap-2 overflow-x-auto pb-1 mobile-native-scroll sm:mt-0 sm:overflow-visible sm:pb-0">
              {(["all", "movie", "tv", "person"] as const).map((type) => (
                <Badge
                  key={type}
                  variant={filterType === type ? "default" : "outline"}
                  className={`min-h-10 shrink-0 cursor-pointer transition-all duration-200 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg flex items-center gap-2 ${filterType === type
                    ? FILTER_CHIP_ACTIVE
                    : FILTER_CHIP
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
                  ) : type === "tv" ? (
                    <>
                      <Tv size={12} />
                      <span className="hidden sm:inline">TV</span>
                    </>
                  ) : (
                    <>
                      <User size={12} />
                      <span className="hidden sm:inline">People</span>
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
              className="mb-6 max-h-[72svh] overflow-y-auto rounded-2xl border border-white/10 bg-[#101010]/95 p-3 shadow-sm mobile-native-scroll sm:max-h-none sm:p-5"
            >
              <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                    <SlidersHorizontal size={17} className="text-[#e94f37]" />
                    Advanced Filters
                  </h2>
                  <p className="mt-1 text-xs text-gray-400">
                    Choose filters here, then apply them together.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full border px-2.5 py-1 ${hasPendingFilterChanges
                    ? "border-[#e94f37]/50 bg-[#e94f37]/10 text-[#ffb3a8]"
                    : "border-white/10 bg-white/[0.04] text-gray-400"
                    }`}>
                    {hasPendingFilterChanges ? "Pending changes" : "No pending changes"}
                  </span>
                  {hasActiveFilters && (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-gray-300">
                      {getActiveFilterCount()} active
                    </span>
                  )}
                </div>
              </div>

              {/* Row 1: Sort + Content Toggle + Adult */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Sort */}
                <div className="sm:col-span-2">
                  <label className={`${FILTER_SECTION_TITLE} mb-2`}>
                    <TrendingUp size={16} />
                    Sort Results By
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { key: "relevance", label: "Most Relevant", icon: Search },
                      { key: "rating", label: "Highest Rated", icon: Award },
                      { key: "date", label: "Most Recent", icon: Clock },
                      { key: "popularity", label: "Most Popular", icon: TrendingUp },
                    ] satisfies Array<{ key: SearchSort; label: string; icon: typeof Search }>).map((option) => {
                      const Icon = option.icon;
                      const isActive = sortBy === option.key;
                      return (
                        <button
                          key={option.key}
                          onClick={() => setSortBy(option.key)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${isActive
                            ? FILTER_CHIP_ACTIVE
                            : FILTER_CHIP
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
                    <label className="text-sm font-semibold text-gray-100">Content Rating</label>
                    <p className="text-xs text-gray-400">Include adult content in results</p>
                  </div>
                  <div
                    role="switch"
                    aria-checked={includeAdult}
                    onClick={() => setIncludeAdult(!includeAdult)}
                    className={`relative inline-flex items-center h-6 w-12 rounded-full border transition-colors duration-200 cursor-pointer ${includeAdult ? "border-[#e94f37]/60 bg-[#e94f37]/70" : "border-white/10 bg-white/10"
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
                <div className={`${FILTER_SURFACE} p-4`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white/[0.06] rounded-lg text-[#e94f37]">
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${isSelected ? FILTER_CHIP_ACTIVE : FILTER_CHIP
                            }`}
                        >
                          {decade.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {renderYearDropdown("from", "From", yearRange[0], setYearFrom)}
                    {renderYearDropdown("to", "To", yearRange[1], setYearTo)}
                  </div>

                  <div className="mt-3 flex items-center justify-between px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-xs">
                    <span className="text-gray-400">Range:</span>
                    <span className="font-bold text-[#ff8a78] text-sm">
                      {yearRange[0]} - {yearRange[1]}
                    </span>
                  </div>
                </div>

                {/* Rating */}
                <div className={`${FILTER_SURFACE} p-4`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white/[0.06] rounded-lg text-[#e94f37]">
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 border transition-colors ${isSelected ? FILTER_CHIP_ACTIVE : FILTER_CHIP
                            }`}
                        >
                          {isSelected && <Check size={12} />}
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {renderRatingDropdown("min", "Min", ratingRange[0], setRatingMinValue)}
                    {renderRatingDropdown("max", "Max", ratingRange[1], setRatingMaxValue)}
                  </div>

                  <div className="mt-3 flex items-center justify-between px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-xs">
                    <span className="text-gray-400">Range:</span>
                    <span className="font-bold text-[#ff8a78] text-sm">
                      {ratingRange[0]} - {ratingRange[1]} stars
                    </span>
                  </div>
                </div>
              </div>

              {/* Genres & Countries stacked for mobile */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`${FILTER_SURFACE} p-4`}>
                  <label className={`${FILTER_SECTION_TITLE} mb-3`}>
                    <Film size={16} />
                    Genres
                    {selectedGenres.length > 0 && (
                      <Badge variant="outline" className="text-xs border-[#e94f37]/40 bg-[#e94f37]/10 text-gray-100 ml-2">
                        {selectedGenres.length} selected
                      </Badge>
                    )}
                  </label>
                  <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto pr-1 mobile-native-scroll min-[430px]:grid-cols-3 sm:grid-cols-4">
                    {availableGenres.map((genre) => {
                      const isSelected = selectedGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          onClick={() => handleGenreToggle(genre)}
                          className={`px-2 py-2 text-xs rounded-lg text-center font-medium border transition-all duration-150 ${isSelected
                            ? FILTER_CHIP_ACTIVE
                            : FILTER_CHIP
                            }`}
                        >
                          {genre}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`${FILTER_SURFACE} p-4`}>
                  <label className={`${FILTER_SECTION_TITLE} mb-3`}>
                    <Globe size={16} />
                    Countries
                    {selectedCountries.length > 0 && (
                      <Badge variant="outline" className="text-xs border-[#e94f37]/40 bg-[#e94f37]/10 text-gray-100 ml-2">
                        {selectedCountries.length} selected
                      </Badge>
                    )}
                  </label>
                  <div className="grid max-h-52 grid-cols-1 gap-2 overflow-y-auto pr-1 mobile-native-scroll min-[430px]:grid-cols-2 sm:grid-cols-3">
                    {availableCountries.map((country) => {
                      const isSelected = selectedCountries.includes(country.code);
                      return (
                        <button
                          key={country.code}
                          onClick={() => handleCountryToggle(country.code)}
                          className={`px-2 py-2 text-xs rounded-lg text-center font-medium border transition-all duration-150 ${isSelected
                            ? FILTER_CHIP_ACTIVE
                            : FILTER_CHIP
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
                  {hasPendingFilterChanges
                    ? "Pending changes"
                    : hasActiveFilters
                      ? `${getActiveFilterCount()} filters active`
                      : "No filters applied"}
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-2 w-full sm:w-auto">

                  {/* Reset button (text on desktop, icon-only on mobile) */}
                  <Button
                    size="sm"
                    onClick={clearAllFilters}
                    disabled={!hasActiveFilters && !hasPendingFilterChanges}
                    className="
    flex items-center gap-1 justify-center
    rounded-lg px-3 py-1.5
    border border-slate-400/30
    text-slate-300
    hover:bg-slate-400/10 hover:border-slate-400/60
    active:scale-95 transition
    disabled:opacity-40 cursor-pointer
  "
                  >
                    <RotateCcw size={14} />

                    {/* Hide label on mobile */}
                    <span className="hidden sm:inline">Reset</span>
                  </Button>

                  {/* Apply button */}
                  <Button
                    size="sm"
                    onClick={applyFilters}
                    disabled={!hasPendingFilterChanges}
                    className="
        flex-1 sm:flex-none
       bg-gradient-to-r from-[#e94f37] to-[#ff6b58]
    text-white shadow-sm
        py-2.5 rounded-xl cursor-pointer
        disabled:cursor-not-allowed disabled:opacity-50
      "
                  >
                    {hasPendingFilterChanges ? "Apply changes" : "Applied"}
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
        {searchStatus === "error" && error && hasCompletedCurrentSearch && (
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
        {hasCompletedCurrentSearch && searchStatus !== "loading" && !error && (
          <>
            {searchStatus === "empty" ? (
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
            sizes="(max-width: 768px) 100vw, 50vw"
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
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-lg backdrop-blur-md ${bestMatch.type === "tv"
                              ? "bg-blue-500/85 text-white"
                              : "bg-purple-500/85 text-white"
                              }`}
                          >
                            {bestMatch.type === "tv" ? (
                              <Tv size={12} />
                            ) : (
                              <Film size={12} />
                            )}
                            {bestMatch.type === "tv" ? "Series" : "Movie"}
                          </span>

                          <div className="flex items-center gap-2">
                            <RatingBadge rating={bestMatch.vote_average} variant="colored" size="md" />
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
                          {bestMatch.origin_country && bestMatch.origin_country?.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Globe size={14} />
                              <span>{getCountryName(bestMatch.origin_country[0])}</span>
                            </div>
                          )}
                          {bestMatch.type === "person" && bestMatch.known_for_department && (
                            <div className="flex items-center gap-1">
                              <User size={14} />
                              <span>{bestMatch.known_for_department}</span>
                            </div>
                          )}
                        </div>

                        {bestMatch.overview && (
                          <p className="text-gray-300 text-sm line-clamp-4">{bestMatch.overview}</p>
                        )}

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

                          {bestMatch.type !== "person" && (
                            <Button
                              onClick={() => handlePlayTrailer(bestMatch)}
                              className="
    flex-1 sm:flex-none
    bg-gradient-to-r from-[#e94f37] to-[#ff6b58]
    text-white font-medium
    hover:opacity-90 active:scale-95
    transition rounded-xl
    flex items-center justify-center cursor-pointer
  "
                            >
                              <Play size={18} className="mr-0 sm:mr-2" />
                              <span className="hidden sm:inline">Play Trailer</span>
                            </Button>
                          )}

                          {/* More Info */}
                          <Button
                            onClick={() => handleCardClick(bestMatch)}
                            variant="outline"
                            className="
      flex-1 sm:flex-none
    border border-slate-400/30
    text-slate-300
    bg-primary
    hover:bg-slate-400/10 hover:border-slate-400/60 hover:text-slate-300
    active:scale-95 transition
    disabled:opacity-40 rounded-xl
      flex items-center justify-center cursor-pointer
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
                {mediaResults.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-lg sm:text-2xl font-bold mb-4 bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                      Top Results
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {mediaResults.slice(0, 2).map((item) => (
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
            sizes="(max-width: 768px) 100vw, 50vw"
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                            <div className="absolute bottom-3 left-3 right-3">
                              <div className="flex items-center gap-3 mb-2">
                                {renderTypeBadge(item)}

                                <RatingBadge rating={item.vote_average} variant="colored" size="sm" />
                              </div>

                              <h3 className="text-lg sm:text-2xl font-bold text-white drop-shadow-lg line-clamp-2">{getTitle(item)}</h3>

                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Results grouped by media type */}
                <div className="mb-8">
                  <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg sm:text-2xl font-bold text-gray-200 flex items-center gap-2">
                        <Search size={18} />
                        Results by Type
                      </h2>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
                        {groupedResultSections.map((section) => (
                          <a
                            key={section.key}
                            href={`#search-${section.key}-results`}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-gray-300 transition-colors hover:border-[#e94f37]/50 hover:text-white"
                          >
                            {section.results.length} {section.title.toLowerCase()}
                          </a>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="bg-gray-800/60 rounded-xl p-1 flex border border-gray-600/50">
                        <button
                          onClick={() => setViewMode("grid")}
                          className={`p-2 rounded-lg transition-all duration-200 ${viewMode === "grid" ? " bg-gradient-to-r from-[#e94f37] to-[#ff6b58]" : "text-gray-400 hover:text-white"}`}
                          aria-label="Grid view"
                        >
                          <Grid3X3 size={18} />
                        </button>
                        <button
                          onClick={() => setViewMode("list")}
                          className={`p-2 rounded-lg transition-all duration-200 ${viewMode === "list" ? " bg-gradient-to-r from-[#e94f37] to-[#ff6b58]" : "text-gray-400 hover:text-white"}`}
                          aria-label="List view"
                        >
                          <List size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {groupedResultSections.map((section) => {
                      const SectionIcon = section.icon;
                      const isExpanded = expandedSections[section.key];
                      const previewLimit = getSectionPreviewLimit();
                      const visibleResults = isExpanded
                        ? section.results
                        : section.results.slice(0, previewLimit);
                      const hiddenCount = section.results.length - visibleResults.length;

                      return (
                        <section key={section.key} id={`search-${section.key}-results`} className="scroll-mt-28">
                          <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                            <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                              <SectionIcon size={17} className="text-[#e94f37]" />
                              {section.title}
                            </h3>
                            <span className="text-xs text-gray-500">
                              {section.results.length} result{section.results.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          {viewMode === "grid"
                            ? renderGridResults(visibleResults)
                            : renderListResults(visibleResults)}
                          {hiddenCount > 0 && (
                            <div className="mt-4 flex justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setExpandedSections((prev) => ({
                                    ...prev,
                                    [section.key]: true,
                                  }))
                                }
                                className="border-white/10 bg-white/[0.04] text-gray-200 hover:border-[#e94f37]/50 hover:bg-white/[0.08] hover:text-white"
                              >
                                Show {hiddenCount} more {section.title.toLowerCase()}
                              </Button>
                            </div>
                          )}
                          {isExpanded && section.results.length > previewLimit && (
                            <div className="mt-4 flex justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setExpandedSections((prev) => ({
                                    ...prev,
                                    [section.key]: false,
                                  }))
                                }
                                className="border-white/10 bg-white/[0.04] text-gray-200 hover:border-[#e94f37]/50 hover:bg-white/[0.08] hover:text-white"
                              >
                                Show fewer {section.title.toLowerCase()}
                              </Button>
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
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
                Showing {(currentPage - 1) * SEARCH_PAGE_SIZE + 1} - {Math.min(currentPage * SEARCH_PAGE_SIZE, totalResults)} of {totalResults.toLocaleString()} results
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
    </div >
  );

}
