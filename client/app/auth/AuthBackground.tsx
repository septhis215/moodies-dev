"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// Extend window for the YouTube IFrame API
declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: Record<string, unknown>,
      ) => YTPlayer;
      PlayerState?: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
        UNSTARTED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YTPlayer = {
  destroy: () => void;
  getPlayerState: () => number;
  getDuration: () => number;
  getCurrentTime: () => number;
  playVideo: () => void;
  mute: () => void;
  unMute: () => void;
};

type VideoStatus = "loading" | "playing" | "ended" | "error" | "blocked";

type Slide = {
  backdrop: string;
  title?: string;
  id?: number;
  kind?: "movie" | "tv";
};
type Props = { slides: Slide[]; rotationMs?: number };

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

/** Fisher-Yates shuffle — returns a new array, doesn't mutate the original. */
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Loads the YouTube IFrame API once and returns the YT namespace. */
function loadYouTubeApi(): Promise<NonNullable<typeof window.YT>> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("No window"));
    if (window.YT?.Player) return resolve(window.YT);

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevReady) prevReady();
      if (window.YT) resolve(window.YT);
      else reject(new Error("YouTube API failed to load"));
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      tag.onerror = () => reject(new Error("YouTube script failed"));
      document.body.appendChild(tag);
    }
  });
}

export default function AuthBackground({ slides, rotationMs = 10000 }: Props) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"image" | "video">("image");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [trailerKeys, setTrailerKeys] = useState<Record<number, string>>({});
  const [videoStatus, setVideoStatus] = useState<VideoStatus>("loading");
  const playerRef = useRef<YTPlayer | null>(null);
  const playerIdRef = useRef(`yt-player-${Math.random().toString(36).slice(2, 9)}`);
  const audioEnabledRef = useRef(audioEnabled);
  const pathname = usePathname();
  const isLogin = pathname.includes("/auth/login");

  // Keep the latest audio preference available inside callbacks without
  // recreating the player every time the toggle is pressed.
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  // Shuffle slides once on mount so the order is never the same across visits
  const shuffledSlides = useMemo(() => shuffleArray(slides), [slides]);

  // Durations: image is a brief intro; video timeout is a max-play guard
  // (real ended/error events now drive the transition).
  const imageDuration = Math.max(6000, rotationMs / 2);
  const videoDuration = Math.max(30000, Math.round(rotationMs * 3));

  const current = shuffledSlides[idx] ?? shuffledSlides[0];
  const currentKey =
    videoEnabled && current?.id != null ? trailerKeys[current.id] : undefined;
  const hasVideo = Boolean(currentKey);
  const shouldShowAudioButton = videoEnabled || hasVideo;
  const isVideoPhase = phase === "video" && hasVideo;

  // Progressive enhancement: only on desktop, only when motion is allowed,
  // and only once the browser is idle (so the form stays instantly interactive).
  // Falls back silently to the image backdrop if anything is unavailable.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!isDesktop || reduced) return;

    let cancelled = false;

    const start = async () => {
      try {
        const items = shuffledSlides
          .filter(
            (s) =>
              typeof s.id === "number" && (s.kind === "movie" || s.kind === "tv"),
          )
          .map((s) => ({ type: s.kind as "movie" | "tv", id: s.id as number }));
        if (items.length === 0) return;

        const res = await fetch(`${API_BASE}/all/batch/trailers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(items),
        });
        if (!res.ok) return;

        const data: Record<string, string | null> = await res.json();
        const map: Record<number, string> = {};
        for (const s of shuffledSlides) {
          if (typeof s.id !== "number" || !s.kind) continue;
          const key = data[`${s.kind}-${s.id}`];
          if (key) map[s.id] = key;
        }

        if (!cancelled) {
          setTrailerKeys(map);
          setVideoEnabled(true);
        }
      } catch {
        /* silently fall back to image backdrop */
      }
    };

    const handle = window.setTimeout(start, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [shuffledSlides]);

  useEffect(() => {
    if (!shuffledSlides.length) return;

    setPhase("image");
    setVideoStatus("loading");
  }, [idx, shuffledSlides.length]);

  // Immediate transition when a video ends, errors, or is blocked.
  useEffect(() => {
    if (!shuffledSlides.length) return;
    if (phase !== "video") return;

    const isVideoFailed =
      videoStatus === "ended" || videoStatus === "error" || videoStatus === "blocked";

    if (isVideoFailed || !hasVideo) {
      setIdx((currentIdx) => {
        if (shuffledSlides.length <= 1) return 0;
        const nextIdx = (currentIdx + 1) % shuffledSlides.length;
        return nextIdx === currentIdx ? 0 : nextIdx;
      });
      setPhase("image");
      setVideoStatus("loading");
    }
  }, [phase, videoStatus, hasVideo, shuffledSlides.length]);

  // Timer that advances the slideshow. This does NOT depend on videoStatus,
  // so playback state changes (loading -> playing) won't reset the clock.
  useEffect(() => {
    if (!shuffledSlides.length) return;

    const timeout = window.setTimeout(() => {
      if (phase === "image") {
        if (hasVideo) {
          setPhase("video");
        } else {
          setIdx((currentIdx) => {
            if (shuffledSlides.length <= 1) return 0;
            const nextIdx = (currentIdx + 1) % shuffledSlides.length;
            return nextIdx === currentIdx ? 0 : nextIdx;
          });
          setPhase("image");
        }
        return;
      }

      setIdx((currentIdx) => {
        if (shuffledSlides.length <= 1) return 0;
        const nextIdx = (currentIdx + 1) % shuffledSlides.length;
        return nextIdx === currentIdx ? 0 : nextIdx;
      });
      setPhase("image");
    }, phase === "image" ? (hasVideo ? imageDuration : imageDuration * 2) : videoDuration);

    return () => window.clearTimeout(timeout);
  }, [phase, shuffledSlides.length, imageDuration, videoDuration, hasVideo, idx]);

  // Create / destroy the YouTube player whenever the active trailer changes.
  useEffect(() => {
    if (!isVideoPhase || !currentKey) return;
    if (typeof window === "undefined") return;

    let cancelled = false;
    let player: YTPlayer | null = null;

    const start = async () => {
      try {
        const YT = await loadYouTubeApi();
        if (cancelled) return;

        const State = YT.PlayerState;

        player = new YT.Player(playerIdRef.current, {
          videoId: currentKey,
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            loop: 0,
            iv_load_policy: 3,
            disablekb: 1,
            fs: 0,
            cc_load_policy: 0,
          },
          events: {
            onReady: (event: { target: YTPlayer }) => {
              if (cancelled) return;
              setVideoStatus("loading");
              // Respect the user's audio preference for this player
              try {
                if (audioEnabledRef.current) event.target.unMute();
                else event.target.mute();
              } catch {
                /* ignore */
              }
              // Detect browsers that block programmatic autoplay
              window.setTimeout(() => {
                if (cancelled) return;
                const state = event.target.getPlayerState();
                if (state === State?.PLAYING) {
                  setVideoStatus("playing");
                } else if (state === State?.ENDED) {
                  setVideoStatus("ended");
                } else {
                  setVideoStatus("blocked");
                }
              }, 4500);
            },
            onStateChange: (event: { data: number }) => {
              if (cancelled) return;
              if (event.data === State?.PLAYING) {
                setVideoStatus("playing");
              } else if (event.data === State?.ENDED) {
                setVideoStatus("ended");
              }
              // BUFFERING / PAUSED are ignored; the max-duration timer is the
              // only fallback once playback has actually started.
            },
            onError: () => {
              if (cancelled) return;
              setVideoStatus("error");
            },
          },
        });

        if (cancelled) {
          try {
            player.destroy();
          } catch {
            /* ignore */
          }
          return;
        }

        playerRef.current = player;
      } catch {
        if (!cancelled) setVideoStatus("error");
      }
    };

    // Give the DOM a tick to render the container div before the API tries to mount.
    const handle = window.setTimeout(start, 50);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, [currentKey, isVideoPhase]);

  // Toggle audio on the active player without remounting it.
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (audioEnabled) playerRef.current.unMute();
      else playerRef.current.mute();
    } catch {
      /* ignore */
    }
  }, [audioEnabled]);

  // Watchdog: if the video stalls or never starts, force a fallback.
  useEffect(() => {
    if (!isVideoPhase) return;
    if (videoStatus === "ended" || videoStatus === "error") return;

    const stalled = window.setTimeout(() => {
      if (videoStatus === "loading") {
        setVideoStatus("blocked");
      }
    }, videoDuration);

    return () => window.clearTimeout(stalled);
  }, [isVideoPhase, videoStatus, videoDuration]);

  return (
    <div className="absolute inset-0 z-0">
      {/* Image backdrop — base layer / universal fallback */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${current.backdrop}-${phase}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: isVideoPhase ? 0 : isLogin ? 0.82 : 0.7 }}
          exit={{ opacity: 0 }}
          transition={{ duration: isVideoPhase ? 0.6 : 1 }}
          className="absolute inset-0 z-0"
        >
          <Image
            src={current.backdrop}
            alt={current.title || "Background"}
            fill
            sizes="100vw"
            priority
            className="object-cover scale-110 animate-slow-zoom"
          />
        </motion.div>
      </AnimatePresence>

      {/* Trailer video — progressive enhancement (desktop, motion-allowed only).
          Oversized + cropped + click-blocked to hide all YouTube chrome. */}
      <AnimatePresence>
        {isVideoPhase && currentKey && (
          <motion.div
            key={currentKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, delay: 0.6 }}
            className="absolute inset-0 z-10 overflow-hidden"
          >
            {/* YouTube player mount point — controlled via the IFrame API so we
                get real ended/error/playing events instead of guessing. */}
            <div
              id={playerIdRef.current}
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                         w-screen h-[56.25vw] min-h-screen min-w-[177.78vh] scale-125"
            />
            {/* Interaction blocker so nothing on the player is ever clickable */}
            <div className="absolute inset-0" />
          </motion.div>
        )}
      </AnimatePresence>

      {shouldShowAudioButton && (
        <button
          type="button"
          onClick={() => setAudioEnabled((value) => !value)}
          className="pointer-events-auto absolute bottom-4 left-4 z-40 rounded-full border border-white/20 bg-black/60 px-3 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm transition hover:bg-black/80"
        >
          {audioEnabled ? "🔊 Sound on" : "🔈 Sound off"}
        </button>
      )}

      {/* Cinematic overlays — sit above everything and mask any residual chrome */}
      <div
        className={`absolute inset-0 z-[1] bg-gradient-to-t ${
          isLogin ? "from-black/55" : "from-black"
        } via-black/00 to-transparent`}
      />
      <div
        className={`absolute inset-0 z-[1] bg-gradient-to-r ${
          isLogin ? "from-black/10" : "from-black/00"
        } via-black/00 to-transparent`}
      />
    </div>
  );
}
