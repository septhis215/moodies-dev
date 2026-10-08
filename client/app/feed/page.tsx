"use client";
import PageSkeleton from "@/components/loading/PageSkeleton";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/lib/tmdb";
import { useState, useRef, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clapperboard,
  ExternalLink,
  Maximize2,
  Play,
  RefreshCw,
  Sparkles,
  Search,
  Star,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ActionButtons from "@/components/ui/actionButtons";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useLiked } from "@/hooks/useLiked";
import { useAuth } from "@/app/context/AuthProvider";
import {
  YT_PLAYER_STATE,
  createYouTubePlayer,
  type YouTubePlayer,
} from "@/lib/youtube-player";

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
  media_type: "movie" | "tv";
  primary_video: {
    key: string;
    name: string;
    type: string;
    site: string;
    video_type?: string;
    video_type_label?: string;
    aspect_ratio?: number;
    orientation?: "portrait" | "landscape";
  };
  video_key?: string;
  video_name?: string;
  video_type?: string;
  video_type_label?: string;
  aspect_ratio?: number;
  orientation?: "portrait" | "landscape";
  videos: unknown[];
}

type FeedContentLike = Partial<VideoItem> & {
  type?: string;
  number_of_seasons?: number;
};

type Category = "all" | "upcoming";
type LoadingMode = "idle" | "initial" | "more" | "refresh";
/** Playback signals the mounted player reports back to the page. */
type FeedPlayerStatus = "playing" | "paused" | "blocked" | "error";

const feedTabs: Array<{
  value: Category;
  label: string;
  shortLabel: string;
  icon: ReactNode;
}> = [
  {
    value: "all",
    label: "All Videos",
    shortLabel: "All",
    icon: <Clapperboard className="h-4 w-4" />,
  },
  {
    value: "upcoming",
    label: "Upcoming",
    shortLabel: "Soon",
    icon: <Calendar className="h-4 w-4" />,
  },
];

export default function VideoFeedPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Configuration constants
  const PREFETCH_THRESHOLD = 5;
  const WINDOW_SIZE = 20;
  const CLEANUP_THRESHOLD = 10;
  const INITIAL_FETCH_SIZE = 15;
  const PREFETCH_SIZE = 10;

  const [expanded, setExpanded] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingMode, setLoadingMode] = useState<LoadingMode>("idle");
  const [hasMore, setHasMore] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const isFetchingRef = useRef(false);
  const nextPageRef = useRef(1);
  const sessionSaltRef = useRef(Math.floor(Math.random() * 500)); // random 0-499 per tab session
  const seenVideoIdsRef = useRef<Set<string>>(new Set());
  const indexOffsetRef = useRef(0);
  const retryCountRef = useRef(0);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const fetchGenerationRef = useRef(0);
  const viewerIdRef = useRef<string>("");
  const reportedViewsRef = useRef<Set<string>>(new Set());

  // Mobile browsers only guarantee autoplay while muted. Once the user
  // explicitly enables sound, that preference carries to subsequent videos —
  // but it may only be enabled from a deliberate tap on the sound control.
  // Treating any stray gesture as consent would unmute the next card and the
  // autoplay policy would then refuse to start it at all.
  const [muted, setMuted] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const [panelOpen, setPanelOpen] = useState(false);
  const {
    isLiked,
    like: addToLiked,
    unlike: removeFromLiked,
    ready: likedReady,
  } = useLiked();
  const [isPlaying, setIsPlaying] = useState(true);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [playerReloadKey, setPlayerReloadKey] = useState(0);
  const [modalBackdropError, setModalBackdropError] = useState(false);
  const [isMobileFullscreen, setIsMobileFullscreen] = useState(false);
  const [isTogglingWatchlist, setIsTogglingWatchlist] = useState(false);
  const {
    isInWatchlist,
    add: addToWatchlist,
    remove: removeFromWatchlist,
  } = useWatchlist();

  const panelRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Live player instance, published by the mounted slide's own player. */
  const playerRef = useRef<YouTubePlayer | null>(null);
  const isPlayingRef = useRef(true);
  const manuallyPausedRef = useRef(false);
  const autoplayBlockedRef = useRef(false);
  const gatesClearRef = useRef(true);
  const recoveryTimerRef = useRef<number | null>(null);
  const recoveryAttemptsRef = useRef(0);
  const wasPlayingBeforeFullscreenRef = useRef(true);
  const [videoReady, setVideoReady] = useState(false);
  const [feedVisible, setFeedVisible] = useState(true);

  const currentVideo = videos[currentIndex];
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    if (user?.id) {
      viewerIdRef.current = `user:${user.id}`;
      return;
    }

    try {
      const storageKey = "moodiesFeedViewerId";
      const existing = localStorage.getItem(storageKey);
      if (existing) {
        viewerIdRef.current = existing;
        return;
      }
      const created = `anon:${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(storageKey, created);
      viewerIdRef.current = created;
    } catch {
      if (!viewerIdRef.current) {
        viewerIdRef.current = `session:${Math.random().toString(36).slice(2)}`;
      }
    }
  }, [user?.id]);

  const getContentType = useCallback(
    (item: FeedContentLike): "movie" | "tv" => {
      if (item.media_type) return item.media_type;
      if (item.type === "movies" || item.type === "movie") return "movie";
      if (item.type === "tv") return "tv";
      if (item.number_of_seasons || item.first_air_date || item.name)
        return "tv";
      return "movie";
    },
    [],
  );

  const currentContentType = currentVideo ? getContentType(currentVideo) : "movie";
  const watchType = currentContentType === "tv" ? "series" : "movie";
  const inWatchlist = currentVideo
    ? isInWatchlist(String(currentVideo.id), watchType)
    : false;
  const likeType = currentContentType === "tv" ? "series" : "movie";
  const liked = currentVideo
    ? isLiked(String(currentVideo.id), likeType)
    : false;

  const handleLikeToggle = useCallback(async () => {
    if (!currentVideo) return;
    if (!likedReady) {
      router.push("/auth/login");
      return;
    }
    const meta = {
      title: currentVideo.title || currentVideo.name,
      posterUrl: currentVideo.poster_path
        ? tmdbImage(currentVideo.poster_path, "w200")
        : null,
      duration: 3000,
    };
    if (liked) await removeFromLiked(String(currentVideo.id), likeType, meta);
    else await addToLiked(String(currentVideo.id), likeType, meta);
  }, [
    currentVideo,
    liked,
    likeType,
    likedReady,
    addToLiked,
    removeFromLiked,
    router,
  ]);

  const handleWatchlistToggle = useCallback(async () => {
    if (!currentVideo || isTogglingWatchlist) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }
    setIsTogglingWatchlist(true);
    try {
      if (inWatchlist) {
        await removeFromWatchlist(String(currentVideo.id), watchType, {
          title: currentVideo.title || currentVideo.name,
          posterUrl: currentVideo.poster_path
            ? tmdbImage(currentVideo.poster_path, "w200")
            : null,
          variant: "info",
          duration: 3500,
        });
      } else {
        await addToWatchlist(String(currentVideo.id), watchType, {
          title: currentVideo.title || currentVideo.name,
          posterUrl: currentVideo.poster_path
            ? tmdbImage(currentVideo.poster_path, "w200")
            : null,
          variant: "success",
          duration: 3500,
        });
      }
    } catch (error) {
      console.error("Failed to toggle watchlist:", error);
    } finally {
      setIsTogglingWatchlist(false);
    }
  }, [
    currentVideo,
    inWatchlist,
    watchType,
    isTogglingWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    user,
    router,
  ]);

  const href = currentVideo
    ? `/${getContentType(currentVideo) === "tv" ? "tv" : "movies"}/${currentVideo.id}`
    : undefined;

  const getVideoIdentity = useCallback(
    (video: VideoItem) => {
      const videoKey = video.video_key || video.primary_video?.key || "primary";
      return `${video.media_type || getContentType(video)}:${video.id}:${videoKey}`;
    },
    [getContentType],
  );
  const currentVideoIdentity = currentVideo
    ? getVideoIdentity(currentVideo)
    : "";
  const loading = loadingMode !== "idle";

  const fetchMoreVideos = useCallback(
    async (
      isInitial = false,
      mode: LoadingMode = isInitial ? "initial" : "more",
    ) => {
      if (isFetchingRef.current) return;
      if (!isInitial && !hasMore) return;
      isFetchingRef.current = true;
      setLoadingMode(mode);
      setFeedError(null);

      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;
      const requestGeneration = fetchGenerationRef.current;

      try {
        const base = process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
        const limit = isInitial ? INITIAL_FETCH_SIZE : PREFETCH_SIZE;
        const currentPage = nextPageRef.current;
        const viewerParam = viewerIdRef.current
          ? `&viewerId=${encodeURIComponent(viewerIdRef.current)}`
          : "";
        const endpoint =
          activeCategory === "upcoming"
            ? `${base}/all/upcoming-trailers-feed?page=${currentPage}&limit=${limit}${viewerParam}`
            : `${base}/all/video-feed?page=${currentPage}&limit=${limit}&salt=${sessionSaltRef.current}${viewerParam}`;

        const res = await fetch(endpoint, { signal: controller.signal });
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        const data = await res.json();
        if (requestGeneration !== fetchGenerationRef.current) return;
        const results = Array.isArray(data) ? data : data.results || [];

        if (results.length > 0) {
          const uniqueVideos: VideoItem[] = [];
          for (const video of results as VideoItem[]) {
            if (!video.primary_video?.key) continue;
            const identity = getVideoIdentity(video);
            if (seenVideoIdsRef.current.has(identity)) continue;
            seenVideoIdsRef.current.add(identity);
            uniqueVideos.push(video);
          }

          if (uniqueVideos.length > 0) {
            retryCountRef.current = 0;
            setVideos((prev) => {
              const prevIds = new Set(
                prev.map((video) => getVideoIdentity(video)),
              );
              return [
                ...prev,
                ...uniqueVideos.filter(
                  (video) => !prevIds.has(getVideoIdentity(video)),
                ),
              ];
            });
            nextPageRef.current = Number(data.nextPage) || currentPage + 1;
            const backendHasMore =
              data.hasMore !== undefined
                ? data.hasMore
                : uniqueVideos.length >= Math.floor(limit * 0.7);
            setHasMore(Boolean(backendHasMore));
          } else {
            const backendHasMore =
              data.hasMore !== undefined ? data.hasMore : currentPage < 100;
            if (retryCountRef.current < 2 && backendHasMore) {
              retryCountRef.current += 1;
              nextPageRef.current = Number(data.nextPage) || currentPage + 1;
              isFetchingRef.current = false;
              setLoadingMode("idle");
              retryTimerRef.current = window.setTimeout(
                () => fetchMoreVideos(false),
                180,
              );
              return;
            }
            setHasMore(false);
          }
        } else {
          setHasMore(false);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        console.error("Error fetching videos:", error);
        setFeedError("Could not load this feed. Please try again.");
        setHasMore(videos.length > 0);
      } finally {
        if (requestGeneration === fetchGenerationRef.current) {
          setLoadingMode("idle");
        }
        isFetchingRef.current = false;
        if (fetchAbortRef.current === controller) fetchAbortRef.current = null;
      }
    },
    [
      activeCategory,
      hasMore,
      INITIAL_FETCH_SIZE,
      PREFETCH_SIZE,
      videos.length,
      getVideoIdentity,
    ],
  );
  const destroyActivePlayer = useCallback(() => {
    const player = playerRef.current;
    playerRef.current = null;
    if (!player) return;
    try {
      player.destroy();
    } catch {
      /* the API has already torn this player down */
    }
  }, []);

  const cleanupOldVideos = useCallback(() => {
    const videosAhead = videos.length - currentIndex;
    if (currentIndex > CLEANUP_THRESHOLD && videosAhead > WINDOW_SIZE / 2) {
      const keepFrom = Math.max(0, currentIndex - 2);
      if (keepFrom > 0) {
        // Dropped slides unmount, and each slide owns its player, so their
        // players are destroyed by their own effect cleanup.
        setVideos((prev) => prev.slice(keepFrom));
        indexOffsetRef.current += keepFrom;
        setCurrentIndex((prev) => prev - keepFrom);
      }
    }
  }, [currentIndex, videos.length, CLEANUP_THRESHOLD, WINDOW_SIZE]);

  const resetFeed = useCallback(
    (mode: LoadingMode = "initial") => {
      fetchGenerationRef.current += 1;
      fetchAbortRef.current?.abort();
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      destroyActivePlayer();
      setVideoReady(false);
      setAutoplayBlocked(false);
      setVideos([]);
      setCurrentIndex(0);
      indexOffsetRef.current = 0;
      seenVideoIdsRef.current = new Set();
      nextPageRef.current = 1;
      sessionSaltRef.current = Math.floor(Math.random() * 500);
      retryCountRef.current = 0;
      reportedViewsRef.current = new Set();
      setFeedError(null);
      setHasMore(true);
      setPanelOpen(false);
      setExpanded(false);
      isFetchingRef.current = false;
      const timer = window.setTimeout(() => fetchMoreVideos(true, mode), 80);
      return () => window.clearTimeout(timer);
    },
    [fetchMoreVideos, destroyActivePlayer],
  );

  useEffect(() => {
    const distanceFromEnd = videos.length - currentIndex - 1;
    if (
      distanceFromEnd <= PREFETCH_THRESHOLD &&
      hasMore &&
      !isFetchingRef.current
    )
      fetchMoreVideos(false);
  }, [
    currentIndex,
    videos.length,
    hasMore,
    PREFETCH_THRESHOLD,
    fetchMoreVideos,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => cleanupOldVideos(), 500);
    return () => clearTimeout(timer);
  }, [currentIndex, cleanupOldVideos]);

  useEffect(() => {
    const cleanup = resetFeed("initial");
    return () => {
      cleanup?.();
      fetchAbortRef.current?.abort();
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    };
    // This reset should only run when the selected feed changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current)
        setShowScrollHint(containerRef.current.scrollTop <= 50);
    };
    const container = containerRef.current;
    if (container) container.addEventListener("scroll", handleScroll);
    return () => container?.removeEventListener("scroll", handleScroll);
  }, []);

  // Close panel when video changes
  useEffect(() => {
    setPanelOpen(false);
    setExpanded(false);
    setVideoReady(false);
    setPlayerError(false);
    setAutoplayBlocked(false);
    setModalBackdropError(false);
    setIsMobileFullscreen(false);
    manuallyPausedRef.current = false;
    setManuallyPaused(false);
    setIsPlaying(false);
    if (recoveryTimerRef.current !== null) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    recoveryAttemptsRef.current = 0;
  }, [currentIndex]);

  // Safety net for a player that never reaches PLAYING. `videoReady` is now
  // derived from real player state, so this can finally fire on a video that is
  // genuinely stuck instead of being disarmed the moment markup appeared.
  useEffect(() => {
    if (!currentVideo || videoReady || autoplayBlocked) return;
    const timer = window.setTimeout(() => setPlayerError(true), 12000);
    return () => window.clearTimeout(timer);
  }, [
    currentVideo,
    currentVideoIdentity,
    playerReloadKey,
    videoReady,
    autoplayBlocked,
  ]);

  useEffect(() => {
    if (!currentVideo?.id || !currentVideo.primary_video?.key) return;
    if (!viewerIdRef.current) return;

    const identity = getVideoIdentity(currentVideo);
    if (reportedViewsRef.current.has(identity)) return;

    const timer = window.setTimeout(() => {
      reportedViewsRef.current.add(identity);
      const base = process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
      void fetch(`${base}/all/video-feed/viewed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viewerId: viewerIdRef.current,
          mediaType: getContentType(currentVideo),
          id: currentVideo.id,
          videoKey: currentVideo.primary_video.key,
        }),
        keepalive: true,
      }).catch(() => {
        reportedViewsRef.current.delete(identity);
      });
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [
    currentVideo,
    currentVideo?.id,
    currentVideo?.primary_video?.key,
    getContentType,
    getVideoIdentity,
  ]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    manuallyPausedRef.current = manuallyPaused;
  }, [manuallyPaused]);

  useEffect(() => {
    autoplayBlockedRef.current = autoplayBlocked;
  }, [autoplayBlocked]);

  useEffect(() => {
    gatesClearRef.current = feedVisible && !panelOpen && !manuallyPaused;
  }, [feedVisible, panelOpen, manuallyPaused]);

  // ── PLAYER CONTROL LAYER ──────────────────────────────────────
  // Every playback signal comes from the YouTube IFrame API. The feed no longer
  // posts raw `postMessage` commands at an embed iframe: that protocol is
  // undocumented, no message channel was ever bound here, so the page was
  // driving a player it could not observe and calling a video "ready" as soon as
  // its markup parsed.
  const attachPlayer = useCallback((player: YouTubePlayer | null) => {
    playerRef.current = player;
  }, []);

  const handlePlayerStatus = useCallback((status: FeedPlayerStatus) => {
    if (status === "playing") {
      setAutoplayBlocked(false);
      setVideoReady(true);
      setPlayerError(false);
      setIsPlaying(true);
      return;
    }
    if (status === "paused") {
      setIsPlaying(false);
      // A pause nobody in this page asked for. Chrome quietly suspends muted
      // autoplays it decides are background noise, so recover it a couple of
      // times; if the browser keeps refusing, the forced play comes back as
      // "blocked" and the viewer gets an explicit control instead of a freeze.
      // The recovery never touches isPlaying: the player's own PLAYING event is
      // what is allowed to claim the video came back.
      if (
        recoveryTimerRef.current !== null ||
        recoveryAttemptsRef.current >= 2 ||
        !gatesClearRef.current
      ) {
        return;
      }
      recoveryTimerRef.current = window.setTimeout(() => {
        recoveryTimerRef.current = null;
        recoveryAttemptsRef.current += 1;
        if (!gatesClearRef.current) return;
        try {
          playerRef.current?.playVideo();
        } catch {
          /* the player is mid-teardown */
        }
      }, 500);
      return;
    }
    if (status === "blocked") {
      // The browser refused to start the video. Show an explicit gesture
      // instead of a loading spinner that will never resolve.
      setAutoplayBlocked(true);
      setVideoReady(false);
      setIsPlaying(false);
      return;
    }
    setPlayerError(true);
    setVideoReady(false);
    setAutoplayBlocked(false);
    setIsPlaying(false);
  }, []);

  const pauseActiveVideo = useCallback(() => {
    try {
      playerRef.current?.pauseVideo();
    } catch {
      /* the player is mid-teardown */
    }
    setIsPlaying(false);
  }, []);

  const playActiveVideo = useCallback(
    (force = false) => {
      if (!currentVideo || !feedVisible || panelOpen) return;
      if (manuallyPausedRef.current && !force) return;
      // A video the browser blocked only restarts from a real gesture; retrying
      // from an effect just bounces off the same autoplay policy.
      if (autoplayBlockedRef.current && !force) return;
      const player = playerRef.current;
      if (!player) return;

      setAutoplayBlocked(false);
      player.playVideo();
      setIsPlaying(true);
    },
    [currentVideo, feedVisible, panelOpen],
  );

  /**
   * Recovers a video the browser refused to autoplay. Must be called directly
   * from a click handler: the user gesture is what unlocks playback, and
   * deferring the call (a timeout, an effect) loses it.
   */
  const startPlaybackFromGesture = useCallback(() => {
    manuallyPausedRef.current = false;
    setManuallyPaused(false);
    playActiveVideo(true);
  }, [playActiveVideo]);

  const toggleMute = useCallback(() => {
    setAudioUnlocked(true);
    setMuted((prev) => !prev);
  }, []);

  /** Turns sound on from a deliberate tap, then keeps the video running. */
  const enableAudio = useCallback(() => {
    setAudioUnlocked(true);
    setMuted(false);
    const player = playerRef.current;
    if (!player || manuallyPausedRef.current || panelOpen) return;
    try {
      player.setVolume(100);
      player.unMute();
      // Unmuting can flip a tolerated muted stream into a blocked one, so
      // restart inside the same gesture rather than waiting to notice.
      player.playVideo();
      setAutoplayBlocked(false);
      setIsPlaying(true);
    } catch {
      /* the player is mid-teardown */
    }
  }, [panelOpen]);

  const handleScroll = useCallback(
    (e: WheelEvent) => {
      if (panelOpen) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      if (Math.abs(e.deltaY) < 50) return;
      if (e.deltaY > 0 && currentIndex < videos.length - 1) {
        setCurrentIndex((i) => i + 1);
        setPanelOpen(false);
      } else if (e.deltaY > 0 && hasMore && !isFetchingRef.current) {
        fetchMoreVideos(false);
      } else if (e.deltaY < 0 && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
        setPanelOpen(false);
      }
    },
    [currentIndex, videos.length, hasMore, fetchMoreVideos, panelOpen],
  );

  const touchStartY = useRef(0);
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (panelOpen) return;
      touchStartY.current = e.touches[0].clientY;
    },
    [panelOpen],
  );
  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (panelOpen) return;
      const diff = touchStartY.current - e.changedTouches[0].clientY;
      if (Math.abs(diff) < 50) return;
      if (diff > 0 && currentIndex < videos.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setPanelOpen(false);
      } else if (diff > 0 && hasMore && !isFetchingRef.current) {
        fetchMoreVideos(false);
      } else if (diff < 0 && currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
        setPanelOpen(false);
      }
    },
    [currentIndex, videos.length, hasMore, fetchMoreVideos, panelOpen],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || panelOpen) return;
    container.addEventListener("wheel", handleScroll, { passive: false });
    container.addEventListener("touchstart", handleTouchStart as EventListener);
    container.addEventListener("touchend", handleTouchEnd as EventListener);
    return () => {
      container.removeEventListener("wheel", handleScroll);
      container.removeEventListener(
        "touchstart",
        handleTouchStart as EventListener,
      );
      container.removeEventListener(
        "touchend",
        handleTouchEnd as EventListener,
      );
    };
  }, [handleScroll, handleTouchStart, handleTouchEnd, panelOpen]);

  // Playback gate: a trailer only runs while the tab is visible, the details
  // panel is closed, the user has not paused it and the browser has not blocked
  // autoplay. Opening the panel pauses; closing it resumes.
  useEffect(() => {
    if (!currentVideo) return;
    if (!feedVisible || panelOpen) {
      pauseActiveVideo();
      return;
    }
    if (manuallyPausedRef.current || autoplayBlocked) return;
    const timer = window.setTimeout(() => playActiveVideo(), 260);
    return () => window.clearTimeout(timer);
  }, [
    autoplayBlocked,
    currentVideo,
    feedVisible,
    panelOpen,
    pauseActiveVideo,
    playActiveVideo,
  ]);

  useEffect(() => {
    if (!panelOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [panelOpen]);

  // Only tab visibility gates playback. The old `blur` handler marked the feed
  // hidden whenever the window lost focus, and a window that never fires
  // `focus` again (clicking into another monitor, a devtools focus steal) left
  // every later play attempt early-returning for the rest of the session.
  useEffect(() => {
    const handleVisibilityChange = () => {
      setFeedVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const togglePlayPause = () => {
    if (!currentVideo) return;
    if (!playerRef.current) return;
    if (isPlaying) {
      manuallyPausedRef.current = true;
      setManuallyPaused(true);
      pauseActiveVideo();
    } else {
      startPlaybackFromGesture();
    }
  };

  const videoTitle = currentVideo?.title || currentVideo?.name || "";
  const currentPoster = currentVideo?.poster_path
    ? tmdbImage(currentVideo.poster_path, "w342")
    : null;
  const currentBackdrop = currentVideo?.backdrop_path
    ? tmdbImage(currentVideo.backdrop_path, "w1280")
    : currentPoster;
  const currentYear =
    currentVideo?.release_date || currentVideo?.first_air_date
      ? new Date(
          currentVideo.release_date ?? currentVideo.first_air_date!,
        ).getFullYear()
      : null;
  const currentReleaseDateLabel =
    currentVideo?.release_date || currentVideo?.first_air_date
      ? new Date(
          currentVideo.release_date ?? currentVideo.first_air_date!,
        ).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;
  const currentVideoTypeLabel =
    currentVideo?.video_type_label ||
    currentVideo?.primary_video?.video_type_label ||
    currentVideo?.video_type ||
    currentVideo?.primary_video?.video_type ||
    currentVideo?.primary_video?.type ||
    "Video";
  const currentAspectRatio =
    currentVideo?.aspect_ratio ?? currentVideo?.primary_video?.aspect_ratio;
  const currentOrientation =
    currentVideo?.orientation ?? currentVideo?.primary_video?.orientation;
  const isPortraitVideo =
    currentOrientation === "portrait" ||
    (typeof currentAspectRatio === "number" && currentAspectRatio < 1);
  const isLandscapeVideo = !isPortraitVideo;
  // Escape hatch for landscape trailers on small screens: a stock YouTube
  // player with native controls, opened from a tap, so the autoplay policy is
  // satisfied by that gesture instead of being fought.
  const fullscreenIframeSrc = currentVideo?.primary_video?.key
    ? `https://www.youtube.com/embed/${currentVideo.primary_video.key}?autoplay=1&controls=1&fs=0&iv_load_policy=3&modestbranding=1&rel=0&playsinline=1&mute=${muted ? 1 : 0}&vq=hd1080`
    : "";

  const openMobileFullscreen = () => {
    if (!currentVideo || !isLandscapeVideo) return;
    wasPlayingBeforeFullscreenRef.current =
      isPlayingRef.current && !manuallyPausedRef.current;
    pauseActiveVideo();
    setIsMobileFullscreen(true);
  };

  const closeMobileFullscreen = useCallback(() => {
    setIsMobileFullscreen(false);
    if (
      wasPlayingBeforeFullscreenRef.current &&
      !manuallyPausedRef.current &&
      feedVisible
    ) {
      window.setTimeout(() => playActiveVideo(), 180);
    }
  }, [feedVisible, playActiveVideo]);

  useEffect(() => {
    if (!isMobileFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileFullscreen();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMobileFullscreen, isMobileFullscreen]);

  const videoFrameSizeClassName = cn(
    isPortraitVideo
      ? "h-[100svh] w-screen max-w-none lg:h-[calc(100svh-1rem)] lg:w-[calc((100svh-1rem)*0.5625)]"
      : "h-[100svh] w-screen max-w-none lg:h-[100svh] lg:w-screen",
  );
  const videoFrameClassName = cn(
    "relative isolate overflow-hidden bg-black",
    isPortraitVideo &&
      "lg:rounded-[1.5rem] lg:ring-1 lg:ring-white/10 lg:shadow-[0_30px_110px_rgba(0,0,0,0.78)]",
    videoFrameSizeClassName,
  );

  const playbackAllowed = feedVisible && !panelOpen && !manuallyPaused;

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed inset-0 h-[100svh] w-full overflow-hidden overscroll-none bg-black",
        panelOpen ? "touch-pan-y" : "touch-none",
      )}
    >
      {loading && videos.length === 0 && <div className="pointer-events-none absolute inset-0"><PageSkeleton variant="feed" /></div>}
      {/* ── TOP NAVBAR ──────────────────────────────────────────── */}
      <motion.nav
        initial={{ y: -56, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="pointer-events-none fixed left-0 right-0 top-0 z-50 bg-gradient-to-b from-black/88 via-black/55 to-transparent px-3 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:pb-14"
      >
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
          <Link
            href="/"
            className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/35 shadow-xl shadow-black/25 backdrop-blur-xl transition hover:border-white/25 hover:bg-black/50 sm:h-11 sm:w-11"
          >
            <Image
              src="/images/moodies-transparent.png"
              alt="Moodies"
              width={30}
              height={30}
              className="h-7 w-7 object-contain sm:h-8 sm:w-8"
            />
          </Link>

          <div className="flex min-w-0 justify-center">
            <div className="pointer-events-auto grid w-full max-w-[21rem] grid-cols-2 gap-1 rounded-full border border-white/15 bg-black/35 p-1 shadow-xl shadow-black/25 backdrop-blur-xl transition-colors hover:bg-black/45 sm:max-w-[24rem]">
              {feedTabs.map((tab) => (
                <motion.button
                  key={tab.value}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setActiveCategory(tab.value)}
                  className={cn(
                    "relative min-h-9 overflow-hidden rounded-full px-2 py-1.5 text-left transition-colors duration-200 sm:min-h-10 sm:px-3",
                    activeCategory === tab.value
                      ? "text-white"
                      : "text-white/55 hover:bg-white/[0.04] hover:text-white/85",
                  )}
                >
                  {activeCategory === tab.value && (
                    <motion.span
                      layoutId="pill"
                      className="absolute inset-0 rounded-full bg-white/18 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-2 sm:justify-start">
                    <span
                      className={cn(
                        "hidden text-white/80 sm:block",
                        activeCategory === tab.value &&
                          "text-[var(--brand-coral-strong)]",
                      )}
                    >
                      {tab.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-center text-xs font-black sm:text-left">
                        <span className="sm:hidden">{tab.shortLabel}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                      </span>
                    </span>
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="pointer-events-auto flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-black/35 p-1 shadow-xl shadow-black/25 backdrop-blur-xl transition-colors hover:bg-black/45">
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => resetFeed("refresh")}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
              aria-label="Refresh feed"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4 sm:h-5 sm:w-5",
                  loadingMode === "refresh" && "motion-safe:animate-spin",
                )}
              />
            </motion.button>
            <Link href="/search" prefetch>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.93 }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-all hover:bg-white/10 hover:text-white sm:h-9 sm:w-9"
                aria-label="Search"
              >
                <Search className="h-4 w-4 sm:h-5 sm:w-5" />
              </motion.button>
            </Link>
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => router.push("/profile")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-all hover:bg-white/10 hover:text-white sm:h-9 sm:w-9"
              aria-label="Profile"
            >
              <User className="h-4 w-4 sm:h-5 sm:w-5" />
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* ── MAIN VIDEO AREA ─────────────────────────────────────── */}
      <div className="relative flex h-[100svh] w-full items-center justify-center overflow-hidden bg-black">
        {currentBackdrop && (
          <div
            className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-50 blur-3xl saturate-125"
            style={{ backgroundImage: `url(${currentBackdrop})` }}
            aria-hidden="true"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-black/30" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,transparent_20%,rgba(0,0,0,0.14)_58%,rgba(0,0,0,0.72)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-36 bg-gradient-to-b from-black/82 via-black/28 to-transparent" />
        <AnimatePresence mode="wait">
          {currentVideo && (
            <motion.div
              key={`${currentVideoIdentity}:${currentVideo.primary_video.key}`}
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {/* Video iframe */}
              <div className="relative flex h-full w-full items-center justify-center bg-transparent">
                <div className={videoFrameClassName}>
                  {currentBackdrop && (
                    <div
                      className={cn(
                        "absolute inset-0 bg-cover bg-center opacity-70 blur-sm scale-105 transition-opacity duration-500",
                        videoReady && "opacity-0",
                      )}
                      style={{ backgroundImage: `url(${currentBackdrop})` }}
                      aria-hidden="true"
                    />
                  )}
                  {!currentBackdrop && (
                    <div
                      className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(233,79,55,0.22),transparent_38%),linear-gradient(180deg,#111_0%,#020202_65%,#000_100%)]"
                      aria-hidden="true"
                    />
                  )}
                  {!videoReady && !playerError && !autoplayBlocked && (
                    <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
                      <div className="h-9 w-9 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
                      <span className="rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55 backdrop-blur">
                        Loading video
                      </span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.10),transparent_58%)] mix-blend-screen" />
                  <FeedVideoPlayer
                    videoKey={currentVideo.primary_video.key}
                    reloadKey={playerReloadKey}
                    muted={muted}
                    playbackAllowed={playbackAllowed}
                    onStatus={handlePlayerStatus}
                    attachPlayer={attachPlayer}
                    title={videoTitle || `video-${currentVideo.id}`}
                    className="absolute inset-0 h-full w-full bg-black brightness-[1.08] contrast-[1.08] saturate-[1.12]"
                  />
                  {/*
                   * The feed keeps ownership of every gesture: the player host is
                   * pointer-transparent so a tap lands here (where play/pause runs
                   * inside a real user gesture) and a swipe still reaches the feed's
                   * touch handlers instead of the player's own scroll chrome.
                   */}
                  <button
                    type="button"
                    onClick={togglePlayPause}
                    aria-label={isPlaying ? "Pause video" : "Play video"}
                    className="absolute inset-0 z-[12] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
                  />
                  {autoplayBlocked && !playerError && (
                    <button
                      type="button"
                      onClick={startPlaybackFromGesture}
                      aria-label={`Play ${videoTitle || "video"}`}
                      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/40 transition hover:bg-black/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
                    >
                      <span className="grid h-16 w-16 place-items-center rounded-full border border-white/20 bg-black/25 shadow-xl shadow-black/30">
                        <Play
                          className="h-7 w-7 translate-x-px text-white"
                          fill="currentColor"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="rounded-full border border-white/15 bg-black/55 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/85">
                        Tap to play
                      </span>
                    </button>
                  )}
                  {playerError && (
                    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 px-6 text-center backdrop-blur-sm">
                      <div className="max-w-xs">
                        <p className="text-base font-bold text-white">
                          Video could not start
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-white/55">
                          Check your connection or reload this trailer.
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPlayerError(false);
                              setVideoReady(false);
                              setPlayerReloadKey((key) => key + 1);
                            }}
                            className="min-h-11 rounded-full bg-white px-4 text-sm font-bold text-black transition hover:bg-white/88"
                          >
                            Reload video
                          </button>
                          <a
                            href={`https://www.youtube.com/watch?v=${currentVideo.primary_video.key}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
                          >
                            Open YouTube
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                  {!audioUnlocked && muted && videoReady && (
                    <button
                      type="button"
                      onClick={enableAudio}
                      className="absolute left-1/2 top-24 z-30 -translate-x-1/2 rounded-full border border-white/15 bg-black/55 px-3.5 py-2 text-[11px] font-semibold text-white/85 shadow-lg backdrop-blur-md transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                    >
                      Tap for sound
                    </button>
                  )}
                </div>
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
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
              >
                <div
                  className={cn(
                    "relative flex items-end overflow-hidden",
                    videoFrameSizeClassName,
                  )}
                >
                  {/* Layer 1 — tall ambient scrim: fades video into dark over a large area */}
                  <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black via-black/68 via-[42%] to-transparent sm:h-[58%]" />

                  {/* Layer 2 — tight bottom vignette: ensures the very bottom edge is fully dark */}
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black to-transparent" />

                  {/* Content */}
                  <div className="relative w-full px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pr-20 pt-36 sm:px-6 sm:pb-7 sm:pr-28 sm:pt-40 lg:max-w-5xl lg:px-10 lg:pb-10 lg:pr-36">
                    <div className="mb-2 flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#ff725e] shadow-[0_0_10px_rgba(255,114,94,0.8)]" />
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/80">
                        {currentVideoTypeLabel}
                      </span>
                    </div>
                    <h2
                      className="mb-3 line-clamp-2 max-w-xl text-xl font-bold leading-tight tracking-normal text-white sm:text-2xl"
                      style={{
                        textShadow:
                          "0 10px 36px rgba(0,0,0,0.85), 0 2px 8px rgba(0,0,0,0.98)",
                      }}
                    >
                      {videoTitle}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-white/80">
                      {/* Rating / Upcoming badge */}
                      {Number.isFinite(Number(currentVideo.vote_average)) &&
                        (() => {
                          const va = Number(currentVideo.vote_average);
                          const isUpcomingItem = va === 0;
                          return (
                            <span
                              className={cn(
                                "inline-flex min-h-7 items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-2.5 backdrop-blur-md",
                                isUpcomingItem
                                  ? "text-indigo-200"
                                  : "text-amber-200",
                              )}
                            >
                              {!isUpcomingItem && (
                                <Star
                                  className="h-3.5 w-3.5 text-amber-300"
                                  fill="currentColor"
                                />
                              )}
                              {isUpcomingItem ? "Upcoming" : va.toFixed(1)}
                            </span>
                          );
                        })()}

                      <span className="inline-flex min-h-7 items-center rounded-full border border-white/15 bg-black/30 px-2.5 uppercase tracking-[0.12em] text-white/80 backdrop-blur-md">
                        {currentContentType}
                      </span>

                      {activeCategory === "upcoming" &&
                        currentReleaseDateLabel && (
                          <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-2.5 text-emerald-200 backdrop-blur-md">
                            <Calendar className="h-3.5 w-3.5" />
                            {currentReleaseDateLabel}
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Action Buttons — always visible, Info included */}
              <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                <div
                  className={cn(
                    "relative pointer-events-none",
                    videoFrameSizeClassName,
                  )}
                >
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
                    onInfo={() => setPanelOpen((p) => !p)}
                    className="pointer-events-auto absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-2.5 sm:bottom-6 sm:right-5 lg:bottom-8 lg:right-7"
                  />
                  {isLandscapeVideo && (
                    <button
                      type="button"
                      onClick={openMobileFullscreen}
                      aria-label="Open landscape video fullscreen"
                      className="pointer-events-auto absolute right-3 top-24 z-40 grid h-11 w-11 place-items-center rounded-full bg-black/35 text-white shadow-lg transition active:scale-90 sm:right-4 lg:hidden"
                    >
                      <Maximize2 className="h-5 w-5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── LOADING INDICATOR ───────────────────────────────────── */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-28 left-1/2 z-30 -translate-x-1/2 sm:bottom-24"
            >
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-black/60 backdrop-blur-xl rounded-full border border-white/15 shadow-xl">
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-white/80 text-xs font-semibold tracking-wide">
                  {loadingMode === "refresh"
                    ? "Refreshing"
                    : videos.length === 0
                      ? "Loading"
                      : "Loading more"}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── EMPTY STATE ─────────────────────────────────────────── */}
        <AnimatePresence>
          {feedError && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-28 left-1/2 z-40 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-red-400/25 bg-black/70 p-4 text-center shadow-2xl shadow-black/40 backdrop-blur-xl"
            >
              <p className="mb-3 text-sm font-semibold text-white/80">
                {feedError}
              </p>
              <button
                onClick={() =>
                  videos.length === 0
                    ? resetFeed("refresh")
                    : fetchMoreVideos(false)
                }
                className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/15"
              >
                Try again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {!loading && !feedError && videos.length === 0 && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Video details"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center px-6"
          >
            <div className="rounded-2xl border border-white/10 bg-black/45 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-xl">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-red-600/40"
              >
                <Sparkles className="w-9 h-9 text-white" />
              </motion.div>
              <p className="text-white text-xl font-bold mb-2">
                Nothing here yet
              </p>
              <p className="text-white/50 text-sm">
                Check back soon for new content.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── SCROLL HINT ─────────────────────────────────────────── */}
        <AnimatePresence>
          {showScrollHint && videos.length > 1 && !panelOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0.55, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-0.5 pointer-events-none sm:bottom-5 max-[760px]:hidden"
            >
              <motion.div
                animate={{ y: [0, 4, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 1.6,
                  ease: "easeInOut",
                }}
              >
                <svg
                  className="w-4 h-6 text-white/42"
                  viewBox="0 0 24 40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="2" y="2" width="20" height="36" rx="10" />
                  <circle cx="12" cy="10" r="2.5" fill="currentColor" />
                </svg>
              </motion.div>
              <span className="text-[9px] text-white/35 tracking-widest uppercase">
                Scroll
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── DETAIL PANEL ────────────────────────────────────────── */}
      <AnimatePresence>
        {isMobileFullscreen && currentVideo && isLandscapeVideo && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Fullscreen video"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black lg:hidden"
          >
            <iframe
              title={`${videoTitle} fullscreen`}
              src={fullscreenIframeSrc}
              className="aspect-video max-h-[100svh] w-full bg-black"
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <button
              type="button"
              onClick={closeMobileFullscreen}
              aria-label="Exit fullscreen video"
              className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] grid h-11 w-11 place-items-center rounded-full bg-black/65 text-white shadow-xl backdrop-blur-md transition active:scale-90"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panelOpen && currentVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] overscroll-none"
            onWheel={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
            onTouchEnd={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default bg-black/72 backdrop-blur-md"
              onClick={() => setPanelOpen(false)}
              aria-label="Dismiss details"
            />
            <motion.div
              initial={{ x: 28, opacity: 0, scale: 0.98 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 28, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-x-0 bottom-0 top-[max(10svh,env(safe-area-inset-top))] flex overflow-hidden rounded-t-[30px]
                         border border-white/12 bg-[#0b0c0f]/94 shadow-[0_-24px_80px_rgba(0,0,0,0.55)]
                         backdrop-blur-2xl sm:inset-x-3 sm:bottom-3 sm:top-[max(5rem,env(safe-area-inset-top))] sm:rounded-3xl
                         md:inset-y-6 md:left-auto md:right-6 md:w-[29rem] md:rounded-[28px] md:shadow-[0_24px_90px_rgba(0,0,0,0.62)]"
            >
              <div className="absolute left-1/2 top-2.5 z-20 h-1 w-10 -translate-x-1/2 rounded-full bg-white/25 md:hidden" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.035] via-transparent to-black/35" />

              <div
                ref={panelRef}
                className="relative flex min-h-0 flex-1 touch-pan-y flex-col overflow-y-auto overscroll-contain mobile-native-scroll"
              >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.08] bg-[#0b0c0f]/72 px-4 pb-3 pt-5 backdrop-blur-2xl sm:px-5 sm:pt-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#ff6f5c] shadow-[0_0_14px_rgba(255,111,92,0.75)]" />
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/70">
                    Details
                  </h3>
                </div>
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setPanelOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/70 transition-all hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff725e]/80"
                  aria-label="Close details"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>

              <div className="relative h-52 shrink-0 overflow-hidden border-b border-white/[0.08] sm:h-60 md:h-64">
                {currentBackdrop && !modalBackdropError ? (
                  <Image
                    src={currentBackdrop}
                    alt=""
                    fill
                    unoptimized
                    sizes="(max-width: 767px) 100vw, 464px"
                    className="object-cover object-center"
                    onError={() => setModalBackdropError(true)}
                  />
                ) : currentPoster ? (
                  <Image
                    src={currentPoster}
                    alt=""
                    fill
                    unoptimized
                    sizes="(max-width: 767px) 100vw, 464px"
                    className="scale-110 object-cover object-center blur-md"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(233,79,55,0.28),transparent_42%),linear-gradient(135deg,#18191e,#08090b)]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c0f] via-[#0b0c0f]/20 to-black/10" />
                <div className="absolute inset-x-0 bottom-0 px-4 pb-5 sm:px-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff8a76]">
                    {currentVideoTypeLabel}
                  </p>
                  <h2 className="mt-1 line-clamp-2 max-w-md text-2xl font-black leading-[1.05] tracking-[-0.025em] text-white drop-shadow-lg sm:text-3xl">
                    {currentVideo.title || currentVideo.name}
                  </h2>
                </div>
              </div>

              <div className="space-y-5 px-4 pb-5 pt-5 sm:px-5">
                <div className="flex gap-4">
                  <div
                    className="h-36 w-24 shrink-0 rounded-2xl border border-white/12 bg-white/[0.06] bg-cover bg-center shadow-xl shadow-black/40"
                    style={
                      currentPoster
                        ? { backgroundImage: `url(${currentPoster})` }
                        : undefined
                    }
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {currentYear && Number.isFinite(currentYear) && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.08] px-2.5 py-1 text-xs font-bold text-white/70">
                          <Calendar className="h-3 w-3" />
                          {currentYear}
                        </span>
                      )}
                      {currentVideo.genres?.slice(0, 2).map((genre) => (
                        <span
                          key={genre}
                          className="rounded-full border border-white/12 bg-white/[0.08] px-2.5 py-1 text-xs font-bold text-white/70"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {Number.isFinite(Number(currentVideo.vote_average)) &&
                    (() => {
                      const va = Number(currentVideo.vote_average);
                      const isUpcomingItem = va === 0;
                      return (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold
                        ${
                          isUpcomingItem
                            ? "bg-indigo-500/25 text-indigo-200 border-indigo-400/35"
                            : "bg-amber-500/25 text-amber-200 border-amber-400/35"
                        }`}
                        >
                          {!isUpcomingItem && (
                            <Star
                              className="h-3 w-3 text-amber-300"
                              fill="currentColor"
                            />
                          )}
                          {isUpcomingItem ? "Upcoming" : va.toFixed(1)}
                        </span>
                      );
                    })()}
                  <span className="rounded-full border border-white/15 bg-white/[0.08] px-2.5 py-1 text-xs font-bold uppercase text-white/70">
                    {currentContentType}
                  </span>
                  {currentVideoTypeLabel && (
                    <span className="rounded-full border border-red-400/25 bg-red-500/15 px-2.5 py-1 text-xs font-bold uppercase text-red-300">
                      {currentVideoTypeLabel}
                    </span>
                  )}
                </div>
              </div>

              <div className="mx-4 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 shadow-lg shadow-black/15 sm:mx-5">
                <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  <span className="inline-block h-3.5 w-0.5 rounded-full bg-gradient-to-b from-red-500 to-orange-500" />
                  Overview
                </h4>
                <p
                  className={`text-sm leading-6 text-white/[0.74] transition-all duration-300 ${expanded ? "" : "line-clamp-5"}`}
                >
                  {currentVideo.overview}
                </p>
                {currentVideo.overview?.length > 190 && (
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="mt-3 text-xs font-bold text-red-300 transition-colors hover:text-red-200"
                  >
                    {expanded ? "Show less" : "Read more"}
                  </button>
                )}
              </div>

              <div className="mx-4 mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:mx-5">
                <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  <span className="inline-block h-3.5 w-0.5 rounded-full bg-gradient-to-b from-red-500 to-orange-500" />
                  Info
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2 rounded-xl border border-white/[0.08] bg-black/[0.24] p-3.5">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Type
                    </div>
                    <div className="text-sm font-bold uppercase text-white">
                      {currentContentType}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-black/[0.24] p-3.5">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Video
                    </div>
                    <div className="text-sm font-bold uppercase text-white">
                      {currentVideoTypeLabel}
                    </div>
                  </div>
                  {(currentVideo.release_date ||
                    currentVideo.first_air_date) && (
                    <div className="rounded-xl border border-white/[0.08] bg-black/[0.24] p-3.5">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                        Released
                      </div>
                      <div className="text-sm font-bold text-white">
                        {new Date(
                          currentVideo.release_date ??
                            currentVideo.first_air_date!,
                        ).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                  {currentVideo.original_language && (
                    <div className="rounded-xl border border-white/[0.08] bg-black/[0.24] p-3.5">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                        Language
                      </div>
                      <div className="text-sm font-bold uppercase text-white">
                        {currentVideo.original_language}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 mt-auto border-t border-white/[0.08] bg-[#0b0c0f]/88 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-2xl sm:px-5 sm:pb-4">
                {href ? (
                  <Link href={href} prefetch shallow={false}>
                    <motion.span
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl
                                 bg-[#e94f37] px-4 py-3 text-sm font-bold text-white
                                 shadow-[0_12px_30px_rgba(233,79,55,0.22)]
                                 transition hover:bg-[#f05b43]"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Full Details
                    </motion.span>
                  </Link>
                ) : (
                  <div className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white/30">
                    <ExternalLink className="h-4 w-4" />
                    View Full Details
                  </div>
                )}
              </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * One slide, one `YT.Player`.
 *
 * The player lives in its own component so that its lifecycle is tied to the
 * exact DOM node it renders into. An exiting slide stays mounted while the next
 * one fades in, so a page-level effect can just as easily find the node that is
 * about to disappear; owning the mount here makes that impossible.
 *
 * The instance is published upward through `attachPlayer` because the page still
 * drives play/pause from its own gestures, and playback is reported through
 * `onStatus` so the UI only claims a video is ready once the player says so.
 */
function FeedVideoPlayer({
  videoKey,
  reloadKey,
  muted,
  playbackAllowed,
  onStatus,
  attachPlayer,
  title,
  className,
}: {
  videoKey: string;
  reloadKey: number;
  muted: boolean;
  playbackAllowed: boolean;
  onStatus: (status: FeedPlayerStatus) => void;
  attachPlayer: (player: YouTubePlayer | null) => void;
  title: string;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const mutedRef = useRef(muted);
  const allowedRef = useRef(playbackAllowed);

  useEffect(() => {
    allowedRef.current = playbackAllowed;
  }, [playbackAllowed]);

  useEffect(() => {
    mutedRef.current = muted;
    const player = playerRef.current;
    if (!player) return;
    try {
      if (muted) {
        player.mute();
      } else {
        player.setVolume(100);
        player.unMute();
      }
    } catch {
      /* the player is mid-teardown */
    }
  }, [muted]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;

    const mount = async () => {
      let player: YouTubePlayer | null = null;
      try {
        player = await createYouTubePlayer(host, {
          videoId: videoKey,
          playerVars: {
            autoplay: 1,
            // Always start muted — it is the only setting every autoplay policy
            // tolerates. The user's real audio preference is applied in onReady.
            mute: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            loop: 1,
            playlist: videoKey,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            cc_load_policy: 0,
            autohide: 1,
            playsinline: 1,
            vq: "hd1080",
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              const ready = event.target;
              try {
                if (mutedRef.current) ready.mute();
                else {
                  ready.setVolume(100);
                  ready.unMute();
                }
                if (allowedRef.current) ready.playVideo();
                else ready.pauseVideo();
              } catch {
                /* the player is mid-teardown */
              }
              // onReady is not "playing". Give the browser's answer a beat, then
              // trust the measured state over the request that was made.
              window.setTimeout(() => {
                if (cancelled) return;
                if (ready.getPlayerState() !== YT_PLAYER_STATE.PLAYING) {
                  onStatus("blocked");
                }
              }, 4000);
            },
            onStateChange: (event) => {
              if (cancelled) return;
              if (event.data === YT_PLAYER_STATE.PLAYING) {
                onStatus("playing");
              } else if (event.data === YT_PLAYER_STATE.PAUSED) {
                onStatus("paused");
              }
              // ENDED is deliberately ignored: loop=1 restarts the trailer, and
              // honouring that boundary would flicker the play/pause state.
            },
            onError: () => {
              if (!cancelled) onStatus("error");
            },
            // The only signal that proves the browser refused to start the video.
            // A plain embed iframe cannot report this, which is why the previous
            // implementation never noticed it happening.
            onAutoplayBlocked: () => {
              if (!cancelled) onStatus("blocked");
            },
          },
        });
      } catch {
        if (!cancelled) onStatus("error");
        return;
      }

      if (!player) return;
      if (cancelled) {
        try {
          player.destroy();
        } catch {
          /* already torn down */
        }
        return;
      }

      playerRef.current = player;
      attachPlayer(player);

      // The API builds its own iframe, so permissions and the accessible name
      // have to be applied to the node it created, not to a node we render.
      const frame = player.getIframe();
      if (frame) {
        frame.setAttribute("title", title);
        frame.setAttribute(
          "allow",
          "autoplay; encrypted-media; picture-in-picture",
        );
        frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      }
    };

    void mount();

    return () => {
      cancelled = true;
      const live = playerRef.current;
      playerRef.current = null;
      if (live) {
        attachPlayer(null);
        try {
          live.destroy();
        } catch {
          /* already torn down */
        }
      }
      host.replaceChildren();
    };
  }, [videoKey, reloadKey, title, attachPlayer, onStatus]);

  return (
    <div
      ref={hostRef}
      className={cn(className, "pointer-events-none select-none")}
    />
  );
}
