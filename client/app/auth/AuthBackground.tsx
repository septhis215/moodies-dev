"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

type Slide = { backdrop: string };
type Props = { slides: Slide[]; rotationMs?: number };

export default function AuthBackground({ slides, rotationMs = 10000 }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % slides.length), rotationMs);
    return () => clearInterval(id);
  }, [rotationMs, slides.length]);

  const current = slides[idx];

  return (
    <div className="absolute inset-0">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0"
        >
          <Image
            src={current.backdrop}
            alt="Background"
            fill
            sizes="100vw"
            priority
            className="object-cover scale-110 animate-slow-zoom"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/00 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/00 via-black/00 to-transparent" />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
