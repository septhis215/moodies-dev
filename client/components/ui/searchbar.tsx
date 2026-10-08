"use client";

import { tmdbImage } from "@/lib/tmdb";
import React, { useEffect, useRef, useState, useCallback, useId } from "react";
import { IconSearch, IconX, IconClock, IconArrowRight, IconTrendingUp } from "@tabler/icons-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import { useRouter } from 'next/navigation';
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { Film, Tv, User } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import styles from './SearchBar.module.css';

interface SearchSuggestion {
  id: number;
  title: string;
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
  media_type?: "movie" | "tv" | "person" | string;
  type?: "movies" | "movie" | "tv" | "person" | string;
  number_of_seasons?: number;
  first_air_date?: string;
  name?: string;
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
  const fieldRef = useRef<HTMLFormElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suggestionsRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileDialogRef = useRef<HTMLDivElement | null>(null);
  const searchId = useId();
  const trendingLoaded = useRef(false);

  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [targetWidth, setTargetWidth] = useState<number>(400);
  const [mobileValue, setMobileValue] = useState<string>("");
  const [mobileMode, setMobileMode] = useState<SearchMode>('content');
  const debouncedMobileValue = useDebounce(mobileValue, 300);

  const prefersReduced = useReducedMotion();
  const debouncedValue = useDebounce(value, 300);

  useEffect(() => {
    try {
      const history: unknown = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      if (Array.isArray(history)) setSearchHistory(history.filter((item): item is string => typeof item === 'string').slice(0, 10));
    } catch { /* Search still works when browser storage is unavailable. */ }
  }, []);

  // keep mobile UI in sync when opening/modal toggles or when searchMode/value changes
  useEffect(() => {
    setMobileValue(value);
  }, [value]);

  useEffect(() => {
    setMobileMode(searchMode);
  }, [searchMode]);

  const [trendingTerms, setTrendingTerms] = useState<TrendingTerm[]>([
    { id: 0, title: 'Avengers', media_type: 'movie' },
    { id: 1, title: 'Stranger Things', media_type: 'tv' },
    { id: 2, title: 'Batman', media_type: 'movie' },
  ]);

  useEffect(() => {
    if ((!open && !mobileOpen) || trendingLoaded.current) return;
    const controller = new AbortController();
    const fetchTrendingTerms = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'https://dev.api.moodies.tech/api'}/all/search/trending-terms`, { signal: controller.signal }
        );
        if (response.ok) {
          const data = await response.json();
          if (!controller.signal.aborted && Array.isArray(data) && data.length > 0) {
            setTrendingTerms(data);
            trendingLoaded.current = true;
          }
        }
      } catch {
        // Keep the local trending suggestions when the API is unavailable.
      }
    };

    void fetchTrendingTerms();
    return () => controller.abort();
  }, [open, mobileOpen]);

  useEffect(() => {
    const query = (mobileOpen ? debouncedMobileValue : debouncedValue).trim();
    const currentQuery = (mobileOpen ? mobileValue : value).trim();
    const mode = mobileOpen ? mobileMode : searchMode;
    if ((!open && !mobileOpen) || currentQuery.length < 2) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }
    if (query !== currentQuery) { setSuggestions([]); setLoadingSuggestions(true); return; }
    const controller = new AbortController();
    setLoadingSuggestions(true);
    const load = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://dev.api.moodies.tech/api'}/search/suggestions/${mode}?q=${encodeURIComponent(query)}&limit=8`, { signal: controller.signal });
        const data: unknown = response.ok ? await response.json() : [];
        if (!controller.signal.aborted) setSuggestions(Array.isArray(data) ? data : []);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoadingSuggestions(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [debouncedValue, debouncedMobileValue, value, mobileValue, open, mobileOpen, searchMode, mobileMode]);


  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 1023px)");
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

  const handleSearch = useCallback((query: string, mode: SearchMode = searchMode) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    const updatedHistory = [trimmedQuery, ...searchHistory.filter(h => h !== trimmedQuery)].slice(0, 10);
    setSearchHistory(updatedHistory);
    try { localStorage.setItem('searchHistory', JSON.stringify(updatedHistory)); } catch { /* Storage is optional. */ }

    const params = new URLSearchParams();
    params.set("q", trimmedQuery);
    params.set("page", "1");
    if (mode === 'person') {
      params.set("type", "person");
    }

    setOpen(false);
    setMobileOpen(false);
    setSuggestions([]);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    router.push(`/search?${params.toString()}`, { scroll: false });

    onSearch?.(trimmedQuery, mode);
  }, [onSearch, router, searchHistory, searchMode]);

  const handleSuggestionClick = useCallback((suggestion: SearchSuggestion) => {
    let path: string;

    if (suggestion.type === 'person') {
      path = `/celeb/${suggestion.id}`;
    } else {
      path = suggestion.type === 'tv' ? `/tv/${suggestion.id}` : `/movies/${suggestion.id}`;
    }

    router.push(path);
    setOpen(false);
    setMobileOpen(false);
    setSuggestions([]);
  }, [router]);

  const showSuggestions = open && !isMobile;


  const resolvedIsMobile = isMobile === null ? false : isMobile;
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const updatePosition = useCallback(() => {
    const el = fieldRef.current;
    if (!el || typeof window === "undefined") {
      setAnchorRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setAnchorRect(r);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const target = fieldRef.current;
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

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === "ArrowDown") {
        if (!suggestions.length) return;
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev === null ? 0 : Math.min(prev + 1, (suggestions.length - 1));
          return next;
        });
      } else if (e.key === "ArrowUp") {
        if (!suggestions.length) return;
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev === null ? Math.max(suggestions.length - 1, 0) : Math.max(prev - 1, 0);
          return next;
        });
      } else if (e.key === "Enter") {
        if (highlightedIndex !== null && suggestions[highlightedIndex]) {
          e.preventDefault();
          handleSuggestionClick(suggestions[highlightedIndex]);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
        setSuggestions([]);
        setHighlightedIndex(null);
      }
  };

  useEffect(() => { setHighlightedIndex(null); }, [suggestions, open]);

  useEffect(() => {
    if (!mobileOpen) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    mobileInputRef.current?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = mobileDialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trapFocus);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', trapFocus); trigger?.focus(); };
  }, [mobileOpen]);

  useEffect(() => {
    if (highlightedIndex === null) return;
    const el = itemRefs.current[highlightedIndex];
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightedIndex]);

  const removeHistoryItem = (term: string) => {
    const updated = searchHistory.filter(h => h !== term);
    setSearchHistory(updated);
    try { localStorage.setItem('searchHistory', JSON.stringify(updated)); } catch { /* Storage is optional. */ }
  };

  const clearAllHistory = () => {
    setSearchHistory([]);
    try { localStorage.removeItem('searchHistory'); } catch { /* Storage is optional. */ }
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
    if (!showSuggestions || typeof document === "undefined" || !anchorRect || anchorRect.width <= 0) return null;

    const padding = 8;
    const inputRect = anchorRect;
    const desiredWidth = Math.min(
      inputRect.width,
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
          role="region"
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
                type="button"
                aria-pressed={searchMode === 'content'}
                onClick={() => {
                  setSearchMode('content');
                  setSuggestions([]);
                }}
                className={`flex-1 py-1.5 px-3 rounded-full text-xs font-medium transition-all ${searchMode === 'content'
                  ? 'bg-[#e94f37] text-white'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
              >
                Movies & TV
              </button>
              <button
                type="button"
                aria-pressed={searchMode === 'person'}
                onClick={() => {
                  setSearchMode('person');
                  setSuggestions([]);
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
              <div className="space-y-2 pt-2" role="listbox" id={`${searchId}-suggestions`} aria-label="Matching titles">
                {suggestions.map((s, idx) => {
                  const isHighlighted = idx === highlightedIndex;
                  const accent = isHighlighted ? "before:w-1" : "before:w-0";
                  const bgClass = isHighlighted ? "bg-[#e94f37]/10" : "hover:bg-white/3";
                  const displayTitle = s.title || s.name || 'Unknown';
                  const imagePath = s.type === 'person' ? s.profile_path : s.poster_path;

                  return (
                    <div
                      key={`${s.type}-${s.id}`}
                      id={`${searchId}-suggestion-${idx}`}
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
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
                        <Image
                          src={imagePath ? tmdbImage(imagePath, "w154") : (s.type === 'person' ? '/placeholder-person.svg' : '/placeholder-poster.svg')}
                          alt={displayTitle}
                          fill
            sizes="48px"
                          className="object-cover"
                        />
                        {imagePath && (
                          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
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
                          onClick={() => handleSearch(t.title, searchMode)}
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

          {!loadingSuggestions && suggestions.length === 0 && value.trim().length > 1 && <p className="px-4 py-3 text-sm text-[var(--ink-muted)]">No quick matches. Try searching all results.</p>}
          {value.trim() && <button type="button" className={styles.allResults} onClick={() => handleSearch(value, searchMode)}>Search all results for “{value.trim()}”<IconArrowRight size={16} aria-hidden="true" /></button>}
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
            ref={triggerRef}
            type="button"
            aria-label={open && !resolvedIsMobile ? "Close search" : "Open search"}
            aria-expanded={open || mobileOpen}
            onClick={() => {
              if (resolvedIsMobile) {
                setMobileOpen(true);
              } else {
                setOpen(!open);
              }
            }}
            className="ml-2 min-h-11 min-w-11 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--brand-coral-strong)] transition-colors z-10"
          >
            {open && !resolvedIsMobile ? <IconX size={20} /> : <IconSearch size={20} />}
          </button>

          <motion.div
            initial={false}
            aria-hidden={!open || resolvedIsMobile}
            animate={{ width: open && !resolvedIsMobile ? targetWidth : 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
            className="overflow-hidden"
          >
            <form ref={fieldRef} role="search" aria-label="Search Moodies" className={styles.form} onSubmit={(event) => { event.preventDefault(); handleSearch(value, searchMode); }}>
            <div className={styles.inputWrap}>
            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open && suggestions.length > 0}
              aria-controls={suggestions.length > 0 ? `${searchId}-suggestions` : undefined}
              aria-activedescendant={highlightedIndex !== null ? `${searchId}-suggestion-${highlightedIndex}` : undefined}
              aria-label={searchMode === 'person' ? 'Search people' : 'Search movies and series'}
              tabIndex={open && !resolvedIsMobile ? 0 : -1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onInputKeyDown}
              onFocus={() => setOpen(true)}
              placeholder={searchMode === 'person' ? 'Search for actors, directors...' : placeholder}
              className={styles.input}
            />
            {value && <button type="button" aria-label="Clear search" tabIndex={open && !resolvedIsMobile ? 0 : -1} className={styles.clear} onClick={() => { setValue(''); inputRef.current?.focus(); }}><IconX size={16} /></button>}
            </div>
            <button type="submit" aria-label="Search" title="Search" className={styles.submit} disabled={!value.trim()} tabIndex={open && !resolvedIsMobile ? 0 : -1}><IconSearch size={18} aria-hidden="true" /></button>
            </form>
          </motion.div>
        </div>

        {portalRender}
      </div>
      {typeof document !== "undefined" && createPortal(
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
                ref={mobileDialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${searchId}-title`}
                onClick={(e) => e.stopPropagation()}
                initial={prefersReduced ? {} : { y: -12, opacity: 0 }}
                animate={prefersReduced ? {} : { y: 0, opacity: 1 }}
                exit={prefersReduced ? {} : { y: -12, opacity: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 28 }}
                className={`${styles.mobilePanel} w-full max-w-lg px-4`}
              >
                <div className={styles.mobileHeader}><h2 id={`${searchId}-title`}>Search Moodies</h2><button type="button" aria-label="Close search" className={styles.close} onClick={() => setMobileOpen(false)}><IconX size={20} /></button></div>
                {/* Mode Tabs */}
                <div className="mb-3 flex gap-2 bg-white/10 backdrop-blur-md rounded-full p-1">
                  <button
                    type="button"
                    aria-pressed={mobileMode === 'content'}
                    onClick={() => { setMobileMode('content'); setSearchMode('content'); }}
                    className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${mobileMode === 'content' ? 'bg-[#e94f37] text-white' : 'text-gray-300 hover:text-white'
                      }`}
                  >
                    Movies & TV
                  </button>
                  <button
                    type="button"
                    aria-pressed={mobileMode === 'person'}
                    onClick={() => { setMobileMode('person'); setSearchMode('person'); }}
                    className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${mobileMode === 'person' ? 'bg-[#e94f37] text-white' : 'text-gray-300 hover:text-white'
                      }`}
                  >
                    People
                  </button>
                </div>

                {/* Input */}
                <form role="search" aria-label="Search Moodies" className={`${styles.form} mb-4`} onSubmit={(event) => { event.preventDefault(); handleSearch(mobileValue, mobileMode); }}>
                  <div className={styles.inputWrap}>
                  <input
                    ref={mobileInputRef}
                    type="search"
                    aria-label={mobileMode === 'person' ? 'Search people' : 'Search movies and series'}
                    value={mobileValue}
                    onChange={(e) => setMobileValue(e.target.value)}
                    placeholder={mobileMode === 'person' ? 'Search for actors, directors...' : placeholder}
                    className={styles.input}
                    autoFocus
                  />
                  {mobileValue && <button type="button" aria-label="Clear search" className={styles.clear} onClick={() => { setMobileValue(''); mobileInputRef.current?.focus(); }}><IconX size={16} /></button>}
                  </div>
                  <button type="submit" aria-label="Search" title="Search" className={styles.submit} disabled={!mobileValue.trim()}><IconSearch size={18} aria-hidden="true" /></button>
                </form>

                {/* Results / Trending */}
                <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 max-h-96 overflow-y-auto">
                  {loadingSuggestions && (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    </div>
                  )}

                  {!loadingSuggestions && suggestions.length > 0 && (
                    suggestions.map((suggestion, index) => (
                      <button type="button"
                        key={`${suggestion.id}-${index}`}
                        onClick={() => { handleSuggestionClick(suggestion); setMobileOpen(false); }}
                        className="flex w-full items-center gap-3 p-2 text-left hover:bg-white/10 rounded cursor-pointer text-white"
                      >
                        <Image
                          src={(suggestion.type === 'person' ? suggestion.profile_path : suggestion.poster_path) ? tmdbImage((suggestion.type === 'person' ? suggestion.profile_path : suggestion.poster_path)!, "w92") : suggestion.type === 'person' ? '/placeholder-person.svg' : '/placeholder-poster.svg'}
                          alt=""
                          width={32}
                          height={40}
                          className="w-8 h-10 rounded object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">
                            {highlightMatch(suggestion.title || suggestion.name || 'Unknown', mobileValue)}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{getTypeLabel(suggestion.type)}</p>
                        </div>
                      </button>
                    ))
                  )}

                  {!loadingSuggestions && suggestions.length === 0 && debouncedMobileValue.trim().length > 1 && (
                    <p className="text-sm text-gray-400 text-center py-3">No results found</p>
                  )}

                  {!loadingSuggestions && suggestions.length === 0 && debouncedMobileValue.trim().length <= 1 && (
                    <>
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-2 px-2">Trending</p>
                      {trendingTerms.slice(0, 6).map((term, index) => (
                        <button type="button"
                          key={index}
                          onClick={() => { setMobileValue(term.title); handleSearch(term.title, mobileMode); }}
                          className="flex w-full items-center gap-3 p-2 text-left hover:bg-white/10 rounded cursor-pointer text-white"
                        >
                          <IconTrendingUp size={16} className="text-gray-400" />
                          <span className="text-sm">{term.title}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

    </>

  );
}
