"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Play, Volume2, VolumeX } from "lucide-react";
import Image from "next/image";
import {
  createYouTubePlayer,
  YT_PLAYER_STATE,
  type YouTubePlayer,
} from "@/lib/youtube-player";
import type { CelebrityVideo } from "@/types/celebrityMedia";
import styles from "./celebrity-hub.module.css";

export default function CelebrityVideoPlayer({
  video,
  autoplay = false,
  initialMuted = true,
  onMutedChange,
  onEnded,
}: {
  video: CelebrityVideo;
  autoplay?: boolean;
  initialMuted?: boolean;
  onMutedChange?: (muted: boolean) => void;
  onEnded?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const [state, setState] = useState<
    "idle" | "playing" | "paused" | "blocked" | "error"
  >("idle");
  const [muted, setMuted] = useState(initialMuted);
  const [brokenImage, setBrokenImage] = useState(false);
  const [ready, setReady] = useState(false);
  const startingMuted = useRef(initialMuted);
  const ended = useRef(onEnded);
  ended.current = onEnded;
  useEffect(() => {
    if (!host.current || !video.canEmbed) return;
    let disposed = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setTimeout(() => setState("error"), 12000);
    void createYouTubePlayer(host.current, {
      videoId: video.id,
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 0,
        mute: startingMuted.current ? 1 : 0,
        playsinline: 1,
        controls: 1,
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: ({ target }) => {
          if (disposed) {
            target.destroy();
            return;
          }
          window.clearTimeout(timer);
          player.current = target;
          setReady(true);
          target.getIframe().title = video.title;
          target
            .getIframe()
            .setAttribute(
              "allow",
              "autoplay; encrypted-media; picture-in-picture; fullscreen",
            );
          if (startingMuted.current) target.mute();
          else target.unMute();
          const rect = root.current?.getBoundingClientRect();
          if (
            autoplay &&
            !reduced.matches &&
            !document.hidden &&
            rect &&
            rect.top < window.innerHeight &&
            rect.bottom > 0
          )
            target.playVideo();
        },
        onStateChange: ({ data }) => {
          if (disposed) return;
          if (data === YT_PLAYER_STATE.PLAYING) setState("playing");
          if (data === YT_PLAYER_STATE.PAUSED) setState("paused");
          if (data === YT_PLAYER_STATE.ENDED) {
            setState("paused");
            if (!reduced.matches) ended.current?.();
          }
        },
        onAutoplayBlocked: () => {
          if (!disposed) setState("blocked");
        },
        onError: () => {
          if (!disposed) {
            window.clearTimeout(timer);
            setState("error");
          }
        },
      },
    })
      .then((instance) => {
        if (disposed) instance.destroy();
        else player.current = instance;
      })
      .catch(() => {
        if (!disposed) {
          window.clearTimeout(timer);
          setState("error");
        }
      });
    const pause = () => {
      if (document.hidden) player.current?.pauseVideo();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio < 0.15) player.current?.pauseVideo();
      },
      { threshold: 0.15 },
    );
    if (root.current) observer.observe(root.current);
    document.addEventListener("visibilitychange", pause);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", pause);
      player.current?.destroy();
      player.current = null;
    };
  }, [video.id, video.title, video.canEmbed, autoplay]);
  function play() {
    if (!player.current) return;
    player.current.unMute();
    setMuted(false);
    onMutedChange?.(false);
    player.current.playVideo();
  }
  function toggleSound() {
    if (!player.current) return;
    if (muted) player.current.unMute();
    else player.current.mute();
    setMuted(!muted);
    onMutedChange?.(!muted);
  }
  const fallback = !video.canEmbed || state === "error";
  return (
    <div
      ref={root}
      className={styles.heroStage}
      aria-label={`Video: ${video.title}`}
    >
      {!fallback && <div ref={host} className={styles.playerHost} />}
      {(fallback || state === "idle" || state === "blocked") && (
        <>
          <Image
            src={brokenImage ? "/placeholder-backdrop.svg" : video.thumbnail}
            alt=""
            fill
            unoptimized
            priority
            className="object-cover"
            sizes="(max-width: 767px) 92vw, 90vw"
            onError={() => setBrokenImage(true)}
          />
          <div className="absolute inset-0 grid place-items-center bg-black/25">
            {fallback ? (
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-black"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Watch on YouTube
              </a>
            ) : (
              <button
                type="button"
                onClick={play}
                disabled={!ready}
                aria-label={
                  ready ? `Play ${video.title}` : "Loading video player"
                }
                className="grid h-16 w-16 place-items-center rounded-full bg-white text-black shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral)] disabled:opacity-60"
              >
                <Play className="h-6 w-6 fill-current" aria-hidden="true" />
              </button>
            )}
          </div>
          {state === "error" && (
            <p
              className="absolute inset-x-4 bottom-3 text-center text-xs text-white"
              role="status"
            >
              This video can’t play here. Open it on YouTube.
            </p>
          )}
        </>
      )}
      {!fallback && (
        <button
          type="button"
          className={`${styles.iconButton} absolute right-4 top-4 z-10`}
          onClick={toggleSound}
          aria-label={muted ? "Turn sound on" : "Mute video"}
        >
          {muted ? (
            <VolumeX className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Volume2 className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}
