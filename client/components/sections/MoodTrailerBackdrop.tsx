"use client";

import { useEffect, useRef, useState } from "react";
import { createYouTubePlayer, type YouTubePlayer, YT_PLAYER_STATE } from "@/lib/youtube-player";
import { createTrailerReveal } from "@/lib/trailer-reveal";

export default function MoodTrailerBackdrop({ videoKey, onPlaying }: {
  videoKey: string; onPlaying: (playing: boolean) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let player: YouTubePlayer | null = null;
    const resize = () => {
      const parent = host.parentElement;
      if (!parent) return;
      const width = Math.max(parent.clientWidth, parent.clientHeight * 16 / 9, 356);
      host.style.width = `${width}px`;
      host.style.height = `${width * 9 / 16}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (host.parentElement) observer.observe(host.parentElement);
    const status = (value: boolean) => {
      if (cancelled) return;
      setPlaying(value);
      onPlaying(value);
    };
    const reveal = createTrailerReveal(status, () => player?.getPlayerState() === YT_PLAYER_STATE.PLAYING);
    const start = async () => {
      try {
        player = await createYouTubePlayer(host, {
          videoId: videoKey, width: "100%", height: "100%",
          playerVars: { autoplay: 1, mute: 1, controls: 0, disablekb: 1, fs: 0, playsinline: 1, rel: 0, iv_load_policy: 3, loop: 1, playlist: videoKey, origin: window.location.origin },
          events: {
            onReady: ({ target }) => {
              if (cancelled) return;
              const iframe = target.getIframe();
              iframe.tabIndex = -1;
              iframe.setAttribute("aria-hidden", "true");
              iframe.title = "Muted mood trailer background";
              target.mute();
              target.playVideo();
            },
            onStateChange: ({ data }) => reveal.update(data === YT_PLAYER_STATE.PLAYING),
            onError: () => reveal.update(false),
            onAutoplayBlocked: () => reveal.update(false),
          },
        });
        if (cancelled) player.destroy();
      } catch { reveal.update(false); }
    };
    void start();
    return () => {
      cancelled = true;
      reveal.dispose();
      observer.disconnect();
      onPlaying(false);
      try { player?.destroy(); } catch { /* Already removed by the player. */ }
    };
  }, [videoKey, onPlaying]);

  return <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity motion-reduce:transition-none ${playing ? "opacity-100 duration-700" : "opacity-0 duration-0"}`}>
    <div ref={hostRef} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 [&_iframe]:h-full [&_iframe]:w-full" />
  </div>;
}
