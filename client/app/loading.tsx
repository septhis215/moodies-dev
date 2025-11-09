"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import {
    Film,
    Tv,
    Star,
    Play,
    Sparkles,
    Loader2,
} from "lucide-react";

type Particle = {
  topPct: number; // top in percent (so it adapts to height)
  startX: number; // start x in px
  endX: number; // end x in px
  delay: number;
  duration: number;
  size: number;
  opacity: number;
};

export default function AppLoading() {
  const [particles, setParticles] = React.useState<Particle[] | null>(null);

  React.useEffect(() => {
    // run once on client only
    const w = window.innerWidth || 1200;
    const h = window.innerHeight || 800;
    const n = 6; // number of floating dots
    const arr: Particle[] = Array.from({ length: n }).map(() => {
      const topPct = 5 + Math.random() * 90; // between 5% and 95%
      const startX = -20 - Math.random() * 60; // slightly off-screen left
      const endX = w + 20 + Math.random() * 60; // slightly off-screen right
      const delay = Math.random() * 4;
      const duration = 8 + Math.random() * 6;
      const size = 6 + Math.random() * 8;
      const opacity = 0.08 + Math.random() * 0.25;
      return { topPct, startX, endX, delay, duration, size, opacity };
    });
    setParticles(arr);
  }, []);

  const pulseVariants: Variants = {
    initial: { scale: 1, opacity: 0.7 },
    animate: {
      scale: [1, 1.05, 1],
      opacity: [0.7, 1, 0.7],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  const floatingVariants: Variants = {
    animate: {
      y: [-10, 10, -10],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  const shimmerVariants: Variants = {
    animate: {
      backgroundPosition: ["200% 0", "-200% 0"],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "linear",
      },
    },
  };

  const iconItems = [
    { Icon: Film, color: "text-purple-400" },
    { Icon: Tv, color: "text-blue-400" },
    { Icon: Star, color: "text-yellow-400" },
    { Icon: Sparkles, color: "text-pink-400" },
  ];

  const iconVariant: Variants = {
    initial: { y: 0, rotate: 0 },
    animate: (i: number) => ({
      y: [0, -8, -4, 0], // keyframes for a nicer wave
      rotate: [0, 6, -6, 0], // subtle rotate along the wave
      transition: {
        duration: 1.6,
        repeat: Infinity,
        ease: "easeInOut",
        delay: i * 0.18, // phase shift based on index -> wave
      },
    }),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex flex-col items-center justify-center relative">
      {/* Main Loading Content */}
      <div className="text-center space-y-8 max-w-md mx-auto px-6 z-10">
        {/* Logo/Brand Area */}
        <motion.div
          variants={floatingVariants}
          animate="animate"
          className="relative"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <motion.div
              variants={pulseVariants}
              initial="initial"
              animate="animate"
              className="relative"
            >
              {/* Logo image */}
              <motion.img
                src="/images/moodies.png"
                alt="Moodies Logo"
                className="w-20 h-20 object-contain drop-shadow-[0_0_12px_rgba(255,150,0,0.5)]"
                animate={{
                  scale: [1, 1.05, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              {/* Rotating dashed ring around logo */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-3 border-2 border-dashed border-orange-500/40 rounded-full"
              />
            </motion.div>
          </div>


          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent mb-2">
            Moodies
          </h1>
          <p className="text-gray-400 text-lg">
            Your gateway to movies & shows that match your vibe
          </p>
        </motion.div>

        {/* Loading Spinner */}
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="animate-spin text-orange-500" size={24} />
          <span className="text-gray-300 font-medium">
            Finding the perfect stories for you...
          </span>
        </div>

        {/* Floating Icons */}
        <div className="flex justify-center gap-6">
          {iconItems.map(({ Icon, color }, index) => (
            <motion.div
              key={index}
              custom={index}
              variants={iconVariant}
              initial="initial"
              animate="animate"
              style={{ willChange: "transform" }} // hint for smoother animation
              className={`${color} opacity-80`}
            >
              <Icon size={20} />
            </motion.div>
          ))}
        </div>

        {/* Shimmer Progress Bar */}
        <div className="w-full max-w-xs mx-auto">
          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full w-full bg-gradient-to-r from-transparent via-orange-500 to-transparent"
              variants={shimmerVariants}
              animate="animate"
              style={{ backgroundSize: "200% 100%" }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Curating recommendations tailored to your mood...
          </p>
        </div>
      </div>

      {/* Background Elements (client-only) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {particles &&
          particles.map((p, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-orange-500"
              initial={{ x: p.startX, opacity: 0 }}
              animate={{ x: [p.startX, p.endX], opacity: [0, p.opacity, 0] }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                delay: p.delay,
                ease: "linear",
              }}
              style={{
                top: `${p.topPct}%`,
                left: 0,
                width: p.size,
                height: p.size,
                transform: "translateY(-50%)",
              }}
            />
          ))}
      </div>
    </div>
  );
}
