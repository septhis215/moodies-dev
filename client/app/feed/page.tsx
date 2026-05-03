'use client';
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2, VolumeX, Heart, Bookmark, Star, ExternalLink,
  Sparkles, Search, X, Pause, Play, User
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ActionButtons from '@/components/ui/actionButtons';
import Image from "next/image";
import { useWatchlist } from '@/hooks/useWatchlist';
import { useLiked } from '@/hooks/useLiked';

interface VideoItem {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  genres?: string[];
  vote_average: number;
  media_type: 'movie' | 'tv';
  primary_video: {
    key: string;
    name: string;
    type: string;
    site: string;
  };
  videos: any[];
}

type Category = 'all' | 'upcoming';

export default function VideoFeedPage() {
  const router = useRouter();

  // Configuration constants
  const PREFETCH_THRESHOLD = 5;
  const WINDOW_SIZE = 20;
  const CLEANUP_THRESHOLD = 10;
  const INITIAL_FETCH_SIZE = 15;
  const PREFETCH_SIZE = 10;

  const [expanded, setExpanded] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchedPages, setFetchedPages] = useState<Set<number>>(new Set());
  const fetchedPagesRef = useRef<Set<number>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const isFetchingRef = useRef(false);
  const nextPageRef = useRef(1);
  const sessionSaltRef = useRef(Math.floor(Math.random() * 500)); // random 0-499 per tab session
  const seenVideoIdsRef = useRef<Set<number>>(new Set());
  const indexOffsetRef = useRef(0);
  const retryCountRef = useRef(0);

  const [muted, setMuted] = useState<boolean>(() => {
    try {
      const s = typeof window !== 'undefined' ? localStorage.getItem('videoMuted') : null;
      return s === null ? true : s === 'true';
    } catch {
      return true;
    }
  });

  const [panelOpen, setPanelOpen] = useState(false);
  const { isLiked, like: addToLiked, unlike: removeFromLiked, ready: likedReady } = useLiked();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isTogglingWatchlist, setIsTogglingWatchlist] = useState(false);
  const { isInWatchlist, add: addToWatchlist, remove: removeFromWatchlist } = useWatchlist();

  const panelRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<number, HTMLIFrameElement>>(new Map());
  const firstUserGestureRef = useRef(false);

  const currentVideo = videos[currentIndex];
  const [showScrollHint, setShowScrollHint] = useState(true);

  const watchType = currentVideo?.media_type === 'tv' ? 'series' : 'movie';
  const inWatchlist = currentVideo ? isInWatchlist(String(currentVideo.id), watchType) : false;
  const likeType = currentVideo?.media_type === 'tv' ? 'series' : 'movie';
  const liked = currentVideo ? isLiked(String(currentVideo.id), likeType) : false;

  const handleLikeToggle = useCallback(async () => {
    if (!currentVideo || !likedReady) return;
    const meta = {
      title: currentVideo.title || currentVideo.name,
      posterUrl: currentVideo.poster_path ? `https://image.tmdb.org/t/p/w200${currentVideo.poster_path}` : null,
      duration: 3000,
    };
    if (liked) await removeFromLiked(String(currentVideo.id), likeType, meta);
    else await addToLiked(String(currentVideo.id), likeType, meta);
  }, [currentVideo, liked, likeType, likedReady, addToLiked, removeFromLiked]);

  const handleWatchlistToggle = useCallback(async () => {
    if (!currentVideo || isTogglingWatchlist) return;
    setIsTogglingWatchlist(true);
    try {
      if (inWatchlist) {
        await removeFromWatchlist(String(currentVideo.id), watchType, {
          title: currentVideo.title || currentVideo.name,
          posterUrl: currentVideo.poster_path ? `https://image.tmdb.org/t/p/w200${currentVideo.poster_path}` : null,
          variant: 'info',
          duration: 3500,
        });
      } else {
        await addToWatchlist(String(currentVideo.id), watchType, {
          title: currentVideo.title || currentVideo.name,
          posterUrl: currentVideo.poster_path ? `https://image.tmdb.org/t/p/w200${currentVideo.poster_path}` : null,
          variant: 'success',
          duration: 3500,
        });
      }
    } catch (error) {
      console.error('Failed to toggle watchlist:', error);
    } finally {
      setIsTogglingWatchlist(false);
    }
  }, [currentVideo, inWatchlist, watchType, isTogglingWatchlist, addToWatchlist, removeFromWatchlist]);

  const getContentType = (item: any): "movie" | "tv" => {
    if (item.media_type) return item.media_type;
    if (item.type === "movies" || item.type === "movie") return "movie";
    if (item.type === "tv") return "tv";
    if (item.number_of_seasons || item.first_air_date || item.name) return "tv";
    return "movie";
  };

  const href = currentVideo
    ? `/${getContentType(currentVideo) === 'tv' ? 'tv' : 'movies'}/${currentVideo.id}`
    : undefined;

  const fetchMoreVideos = useCallback(async (isInitial = false) => {
    if (isFetchingRef.current) return;
    if (!isInitial && !hasMore) return;
    isFetchingRef.current = true;
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const limit = isInitial ? INITIAL_FETCH_SIZE : PREFETCH_SIZE;
      let endpoint: string;
      let currentPage = 1;

      if (activeCategory === 'upcoming') {
        currentPage = nextPageRef.current;
        endpoint = `${base}/all/upcoming-trailers-feed?page=${currentPage}&limit=${limit}&salt=${sessionSaltRef.current}`;
        // The salt is random per browser session (tab open). Backend uses it to
        // vary the shuffle seed, so the same page number produces different ordering
        // for different users/sessions. No backend schema changes needed — it's
        // just a seed input.
      } else {
        let randomPage: number;
        let attempts = 0;
        do {
          randomPage = Math.floor(Math.random() * 20) + 1;
          attempts++;
        } while (fetchedPagesRef.current.has(randomPage) && attempts < 50);
        if (attempts >= 50) { setHasMore(false); isFetchingRef.current = false; setLoading(false); return; }
        currentPage = randomPage;
        endpoint = `${base}/all/video-feed?page=${randomPage}`;
        setFetchedPages(prev => {
          const next = new Set(prev);
          next.add(randomPage);
          fetchedPagesRef.current = new Set(next);
          return next;
        });
      }

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = await res.json();
      const results = Array.isArray(data) ? data : (data.results || []);

      if (results.length > 0) {
        const uniqueVideos = results.filter((video: VideoItem) => {
          if (!video.primary_video?.key) return false;
          if (seenVideoIdsRef.current.has(video.id)) return false;
          seenVideoIdsRef.current.add(video.id);
          return true;
        });
        if (uniqueVideos.length > 0) {
          retryCountRef.current = 0;
          const videosToAdd = activeCategory === 'upcoming'
            ? uniqueVideos
            : [...uniqueVideos].sort(() => Math.random() - 0.5);
          setVideos(prev => [...prev, ...videosToAdd]);
          if (activeCategory === 'upcoming') nextPageRef.current += 1;
          if (activeCategory === 'all') { setHasMore(fetchedPagesRef.current.size < 100); }
          else {
            const backendHasMore = data.hasMore !== undefined ? data.hasMore : uniqueVideos.length >= Math.floor(limit * 0.7);
            setHasMore(backendHasMore);
          }
        } else {
          if (retryCountRef.current < 3) {
            retryCountRef.current += 1;
            if (activeCategory === 'upcoming') nextPageRef.current += 1;
            isFetchingRef.current = false;
            setLoading(false);
            setTimeout(() => fetchMoreVideos(false), 200);
            return;
          } else { setHasMore(false); }
        }
      } else { setHasMore(false); }
    } catch (error) {
      console.error('Error fetching videos:', error);
      setHasMore(false);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [activeCategory, hasMore, INITIAL_FETCH_SIZE, PREFETCH_SIZE]);

  const cleanupOldVideos = useCallback(() => {
    const videosAhead = videos.length - currentIndex;
    if (currentIndex > CLEANUP_THRESHOLD && videosAhead > WINDOW_SIZE / 2) {
      const keepFrom = Math.max(0, currentIndex - 2);
      if (keepFrom > 0) {
        setVideos(prev => {
          const newVideos = prev.slice(keepFrom);
          prev.slice(0, keepFrom).forEach(video => videoRefs.current.delete(video.id));
          return newVideos;
        });
        indexOffsetRef.current += keepFrom;
        setCurrentIndex(prev => prev - keepFrom);
      }
    }
  }, [currentIndex, videos.length, CLEANUP_THRESHOLD, WINDOW_SIZE]);

  useEffect(() => {
    const distanceFromEnd = videos.length - currentIndex - 1;
    if (distanceFromEnd <= PREFETCH_THRESHOLD && hasMore && !isFetchingRef.current) fetchMoreVideos(false);
  }, [currentIndex, videos.length, hasMore, PREFETCH_THRESHOLD, fetchMoreVideos]);

  useEffect(() => {
    const timer = setTimeout(() => cleanupOldVideos(), 500);
    return () => clearTimeout(timer);
  }, [currentIndex, cleanupOldVideos]);

  useEffect(() => {
    setVideos([]);
    setCurrentIndex(0);
    indexOffsetRef.current = 0;
    seenVideoIdsRef.current = new Set();
    setFetchedPages(new Set());
    fetchedPagesRef.current = new Set();
    nextPageRef.current = 1;
    sessionSaltRef.current = Math.floor(Math.random() * 500); // re-randomise on category switch too
    retryCountRef.current = 0;
    setHasMore(true);
    setPanelOpen(false);
    isFetchingRef.current = false;
    setTimeout(() => fetchMoreVideos(true), 100);
  }, [activeCategory]);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) setShowScrollHint(containerRef.current.scrollTop <= 50);
    };
    const container = containerRef.current;
    if (container) container.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, []);

  // Close panel when video changes
  useEffect(() => {
    setPanelOpen(false);
    setExpanded(false);
  }, [currentIndex]);

  useEffect(() => {
    try { localStorage.setItem('videoMuted', String(muted)); } catch { }
  }, [muted]);

  const sendYouTubeCommand = (iframe: HTMLIFrameElement | undefined | null, func: string, args: any[] = []) => {
    if (!iframe) return;
    try { iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*'); } catch { }
  };

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      const iframe = currentVideo ? videoRefs.current.get(currentVideo.id) : undefined;
      if (iframe) sendYouTubeCommand(iframe, next ? 'mute' : 'unMute');
      return next;
    });
  }, [currentVideo]);

  useEffect(() => {
    if (!currentVideo) return;
    const iframe = videoRefs.current.get(currentVideo.id);
    if (iframe) {
      const t = window.setTimeout(() => sendYouTubeCommand(iframe, muted ? 'mute' : 'unMute'), 250);
      return () => clearTimeout(t);
    }
  }, [currentVideo?.id, muted]);

  const handleScroll = useCallback((e: WheelEvent) => {
    if (panelRef.current?.contains(e.target as Node)) return;
    e.preventDefault();
    if (Math.abs(e.deltaY) < 50) return;
    if (e.deltaY > 0 && currentIndex < videos.length - 1) { setCurrentIndex(i => i + 1); setPanelOpen(false); }
    else if (e.deltaY < 0 && currentIndex > 0) { setCurrentIndex(i => i - 1); setPanelOpen(false); }
  }, [currentIndex, videos.length]);

  const touchStartY = useRef(0);
  const handleTouchStart = (e: TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchEnd = (e: TouchEvent) => {
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(diff) < 50) return;
    if (diff > 0 && currentIndex < videos.length - 1) { setCurrentIndex(prev => prev + 1); setPanelOpen(false); }
    else if (diff < 0 && currentIndex > 0) { setCurrentIndex(prev => prev - 1); setPanelOpen(false); }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleScroll, { passive: false });
    container.addEventListener('touchstart', handleTouchStart as any);
    container.addEventListener('touchend', handleTouchEnd as any);
    return () => {
      container.removeEventListener('wheel', handleScroll);
      container.removeEventListener('touchstart', handleTouchStart as any);
      container.removeEventListener('touchend', handleTouchEnd as any);
    };
  }, [handleScroll]);

  useEffect(() => {
    if (!currentVideo) return;
    setIsPlaying(true);
    const t = window.setTimeout(() => {
      const iframe = videoRefs.current.get(currentVideo.id);
      if (iframe) { sendYouTubeCommand(iframe, 'playVideo', []); if (!muted) sendYouTubeCommand(iframe, 'unMute', []); }
    }, 350);
    return () => clearTimeout(t);
  }, [currentVideo?.id, muted]);

  useEffect(() => {
    if (!currentVideo) return;
    const onFirstGesture = () => {
      if (firstUserGestureRef.current) return;
      firstUserGestureRef.current = true;
      const iframe = videoRefs.current.get(currentVideo.id);
      if (iframe) { sendYouTubeCommand(iframe, 'unMute', []); sendYouTubeCommand(iframe, 'playVideo', []); }
    };
    window.addEventListener('click', onFirstGesture, { once: true, passive: true });
    return () => { try { window.removeEventListener('click', onFirstGesture as any); } catch { } };
  }, [currentVideo?.id]);

  const iframeSrc = useMemo(() => {
    if (!currentVideo?.primary_video?.key) return '';
    const key = currentVideo.primary_video.key;
    const origin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
    return `https://www.youtube.com/embed/${key}?autoplay=1&controls=0&modestbranding=1&rel=0&loop=1&playlist=${key}&enablejsapi=1&playsinline=1&mute=1&origin=${origin}`;
  }, [currentVideo?.id, currentVideo?.primary_video?.key]);

  const togglePlayPause = () => {
    if (!currentVideo) return;
    const iframe = videoRefs.current.get(currentVideo.id);
    if (!iframe) return;
    if (isPlaying) { sendYouTubeCommand(iframe, 'pauseVideo', []); setIsPlaying(false); }
    else { sendYouTubeCommand(iframe, 'playVideo', []); if (!muted) sendYouTubeCommand(iframe, 'unMute', []); setIsPlaying(true); }
  };

  const videoTitle = currentVideo?.title || currentVideo?.name || '';

  return (
    <div ref={containerRef} className="fixed inset-0 w-full bg-black overflow-hidden">

      {/* ── TOP NAVBAR ──────────────────────────────────────────── */}
      <motion.nav
        initial={{ y: -56, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 md:px-6
                   bg-gradient-to-b from-black/80 via-black/40 to-transparent"
      >
        <Link href="/" className="flex items-center gap-2 mr-4 shrink-0 select-none">
          <Image src="/images/moodies.png" alt="logo" width={28} height={28} className="rounded-md" />
          <span className="text-white font-semibold text-sm tracking-wide">Moodies</span>
        </Link>

        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/8 backdrop-blur-md border border-white/10">
            {(['all', 'upcoming'] as Category[]).map(cat => (
              <motion.button
                key={cat}
                whileTap={{ scale: 0.96 }}
                onClick={() => setActiveCategory(cat)}
                className={`relative px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors duration-200
                  ${activeCategory === cat ? 'text-white' : 'text-white/50 hover:text-white/80'}`}
              >
                {activeCategory === cat && (
                  <motion.span
                    layoutId="pill"
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 shadow-md shadow-red-600/40"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative z-10 capitalize">
                  {cat === 'all' ? 'All Videos' : 'Upcoming'}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 ml-4 shrink-0">
          <Link href="/search" prefetch>
            <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
              className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all">
              <Search className="w-5 h-5" />
            </motion.button>
          </Link>
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
            onClick={() => router.push('/profile')}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all">
            <User className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.nav>

      {/* ── MAIN VIDEO AREA ─────────────────────────────────────── */}
      <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          {currentVideo && (
            <motion.div
              key={currentVideo.id}
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="absolute inset-0 flex"
            >
              {/* Video iframe */}
              <div className="relative w-full h-full flex items-center justify-center">
                <iframe
                  ref={el => { if (el && currentVideo) videoRefs.current.set(currentVideo.id, el); }}
                  title={videoTitle || `video-${currentVideo.id}`}
                  src={iframeSrc}
                  className="absolute top-1/2 left-1/2 min-w-full min-h-full -translate-x-1/2 -translate-y-1/2 bg-black"
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                  style={{ border: 'none', pointerEvents: 'none' }}
                  onLoad={e => {
                    const iframe = e.currentTarget as HTMLIFrameElement;
                    if (currentVideo) videoRefs.current.set(currentVideo.id, iframe);
                    setTimeout(() => {
                      sendYouTubeCommand(iframe, 'playVideo', []);
                      sendYouTubeCommand(iframe, muted ? 'mute' : 'unMute', []);
                    }, 300);
                  }}
                />
              </div>

              {/*
               * ── PERMANENT BOTTOM TITLE BAR ──────────────────────
               * Always rendered. Uses a tall gradient scrim so it
               * feels embedded in the video, not overlaid on top.
               * Right side is padded to avoid the action buttons column.
               */}
              <motion.div
                key={`titlebar-${currentVideo.id}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none"
              >
                {/* Layer 1 — tall ambient scrim: fades video into dark over a large area */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

                {/* Layer 2 — tight bottom vignette: ensures the very bottom edge is fully dark */}
                <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/60 to-transparent" />

                {/* Content */}
                <div className="relative px-4 md:px-7 pt-32 pb-5 pr-20 sm:pr-24 md:pr-28">
                  <h2
                    className="text-white font-bold text-xl md:text-2xl leading-tight line-clamp-2 mb-2"
                    style={{ textShadow: '0 1px 12px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.8)' }}
                  >
                    {videoTitle}
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Rating / Upcoming badge */}
                    {Number.isFinite(Number(currentVideo.vote_average)) && (() => {
                      const va = Number(currentVideo.vote_average);
                      const isUpcomingItem = va === 0;
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border
                          ${isUpcomingItem
                            ? 'bg-indigo-500/30 text-indigo-200 border-indigo-400/40'
                            : 'bg-amber-500/30 text-amber-200 border-amber-400/40'}`}>
                          {!isUpcomingItem && <Star className="w-3 h-3 text-amber-300" fill="currentColor" />}
                          {isUpcomingItem ? 'Upcoming' : va.toFixed(1)}
                        </span>
                      );
                    })()}

                    <span className="px-2 py-0.5 rounded-md text-xs font-bold uppercase border bg-white/10 text-white/80 border-white/20">
                      {currentVideo.media_type}
                    </span>

                    <span className="px-2 py-0.5 rounded-md text-xs font-bold uppercase border bg-red-500/20 text-red-300 border-red-400/30">
                      {currentVideo.primary_video.type}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Action Buttons — always visible, Info included */}
              <ActionButtons
                isPlaying={isPlaying}
                liked={liked}
                saved={inWatchlist}
                muted={muted}
                panelOpen={panelOpen}
                togglePlayPause={togglePlayPause}
                onLike={handleLikeToggle}
                setSaved={handleWatchlistToggle}
                toggleMute={toggleMute}
                onInfo={() => setPanelOpen(p => !p)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── LOADING INDICATOR ───────────────────────────────────── */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
            >
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-black/60 backdrop-blur-xl rounded-full border border-white/15 shadow-xl">
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-white/80 text-xs font-semibold tracking-wide">Loading more</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── EMPTY STATE ─────────────────────────────────────────── */}
        {!loading && videos.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-red-600/40">
                <Sparkles className="w-9 h-9 text-white" />
              </motion.div>
              <p className="text-white text-xl font-bold mb-2">Nothing here yet</p>
              <p className="text-white/50 text-sm">Check back soon for new content.</p>
            </div>
          </motion.div>
        )}

        {/* ── SCROLL HINT ─────────────────────────────────────────── */}
        <AnimatePresence>
          {showScrollHint && videos.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none z-40"
            >
              <motion.div animate={{ y: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}>
                <svg className="w-5 h-7 text-white/50" viewBox="0 0 24 40" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="36" rx="10" />
                  <circle cx="12" cy="10" r="2.5" fill="currentColor" />
                </svg>
              </motion.div>
              <span className="text-[10px] text-white/40 tracking-widest uppercase">Scroll</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── DETAIL PANEL ────────────────────────────────────────── */}
      <AnimatePresence>
        {panelOpen && currentVideo && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed inset-y-0 right-0 w-full md:w-96 z-[100]
                       bg-gradient-to-b from-black/95 via-neutral-950/95 to-black/95
                       backdrop-blur-2xl border-l border-white/8
                       flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 py-4 pt-16 border-b border-white/8">
              <h3 className="text-white font-bold text-sm tracking-wide uppercase">Details</h3>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.93 }}
                onClick={() => setPanelOpen(false)}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all">
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            <div ref={panelRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div>
                <h2 className="text-white font-bold text-xl leading-snug mb-3">
                  {currentVideo.title || currentVideo.name}
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  {Number.isFinite(Number(currentVideo.vote_average)) && (() => {
                    const va = Number(currentVideo.vote_average);
                    const isUpcomingItem = va === 0;
                    return (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold
                        ${isUpcomingItem
                          ? 'bg-indigo-500/25 text-indigo-200 border-indigo-400/35'
                          : 'bg-amber-500/25 text-amber-200 border-amber-400/35'}`}>
                        {!isUpcomingItem && <Star className="w-3 h-3 text-amber-300" fill="currentColor" />}
                        {isUpcomingItem ? 'Upcoming' : va.toFixed(1)}
                      </span>
                    );
                  })()}
                  <span className="px-2.5 py-1 rounded-lg border text-xs font-bold uppercase bg-white/8 text-white/70 border-white/15">
                    {currentVideo.media_type}
                  </span>
                  {currentVideo.primary_video?.type && (
                    <span className="px-2.5 py-1 rounded-lg border text-xs font-bold uppercase bg-red-500/15 text-red-300 border-red-400/25">
                      {currentVideo.primary_video.type}
                    </span>
                  )}
                </div>
              </div>

              <div className="h-px bg-white/8" />

              <div>
                <h4 className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-0.5 h-3.5 rounded-full bg-gradient-to-b from-red-500 to-orange-500 inline-block" />
                  Overview
                </h4>
                <p className={`text-white/70 text-sm leading-relaxed transition-all duration-300 ${expanded ? '' : 'line-clamp-4'}`}>
                  {currentVideo.overview}
                </p>
                {currentVideo.overview?.length > 150 && (
                  <button onClick={() => setExpanded(!expanded)}
                    className="mt-2 text-red-400 text-xs font-semibold hover:text-red-300 transition-colors">
                    {expanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>

              <div className="h-px bg-white/8" />

              <div>
                <h4 className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-0.5 h-3.5 rounded-full bg-gradient-to-b from-red-500 to-orange-500 inline-block" />
                  Info
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2 p-3.5 rounded-xl bg-white/5 border border-white/8">
                    <div className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mb-1">Type</div>
                    <div className="text-white font-bold text-sm uppercase">{currentVideo.media_type}</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/8">
                    <div className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mb-1">Video</div>
                    <div className="text-white font-bold text-sm uppercase">{currentVideo.primary_video?.type || '—'}</div>
                  </div>
                  {(currentVideo.release_date || currentVideo.first_air_date) && (
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/8">
                      <div className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mb-1">Released</div>
                      <div className="text-white font-bold text-sm">
                        {new Date(currentVideo.release_date ?? currentVideo.first_air_date!).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                  {currentVideo.original_language && (
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/8">
                      <div className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mb-1">Language</div>
                      <div className="text-white font-bold text-sm uppercase">{currentVideo.original_language}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-white/8">
              {href ? (
                <Link href={href} prefetch shallow={false}>
                  <motion.span whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3
                               bg-gradient-to-r from-red-500 to-orange-500
                               rounded-xl text-white font-bold text-sm
                               shadow-md shadow-red-600/30 hover:shadow-red-600/50 transition-shadow">
                    <ExternalLink className="w-4 h-4" />
                    View Full Details
                  </motion.span>
                </Link>
              ) : (
                <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 text-white/30 text-sm font-semibold">
                  <ExternalLink className="w-4 h-4" />
                  View Full Details
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}