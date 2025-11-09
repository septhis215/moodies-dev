"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

type Slide = { title: string; poster: string; tagline?: string };
type Props = { slides: Slide[]; rotationMs?: number };

export default function AuthPoster({ slides, rotationMs = 10000 }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % slides.length), rotationMs);
    return () => clearInterval(id);
  }, [rotationMs, slides.length]);

  const current = slides[idx];

  return (
    <div className="text-center relative group">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.poster}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="relative"
        >
          {/* Glow aura */}
          <div className="absolute -inset-4 bg-gradient-to-b from-pink-500/30 to-amber-400/20 blur-3xl rounded-3xl opacity-70 group-hover:opacity-100 transition" />

          {/* Poster image */}
          <div className="relative rounded-3xl overflow-hidden border border-white/15 
                          shadow-[0_20px_80px_-20px_rgba(0,0,0,0.9)] 
                          ring-1 ring-white/10 hover:ring-white/25 
                          transition-all duration-500 mx-auto w-[260px] sm:w-[300px]"
          >
            <Image
              src={current.poster}
              alt={current.title || "Featured"}
              width={400}
              height={600}
              className="object-cover w-full h-auto transition-transform duration-700 group-hover:scale-[1.03]"
              priority
            />
          </div>

          {/* Title */}
          {/* <h2 className="mt-5 text-lg sm:text-xl font-extrabold tracking-wide 
                         bg-gradient-to-r from-purple-300 via-pink-300 to-rose-300 
                         bg-clip-text text-transparent drop-shadow-md">
            {current.title}
          </h2> */}

          {/* Tagline */}
          {current.tagline && (
            <p className="mt-2 text-sm text-white/70 italic animate-fadeIn">
              “{current.tagline}”
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
