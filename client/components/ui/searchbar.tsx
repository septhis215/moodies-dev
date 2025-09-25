// components/ui/SearchBarWithSuggestions.tsx
"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { IconSearch, IconX, IconClock, IconTrendingUp } from "@tabler/icons-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Film, Tv, Star } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchSuggestion {
  id: number;
  title: string;
  type: 'movie' | 'tv';
  year: number | null;
  poster_path: string | null;
}

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (q: string) => void;
}

export default function SearchBarWithSuggestions({
  placeholder = "Search movies, series...",
  onSearch,
}: SearchBarProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [trendingSearches] = useState(['Avengers', 'Stranger Things', 'Batman', 'Marvel', 'Game of Thrones']);
  
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suggestionsRef = useRef<HTMLDivElement | null>(null);
  
  const router = useRouter();

  // Mobile modal state
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [targetWidth, setTargetWidth] = useState<number>(400);
  const [mobileValue, setMobileValue] = useState<string>(value);

  const prefersReduced = useReducedMotion();
  const debouncedValue = useDebounce(value, 300);

  // Load search history
  useEffect(() => {
    const history = localStorage.getItem('searchHistory');
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  }, []);

  // Fetch suggestions when debounced value changes
  useEffect(() => {
    if (debouncedValue.trim().length > 2 && open) {
      fetchSuggestions(debouncedValue);
    } else {
      setSuggestions([]);
    }
  }, [debouncedValue, open]);

  const fetchSuggestions = async (query: string) => {
    setLoadingSuggestions(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/search/suggestions?q=${encodeURIComponent(query)}&limit=6`
      );
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Compute mobile breakpoint & target width safely (client-only)
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

  // Focus the inline input when opened (desktop)
  useEffect(() => {
    if (open && !isMobile) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, isMobile]);

  // Click outside & escape to close
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

  const handleSearch = (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    // Add to search history
    const updatedHistory = [trimmedQuery, ...searchHistory.filter(h => h !== trimmedQuery)].slice(0, 10);
    setSearchHistory(updatedHistory);
    localStorage.setItem('searchHistory', JSON.stringify(updatedHistory));

    // Navigate to search results
    router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    
    // Close search
    setOpen(false);
    setMobileOpen(false);
    setSuggestions([]);
    
    onSearch?.(trimmedQuery);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    const path = suggestion.type === 'tv' ? '/tv' : '/movies';
    router.push(`${path}/${suggestion.id}`);
    setOpen(false);
    setSuggestions([]);
  };

  // Show suggestions dropdown
  const showSuggestions = open && !isMobile && (
    suggestions.length > 0 || 
    loadingSuggestions || 
    searchHistory.length > 0 || 
    (value.trim().length === 0)
  );

  // Mobile modal component
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
              <div className="relative mb-4">
                <input
                  value={mobileValue}
                  onChange={(e) => setMobileValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch(mobileValue);
                    }
                  }}
                  placeholder={placeholder}
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

              {/* Mobile suggestions */}
              <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 max-h-96 overflow-y-auto">
                {trendingSearches.map((term, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setMobileValue(term);
                      handleSearch(term);
                    }}
                    className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer text-white"
                  >
                    <IconTrendingUp size={16} className="text-gray-400" />
                    <span>{term}</span>
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

  return (
    <>
      <div ref={wrapperRef} className="relative flex items-center gap-2">
        <div className="flex items-center flex-row-reverse relative">
          {/* Search icon */}
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
            <IconSearch />
          </button>

          {/* Animated search input (desktop only) */}
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
                  handleSearch(value);
                }
              }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              className="w-full bg-white/10 backdrop-blur-md placeholder:text-gray-300 text-white rounded-full px-4 py-2 text-sm outline-none transition-all"
              style={{ height: 36 }}
            />
          </motion.div>
        </div>

        {/* Desktop suggestions dropdown */}
        <AnimatePresence>
          {showSuggestions && (
            <motion.div
              ref={suggestionsRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-lg shadow-xl z-999 max-h-96 overflow-y-auto"
              style={{ width: targetWidth }}
            >
              {/* Loading state */}
              {loadingSuggestions && (
                <div className="p-4 text-center text-gray-400">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#e94f37] mx-auto"></div>
                </div>
              )}

              {/* Search suggestions */}
              {suggestions.length > 0 && (
                <div className="p-2">
                  <div className="text-xs text-gray-400 px-3 py-2 border-b border-gray-700 mb-2">
                    Suggestions
                  </div>
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded cursor-pointer group"
                    >
                      <div className="relative w-8 h-12 rounded overflow-hidden bg-gray-700 flex-shrink-0">
                        {suggestion.poster_path && (
                          <Image
                            src={`https://image.tmdb.org/t/p/w92${suggestion.poster_path}`}
                            alt={suggestion.title}
                            fill
                            className="object-cover"
                          />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm truncate group-hover:text-[#e94f37] transition-colors">
                            {suggestion.title}
                          </span>
                          {suggestion.type === 'tv' ? (
                            <Tv size={12} className="text-blue-400 flex-shrink-0" />
                          ) : (
                            <Film size={12} className="text-purple-400 flex-shrink-0" />
                          )}
                        </div>
                        {suggestion.year && (
                          <div className="text-xs text-gray-400">{suggestion.year}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Search history */}
              {!loadingSuggestions && suggestions.length === 0 && value.trim().length === 0 && searchHistory.length > 0 && (
                <div className="p-2">
                  <div className="text-xs text-gray-400 px-3 py-2 border-b border-gray-700 mb-2">
                    Recent Searches
                  </div>
                  {searchHistory.slice(0, 5).map((term, index) => (
                    <div
                      key={index}
                      onClick={() => handleSearch(term)}
                      className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded cursor-pointer text-white hover:text-[#e94f37] transition-colors"
                    >
                      <IconClock size={16} className="text-gray-400" />
                      <span className="text-sm">{term}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Trending searches */}
              {!loadingSuggestions && suggestions.length === 0 && value.trim().length === 0 && (
                <div className="p-2">
                  <div className="text-xs text-gray-400 px-3 py-2 border-b border-gray-700 mb-2">
                    Trending
                  </div>
                  {trendingSearches.map((term, index) => (
                    <div
                      key={index}
                      onClick={() => handleSearch(term)}
                      className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded cursor-pointer text-white hover:text-[#e94f37] transition-colors"
                    >
                      <IconTrendingUp size={16} className="text-gray-400" />
                      <span className="text-sm">{term}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <MobileModal />
    </>
  );
}