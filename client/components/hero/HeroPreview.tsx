"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square, Volume2, VolumeX } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { createTrailerReveal } from "@/lib/trailer-reveal";
import { createYouTubePlayer, type YouTubePlayer, YT_PLAYER_STATE } from "@/lib/youtube-player";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "https://dev.api.moodies.tech/api";
const PREVIEW_SECONDS = 15;
const STARTUP_SECONDS = 4;

export default function HeroPreview({
  id, kind, trailerKey, autoPlay, onStop, onActiveChange,
}: {
  id: number;
  kind: "movie" | "tv";
  trailerKey?: string | null;
  autoPlay: boolean;
  onStop: () => void;
  onActiveChange: (active: boolean) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [visible, setVisible] = useState(false);
  const [requested, setRequested] = useState(false);
  const [finished, setFinished] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [resolvedKey, setResolvedKey] = useState<string | null | undefined>(
    trailerKey && /^[\w-]{11}$/.test(trailerKey) ? trailerKey : undefined,
  );
  const active = visible && !finished && (requested || (autoPlay && !reduceMotion));
  const showingPreview = active && revealed;
  const playbackLabel = showingPreview ? "Stop preview" : active ? "Cancel preview" : "Play 15s preview";
  const soundLabel = muted ? "Unmute preview" : "Mute preview";
  const PlaybackIcon = active ? Square : Play;
  const SoundIcon = muted ? VolumeX : Volume2;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let intersecting = false;
    const update = () => setVisible(intersecting && document.visibilityState === "visible");
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.intersectionRatio >= 0.5;
      update();
    }, { threshold: 0.5 });
    observer.observe(host);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    if (!visible || resolvedKey !== undefined) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4500);
    void fetch(`${API_BASE}/all/batch/trailers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ type: kind, id }]),
      signal: controller.signal,
    }).then(async (response) => {
      const trailers = response.ok ? await response.json() : null;
      const key = trailers?.[`${kind}-${id}`];
      if (!controller.signal.aborted) setResolvedKey(typeof key === "string" && /^[\w-]{11}$/.test(key) ? key : null);
    }).catch(() => { /* Artwork is already visible. */ }).finally(() => window.clearTimeout(timeout));
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [id, kind, resolvedKey, visible]);

  useEffect(() => {
    const host = playerHostRef.current;
    if (!active || !resolvedKey || !host) return;
    let cancelled = false;
    let started = false;
    let player: YouTubePlayer | undefined;
    const reveal = createTrailerReveal(
      setRevealed,
      () => player?.getPlayerState() === YT_PLAYER_STATE.PLAYING,
      STARTUP_SECONDS * 1000,
    );
    const finish = () => {
      if (!cancelled) setFinished(true);
    };
    let timeout = window.setTimeout(finish, 6500);
    onActiveChange(true);

    void createYouTubePlayer(host, {
      videoId: resolvedKey,
      width: "100%",
      height: "100%",
      playerVars: {
        end: STARTUP_SECONDS + PREVIEW_SECONDS, controls: 0, disablekb: 1, fs: 0, playsinline: 1,
        rel: 0, mute: 1, origin: window.location.origin,
      },
      events: {
        onReady: ({ target }) => {
          if (cancelled) return;
          const iframe = target.getIframe();
          iframe.title = "Featured trailer preview";
          iframe.tabIndex = -1;
          target.mute();
          playerRef.current = target;
          target.playVideo();
        },
        onStateChange: ({ data }) => {
          if (cancelled) return;
          reveal.update(data === YT_PLAYER_STATE.PLAYING);
          if (data === YT_PLAYER_STATE.ENDED) finish();
          if (!started && data === YT_PLAYER_STATE.PLAYING) {
            started = true;
            window.clearTimeout(timeout);
            timeout = window.setTimeout(finish, (STARTUP_SECONDS + PREVIEW_SECONDS + 5) * 1000);
          }
        },
        onAutoplayBlocked: finish,
        onError: finish,
      },
    }).then((instance) => {
      if (cancelled) instance.destroy();
      else player = instance;
    }).catch(finish);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      reveal.dispose();
      playerRef.current = null;
      player?.destroy();
      setRevealed(false);
      setMuted(true);
      onActiveChange(false);
    };
  }, [active, resolvedKey, onActiveChange]);

  return (
    <>
      <div ref={hostRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 z-[1] overflow-hidden [container-type:size] [&_iframe]:pointer-events-none ${showingPreview ? "opacity-100 transition-opacity duration-500 motion-reduce:transition-none" : "opacity-0"}`}>
        <div ref={playerHostRef} className="absolute left-1/2 top-[34%] h-[max(200px,56.25cqw,64cqh)] w-[max(356px,100cqw,113.78cqh)] -translate-x-1/2 -translate-y-1/2 sm:top-1/2 sm:h-[max(100cqh,56.25cqw)] sm:w-[max(100cqw,177.78cqh)]" />
      </div>
      {resolvedKey && (
        <div role="group" aria-label="Trailer preview controls" className="absolute right-4 top-4 z-20 flex divide-x divide-white/20 rounded-md border border-white/20 bg-black/75 text-white sm:right-6 lg:right-8 lg:top-24">
          <button
            type="button"
            className="ui-secondary-action size-11 rounded-r-none border-0 p-0"
            aria-label={playbackLabel}
            title={playbackLabel}
            onClick={() => {
              if (active) onStop();
              setRequested(!active);
              setFinished(active);
            }}
          >
            <PlaybackIcon className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="ui-secondary-action size-11 rounded-l-none border-0 p-0"
            aria-label={soundLabel}
            title={soundLabel}
            aria-disabled={!showingPreview}
            onClick={() => {
              const player = playerRef.current;
              if (!showingPreview || !player) return;
              if (muted) player.unMute();
              else player.mute();
              setMuted(!muted);
            }}
          >
            <SoundIcon className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
