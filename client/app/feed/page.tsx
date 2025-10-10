'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2, VolumeX, Heart, Share2, Bookmark,
  MessageCircle, Star, ExternalLink, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';

interface VideoItem {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
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
  const [muted, setMuted] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<number, HTMLIFrameElement>>(new Map());
  const currentVideo = videos[currentIndex];

  // Generate random page number
  const getRandomPage = () => {
    return Math.floor(Math.random() * 20) + 1;
  };

  // Fetch videos with randomization
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

  // Initial fetch
  useEffect(() => {
    fetchVideos();
  }, []);

  // Toggle mute function - Fixed!
  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const newMutedState = !prev;

      // Update the current video's iframe
      if (currentVideo) {
        const iframe = videoRefs.current.get(currentVideo.id);
        if (iframe && iframe.contentWindow) {
          const command = newMutedState ? 'mute' : 'unMute';
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: command }),
            '*'
          );
        }
      }

      return newMutedState;
    });
  }, [currentVideo]);

  // Scroll handler
  const handleScroll = useCallback((e: WheelEvent) => {
    e.preventDefault();

    if (Math.abs(e.deltaY) < 50) return;

    if (e.deltaY > 0 && currentIndex < videos.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowInfo(false);
      setLiked(false);
      setSaved(false);
    } else if (e.deltaY < 0 && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowInfo(false);
      setLiked(false);
      setSaved(false);
    }

    if (currentIndex >= videos.length - 3) {
      fetchVideos();
    }
  }, [currentIndex, videos.length, fetchVideos]);

  // Touch handlers for mobile
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
      setShowInfo(false);
      setLiked(false);
      setSaved(false);
    } else if (diff < 0 && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowInfo(false);
      setLiked(false);
      setSaved(false);
    }

    if (currentIndex >= videos.length - 3) {
      fetchVideos();
    }
  };

  // Attach scroll listeners
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


  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black overflow-hidden"
    >
      {/* Video Container */}
      <div className="relative w-full h-full">
        <AnimatePresence mode="wait">
          {currentVideo && (
            <motion.div
              key={currentVideo.id}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute inset-0"
            >
              {/* YouTube Video */}
              <div className="relative w-full h-full">
                <iframe
                  ref={el => {
                    if (el) videoRefs.current.set(currentVideo.id, el);
                  }}
                  src={`https://www.youtube.com/embed/${currentVideo.primary_video.key}?autoplay=1&controls=0&modestbranding=1&rel=0&mute=${muted ? 1 : 0}&loop=1&playlist=${currentVideo.primary_video.key}&enablejsapi=1`}
                  className="absolute inset-0 w-full h-full object-cover"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  style={{ border: 'none', pointerEvents: 'none' }}
                />

                {/* Enhanced Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/20 to-black/90 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/30 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none" />
              </div>

              {/* Top Floating Bar with Glass Effect */}
              <motion.div
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="absolute top-4 left-4 right-4 flex items-center justify-between z-10"
              >
                <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-black/30 backdrop-blur-2xl border border-white/10">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  <div>
                    <h1 className="text-white font-bold text-sm">Discover</h1>
                    <p className="text-white/50 text-xs">Trending Now</p>
                  </div>
                </div>

                {/* Progress Dots */}
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-black/30 backdrop-blur-2xl border border-white/10">
                  {videos.slice(Math.max(0, currentIndex - 2), currentIndex + 3).map((_, idx) => (
                    <motion.div
                      key={idx}
                      animate={{
                        width: idx === 2 ? 24 : 6,
                        opacity: idx === 2 ? 1 : 0.4
                      }}
                      className="h-1.5 rounded-full bg-white"
                    />
                  ))}
                </div>
              </motion.div>

              {/* Right Side Actions - Enhanced */}
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="absolute right-3 md:right-5 bottom-32 md:bottom-40 flex flex-col gap-4 z-10"
              >
                {/* Like Button */}
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setLiked(!liked)}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="relative">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-2xl border border-white/20 flex items-center justify-center group-hover:border-red-400/50 transition-all shadow-lg">
                      <Heart
                        className={`w-6 h-6 md:w-7 md:h-7 transition-all ${liked ? 'fill-red-500 text-red-500 scale-110' : 'text-white group-hover:text-red-400'
                          }`}
                      />
                    </div>
                    {liked && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        className="absolute inset-0 rounded-2xl bg-red-500/20 blur-xl"
                      />
                    )}
                  </div>
                  <span className="text-white text-xs font-bold">
                    {Math.floor(currentVideo.vote_average * 10)}K
                  </span>
                </motion.button>

                {/* Comments Button */}
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-2xl border border-white/20 flex items-center justify-center group-hover:border-blue-400/50 transition-all shadow-lg">
                    <MessageCircle className="w-6 h-6 md:w-7 md:h-7 text-white group-hover:text-blue-400 transition-colors" />
                  </div>
                  <span className="text-white text-xs font-bold">234</span>
                </motion.button>

                {/* Save Button */}
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSaved(!saved)}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="relative">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-2xl border border-white/20 flex items-center justify-center group-hover:border-yellow-400/50 transition-all shadow-lg">
                      <Bookmark
                        className={`w-6 h-6 md:w-7 md:h-7 transition-all ${saved ? 'fill-yellow-400 text-yellow-400 scale-110' : 'text-white group-hover:text-yellow-400'
                          }`}
                      />
                    </div>
                    {saved && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        className="absolute inset-0 rounded-2xl bg-yellow-500/20 blur-xl"
                      />
                    )}
                  </div>
                </motion.button>

                {/* Share Button */}
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-2xl border border-white/20 flex items-center justify-center group-hover:border-green-400/50 transition-all shadow-lg">
                    <Share2 className="w-6 h-6 md:w-7 md:h-7 text-white group-hover:text-green-400 transition-colors" />
                  </div>
                </motion.button>

                {/* Sound Button - Fixed */}
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleMute}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-2xl border border-white/20 flex items-center justify-center group-hover:border-purple-400/50 transition-all shadow-lg">
                    {muted ? (
                      <VolumeX className="w-6 h-6 md:w-7 md:h-7 text-white group-hover:text-purple-400 transition-colors" />
                    ) : (
                      <Volume2 className="w-6 h-6 md:w-7 md:h-7 text-purple-400" />
                    )}
                  </div>
                </motion.button>
              </motion.div>

              {/* Enhanced Bottom Info Panel */}
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="absolute bottom-0 left-0 right-0 z-10"
              >
                <div className="px-4 md:px-6 pb-6 md:pb-8">
                  <div className="max-w-2xl">
                    {/* Info Panel */}
                    <motion.div
                      animate={{ height: showInfo ? 'auto' : 'auto' }}
                      className="rounded-3xl bg-gradient-to-br from-black/40 via-black/30 to-black/20 backdrop-blur-2xl border border-white/10 p-5 md:p-6 shadow-2xl overflow-hidden"
                    >
                      {/* Title */}
                      <motion.h2
                        className="text-white font-black text-2xl md:text-3xl mb-3 leading-tight"
                      >
                        {currentVideo.title || currentVideo.name}
                      </motion.h2>

                      {/* Tags */}
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <div className="flex items-center gap-1.5 bg-gradient-to-r from-yellow-500/30 to-orange-500/30 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-yellow-400/30">
                          <Star className="w-4 h-4 text-yellow-400" fill="currentColor" />
                          <span className="text-yellow-400 font-bold text-sm">
                            {currentVideo.vote_average.toFixed(1)}
                          </span>
                        </div>
                        <span className="px-3 py-1.5 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 text-white text-xs font-bold uppercase tracking-wider">
                          {currentVideo.media_type}
                        </span>
                        <span className="px-3 py-1.5 bg-gradient-to-r from-red-500/30 to-pink-500/30 backdrop-blur-xl rounded-xl border border-red-400/30 text-red-300 text-xs font-bold uppercase tracking-wider">
                          {currentVideo.primary_video.type}
                        </span>
                      </div>

                      {/* Overview with smooth expand/collapse */}
                      <AnimatePresence>
                        {showInfo && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <p className="text-white/90 text-sm md:text-base leading-relaxed mb-4">
                              {currentVideo.overview}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowInfo(!showInfo)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-xl border border-white/20 text-white text-sm font-bold transition-all"
                        >
                          {showInfo ? (
                            <>
                              <ChevronUp className="w-4 h-4" />
                              Show Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              Show More
                            </>
                          )}
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(239, 68, 68, 0.5)' }}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-500 via-red-600 to-orange-500 rounded-xl text-white text-sm md:text-base font-bold shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all"
                        >
                          <ExternalLink className="w-5 h-5" />
                          View Details
                        </motion.button>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>

              {/* Animated Scroll Indicators */}
              {currentIndex > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-20 md:top-24 left-1/2 -translate-x-1/2 pointer-events-none"
                >
                  <div className="w-8 h-12 border-2 border-white/40 rounded-full flex items-start justify-center p-2 backdrop-blur-sm bg-white/5">
                    <motion.div
                      animate={{ y: [0, 10, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      className="w-2 h-2 bg-white rounded-full shadow-lg shadow-white/50"
                    />
                  </div>
                </motion.div>
              )}

              {currentIndex < videos.length - 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-28 md:bottom-32 left-1/2 -translate-x-1/2 pointer-events-none"
                >
                  <div className="w-8 h-12 border-2 border-white/40 rounded-full flex items-end justify-center p-2 backdrop-blur-sm bg-white/5">
                    <motion.div
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      className="w-2 h-2 bg-white rounded-full shadow-lg shadow-white/50"
                    />
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Indicator */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
          >
            <div className="px-6 py-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-white text-sm font-bold">Loading more...</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && videos.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="text-center p-8 rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10">
              <div className="text-white text-2xl font-bold mb-2">No videos available</div>
              <div className="text-white/60 text-base">Check back later for new content</div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}