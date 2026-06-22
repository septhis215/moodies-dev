"use client";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clapperboard,
  ExternalLink,
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
import Image from "next/image";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useLiked } from "@/hooks/useLiked";
import { useAuth } from "@/app/context/AuthProvider";

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

  const [muted, setMuted] = useState<boolean>(() => {
    try {
      const s =
        typeof window !== "undefined"
          ? localStorage.getItem("videoMuted")
          : null;
      return s === null ? true : s === "true";
    } catch {
      return true;
    }
  });

  const [panelOpen, setPanelOpen] = useState(false);
  const {
    isLiked,
    like: addToLiked,
    unlike: removeFromLiked,
    ready: likedReady,
  } = useLiked();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isTogglingWatchlist, setIsTogglingWatchlist] = useState(false);
  const {
    isInWatchlist,
    add: addToWatchlist,
    remove: removeFromWatchlist,
  } = useWatchlist();

  const panelRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());
  const firstUserGestureRef = useRef(false);
  const isPlayingRef = useRef(true);
  const panelWasOpenRef = useRef(false);
  const wasPlayingBeforePanelRef = useRef(true);
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
        ? `https://image.tmdb.org/t/p/w200${currentVideo.poster_path}`
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
            ? `https://image.tmdb.org/t/p/w200${currentVideo.poster_path}`
            : null,
          variant: "info",
          duration: 3500,
        });
      } else {
        await addToWatchlist(String(currentVideo.id), watchType, {
          title: currentVideo.title || currentVideo.name,
          posterUrl: currentVideo.poster_path
            ? `https://image.tmdb.org/t/p/w200${currentVideo.poster_path}`
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
        const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
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
  const cleanupOldVideos = useCallback(() => {
    const videosAhead = videos.length - currentIndex;
    if (currentIndex > CLEANUP_THRESHOLD && videosAhead > WINDOW_SIZE / 2) {
      const keepFrom = Math.max(0, currentIndex - 2);
      if (keepFrom > 0) {
        setVideos((prev) => {
          const newVideos = prev.slice(keepFrom);
          prev
            .slice(0, keepFrom)
            .forEach((video) =>
              videoRefs.current.delete(getVideoIdentity(video)),
            );
          return newVideos;
        });
        indexOffsetRef.current += keepFrom;
        setCurrentIndex((prev) => prev - keepFrom);
      }
    }
  }, [
    currentIndex,
    videos.length,
    CLEANUP_THRESHOLD,
    WINDOW_SIZE,
    getVideoIdentity,
  ]);

  const resetFeed = useCallback(
    (mode: LoadingMode = "initial") => {
      fetchGenerationRef.current += 1;
      fetchAbortRef.current?.abort();
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      videoRefs.current.clear();
      setVideoReady(false);
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
    [fetchMoreVideos],
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
  }, [currentIndex]);

  useEffect(() => {
    if (!currentVideo?.id || !currentVideo.primary_video?.key) return;
    if (!viewerIdRef.current) return;

    const identity = getVideoIdentity(currentVideo);
    if (reportedViewsRef.current.has(identity)) return;

    const timer = window.setTimeout(() => {
      reportedViewsRef.current.add(identity);
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
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
    try {
      localStorage.setItem("videoMuted", String(muted));
    } catch {}
  }, [muted]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const sendYouTubeCommand = (
    iframe: HTMLIFrameElement | undefined | null,
    func: string,
    args: unknown[] = [],
  ) => {
    if (!iframe) return;
    try {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }),
        "*",
      );
    } catch {}
  };

  const pauseInactiveVideos = useCallback(
    (activeIdentity?: string) => {
      videoRefs.current.forEach((iframe, identity) => {
        if (identity !== activeIdentity) sendYouTubeCommand(iframe, "pauseVideo", []);
      });
    },
    [],
  );

  const playActiveVideo = useCallback(() => {
    if (!currentVideo || !feedVisible || panelOpen) return;
    const iframe = videoRefs.current.get(currentVideoIdentity);
    if (!iframe) return;

    pauseInactiveVideos(currentVideoIdentity);
    sendYouTubeCommand(iframe, "mute", []);
    sendYouTubeCommand(iframe, "playVideo", []);
    if (firstUserGestureRef.current && !muted) {
      sendYouTubeCommand(iframe, "unMute", []);
    }
    setIsPlaying(true);
  }, [
    currentVideo,
    currentVideoIdentity,
    feedVisible,
    muted,
    panelOpen,
    pauseInactiveVideos,
  ]);

  const toggleMute = useCallback(() => {
    firstUserGestureRef.current = true;
    setMuted((prev) => {
      const next = !prev;
      const iframe = currentVideo
        ? videoRefs.current.get(currentVideoIdentity)
        : undefined;
      if (iframe) {
        sendYouTubeCommand(iframe, next ? "mute" : "unMute");
        sendYouTubeCommand(iframe, "playVideo", []);
        setIsPlaying(true);
      }
      return next;
    });
  }, [currentVideo, currentVideoIdentity]);

  useEffect(() => {
    if (!currentVideo) return;
    const iframe = videoRefs.current.get(currentVideoIdentity);
    if (iframe) {
      const t = window.setTimeout(
        () => {
          if (muted) sendYouTubeCommand(iframe, "mute");
          else if (firstUserGestureRef.current) sendYouTubeCommand(iframe, "unMute");
        },
        250,
      );
      return () => clearTimeout(t);
    }
  }, [currentVideo, currentVideo?.id, currentVideoIdentity, muted]);

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

  useEffect(() => {
    if (!currentVideo) return;
    const activeIframe = videoRefs.current.get(currentVideoIdentity);
    pauseInactiveVideos(currentVideoIdentity);
    setIsPlaying(feedVisible);
    const t = window.setTimeout(() => {
      playActiveVideo();
    }, 350);
    return () => {
      clearTimeout(t);
      sendYouTubeCommand(activeIframe, "pauseVideo", []);
    };
  }, [
    currentVideo,
    currentVideo?.id,
    currentVideoIdentity,
    feedVisible,
    pauseInactiveVideos,
    playActiveVideo,
  ]);

  useEffect(() => {
    const wasOpen = panelWasOpenRef.current;

    if (panelOpen && !wasOpen) {
      wasPlayingBeforePanelRef.current = isPlayingRef.current;
      const iframe = videoRefs.current.get(currentVideoIdentity);
      sendYouTubeCommand(iframe, "pauseVideo", []);
      setIsPlaying(false);
    } else if (
      !panelOpen &&
      wasOpen &&
      wasPlayingBeforePanelRef.current &&
      feedVisible
    ) {
      window.setTimeout(() => playActiveVideo(), 180);
    }

    panelWasOpenRef.current = panelOpen;
  }, [currentVideoIdentity, feedVisible, panelOpen, playActiveVideo]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === "visible";
      setFeedVisible(visible);
      const iframe = currentVideo
        ? videoRefs.current.get(currentVideoIdentity)
        : undefined;
      if (!visible) {
        videoRefs.current.forEach((videoIframe) =>
          sendYouTubeCommand(videoIframe, "pauseVideo", []),
        );
        setIsPlaying(false);
        return;
      }
      if (iframe) window.setTimeout(() => playActiveVideo(), 180);
    };

    const handleBlur = () => {
      setFeedVisible(false);
      videoRefs.current.forEach((iframe) =>
        sendYouTubeCommand(iframe, "pauseVideo", []),
      );
      setIsPlaying(false);
    };

    const handleFocus = () => {
      setFeedVisible(true);
      window.setTimeout(() => playActiveVideo(), 180);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [currentVideo, currentVideoIdentity, playActiveVideo]);

  useEffect(() => {
    if (!currentVideo) return;
    const onFirstGesture = () => {
      if (firstUserGestureRef.current) return;
      firstUserGestureRef.current = true;
      const iframe = videoRefs.current.get(currentVideoIdentity);
      if (iframe) {
        if (!muted) sendYouTubeCommand(iframe, "unMute", []);
        sendYouTubeCommand(iframe, "playVideo", []);
        setIsPlaying(true);
      }
    };
    window.addEventListener("click", onFirstGesture, {
      once: true,
      passive: true,
    });
    window.addEventListener("touchend", onFirstGesture, {
      once: true,
      passive: true,
    });
    return () => {
      try {
        window.removeEventListener("click", onFirstGesture);
        window.removeEventListener("touchend", onFirstGesture);
      } catch {}
    };
  }, [currentVideo, currentVideo?.id, currentVideoIdentity, muted]);

  const iframeSrc = useMemo(() => {
    if (!currentVideo?.primary_video?.key) return "";
    const key = currentVideo.primary_video.key;
    const origin =
      typeof window !== "undefined"
        ? encodeURIComponent(window.location.origin)
        : "";
    return `https://www.youtube.com/embed/${key}?autoplay=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&cc_load_policy=0&autohide=1&showinfo=0&modestbranding=1&rel=0&loop=1&playlist=${key}&enablejsapi=1&playsinline=1&mute=1&vq=hd1080&origin=${origin}`;
  }, [currentVideo?.primary_video?.key]);

  const togglePlayPause = () => {
    if (!currentVideo) return;
    const iframe = videoRefs.current.get(currentVideoIdentity);
    if (!iframe) return;
    firstUserGestureRef.current = true;
    if (isPlaying) {
      sendYouTubeCommand(iframe, "pauseVideo", []);
      setIsPlaying(false);
    } else {
      playActiveVideo();
    }
  };

  const videoTitle = currentVideo?.title || currentVideo?.name || "";
  const currentPoster = currentVideo?.poster_path
    ? `https://image.tmdb.org/t/p/w342${currentVideo.poster_path}`
    : null;
  const currentBackdrop = currentVideo?.backdrop_path
    ? `https://image.tmdb.org/t/p/w780${currentVideo.backdrop_path}`
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
  const videoFrameSizeClassName = cn(
    isPortraitVideo
      ? "h-[100svh] w-screen max-w-none lg:h-[calc(100svh-1rem)] lg:w-[calc((100svh-1rem)*0.5625)]"
      : "h-[100svh] w-screen max-w-none lg:h-[100svh] lg:w-screen",
  );
  const videoFrameClassName = cn(
    "relative isolate overflow-hidden bg-black",
    videoFrameSizeClassName,
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed inset-0 h-[100svh] w-full overflow-hidden overscroll-none bg-black",
        panelOpen ? "touch-pan-y" : "touch-none",
      )}
    >
      {/* ── TOP NAVBAR ──────────────────────────────────────────── */}
      <motion.nav
        initial={{ y: -56, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="pointer-events-none fixed left-0 right-0 top-0 z-50 px-3 pt-3 sm:px-5"
      >
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
          <Link
            href="/"
            className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20 shadow-xl shadow-black/20 backdrop-blur-md transition hover:bg-black/35 sm:h-11 sm:w-11"
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
            <div className="pointer-events-auto grid w-full max-w-[21rem] grid-cols-2 gap-1 rounded-full border border-white/10 bg-black/20 p-1 shadow-xl shadow-black/20 backdrop-blur-md transition-colors hover:bg-black/30 sm:max-w-[24rem]">
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
                        "hidden text-white/70 sm:block",
                        activeCategory === tab.value && "text-[#ff8a78]",
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

          <div className="pointer-events-auto flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-black/20 p-1 shadow-xl shadow-black/20 backdrop-blur-md transition-colors hover:bg-black/30">
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
                  loadingMode === "refresh" && "animate-spin",
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
            className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-45 blur-2xl"
            style={{ backgroundImage: `url(${currentBackdrop})` }}
            aria-hidden="true"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-black/42" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/45 via-black/10 to-transparent" />
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
                  {!videoReady && (
                    <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
                      <div className="h-9 w-9 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
                      <span className="rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55 backdrop-blur">
                        Loading video
                      </span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.10),transparent_58%)] mix-blend-screen" />
                  <iframe
                    ref={(el) => {
                      if (el && currentVideo) {
                        videoRefs.current.set(currentVideoIdentity, el);
                      } else {
                        videoRefs.current.delete(currentVideoIdentity);
                      }
                    }}
                    title={videoTitle || `video-${currentVideo.id}`}
                    src={iframeSrc}
                    className="absolute inset-0 h-full w-full bg-black brightness-[1.08] contrast-[1.04] saturate-[1.08]"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    style={{ border: "none", pointerEvents: "none" }}
                    onLoad={(e) => {
                      const iframe = e.currentTarget as HTMLIFrameElement;
                      if (currentVideo)
                        videoRefs.current.set(currentVideoIdentity, iframe);
                      setVideoReady(true);
                      setTimeout(() => {
                        playActiveVideo();
                      }, 300);
                    }}
                  />
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/68 via-black/18 to-transparent lg:from-black/58 lg:via-black/14" />

                {/* Layer 2 — tight bottom vignette: ensures the very bottom edge is fully dark */}
                <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/44 to-transparent lg:h-20 lg:from-black/34" />

                {/* Content */}
                <div className="relative w-full px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pr-20 pt-24 sm:pr-24 lg:px-8 lg:pb-7 lg:pr-32 lg:pt-28">
                  <h2
                    className="mb-2 line-clamp-2 text-xl font-bold leading-tight text-white lg:text-2xl"
                    style={{
                      textShadow:
                        "0 1px 12px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.8)",
                    }}
                  >
                    {videoTitle}
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Rating / Upcoming badge */}
                    {Number.isFinite(Number(currentVideo.vote_average)) &&
                      (() => {
                        const va = Number(currentVideo.vote_average);
                        const isUpcomingItem = va === 0;
                        return (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border
                          ${
                            isUpcomingItem
                              ? "bg-indigo-500/30 text-indigo-200 border-indigo-400/40"
                              : "bg-amber-500/30 text-amber-200 border-amber-400/40"
                          }`}
                          >
                            {!isUpcomingItem && (
                              <Star
                                className="w-3 h-3 text-amber-300"
                                fill="currentColor"
                              />
                            )}
                            {isUpcomingItem ? "Upcoming" : va.toFixed(1)}
                          </span>
                        );
                      })()}

                    <span className="px-2 py-0.5 rounded-md text-xs font-bold uppercase border bg-white/10 text-white/80 border-white/20">
                      {currentContentType}
                    </span>

                    {activeCategory === "upcoming" &&
                      currentReleaseDateLabel && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border bg-emerald-500/20 text-emerald-200 border-emerald-400/30">
                          <Calendar className="w-3 h-3" />
                          {currentReleaseDateLabel}
                        </span>
                      )}

                    <span className="px-2 py-0.5 rounded-md text-xs font-bold uppercase border bg-red-500/20 text-red-300 border-red-400/30">
                      {currentVideoTypeLabel}
                    </span>
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
                    className="pointer-events-auto absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-2.5 sm:bottom-4 sm:right-4 lg:bottom-5 lg:right-5"
                  />
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
              className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-sm"
              onClick={() => setPanelOpen(false)}
              aria-label="Dismiss details"
            />
            <motion.div
              initial={{ x: 28, opacity: 0, scale: 0.98 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 28, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] top-[max(4rem,env(safe-area-inset-top))] flex overflow-hidden rounded-2xl
                         border border-white/12 bg-black/75 shadow-2xl shadow-black/50
                         backdrop-blur-2xl sm:inset-x-3 sm:bottom-3 sm:rounded-3xl md:inset-y-4 md:left-auto md:right-4 md:w-[25rem]"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-black/30" />
              {currentBackdrop && (
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-cover bg-center opacity-28 blur-sm"
                  style={{ backgroundImage: `url(${currentBackdrop})` }}
                />
              )}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-black/20 via-black/72 to-transparent" />

              <div
                ref={panelRef}
                className="relative flex min-h-0 flex-1 touch-pan-y flex-col overflow-y-auto overscroll-contain mobile-native-scroll"
              >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur-2xl sm:px-5">
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
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition-all hover:bg-white/12 hover:text-white"
                  aria-label="Close details"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>

              <div className="space-y-5 px-4 pb-5 pt-4 sm:px-5">
                <div className="flex gap-4">
                  <div
                    className="h-32 w-[5.5rem] shrink-0 rounded-2xl border border-white/12 bg-white/[0.06] bg-cover bg-center shadow-xl shadow-black/30"
                    style={
                      currentPoster
                        ? { backgroundImage: `url(${currentPoster})` }
                        : undefined
                    }
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1 pt-1">
                    <h2 className="mb-3 line-clamp-3 text-xl font-black leading-tight text-white">
                      {currentVideo.title || currentVideo.name}
                    </h2>
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

              <div className="mx-4 rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-lg shadow-black/15 sm:mx-5">
                <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  <span className="inline-block h-3.5 w-0.5 rounded-full bg-gradient-to-b from-red-500 to-orange-500" />
                  Overview
                </h4>
                <p
                  className={`text-sm leading-relaxed text-white/[0.72] transition-all duration-300 ${expanded ? "" : "line-clamp-5"}`}
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

              <div className="mx-4 mt-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4 sm:mx-5">
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

              <div className="sticky bottom-0 mt-auto border-t border-white/10 bg-black/45 px-4 py-4 backdrop-blur-2xl sm:px-5">
                {href ? (
                  <Link href={href} prefetch shallow={false}>
                    <motion.span
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl
                                 bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3
                                 text-sm font-bold text-white shadow-md shadow-red-600/30
                                 transition-shadow hover:shadow-red-600/50"
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
