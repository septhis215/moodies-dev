"use client";

import Link from "next/link";

// a visible, robust aurora background + centered 404 card
export default function NotFoundAuroraVisible() {
  return (
    <div className="relative min-h-screen w-full bg-black text-white overflow-hidden">
      {/* SVG filter defs (warp + subtle noise) */}
      <svg className="absolute w-0 h-0" aria-hidden focusable="false">
        <defs>
          <filter id="aurora-warp">
            <feTurbulence
              baseFrequency="0.0025 0.0018"
              numOctaves="3"
              stitchTiles="stitch"
              type="fractalNoise"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="50"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          <filter id="aurora-grain">
            <feTurbulence
              baseFrequency="0.9"
              numOctaves="2"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="table" tableValues="0 0.08" />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>

      {/* AURORA LAYERS: z-0 so visible above the black but behind content */}
      <div aria-hidden className="absolute inset-0 z-0 pointer-events-none">
        {/* large saturated base glow so it reads on black */}
        <div
          style={{
            position: "absolute",
            left: "-10%",
            top: "8%",
            width: "120%",
            height: "55%",
            borderRadius: "50%",
            background:
              "radial-gradient(40% 60% at 10% 30%, rgba(6,30,60,0.75), rgba(6,10,20,0.35) 35%, transparent 60%)",
            filter: "blur(120px) saturate(150%)",
            transform: "translateZ(0)",
            opacity: 1,
          }}
        />

        {/* ribbon 1 - green/teal (most visible) */}
        <div
          style={{
            position: "absolute",
            left: "-5%",
            top: "12%",
            width: "130%",
            height: "42%",
            borderRadius: "999px",
            background:
              "linear-gradient(90deg, rgba(60,255,170,0.26) 0%, rgba(30,220,180,0.20) 30%, rgba(20,170,150,0.12) 60%, transparent 100%)",
            filter: "blur(36px) contrast(1.05)",
            mixBlendMode: "screen",
            transformOrigin: "50% 50%",
            willChange: "transform, opacity, filter",
            animation: "auroraDriftSlow 18s ease-in-out infinite",
            opacity: 0.95,
          }}
        />

        {/* ribbon 2 - blue/teal */}
        <div
          style={{
            position: "absolute",
            left: "-10%",
            top: "20%",
            width: "140%",
            height: "40%",
            borderRadius: "999px",
            background:
              "linear-gradient(90deg, rgba(50,150,255,0.18) 0%, rgba(80,170,255,0.15) 30%, rgba(30,110,200,0.08) 60%, transparent 100%)",
            filter: "blur(48px) contrast(1.02)",
            mixBlendMode: "lighten",
            animation: "auroraDriftMedium 14s ease-in-out infinite",
            opacity: 0.88,
          }}
        />

        {/* ribbon 3 - magenta (subtle accent) */}
        <div
          style={{
            position: "absolute",
            left: "2%",
            top: "6%",
            width: "120%",
            height: "30%",
            borderRadius: "999px",
            background:
              "linear-gradient(90deg, rgba(255,80,180,0.06) 0%, rgba(200,60,160,0.05) 40%, transparent 100%)",
            filter: "blur(72px)",
            mixBlendMode: "screen",
            animation: "auroraDriftFast 9s ease-in-out infinite",
            opacity: 0.6,
          }}
        />

        {/* apply a warp to everything above (subtle) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            filter: "url(#aurora-warp)",
            opacity: 0.55,
            pointerEvents: "none",
            mixBlendMode: "screen",
          }}
        />

        {/* moving grain overlay using feTurbulence filter for organic grain */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.02))",
            mixBlendMode: "overlay",
            pointerEvents: "none",
            filter: "url(#aurora-grain)",
            opacity: 0.08,
            animation: "grainShift 12s linear infinite",
          }}
        />
      </div>

      {/* FOREGROUND content (z-10) */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-16">
        <div className="max-w-3xl w-full text-center p-10 rounded-2xl backdrop-blur-md bg-black/40 border border-white/6 shadow-2xl">
          <h1 className="text-6xl font-extrabold tracking-tight mb-4">404</h1>
          <h2 className="text-xl text-gray-200 mb-6">
            We couldn&apos;t find that page
          </h2>
          <p className="text-gray-400 mb-8">
            Looks like this route drifted into the aurora. Try heading back
            home.
          </p>
          <Link
            href="/"
            className="inline-block px-8 py-3 rounded-md bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 transition text-white"
          >
            Back to safety
          </Link>
        </div>
      </div>

      {/* Inline keyframes (kept simple and robust) */}
      <style jsx>{`
        @keyframes auroraDriftSlow {
          0% {
            transform: translate3d(-6%, 0, 0) rotate(-6deg) scale(1);
            opacity: 0.92;
          }
          50% {
            transform: translate3d(6%, 2%, 0) rotate(-4deg) scale(1.02);
            opacity: 1;
          }
          100% {
            transform: translate3d(-6%, 0, 0) rotate(-6deg) scale(1);
            opacity: 0.92;
          }
        }
        @keyframes auroraDriftMedium {
          0% {
            transform: translate3d(0%, -1%, 0) rotate(2deg) scale(1);
            opacity: 0.78;
          }
          50% {
            transform: translate3d(-4%, 2%, 0) rotate(4deg) scale(1.03);
            opacity: 0.88;
          }
          100% {
            transform: translate3d(0%, -1%, 0) rotate(2deg) scale(1);
            opacity: 0.78;
          }
        }
        @keyframes auroraDriftFast {
          0% {
            transform: translate3d(6%, -2%, 0) rotate(12deg) scale(1);
            opacity: 0.46;
          }
          50% {
            transform: translate3d(-6%, 3%, 0) rotate(14deg) scale(1.04);
            opacity: 0.56;
          }
          100% {
            transform: translate3d(6%, -2%, 0) rotate(12deg) scale(1);
            opacity: 0.46;
          }
        }
        @keyframes grainShift {
          0% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(6px, -4px);
          }
          100% {
            transform: translate(0, 0);
          }
        }
      `}</style>
    </div>
  );
}
