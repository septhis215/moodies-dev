"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { IconSearch, IconX, IconClock, IconArrowRight, IconTrendingUp, IconUser } from "@tabler/icons-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Film, Tv, User } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchSuggestion {
  id: number;
  title?: string;
  name?: string;
  type: 'movie' | 'tv' | 'person';
  year?: number | null;
  poster_path?: string | null;
  profile_path?: string | null;
  known_for_department?: string;
}

interface TrendingTerm {
  id: number;
  title: string;
  media_type: string;
}

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (q: string, mode?: string) => void;
}

type SearchMode = 'content' | 'person';

export default function SearchBarWithSuggestions({
  placeholder = "Search movies, series, celebrities...",
  onSearch,
}: SearchBarProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>('content');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suggestionsRef = useRef<HTMLDivElement | null>(null);

  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [targetWidth, setTargetWidth] = useState<number>(400);
  const [mobileValue, setMobileValue] = useState<string>("");
  const [mobileMode, setMobileMode] = useState<SearchMode>('content');

  const prefersReduced = useReducedMotion();
  const debouncedValue = useDebounce(value, 300);

  useEffect(() => {
    const history = localStorage.getItem('searchHistory');
    if (history) {
      try {
        setSearchHistory(JSON.parse(history));
      } catch { }
    }
  }, []);

  // keep mobile UI in sync when opening/modal toggles or when searchMode/value changes
  useEffect(() => {
    setMobileValue(value);
  }, [value]);

  useEffect(() => {
    setMobileMode(searchMode);
  }, [searchMode]);

  const getContentType = (item: Partial<TrendingTerm>): "movie" | "tv" | "person" => {
    if ((item as any).media_type) return (item as any).media_type as any;
    if ((item as any).type === "movies" || (item as any).type === "movie") return "movie";
    if ((item as any).type === "tv") return "tv";
    if ((item as any).type === "person") return "person";
    if ((item as any).number_of_seasons || (item as any).first_air_date || (item as any).name) return "tv";
    return "movie";
  };

  const handleClick = async (movie: TrendingTerm) => {
    const contentType = getContentType(movie);
    let href: string;

    if (contentType === "person") {
      href = `/person/${movie.id}`;
    } else {
      const routePath = contentType === "tv" ? "tv" : "movies";
      href = `/${routePath}/${movie.id}`;
    }

    router.push(href);
  };

  const [trendingTerms, setTrendingTerms] = useState<TrendingTerm[]>([
    { id: 0, title: 'Avengers', media_type: 'movie' },
    { id: 1, title: 'Stranger Things', media_type: 'tv' },
    { id: 2, title: 'Batman', media_type: 'movie' },
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
      } finally {
        setLoadingTrending(false);
      }
    };

    fetchTrendingTerms();
  }, []);

  useEffect(() => {
    if (debouncedValue.trim().length > 1 && open) {
      fetchSuggestions(debouncedValue, searchMode);
    } else {
      setSuggestions([]);
    }
  }, [debouncedValue, open, searchMode]);

  const fetchSuggestions = async (
    query: string,
    type: 'content' | 'person'
  ) => {
    setLoadingSuggestions(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/search/suggestions/${type}?q=${encodeURIComponent(
          query
        )}&limit=8`
      );

      if (response.ok) {
        const data = await response.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };


  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = () => {
      setIsMobile(mq.matches);
      setTargetWidth(mq.matches ? 280 : 400);
    };
    onChange();

    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);

    return () => {
      try {
        if (mq.removeEventListener) mq.removeEventListener("change", onChange);
        else mq.removeListener(onChange);
      } catch { }
    };
  }, []);

  useEffect(() => {
    if (open && !isMobile) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, isMobile]);

  useEffect(() => {
    const onDocPointer = (e: PointerEvent) => {
      if (mobileOpen) return;
      if (!wrapperRef.current || !suggestionsRef.current) return;

      if (
        !wrapperRef.current.contains(e.target as Node) &&
        !suggestionsRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSuggestions([]);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMobileOpen(false);
        setSuggestions([]);
      }
    };

    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const handleSearch = (query: string, mode: SearchMode = searchMode) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    const updatedHistory = [trimmedQuery, ...searchHistory.filter(h => h !== trimmedQuery)].slice(0, 10);
    setSearchHistory(updatedHistory);
    localStorage.setItem('searchHistory', JSON.stringify(updatedHistory));

    // Route based on search mode
    if (mode === 'person') {
      router.push(`/search?q=${encodeURIComponent(trimmedQuery)}&type=person`);
    } else {
      router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    }

    setOpen(false);
    setMobileOpen(false);
    setSuggestions([]);

    onSearch?.(trimmedQuery, mode);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    let path: string;

    if (suggestion.type === 'person') {
      path = `/celeb/${suggestion.id}`;
    } else {
      path = suggestion.type === 'tv' ? `/tv/${suggestion.id}` : `/movies/${suggestion.id}`;
    }

    router.push(path);
    setOpen(false);
    setSuggestions([]);
  };

  const showSuggestions = open && !isMobile && (
    suggestions.length > 0 ||
    loadingSuggestions ||
    searchHistory.length > 0 ||
    (value.trim().length === 0)
  );

  const MobileModal = () => {
    if (typeof document === "undefined") return null;

    return createPortal(
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="search-mobile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 bg-[rgba(0,0,0,0.75)]"
            onClick={() => setMobileOpen(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={prefersReduced ? {} : { y: -12, opacity: 0 }}
              animate={prefersReduced ? {} : { y: 0, opacity: 1 }}
              exit={prefersReduced ? {} : { y: -12, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 28 }}
              className="w-full max-w-lg px-6"
            >
              {/* Mode Tabs */}
              <div className="mb-3 flex gap-2 bg-white/10 backdrop-blur-md rounded-full p-1">
                <button
                  onClick={() => { setMobileMode('content'); setSearchMode('content'); }}
                  className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${mobileMode === 'content'
                    ? 'bg-[#e94f37] text-white'
                    : 'text-gray-300 hover:text-white'
                    }`}
                >
                  Movies & TV
                </button>
                <button
                  onClick={() => { setMobileMode('person'); setSearchMode('person'); }}
                  className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${mobileMode === 'person'
                    ? 'bg-[#e94f37] text-white'
                    : 'text-gray-300 hover:text-white'
                    }`}
                >
                  People
                </button>
              </div>

              <div className="relative mb-4">
                <input
                  value={mobileValue}
                  onChange={(e) => setMobileValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch(mobileValue, mobileMode);
                    }
                  }}
                  placeholder={mobileMode === 'person' ? 'Search for actors, directors...' : 'Search movies & TV series...'}
                  className="w-full rounded-full px-4 py-3 bg-white/10 backdrop-blur-md text-white placeholder:text-gray-300 outline-none "
                  autoFocus
                />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <IconX className="text-white" size={18} />
                </button>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 max-h-96 overflow-y-auto">
                {trendingTerms.slice(0, 6).map((term, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setMobileValue(term.title);
                      handleSearch(term.title, mobileMode);
                    }}
                    className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer text-white"
                  >
                    <IconTrendingUp size={16} className="text-gray-400" />
                    <span>{term.title}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    );
  };

  const resolvedIsMobile = isMobile === null ? false : isMobile;
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const updatePosition = useCallback(() => {
    const el = inputRef.current ?? wrapperRef.current;
    if (!el || typeof window === "undefined") {
      setAnchorRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setAnchorRect(r);
  }, [inputRef, wrapperRef]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const target = inputRef.current ?? wrapperRef.current;
    if (!target) return;

    resizeObserverRef.current?.disconnect();

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(updatePosition);
    });
    ro.observe(target);
    resizeObserverRef.current = ro;

    updatePosition();

    return () => {
      ro.disconnect();
      resizeObserverRef.current = null;
    };
  }, [updatePosition]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let rafId: number | null = null;
    const onScrollResize = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updatePosition);
    };

    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);

    return () => {
      window.removeEventListener("resize", onScrollResize);
      window.removeEventListener("scroll", onScrollResize, true);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [updatePosition]);

  useEffect(() => {
    if (!open || isMobile) return;
    updatePosition();
    const id = window.setTimeout(updatePosition, 120);
    return () => clearTimeout(id);
  }, [open, isMobile, updatePosition]);

  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

  const highlightMatch = useCallback((title: string, q: string) => {
    if (!q) return title;
    const qi = q.trim();
    if (!qi) return title;
    const regex = new RegExp(`(${qi.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")})`, "ig");
    const parts = title.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-transparent text-[#e94f37] font-semibold">{part}</mark> : <span key={i}>{part}</span>
    );
  }, []);

  useEffect(() => {
    if (!open || isMobile) {
      setHighlightedIndex(null);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (!showSuggestions) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev === null ? 0 : Math.min(prev + 1, (suggestions.length - 1));
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev === null ? Math.max(suggestions.length - 1, 0) : Math.max(prev - 1, 0);
          return next;
        });
      } else if (e.key === "Enter") {
        if (highlightedIndex !== null && suggestions[highlightedIndex]) {
          e.preventDefault();
          handleSuggestionClick(suggestions[highlightedIndex]);
        } else if (value.trim()) {
          handleSearch(value, searchMode);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
        setSuggestions([]);
        setHighlightedIndex(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isMobile, showSuggestions, suggestions, highlightedIndex, value, searchMode]);

  useEffect(() => {
    if (highlightedIndex === null) return;
    const el = itemRefs.current[highlightedIndex];
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightedIndex]);

  const removeHistoryItem = (term: string) => {
    const updated = searchHistory.filter(h => h !== term);
    setSearchHistory(updated);
    localStorage.setItem('searchHistory', JSON.stringify(updated));
  };

  const clearAllHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('searchHistory');
  };

  const getTypeIcon = (type: 'movie' | 'tv' | 'person') => {
    switch (type) {
      case 'person':
        return <User size={12} className="text-purple-400" />;
      case 'tv':
        return <Tv size={12} className="text-blue-400" />;
      case 'movie':
      default:
        return <Film size={12} className="text-emerald-400" />;
    }
  };

  const getTypeLabel = (type: 'movie' | 'tv' | 'person') => {
    switch (type) {
      case 'person':
        return 'Person';
      case 'tv':
        return 'TV';
      case 'movie':
      default:
        return 'Movie';
    }
  };

  const portalRender = (() => {
    if (!showSuggestions || typeof document === "undefined" || !anchorRect) return null;

    const padding = 8;
    const inputRect = anchorRect;
    const desiredWidth = Math.min(
      Math.max(inputRect.width || targetWidth || 300, 260),
      window.innerWidth - padding * 2
    );

    const maxLeft = Math.max(window.innerWidth - desiredWidth - padding, padding);
    const left = Math.min(Math.max(inputRect.left, padding), maxLeft);

    const dropdownHeightEstimate = Math.min(window.innerHeight * 0.56, 520);
    let top = inputRect.bottom + 8;
    if (top + dropdownHeightEstimate > window.innerHeight - padding) {
      top = Math.max(inputRect.top - dropdownHeightEstimate - 8, padding);
    }

    itemRefs.current = [];

    return createPortal(
      <AnimatePresence>
        <motion.div
          key="search-suggestions-portal"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.12 }}
          ref={suggestionsRef}
          style={{
            position: "fixed",
            top,
            left,
            width: desiredWidth,
            maxHeight: "56vh",
            overflow: "hidden",
            zIndex: 200000,
            pointerEvents: "auto",
          }}
          className="bg-gradient-to-b from-[#060608]/85 to-[#0b0b0d]/85 backdrop-blur-md border border-gray-800 rounded-2xl shadow-2xl ring-1 ring-black/40"
          role="listbox"
          aria-label="Search suggestions"
        >
          <div className="sticky top-0 z-10 bg-gradient-to-b from-[#060608]/90 to-transparent px-3 py-2 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-baseline gap-3">
                <div className="text-sm font-semibold text-white">Suggestions</div>
                <div className="text-xs text-gray-400">{loadingSuggestions ? "Loading…" : `${suggestions.length} results`}</div>
              </div>

              <div className="text-xs text-gray-400 flex items-center gap-2">
                <span className="hidden sm:inline">Press</span>
                <kbd className="px-2 py-0.5 rounded bg-gray-800 text-white">↑</kbd>
                <kbd className="px-2 py-0.5 rounded bg-gray-800 text-white">↓</kbd>
                <span className="hidden sm:inline">to navigate</span>
              </div>
            </div>

            {/* Mode Tabs */}
            <div className="flex gap-2 bg-white/5 rounded-full p-1">
              <button
                onClick={() => {
                  setSearchMode('content');
                  setSuggestions([]);
                  if (value.trim().length > 2) fetchSuggestions(value, 'content');
                }}
                className={`flex-1 py-1.5 px-3 rounded-full text-xs font-medium transition-all ${searchMode === 'content'
                  ? 'bg-[#e94f37] text-white'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
              >
                Movies & TV
              </button>
              <button
                onClick={() => {
                  setSearchMode('person');
                  setSuggestions([]);
                  if (value.trim().length > 2) fetchSuggestions(value, 'person');
                }}
                className={`flex-1 py-1.5 px-3 rounded-full text-xs font-medium transition-all ${searchMode === 'person'
                  ? 'bg-[#e94f37] text-white'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
              >
                People
              </button>
            </div>
          </div>

          <div className="overflow-y-auto px-2 pb-2" style={{ maxHeight: "calc(56vh - 100px)" }}>
            {loadingSuggestions && (
              <div className="space-y-2 pt-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 rounded-lg animate-pulse">
                    <div className="w-12 h-16 rounded-md bg-gray-700/60 shrink-0" />
                    <div className="flex-1">
                      <div className="h-3 w-3/5 bg-gray-700/60 rounded mb-2" />
                      <div className="h-3 w-1/3 bg-gray-700/60 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loadingSuggestions && suggestions.length > 0 && (
              <div className="space-y-2 pt-2">
                {suggestions.map((s, idx) => {
                  const isHighlighted = idx === highlightedIndex;
                  const accent = isHighlighted ? "before:w-1" : "before:w-0";
                  const bgClass = isHighlighted ? "bg-[#e94f37]/10" : "hover:bg-white/3";
                  const displayTitle = s.title || s.name || 'Unknown';
                  const imagePath = s.type === 'person' ? s.profile_path : s.poster_path;

                  return (
                    <div
                      key={`${s.type}-${s.id}`}
                      ref={(el) => (itemRefs.current[idx] = el)}
                      role="option"
                      aria-selected={isHighlighted}
                      tabIndex={-1}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onMouseLeave={() => setHighlightedIndex(null)}
                      onClick={() => handleSuggestionClick(s)}
                      className={`relative flex items-start gap-3 p-3 rounded-lg transition-colors duration-150 cursor-pointer ${bgClass}`}
                    >
                      <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-10 ${accent} rounded-r-full bg-[#e94f37] transition-all`} />

                      <div className="relative w-12 h-16 rounded-md overflow-hidden flex-shrink-0 bg-gray-800">
                        {imagePath ? (
                          <>
                            <Image
                              src={`https://image.tmdb.org/t/p/w154${imagePath}`}
                              alt={displayTitle}
                              fill
                              className="object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500">
                            {s.type === 'person' ? <IconUser size={24} /> : <Film size={24} />}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 pl-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm text-white font-semibold truncate">
                              {highlightMatch(displayTitle, value)}
                            </div>
                            {s.type === 'person' && s.known_for_department && (
                              <div className="text-xs text-gray-400 mt-1">{s.known_for_department}</div>
                            )}
                            {s.year && s.type !== 'person' && (
                              <div className="text-xs text-gray-400 mt-1">{s.year}</div>
                            )}
                          </div>

                          <div className="flex-shrink-0 ml-2 flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-200 uppercase tracking-wide">
                              {getTypeIcon(s.type)}
                              <span>{getTypeLabel(s.type)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loadingSuggestions && suggestions.length > 0 && (
              <div className="mt-3 mb-2 px-1">
                <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent" />
              </div>
            )}

            {!loadingSuggestions && suggestions.length === 0 && value.trim().length === 0 && (
              <div className="pt-2 pb-3 space-y-4">
                {searchHistory.length > 0 && (
                  <div className="bg-transparent rounded-lg px-2 py-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-gray-300">Recent searches</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { if (searchHistory[0]) handleSearch(searchHistory[0], searchMode); }}
                          className="text-xs text-gray-400 hover:text-white transition"
                          title="Search most recent"
                        >
                          Search last
                        </button>

                        <button
                          onClick={clearAllHistory}
                          className="text-xs text-gray-400 hover:text-white transition"
                          title="Clear recent"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <AnimatePresence>
                        {searchHistory.slice(0, 8).map((term, i) => (
                          <motion.div
                            key={term + i}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, height: 0 }}
                            transition={{ type: "spring", stiffness: 260, damping: 22 }}
                            className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-white/3 transition"
                          >
                            <button
                              onClick={() => handleSearch(term, searchMode)}
                              className="flex-1 text-left flex items-center gap-3 min-w-0"
                            >
                              <IconClock size={16} className="text-gray-400 flex-shrink-0" />
                              <span className="truncate text-sm text-white">{term}</span>
                            </button>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSearch(term, searchMode)}
                                aria-label={`Run search ${term}`}
                                className="p-2 rounded bg-white/6 hover:bg-white/9 transition"
                                title="Run search"
                              >
                                <IconArrowRight size={16} className="text-gray-100" />
                              </button>

                              <button
                                onClick={() => removeHistoryItem(term)}
                                aria-label={`Remove ${term} from history`}
                                className="p-2 rounded hover:bg-white/6 transition"
                                title="Remove"
                              >
                                <IconX size={14} className="text-gray-400" />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {searchHistory.length > 8 && (
                        <div className="text-xs text-gray-400 mt-1">Showing 8 of {searchHistory.length} recent searches</div>
                      )}
                    </div>
                  </div>
                )}

                {(trendingTerms).length > 0 && (
                  <div className="bg-transparent rounded-lg px-2 py-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-medium text-gray-300">Trending</div>
                    </div>

                    <div className="space-y-2">
                      {(trendingTerms).slice(0, 6).map((t, idx) => (
                        <button
                          key={t.id + idx}
                          onClick={() => handleClick(t)}
                          className="w-full text-left flex items-center gap-3 p-2 rounded-md bg-gradient-to-r from-white/3 to-white/6 hover:from-white/5 hover:to-white/8 transition"
                        >
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#e94f37]/10 text-[#e94f37] font-semibold text-sm flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm text-white truncate">{t.title}</div>
                            <div className="text-xs text-gray-400">Trending now</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {searchHistory.length === 0 && (trendingTerms).length === 0 && (
                  <div className="text-sm text-gray-400 px-2 py-3">No recent searches or trending terms available.</div>
                )}
              </div>
            )}
          </div>

          <div className="sticky bottom-0 z-10 bg-gradient-to-t from-transparent to-[#060608]/90 px-3 py-2 border-t border-gray-800/60 flex items-center justify-between text-xs text-gray-400">
            <div>{suggestions.length > 0 ? `${suggestions.length} suggestion${suggestions.length > 1 ? "s" : ""}` : "No direct matches"}</div>
            <div className="hidden sm:flex items-center gap-2">Suggestions update as you type</div>
          </div>
        </motion.div>
      </AnimatePresence>,
      document.body
    );
  })();

  return (
    <>
      <div ref={wrapperRef} className="relative flex items-center gap-2">
        <div className="flex items-center flex-row-reverse relative">
          <button
            type="button"
            onClick={() => {
              if (resolvedIsMobile) {
                setMobileOpen(true);
              } else {
                setOpen(!open);
              }
            }}
            className="ml-2 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#e94f37] transition-colors z-10"
          >
            <IconSearch size={20} />
          </button>

          <motion.div
            initial={false}
            animate={{ width: open && !resolvedIsMobile ? targetWidth : 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
            className="overflow-hidden"
          >
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch(value, searchMode);
                }
              }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              className="w-full bg-white/10 backdrop-blur-md placeholder:text-gray-300 text-white rounded-full px-4 py-2 text-sm outline-none transition-all"
              style={{ height: 36 }}
            />
          </motion.div>
        </div>

        {portalRender}
      </div>
      <MobileModal />
    </>
  );
}
