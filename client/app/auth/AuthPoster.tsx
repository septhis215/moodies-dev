"use client";
import { useEffect, useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { motion, AnimatePresence } from "framer-motion";

type Slide = {
  title: string;
  poster: string;
  rating?: number;
  year?: string;
  genre?: string;
  kind?: "movie" | "tv";
};
type Props = { slides: Slide[]; rotationMs?: number };

export default function AuthPoster({ slides, rotationMs = 10000 }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setIdx((i) => (i + 1) % slides.length),
      rotationMs,
    );
    return () => clearInterval(id);
  }, [rotationMs, slides.length]);

  const current = slides[idx];

  return (
    <div className="relative w-full flex flex-col items-center gap-[clamp(0.6rem,1.8vh,1rem)]">
      {/* Showcase frame */}
      <div className="relative group">
        {/* Glow aura */}
        <div className="absolute -inset-4 bg-gradient-to-b from-[rgb(233,79,55)]/45 via-pink-500/20 to-amber-400/10 blur-3xl rounded-[2rem] opacity-70 group-hover:opacity-100 transition" />

        <AnimatePresence mode="wait">
          <motion.div
            key={current.poster}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
            className="relative rounded-[1.5rem] overflow-hidden border border-white/15 ring-1 ring-white/10
                       shadow-[0_30px_90px_-25px_rgba(0,0,0,0.95)]
                       mx-auto aspect-[2/3] h-[clamp(260px,56vh,520px)]"
          >
            <Image
              src={current.poster}
              alt={current.title || "Featured"}
              width={400}
              height={600}
              className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-[1.04]"
              priority
            />

            {/* Trending pill */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full
                            bg-[rgb(233,79,55)]/90 backdrop-blur-sm text-white text-[0.65rem] font-bold tracking-wide uppercase
                            shadow-[0_4px_14px_rgba(233,79,55,0.5)]">
              <span className="text-[0.7rem] leading-none">🔥</span> Trending
            </div>

            {/* Type badge */}
            {current.kind && (
              <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm border border-white/15 text-white/90 text-[0.6rem] font-semibold tracking-widest uppercase">
                {current.kind}
              </div>
            )}

            {/* Bottom scrim + meta */}
            <div className="absolute inset-x-0 bottom-0 p-3 pt-10 bg-gradient-to-t from-black via-black/70 to-transparent">
              <h3 className="font-['Bebas_Neue'] text-white text-[clamp(1.1rem,2.6vh,1.6rem)] leading-none tracking-wide line-clamp-1 drop-shadow">
                {current.title}
              </h3>
              <div className="mt-1.5 flex items-center gap-2 text-[0.7rem] text-white/70">
                {typeof current.rating === "number" && current.rating > 0 && (
                  <span className="flex items-center gap-1 text-amber-300 font-semibold">
                    <svg
                      className="w-3 h-3"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.36 4.18a1 1 0 00.95.69h4.4c.97 0 1.37 1.24.59 1.81l-3.56 2.59a1 1 0 00-.36 1.12l1.36 4.18c.3.92-.76 1.69-1.54 1.12l-3.56-2.59a1 1 0 00-1.18 0l-3.56 2.59c-.78.57-1.84-.2-1.54-1.12l1.36-4.18a1 1 0 00-.36-1.12L1.4 9.61c-.78-.57-.38-1.81.59-1.81h4.4a1 1 0 00.95-.69L9.05 2.93z" />
                    </svg>
                    {current.rating.toFixed(1)}
                  </span>
                )}
                {current.year && <span className="text-white/40">·</span>}
                {current.year && <span>{current.year}</span>}
                {current.genre && (
                  <span className="hidden sm:inline text-white/40">·</span>
                )}
                {current.genre && (
                  <span className="hidden sm:inline truncate">
                    {current.genre}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slide indicators */}
      {slides.length > 1 && (
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show slide ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === idx
                  ? "w-5 bg-[rgb(233,79,55)]"
                  : "w-1.5 bg-white/25 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
