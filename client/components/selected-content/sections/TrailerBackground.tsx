"use client";

import { useEffect, useRef, useState } from "react";
import { loadYouTubeApi, YT_PLAYER_STATE, type YouTubePlayer } from "@/lib/youtube-player";

// Allow YouTube's transient start/resume overlay to clear before revealing the footage.
const BACKGROUND_REVEAL_DELAY_MS = 4000;

function BackgroundVideo({ videoKey }: { videoKey: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let player: YouTubePlayer | null = null;
    let revealTimer: number | undefined;
    const hideVideo = () => {
      window.clearTimeout(revealTimer);
      revealTimer = undefined;
      host.style.transitionDuration = "0ms";
      host.style.opacity = "0";
    };
    const frame = document.createElement("iframe");
    frame.src = `https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoKey}&playsinline=1&rel=0&iv_load_policy=3&disablekb=1&fs=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
    frame.title = "Background trailer";
    frame.tabIndex = -1;
    frame.allow = "autoplay; encrypted-media";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.className = "h-full w-full border-0";
    host.style.opacity = "0";
    host.appendChild(frame);

    void loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      player = new YT.Player(frame, {
        events: {
          onReady: ({ target }) => {
            if (cancelled) return;
            target.mute();
            target.playVideo();
          },
          onStateChange: ({ data }) => {
            if (cancelled) return;
            hideVideo();
            if (data === YT_PLAYER_STATE.PLAYING) {
              revealTimer = window.setTimeout(() => {
                if (cancelled || player?.getPlayerState() !== YT_PLAYER_STATE.PLAYING) return;
                host.style.transitionDuration = "700ms";
                host.style.opacity = "1";
              }, BACKGROUND_REVEAL_DELAY_MS);
            }
          },
          onError: () => { if (!cancelled) hideVideo(); },
          onAutoplayBlocked: () => { if (!cancelled) hideVideo(); },
        },
      });
    }).catch((error: unknown) => {
      if (!cancelled) console.error("Could not initialize background trailer", error);
    });

    return () => {
      cancelled = true;
      hideVideo();
      player?.destroy();
      frame.remove();
    };
  }, [videoKey]);

  return (
    <div ref={hostRef} className="pointer-events-none absolute left-1/2 top-1/2 h-[max(100cqh,56.25cqw)] w-[max(100cqw,177.78cqh)] -translate-x-1/2 -translate-y-1/2 scale-125 opacity-0 transition-opacity duration-700 motion-reduce:transition-none" />
  );
}

export default function TrailerBackground({ videoKey }: { videoKey: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => setPlaying(visible && !motion.matches);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(host);
    motion.addEventListener("change", update);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", update);
    };
  }, []);

  return (
    <div ref={hostRef} className="absolute inset-0 overflow-hidden [container-type:size]" aria-hidden="true">
      {playing ? (
        <BackgroundVideo videoKey={videoKey} />
      ) : null}
    </div>
  );
}
