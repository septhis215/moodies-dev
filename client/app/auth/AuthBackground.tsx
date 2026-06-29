"use client";
import { useEffect, useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

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

export default function AuthBackground({ slides, rotationMs = 10000 }: Props) {
  const [idx, setIdx] = useState(0);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [trailerKeys, setTrailerKeys] = useState<Record<number, string>>({});
  const pathname = usePathname();
  const isLogin = pathname.includes("/auth/login");

  // Rotation — shares the same cadence as the poster.
  useEffect(() => {
    const id = setInterval(
      () => setIdx((i) => (i + 1) % slides.length),
      rotationMs,
    );
    return () => clearInterval(id);
  }, [rotationMs, slides.length]);

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
        const items = slides
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
        for (const s of slides) {
          if (typeof s.id !== "number" || !s.kind) continue;
          const key = data[`${s.kind}-${s.id}`];
          if (key) map[s.id] = key;
        }

        if (!cancelled && Object.keys(map).length > 0) {
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
  }, [slides]);

  const current = slides[idx];
  const currentKey =
    videoEnabled && current?.id != null ? trailerKeys[current.id] : undefined;

  return (
    <div className="absolute inset-0">
      {/* Image backdrop — base layer / universal fallback */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: isLogin ? 0.82 : 0.7 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0"
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
        {currentKey && (
          <motion.div
            key={currentKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: isLogin ? 0.88 : 0.7 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, delay: 0.6 }}
            className="absolute inset-0 overflow-hidden"
          >
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${currentKey}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1&loop=1&playlist=${currentKey}&iv_load_policy=3&disablekb=1&fs=0`}
              title={current.title || "Trailer"}
              allow="autoplay; encrypted-media"
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                         w-screen h-[56.25vw] min-h-screen min-w-[177.78vh] scale-125"
            />
            {/* Interaction blocker so nothing on the player is ever clickable */}
            <div className="absolute inset-0" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cinematic overlays — sit above everything and mask any residual chrome */}
      <div
        className={`absolute inset-0 bg-gradient-to-t ${
          isLogin ? "from-black/55" : "from-black"
        } via-black/00 to-transparent`}
      />
      <div
        className={`absolute inset-0 bg-gradient-to-r ${
          isLogin ? "from-black/10" : "from-black/00"
        } via-black/00 to-transparent`}
      />
    </div>
  );
}
