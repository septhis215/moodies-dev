"use client";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/lib/tmdb";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Heart,
  Info,
  Play,
  RefreshCw,
  Search,
  Star,
  User,
  X,
} from "lucide-react";
import styles from "./feed.module.css";
import {
  getReleaseStatus,
  getSwipeDirection,
  normalizeWheelDelta,
} from "./feed-state";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
type FeedPlayerStatus =
  | "playing"
  | "paused"
  | "buffering"
  | "blocked"
  | "error";

const feedTabs: { value: Category; label: string }[] = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
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

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingMode, setLoadingMode] = useState<LoadingMode>("initial");
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

  const [panelOpen, setPanelOpen] = useState(false);
  const {
    isLiked,
    like: addToLiked,
    unlike: removeFromLiked,
    ready: likedReady,
  } = useLiked();
  const [isPlaying, setIsPlaying] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [playerReloadKey, setPlayerReloadKey] = useState(0);
  const [isTogglingWatchlist, setIsTogglingWatchlist] = useState(false);
  const {
    isInWatchlist,
    add: addToWatchlist,
    remove: removeFromWatchlist,
  } = useWatchlist();

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const pendingNextRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Live player instance, published by the mounted slide's own player. */
  const playerRef = useRef<YouTubePlayer | null>(null);
  const manuallyPausedRef = useRef(false);
  const autoplayBlockedRef = useRef(false);
  const gatesClearRef = useRef(true);
  const [videoReady, setVideoReady] = useState(false);
  const [feedVisible, setFeedVisible] = useState(true);

  const currentVideo = videos[currentIndex];

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

  const currentContentType = currentVideo
    ? getContentType(currentVideo)
    : "movie";
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
        const base =
          process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
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
      isFetchingRef.current = false;
      const timer = window.setTimeout(() => fetchMoreVideos(true, mode), 80);
      return () => window.clearTimeout(timer);
    },
    [fetchMoreVideos, destroyActivePlayer],
  );

  useEffect(() => {
    const distanceFromEnd = videos.length - currentIndex - 1;
    if (
      videos.length > 0 &&
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

  // A native dialog supplies focus containment, Escape and background inertness.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !panelOpen) return;
    const trigger = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [panelOpen]);

  useEffect(() => {
    setPanelOpen(false);
    setVideoReady(false);
    setPlayerError(false);
    setAutoplayBlocked(false);
    manuallyPausedRef.current = false;
    setManuallyPaused(false);
    setIsPlaying(false);
    stageRef.current?.scrollTo({ top: 0 });
  }, [currentVideoIdentity]);

  useEffect(() => {
    if (
      !currentVideo ||
      videoReady ||
      autoplayBlocked ||
      manuallyPaused ||
      panelOpen ||
      !feedVisible
    )
      return;
    const timer = window.setTimeout(() => setPlayerError(true), 12000);
    return () => window.clearTimeout(timer);
  }, [
    currentVideo,
    currentVideoIdentity,
    playerReloadKey,
    videoReady,
    autoplayBlocked,
    manuallyPaused,
    panelOpen,
    feedVisible,
  ]);

  // Only uninterrupted, visible playback qualifies as watched.
  useEffect(() => {
    if (
      !currentVideo?.id ||
      !currentVideo.primary_video?.key ||
      !viewerIdRef.current ||
      !isPlaying ||
      !feedVisible ||
      panelOpen ||
      playerError ||
      autoplayBlocked
    )
      return;
    const identity = getVideoIdentity(currentVideo);
    if (reportedViewsRef.current.has(identity)) return;
    const timer = window.setTimeout(() => {
      reportedViewsRef.current.add(identity);
      const base =
        process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
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
      })
        .then((response) => {
          if (!response.ok) reportedViewsRef.current.delete(identity);
        })
        .catch(() => reportedViewsRef.current.delete(identity));
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [
    currentVideo,
    isPlaying,
    feedVisible,
    panelOpen,
    playerError,
    autoplayBlocked,
    getContentType,
    getVideoIdentity,
  ]);

  useEffect(() => {
    gatesClearRef.current = feedVisible && !panelOpen;
  }, [feedVisible, panelOpen]);

  const attachPlayer = useCallback((player: YouTubePlayer | null) => {
    playerRef.current = player;
  }, []);

  const handlePlayerStatus = useCallback((status: FeedPlayerStatus) => {
    setIsPlaying(status === "playing");
    if (status === "playing") {
      manuallyPausedRef.current = false;
      setManuallyPaused(false);
      setAutoplayBlocked(false);
      setVideoReady(true);
      setPlayerError(false);
    } else if (status === "paused" && gatesClearRef.current) {
      // Native player pauses are intentional. Never fight the viewer.
      manuallyPausedRef.current = true;
      setManuallyPaused(true);
      setVideoReady(true);
    } else if (status === "blocked") {
      setAutoplayBlocked(true);
    } else if (status === "error") {
      setPlayerError(true);
      setVideoReady(false);
    }
  }, []);

  const startPlaybackFromGesture = useCallback(() => {
    manuallyPausedRef.current = false;
    setManuallyPaused(false);
    setAutoplayBlocked(false);
    playerRef.current?.playVideo();
  }, []);

  useEffect(() => {
    autoplayBlockedRef.current = autoplayBlocked;
  }, [autoplayBlocked]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (!feedVisible || panelOpen) {
      gatesClearRef.current = false;
      player.pauseVideo();
    } else if (!manuallyPausedRef.current && !autoplayBlockedRef.current) {
      player.playVideo();
    }
  }, [feedVisible, panelOpen, currentVideoIdentity]);

  useEffect(() => {
    const update = () => setFeedVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const navigateClip = useCallback(
    (direction: -1 | 1) => {
      if (panelOpen) return;
      const next = currentIndex + direction;
      if (next >= 0 && next < videos.length) {
        pendingNextRef.current = false;
        setCurrentIndex(next);
      } else if (direction === 1 && hasMore) {
        pendingNextRef.current = true;
        if (!isFetchingRef.current) void fetchMoreVideos(false);
      }
    },
    [panelOpen, currentIndex, videos.length, hasMore, fetchMoreVideos],
  );

  useEffect(() => {
    if (!pendingNextRef.current) return;
    if (currentIndex + 1 < videos.length) {
      pendingNextRef.current = false;
      setCurrentIndex((i) => i + 1);
    } else if (!hasMore || feedError) {
      pendingNextRef.current = false;
    }
  }, [videos.length, currentIndex, hasMore, feedError]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || panelOpen) return;
    let wheelTotal = 0;
    let lastWheel = 0;
    let lockedUntil = 0;
    let touch: { x: number; y: number } | null = null;
    const interactive = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(
        target.closest(
          "button, a, input, select, textarea, iframe, dialog, [data-player]",
        ),
      );
    const wheel = (event: WheelEvent) => {
      if (
        interactive(event.target) ||
        event.ctrlKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      )
        return;
      const stage = stageRef.current;
      // Short screens retain ordinary vertical scrolling before clip navigation.
      if (stage && stage.scrollHeight > stage.clientHeight + 1) return;
      event.preventDefault();
      const now = performance.now();
      if (now < lockedUntil) {
        lastWheel = now;
        return;
      }
      if (now - lastWheel < 180 && wheelTotal === 0) {
        lastWheel = now;
        return;
      }
      if (
        now - lastWheel > 180 ||
        Math.sign(event.deltaY) !== Math.sign(wheelTotal)
      )
        wheelTotal = 0;
      lastWheel = now;
      wheelTotal += normalizeWheelDelta(
        event.deltaY,
        event.deltaMode,
        container.clientHeight,
      );
      if (Math.abs(wheelTotal) >= 90) {
        navigateClip(wheelTotal > 0 ? 1 : -1);
        wheelTotal = 0;
        lockedUntil = now + 650;
      }
    };
    const touchStart = (event: TouchEvent) => {
      if (interactive(event.target) || event.touches.length !== 1) {
        touch = null;
        return;
      }
      const stage = stageRef.current;
      if (stage && stage.scrollHeight > stage.clientHeight + 1) return;
      touch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    };
    const touchEnd = (event: TouchEvent) => {
      if (!touch || !event.changedTouches.length) return;
      const end = event.changedTouches[0];
      const direction = getSwipeDirection(
        end.clientX - touch.x,
        end.clientY - touch.y,
      );
      touch = null;
      if (direction && performance.now() >= lockedUntil) {
        lockedUntil = performance.now() + 650;
        navigateClip(direction);
      }
    };
    const cancel = () => {
      touch = null;
    };
    const keyboard = (event: KeyboardEvent) => {
      if (
        interactive(event.target) ||
        (event.target instanceof HTMLElement && event.target.isContentEditable)
      )
        return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!event.repeat) navigateClip(event.key === "ArrowDown" ? 1 : -1);
      }
    };
    container.addEventListener("wheel", wheel, { passive: false });
    container.addEventListener("touchstart", touchStart, { passive: true });
    container.addEventListener("touchend", touchEnd, { passive: true });
    container.addEventListener("touchcancel", cancel);
    window.addEventListener("keydown", keyboard);
    return () => {
      container.removeEventListener("wheel", wheel);
      container.removeEventListener("touchstart", touchStart);
      container.removeEventListener("touchend", touchEnd);
      container.removeEventListener("touchcancel", cancel);
      window.removeEventListener("keydown", keyboard);
    };
  }, [panelOpen, navigateClip]);

  const videoTitle = currentVideo?.title || currentVideo?.name || "Untitled";
  const releaseDate =
    currentVideo?.release_date || currentVideo?.first_air_date;
  const releaseStatus = getReleaseStatus(releaseDate);
  const releaseLabel =
    releaseDate && releaseStatus !== "unknown"
      ? new Date(`${releaseDate}T12:00:00`).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Date to be announced";
  const videoType =
    currentVideo?.video_type_label ||
    currentVideo?.primary_video?.video_type_label ||
    currentVideo?.primary_video?.type ||
    "Video";
  const aspectRatio =
    currentVideo?.aspect_ratio ?? currentVideo?.primary_video?.aspect_ratio;
  const isPortrait =
    (currentVideo?.orientation ?? currentVideo?.primary_video?.orientation) ===
      "portrait" ||
    (typeof aspectRatio === "number" && aspectRatio > 0 && aspectRatio < 1);
  const rating = Number(currentVideo?.vote_average);
  const playbackAllowed = feedVisible && !panelOpen && !manuallyPaused;
  const canGoNext = currentIndex < videos.length - 1 || hasMore;

  const reloadPlayer = () => {
    setPlayerError(false);
    setVideoReady(false);
    setAutoplayBlocked(false);
    manuallyPausedRef.current = false;
    setManuallyPaused(false);
    setPlayerReloadKey((key) => key + 1);
  };

  return (
    <div ref={containerRef} className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" aria-label="Moodies home" className={styles.logo}>
          <img src="/images/logo-b.png" alt="" width={28} height={28} />
          <span className={styles.brand}>Moodies Feed</span>
        </Link>
        <nav aria-label="Feed category" className={styles.tabs}>
          {feedTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={activeCategory === tab.value}
              className={
                activeCategory === tab.value ? styles.selectedTab : undefined
              }
              onClick={() => {
                pendingNextRef.current = false;
                setActiveCategory(tab.value);
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <button
            type="button"
            aria-label="Refresh feed"
            disabled={loading}
            onClick={() => {
              pendingNextRef.current = false;
              resetFeed("refresh");
            }}
          >
            <RefreshCw size={20} />
          </button>
          <Link href="/search" aria-label="Search">
            <Search size={20} />
          </Link>
          <Link
            href={user ? "/profile" : "/auth/login"}
            aria-label={user ? "Your profile" : "Sign in"}
          >
            <User size={20} />
          </Link>
        </div>
      </header>

      <main ref={stageRef} className={styles.stage} aria-label="Moodies Feed">
        {currentVideo ? (
          <section className={styles.screening} aria-labelledby="clip-title">
            <div
              data-player
              className={cn(styles.player, isPortrait && styles.portrait)}
              style={{
                aspectRatio: isPortrait
                  ? aspectRatio || 9 / 16
                  : aspectRatio || 16 / 9,
              }}
            >
              <FeedVideoPlayer
                key={currentVideoIdentity}
                videoKey={currentVideo.primary_video.key}
                reloadKey={playerReloadKey}
                muted={muted}
                playbackAllowed={playbackAllowed}
                onStatus={handlePlayerStatus}
                attachPlayer={attachPlayer}
                onMuteChange={setMuted}
                title={videoTitle}
                className={styles.playerHost}
              />
            </div>
            <div className={styles.caption}>
              <div className={styles.titleBlock}>
                <p className="ui-kicker">{videoType}</p>
                <h1
                  id="clip-title"
                  className="mt-1 text-3xl font-bold leading-none sm:text-4xl"
                >
                  {videoTitle}
                </h1>
                <p className={styles.meta}>
                  <span>
                    {getContentType(currentVideo) === "tv"
                      ? "TV series"
                      : "Movie"}
                  </span>
                  <span>
                    {releaseStatus === "upcoming"
                      ? "Upcoming"
                      : releaseDate?.slice(0, 4) || "Date TBA"}
                  </span>
                  {Number.isFinite(rating) && rating > 0 ? (
                    <span className={styles.rating}>
                      <Star size={14} aria-hidden="true" /> {rating.toFixed(1)}
                      <span className="sr-only"> out of 10</span>
                    </span>
                  ) : (
                    <span>Not rated</span>
                  )}
                </p>
              </div>
              <div className={styles.actions} aria-label="Title actions">
                <button
                  type="button"
                  aria-pressed={liked}
                  onClick={handleLikeToggle}
                >
                  <Heart size={20} fill={liked ? "currentColor" : "none"} />{" "}
                  <span>{liked ? "Liked" : "Like"}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={inWatchlist}
                  disabled={isTogglingWatchlist}
                  onClick={handleWatchlistToggle}
                >
                  <Bookmark
                    size={20}
                    fill={inWatchlist ? "currentColor" : "none"}
                  />{" "}
                  <span>{inWatchlist ? "Saved" : "Save"}</span>
                </button>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={panelOpen}
                  aria-controls="clip-details"
                  onClick={() => setPanelOpen(true)}
                >
                  <Info size={20} /> Details
                </button>
              </div>
            </div>
            <div className={styles.playbackStatus} role="status">
              {playerError ? (
                <>
                  <span>This clip could not play.</span>
                  <button type="button" onClick={reloadPlayer}>
                    Retry
                  </button>
                  {canGoNext && (
                    <button type="button" onClick={() => navigateClip(1)}>
                      Skip clip
                    </button>
                  )}
                  <a
                    href={`https://www.youtube.com/watch?v=${currentVideo.primary_video.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open YouTube
                  </a>
                </>
              ) : autoplayBlocked ? (
                <>
                  <span>Autoplay is paused.</span>
                  <button type="button" onClick={startPlaybackFromGesture}>
                    <Play size={16} /> Play clip
                  </button>
                </>
              ) : (
                <span>
                  {!videoReady
                    ? "Loading clip…"
                    : isPlaying
                      ? "Playing · Sound and captions in player"
                      : manuallyPaused
                        ? "Paused · Resume in player"
                        : "Buffering…"}
                </span>
              )}
            </div>
          </section>
        ) : (
          <section className={styles.empty} aria-labelledby="feed-state-title">
            <p className="ui-kicker">Moodies Feed</p>
            <h1
              id="feed-state-title"
              className="text-3xl font-bold sm:text-4xl"
            >
              {loading
                ? "Preparing your screening"
                : feedError
                  ? "Couldn’t load the feed"
                  : "You’re all caught up"}
            </h1>
            <p className="text-sm leading-6 text-[var(--ink-muted)]">
              {loading
                ? "Finding your next trailer."
                : feedError ||
                  "Try another category or refresh for more clips."}
            </p>
            {!loading && (
              <button
                type="button"
                className="ui-primary-action"
                onClick={() => resetFeed("refresh")}
              >
                Try again
              </button>
            )}
          </section>
        )}
      </main>

      <footer className={styles.footer}>
        {feedError && currentVideo && (
          <div role="alert" className={styles.feedError}>
            <span>{feedError}</span>
            <button type="button" onClick={() => fetchMoreVideos(false)}>
              Retry loading
            </button>
          </div>
        )}
        <nav className={styles.navigation} aria-label="Clip navigation">
          <button
            type="button"
            onClick={() => navigateClip(-1)}
            disabled={!currentVideo || currentIndex === 0}
          >
            <ArrowUp size={18} /> Previous<span className="sr-only"> clip</span>
          </button>
          <span className={styles.position}>
            {loadingMode === "more"
              ? "Loading more…"
              : currentVideo
                ? `Clip ${indexOffsetRef.current + currentIndex + 1}`
                : "Trailers & clips"}
          </span>
          <button
            type="button"
            onClick={() => navigateClip(1)}
            disabled={
              !currentVideo ||
              !canGoNext ||
              (loading && currentIndex === videos.length - 1)
            }
          >
            Next<span className="sr-only"> clip</span>
            <ArrowDown size={18} />
          </button>
        </nav>
        {currentVideo && !canGoNext && (
          <p className={styles.endNote}>
            You’ve reached the end. Try Upcoming or refresh the feed.
          </p>
        )}
      </footer>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {currentVideo ? `Now showing: ${videoTitle}. ${videoType}.` : ""}
      </p>
      <dialog
        ref={dialogRef}
        id="clip-details"
        className={styles.dialog}
        aria-labelledby="details-title"
        aria-describedby="details-overview"
        onCancel={() => setPanelOpen(false)}
        onClose={() => setPanelOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setPanelOpen(false);
        }}
      >
        <div className={styles.details}>
          <div className={styles.detailsHeader}>
            <p className="ui-kicker">About this title</p>
            <button
              type="button"
              autoFocus
              aria-label="Close details"
              onClick={() => setPanelOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          <h2 id="details-title" className="text-3xl font-bold leading-none">
            {videoTitle}
          </h2>
          <p className={styles.meta}>
            {currentContentType === "tv" ? "TV series" : "Movie"} ·{" "}
            {releaseStatus === "upcoming" ? "Upcoming" : "Release"} ·{" "}
            {releaseLabel}
          </p>
          <p id="details-overview" className={styles.overview}>
            {currentVideo?.overview || "No synopsis available yet."}
          </p>
          <dl className={styles.facts}>
            <div>
              <dt>Clip</dt>
              <dd>{videoType}</dd>
            </div>
            <div>
              <dt>Language</dt>
              <dd>
                {currentVideo?.original_language?.toUpperCase() ||
                  "Not specified"}
              </dd>
            </div>
            <div>
              <dt>Rating</dt>
              <dd>
                {Number.isFinite(rating) && rating > 0
                  ? `${rating.toFixed(1)} / 10`
                  : "Not rated"}
              </dd>
            </div>
            {!!currentVideo?.genres?.length && (
              <div>
                <dt>Genres</dt>
                <dd>{currentVideo.genres.join(", ")}</dd>
              </div>
            )}
          </dl>
          {href && (
            <Link href={href} className="ui-primary-action mt-6">
              View full details
            </Link>
          )}
        </div>
      </dialog>
    </div>
  );
}

function FeedVideoPlayer({
  videoKey,
  reloadKey,
  muted,
  playbackAllowed,
  onStatus,
  attachPlayer,
  onMuteChange,
  title,
  className,
}: {
  videoKey: string;
  reloadKey: number;
  muted: boolean;
  playbackAllowed: boolean;
  onStatus: (status: FeedPlayerStatus) => void;
  attachPlayer: (player: YouTubePlayer | null) => void;
  onMuteChange: (muted: boolean) => void;
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
    let soundTimer: number | undefined;

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
            controls: 1,
            disablekb: 0,
            fs: 1,
            loop: 1,
            playlist: videoKey,
            rel: 0,
            iv_load_policy: 3,
            playsinline: 1,
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
              soundTimer = window.setInterval(() => {
                if (!cancelled) {
                  try {
                    onMuteChange(ready.isMuted());
                  } catch {
                    /* teardown */
                  }
                }
              }, 500);
            },
            onStateChange: (event) => {
              if (cancelled) return;
              if (event.data === YT_PLAYER_STATE.PLAYING) {
                onStatus("playing");
              } else if (event.data === YT_PLAYER_STATE.PAUSED) {
                onStatus("paused");
              } else if (event.data === YT_PLAYER_STATE.BUFFERING) {
                onStatus("buffering");
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
          "autoplay; encrypted-media; picture-in-picture; fullscreen",
        );
        frame.setAttribute("allowfullscreen", "");
        frame.style.width = "100%";
        frame.style.height = "100%";
        frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      }
    };

    void mount();

    return () => {
      cancelled = true;
      if (soundTimer !== undefined) window.clearInterval(soundTimer);
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
  }, [videoKey, reloadKey, title, attachPlayer, onStatus, onMuteChange]);

  return <div ref={hostRef} className={className} />;
}
