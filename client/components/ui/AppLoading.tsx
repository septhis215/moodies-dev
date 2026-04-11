/**
 * AppLoading — the single, canonical full-page loading screen for Moodies.
 *
 * Usage (anywhere in the codebase):
 *   import AppLoading from "@/components/ui/AppLoading";
 *   ...
 *   if (loading) return <AppLoading />;
 *
 * Next.js route segments — create a loading.tsx next to your page.tsx and
 * re-export this component:
 *   export { default } from "@/components/ui/AppLoading";
 */

"use client";

import { motion } from "framer-motion";
import { Film, Tv, Star, Sparkles } from "lucide-react";

const ICON_ITEMS = [
  { Icon: Film,     color: "#a78bfa" }, // purple-400
  { Icon: Tv,       color: "#60a5fa" }, // blue-400
  { Icon: Star,     color: "#facc15" }, // yellow-400
  { Icon: Sparkles, color: "#f472b6" }, // pink-400
] as const;

// Film-strip perforation count
const TICK_COUNT = 14;

export default function AppLoading() {
  return (
    <motion.div
      className="relative min-h-screen w-full bg-black overflow-hidden flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      style={{ position: "fixed", inset: 0, zIndex: 9999 }}
    >

      {/* ── Brand glow blobs (aurora-style, matches not-found.tsx) ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        {/* warm glow — bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: "-15%",
            left: "-10%",
            width: "60%",
            height: "60%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(233,79,55,0.20) 0%, rgba(233,79,55,0.06) 45%, transparent 70%)",
            filter: "blur(90px)",
          }}
        />
        {/* warm glow — top-right */}
        <div
          style={{
            position: "absolute",
            top: "-15%",
            right: "-10%",
            width: "55%",
            height: "55%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,107,88,0.16) 0%, rgba(255,107,88,0.04) 45%, transparent 70%)",
            filter: "blur(100px)",
          }}
        />
        {/* faint centre bloom */}
        <div
          style={{
            position: "absolute",
            top: "35%",
            left: "30%",
            width: "40%",
            height: "30%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(233,79,55,0.07) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 flex flex-col items-center gap-9 px-8 text-center">

        {/* Overline — matches section label style across the app */}
        <p
          className="text-xs font-bold tracking-[0.3em] uppercase"
          style={{ color: "#e94f37" }}
        >
          Now Loading
        </p>

        {/* Logo + animated rings */}
        <div className="relative flex items-center justify-center">
          {/* Slow outer ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
            style={{
              position: "absolute",
              width: 110,
              height: 110,
              borderRadius: "50%",
              border: "1.5px solid rgba(233,79,55,0.20)",
              borderTopColor: "#e94f37",
              borderRightColor: "rgba(255,107,88,0.45)",
            }}
          />
          {/* Fast inner ring (counter-rotate) */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
            style={{
              position: "absolute",
              width: 84,
              height: 84,
              borderRadius: "50%",
              border: "1px dashed rgba(255,107,88,0.25)",
            }}
          />
          {/* Pulse bloom */}
          <motion.div
            animate={{ scale: [1, 1.35, 1], opacity: [0.35, 0, 0.35] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              width: 72,
              height: 72,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(233,79,55,0.35) 0%, transparent 70%)",
            }}
          />
          {/* Logo */}
          <motion.img
            src="/images/moodies.png"
            alt="Moodies"
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "relative",
              zIndex: 10,
              width: 56,
              height: 56,
              objectFit: "contain",
              filter:
                "drop-shadow(0 0 18px rgba(233,79,55,0.60)) drop-shadow(0 0 48px rgba(255,107,88,0.22))",
            }}
          />
        </div>

        {/* Brand name + tagline */}
        <div className="flex flex-col items-center gap-1.5">
          <h1 className="text-4xl font-black tracking-tight text-white leading-none">
            Moodies
          </h1>
          <p
            className="text-sm font-semibold"
            style={{
              backgroundImage: "linear-gradient(90deg, #e94f37, #ff6b58)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Movies &amp; Shows that match your vibe
          </p>
        </div>

        {/* Floating genre icons — wave stagger */}
        <div className="flex items-center gap-6">
          {ICON_ITEMS.map(({ Icon, color }, i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -7, 0], opacity: [0.45, 1, 0.45] }}
              transition={{
                duration: 1.9,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.22,
              }}
            >
              <Icon size={17} style={{ color }} />
            </motion.div>
          ))}
        </div>

        {/* Film-strip scan bar */}
        <div className="flex flex-col items-center gap-2.5 w-60">
          {/* Perforations */}
          <div className="flex justify-between w-full">
            {Array.from({ length: TICK_COUNT }).map((_, i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.12, 0.55, 0.12] }}
                transition={{
                  duration: 1.1,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.07,
                }}
                style={{
                  width: 5,
                  height: 9,
                  borderRadius: 2,
                  background: "rgba(233,79,55,0.55)",
                }}
              />
            ))}
          </div>

          {/* Scan line */}
          <div
            className="relative w-full rounded-full overflow-hidden"
            style={{ height: 3, background: "rgba(255,255,255,0.07)" }}
          >
            <motion.div
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "absolute",
                inset: 0,
                width: "50%",
                borderRadius: 9999,
                background:
                  "linear-gradient(90deg, transparent, #e94f37, #ff6b58, transparent)",
              }}
            />
          </div>

          <p className="text-xs text-gray-500 tracking-wide">
            Curating stories for your mood…
          </p>
        </div>

      </div>
    </motion.div>
  );
}
