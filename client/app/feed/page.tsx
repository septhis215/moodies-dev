'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2, VolumeX, Heart, Share2, Bookmark,
  MessageCircle, Star, ExternalLink, Sparkles, Home, Compass, Search, Plus, Info, X,
  Pause,
  Play
} from 'lucide-react';
import { All } from '@/types/all';
import { useRouter } from "next/navigation";
import Link from 'next/link';

interface VideoItem {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  release_date?: string;
  first_air_date?: string;
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

export default function VideoFeedPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchedPages, setFetchedPages] = useState<Set<number>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  // Persisted mute state
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      const s = typeof window !== 'undefined' ? localStorage.getItem('videoMuted') : null;
      return s === null ? true : s === 'true';
    } catch {
      return true;
    }
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const [titleBarVisible, setTitleBarVisible] = useState(true);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<number, HTMLIFrameElement>>(new Map());
  const titleBarTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentVideo = videos[currentIndex];
  const initialMutedRef = useRef<boolean>(muted);


  const getContentType = (item: Partial<All>): "movie" | "tv" => {
    if ((item as any).media_type) return (item as any).media_type;
    if ((item as any).type === "movies" || (item as any).type === "movie")
      return "movie";
    if ((item as any).type === "tv") return "tv";
    if (
      (item as any).number_of_seasons ||
      (item as any).first_air_date ||
      (item as any).name
    )
      return "tv";
    return "movie";
  };
  const href = currentVideo
    ? `/${getContentType(currentVideo) === 'tv' ? 'tv' : 'movies'}/${currentVideo.id}`
    : undefined;

  // Auto-hide title bar after 3 seconds
  useEffect(() => {
    setTitleBarVisible(true);

    if (titleBarTimeoutRef.current) {
      clearTimeout(titleBarTimeoutRef.current);
    }

    titleBarTimeoutRef.current = setTimeout(() => {
      setTitleBarVisible(false);
    }, 3000);

    return () => {
      if (titleBarTimeoutRef.current) {
        clearTimeout(titleBarTimeoutRef.current);
      }
    };
  }, [currentIndex]);
  // persist muted preference
  useEffect(() => {
    try {
      localStorage.setItem('videoMuted', String(muted));
    } catch { /* ignore */ }
  }, [muted]);

  // helper: send postMessage command to YouTube iframe (enablejsapi=1 required)
  const sendYouTubeCommand = (iframe: HTMLIFrameElement | undefined | null, func: string, args: any[] = []) => {
    if (!iframe) return;
    try {
      iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
    } catch {
      // ignore
    }
  };

  // toggle mute (only via postMessage; iframe src does NOT include mute param)
  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      const iframe = currentVideo ? videoRefs.current.get(currentVideo.id) : undefined;
      if (iframe) {
        sendYouTubeCommand(iframe, next ? 'mute' : 'unMute');
      }
      return next;
    });
  }, [currentVideo]);

  // When active iframe loads or when currentVideo changes, apply mute/unMute via postMessage
  useEffect(() => {
    if (!currentVideo) return;
    const iframe = videoRefs.current.get(currentVideo.id);
    if (iframe) {
      const t = window.setTimeout(() => sendYouTubeCommand(iframe, muted ? 'mute' : 'unMute'), 250);
      return () => clearTimeout(t);
    }
  }, [currentVideo, muted]);
  const getRandomPage = () => {
    return Math.floor(Math.random() * 20) + 1;
  };

  const fetchVideos = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const randomPage = getRandomPage();

      if (fetchedPages.has(randomPage)) {
        setLoading(false);
        return;
      }

      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${base}/all/video-feed?page=${randomPage}`);
      const data = await res.json();

      if (data.results.length > 0) {
        const shuffled = [...data.results].sort(() => Math.random() - 0.5);
        setVideos(prev => [...prev, ...shuffled]);
        setFetchedPages(prev => new Set([...prev, randomPage]));
        setHasMore(fetchedPages.size < 50);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, fetchedPages]);

  useEffect(() => {
    fetchVideos();
  }, []);



  // ---------- scroll / swipe handling ----------
  const handleScroll = useCallback((e: WheelEvent) => {
    // If wheel originates from panel, ignore (panel has its own scroll)
    if (panelRef.current && panelRef.current.contains(e.target as Node)) return;

    e.preventDefault();
    if (Math.abs(e.deltaY) < 50) return;

    if (e.deltaY > 0 && currentIndex < videos.length - 1) {
      setCurrentIndex(i => i + 1);
      setPanelOpen(false); setLiked(false); setSaved(false);
    } else if (e.deltaY < 0 && currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      setPanelOpen(false); setLiked(false); setSaved(false);
    }

    if (currentIndex >= videos.length - 3) fetchVideos();
  }, [currentIndex, videos.length, fetchVideos]);

  const touchStartY = useRef(0);
  const handleTouchStart = (e: TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;

    if (Math.abs(diff) < 50) return;

    if (diff > 0 && currentIndex < videos.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setPanelOpen(false);
      setLiked(false);
      setSaved(false);
    } else if (diff < 0 && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setPanelOpen(false);
      setLiked(false);
      setSaved(false);
    }

    if (currentIndex >= videos.length - 3) {
      fetchVideos();
    }
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

  // Apply mute state when video changes
  useEffect(() => {
    if (currentVideo) {
      const iframe = videoRefs.current.get(currentVideo.id);
      if (iframe && iframe.contentWindow) {
        // Wait a bit for iframe to be ready
        setTimeout(() => {
          const command = muted ? 'mute' : 'unMute';
          iframe.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: command, args: [] }),
            '*'
          );
        }, 500);
      }
    }
  }, [currentVideo, muted]);

  const iframeSrc = useMemo(() => {
    if (!currentVideo) return '';
    const key = currentVideo.primary_video.key;
    const base = `https://www.youtube.com/embed/${key}?autoplay=1&controls=0&modestbranding=1&rel=0&loop=1&playlist=${key}&enablejsapi=1&fs=1&playsinline=1`;
    return initialMutedRef.current ? `${base}&mute=1` : base;
  }, [currentVideo?.primary_video.key]);

  const togglePlayPause = () => {
    const iframe = videoRefs.current.get(currentVideo.id);
    if (!iframe) return;
    sendYouTubeCommand(iframe, isPlaying ? 'pauseVideo' : 'playVideo');
    setIsPlaying(!isPlaying);
  };
  return (
    <div ref={containerRef} className="fixed inset-0 bg-black overflow-hidden">
      {/* Top Navigation Bar */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/60 via-black/40 to-transparent backdrop-blur-xl border-b border-white/5 z-50 flex items-center px-4 md:px-8"
      >
        <div className="w-full flex items-center justify-between">
          <motion.div whileHover={{ scale: 1.05 }} className="flex items-center gap-3 cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 via-orange-500 to-pink-500 flex items-center justify-center shadow-lg shadow-red-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="hidden sm:block font-black text-white tracking-tight text-lg">CinemaFeed</span>
          </motion.div>

          <div className="hidden md:flex items-center gap-1">
            {[{ icon: Home }, { icon: Compass }, { icon: Search }].map((it, i) => (
              <motion.button key={i} whileHover={{ scale: 1.1 }} className="p-2 rounded-lg transition-all">
                <it.icon className="w-5 h-5 text-white/70 hover:text-white" />
              </motion.button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <motion.button whileHover={{ scale: 1.05 }} className="p-2 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white">
              <Plus className="w-5 h-5" />
            </motion.button>
            <motion.div whileHover={{ scale: 1.1 }} className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-white font-bold">U</span>
            </motion.div>
          </div>
        </div>
      </motion.nav>

      {/* Main Content Area */}
      <div className="relative w-full h-full pt-16">
        <AnimatePresence mode="wait">
          {currentVideo && (
            <motion.div
              key={currentVideo.id}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="absolute inset-0 pt-16 flex"
            >
              {/* Video Display */}
              <div className="flex-1 relative w-full bg-black overflow-hidden">
                <iframe
                  ref={el => { if (el) videoRefs.current.set(currentVideo.id, el); }}
                  title={currentVideo.title || currentVideo.name || `video-${currentVideo.id}`}
                  src={iframeSrc}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                  style={{ border: 'none', pointerEvents: 'none' }}
                  onLoad={(e) => {
                    const iframe = e.currentTarget as HTMLIFrameElement;
                    // ensure ref and then apply the current (possibly changed) muted state via postMessage
                    videoRefs.current.set(currentVideo.id, iframe);
                    // slight delay to give YouTube player time to init
                    setTimeout(() => sendYouTubeCommand(iframe, muted ? 'mute' : 'unMute'), 250);
                  }}
                />



                {/* Animated Title Bar */}
                <AnimatePresence>
                  {titleBarVisible && (
                    <motion.div
                      initial={{ y: 100, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 100, opacity: 0 }}
                      transition={{ duration: 0.36, ease: 'easeOut' }}
                      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 via-black/30 to-transparent backdrop-blur-sm px-4 md:px-8 py-5 pointer-events-auto z-20"
                      onMouseEnter={() => {
                        if (titleBarTimeoutRef.current) window.clearTimeout(titleBarTimeoutRef.current);
                        setTitleBarVisible(true);
                      }}
                      onMouseLeave={() => {
                        titleBarTimeoutRef.current = window.setTimeout(() => setTitleBarVisible(false), 2000);
                      }}
                    >
                      <div className="flex items-end justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <motion.h2 initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.06 }} className="text-white font-bold text-lg md:text-2xl line-clamp-2 mb-2">
                            {currentVideo.title || currentVideo.name}
                          </motion.h2>
                          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.12 }} className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1 bg-yellow-500/40 px-2.5 py-1 rounded-lg border border-yellow-400/50">
                              <Star className="w-3.5 h-3.5 text-yellow-300" fill="currentColor" />
                              <span className="text-yellow-100 font-bold text-sm">{currentVideo.vote_average.toFixed(1)}</span>
                            </div>
                            <span className="px-2.5 py-1 bg-white/20 rounded-lg border border-white/30 text-white text-xs font-bold uppercase">{currentVideo.media_type}</span>
                            <span className="px-2.5 py-1 bg-red-500/30 rounded-lg border border-red-400/40 text-red-200 text-xs font-bold uppercase">{currentVideo.primary_video.type}</span>
                          </motion.div>
                        </div>

                        <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.18, type: 'spring' }} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }} onClick={() => setPanelOpen(p => !p)} className={`p-3 rounded-xl transition-all backdrop-blur-md ${panelOpen ? 'bg-white text-black shadow-lg' : 'bg-white/20 border border-white/30 text-white hover:bg-white/30'}`}>
                          <Info className="w-5 h-5" />
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Show Info Button when hidden */}
                <AnimatePresence>
                  {!titleBarVisible && (
                    <motion.button initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ duration: 0.28 }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setTitleBarVisible(true)} className="absolute bottom-6 left-4 md:left-8 px-4 py-2 bg-black/40 backdrop-blur-md border border-white/30 rounded-xl text-white text-sm font-medium hover:bg-black/60 transition-all shadow-lg z-20 flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      <span className="hidden sm:inline">Show Info</span>
                    </motion.button>
                  )}
                </AnimatePresence>

                <motion.div
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.36 }}
                  className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 flex flex-col gap-5 z-30"
                >
                  {[
                    {
                      onClick: togglePlayPause,
                      icon: isPlaying ? <Pause className="w-6 h-6 md:w-7 md:h-7 text-white" /> : <Play className="w-6 h-6 md:w-7 md:h-7 text-white" />,
                      label: isPlaying ? "Playing..." : "Paused",
                      active: isPlaying,
                    },
                    {
                      onClick: () => setLiked(l => !l),
                      icon: <Heart className={`w-6 h-6 md:w-7 md:h-7 ${liked ? "fill-white text-white" : "text-white"}`} />,
                      label: liked ? "Liked" : "Like",
                      active: liked,
                    },
                    {
                      onClick: () => setSaved(s => !s),
                      icon: <Bookmark className={`w-6 h-6 md:w-7 md:h-7 ${saved ? "fill-white text-white" : "text-white"}`} />,
                      label: saved ? "Saved" : "Save",
                      active: saved,
                    },
                    {
                      onClick: toggleMute,
                      icon: muted ? (
                        <VolumeX className="w-6 h-6 md:w-7 md:h-7 text-white" />
                      ) : (
                        <Volume2 className="w-6 h-6 md:w-7 md:h-7 text-white" />
                      ),
                      label: muted ? "Muted" : "Unmuted",
                      active: !muted,
                    },
                  ].map((btn, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={btn.onClick}
                      className="group flex flex-col items-center gap-1"
                    >
                      <div
                        className={`w-12 h-12 md:w-14 md:h-14 rounded-full border flex items-center justify-center transition-all duration-300
          ${btn.active
                            ? "bg-gradient-to-r from-[#e94f37] to-[#ff6b58] border-transparent shadow-[0_0_12px_rgba(233,79,55,0.7)] backdrop-blur-sm"
                            : "bg-black/40 border-white/30 group-hover:border-white/50 group-hover:bg-white/10 backdrop-blur-sm"}`}
                      >
                        {btn.icon}
                      </div>
                      <span
                        className={`text-xs md:text-sm font-medium transition-colors duration-200 ${btn.active ? "text-white" : "text-white/80 group-hover:text-white"
                          }`}
                      >
                        {btn.label}
                      </span>
                    </motion.button>
                  ))}
                </motion.div>
              </div>

              {/* Side Info Panel - right of the video (separate scroll container) */}
              <AnimatePresence>
                {panelOpen && (
                  <motion.div
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    className="w-80 md:w-96 bg-gradient-to-br from-black/90 via-black/80 to-black/90 backdrop-blur-xl border-l border-white/10 flex flex-col overflow-hidden shadow-2xl"
                  >
                    <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
                      <h3 className="text-white font-bold text-base">Details</h3>
                      <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }} onClick={() => setPanelOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-all">
                        <X className="w-5 h-5 text-white/60" />
                      </motion.button>
                    </div>

                    {/* Panel Content — panelRef stops propagation so it scrolls independently */}
                    <div ref={panelRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                      <div>
                        <h2 className="text-white font-bold text-xl md:text-2xl leading-tight mb-3">{currentVideo.title || currentVideo.name}</h2>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 bg-yellow-500/30 px-3 py-1.5 rounded-lg border border-yellow-400/40">
                            <Star className="w-4 h-4 text-yellow-400" fill="currentColor" />
                            <span className="text-yellow-300 font-bold text-sm">{currentVideo.vote_average.toFixed(1)}</span>
                          </div>
                          <span className="px-3 py-1.5 bg-white/10 rounded-lg border border-white/20 text-white text-xs font-bold uppercase">{currentVideo.media_type}</span>
                          <span className="px-3 py-1.5 bg-red-500/20 rounded-lg border border-red-400/30 text-red-300 text-xs font-bold uppercase">{currentVideo.primary_video.type}</span>
                        </div>
                      </div>

                      <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                      <div>
                        <h4 className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                          <div className="w-1 h-4 bg-gradient-to-b from-red-500 to-orange-500 rounded-full" /> Overview
                        </h4>
                        <p className="text-white/80 text-sm leading-relaxed">
                          {currentVideo.overview}
                        </p>
                      </div>

                      <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                      <div>
                        <h4 className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                          <div className="w-1 h-4 bg-gradient-to-b from-red-500 to-orange-500 rounded-full" /> Details
                        </h4>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2 p-4 bg-gradient-to-br from-white/5 to-white/10 rounded-xl border border-white/10">
                            <div className="text-white/50 text-xs font-medium mb-1">Media Type</div>
                            <div className="text-white font-bold text-base uppercase">{currentVideo.media_type}</div>
                          </div>

                          <div className="p-4 bg-gradient-to-br from-white/5 to-white/10 rounded-xl border border-white/10">
                            <div className="text-white/50 text-xs font-medium mb-1">Rating</div>
                            <div className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" />
                              <span className="text-white font-bold text-base">{currentVideo.vote_average.toFixed(1)}</span>
                            </div>
                          </div>

                          <div className="p-4 bg-gradient-to-br from-white/5 to-white/10 rounded-xl border border-white/10">
                            <div className="text-white/50 text-xs font-medium mb-1">Video Type</div>
                            <div className="text-white font-bold text-sm uppercase">{currentVideo.primary_video.type}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border-t border-white/10">
                      {href ? (
                        <Link href={href} prefetch={true} shallow={false}>
                          <motion.span
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl text-white font-bold text-sm shadow-lg shadow-red-500/30"
                            aria-label={`View full details for ${currentVideo?.title ?? currentVideo?.name ?? currentVideo?.id}`}
                          >
                            <ExternalLink className="w-4 h-4" />
                            View Full Details
                          </motion.span>
                        </Link>
                      ) : (
                        <motion.span className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white/60 bg-gray-700/20">
                          <ExternalLink className="w-4 h-4" />
                          View Full Details
                        </motion.span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
            <div className="px-5 py-3 bg-black/60 backdrop-blur-xl rounded-full border border-white/20 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-white text-sm font-bold">Loading more...</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty */}
        {!loading && videos.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }} className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-10 h-10 text-white" />
              </motion.div>
              <div className="text-white text-2xl font-bold mb-2">No videos available</div>
              <div className="text-white/60 text-sm">Check back later for new content</div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}