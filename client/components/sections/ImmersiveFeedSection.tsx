"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Film,
  MousePointer2,
  Play,
  Repeat,
  Zap,
} from "lucide-react";

export default function ImmersiveFeedSection() {
  const features = [
    {
      icon: Repeat,
      title: "Swipe the vibe",
      description: "A vertical feed built for quick trailer discovery.",
    },
    {
      icon: Play,
      title: "Preview instantly",
      description: "Watch the hook before opening the full details.",
    },
    {
      icon: Zap,
      title: "Tune fast",
      description: "Move from maybe to must-watch without breaking flow.",
    },
  ];

  return (
    <section
      className="relative mx-auto max-w-7xl overflow-hidden bg-black px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
    >
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/80 p-4 shadow-2xl shadow-black/30 sm:p-7 lg:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#e94f37] via-[#ff7a66] to-[#f59e0b]" />

          <div className="relative z-10 flex h-full flex-col justify-between gap-8">
            <div>
              <h2 className="mt-4 max-w-2xl text-[1.55rem] font-extrabold leading-tight tracking-tight text-white sm:mt-5 sm:text-4xl">
                Drop into a feed that feels made for your next obsession.
              </h2>

              <p className="mt-3 max-w-xl text-[13px] leading-6 text-zinc-400 sm:text-base">
                Browse trailers in a focused, full-screen flow. Swipe through
                scenes, catch the tone quickly, and open the titles that match
                your mood.
              </p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 sm:block sm:p-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/35 text-[#ff7a66] ring-1 ring-white/10 sm:mb-3">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {feature.title}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-gray-400">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <Link
              href="/feed"
              className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-950 shadow-lg shadow-black/20 transition hover:bg-gray-100 sm:w-fit sm:rounded-lg"
            >
              Start swiping
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <Link
          href="/feed"
          className="group relative min-h-[320px] cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl shadow-black/30 transition hover:border-white/20 sm:min-h-[420px] lg:min-h-[460px]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(233,79,55,0.24),transparent_42%)]" />

          <div className="absolute inset-x-8 bottom-8 top-6 overflow-hidden rounded-[1.65rem] border border-white/15 bg-black shadow-2xl shadow-black/50 sm:inset-x-14 sm:top-8 sm:rounded-[2rem] lg:inset-x-16">
            <div className="absolute inset-0 flex items-center justify-center">
              <Image
                src="/images/mascot-feed.png"
                alt="Thrilling mood preview"
                fill
                sizes="(max-width: 640px) 72vw, (max-width: 1024px) 80vw, 400px"
                className="object-contain object-center opacity-100"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/10 opacity-70" />

              <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
                <span className="rounded-full bg-black/50 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-white/10 backdrop-blur-md">
                  Moodies Feed
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black">
                  <Play className="h-4 w-4 fill-current" />
                </div>
              </div>

              <div className="absolute bottom-4 left-4 right-4 sm:bottom-5">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff8b78]">
                  <Film className="h-3.5 w-3.5" />
                  Trailer preview
                </div>
                <h3 className="text-lg font-black leading-tight text-white sm:text-xl">
                  Swipe until the vibe clicks.
                </h3>
                <p className="mt-1.5 text-xs leading-5 text-gray-300 sm:mt-2 sm:text-sm">
                  Short previews, quick decisions, better watch nights.
                </p>
              </div>
            </div>
          </div>

          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/70 sm:bottom-5"
          >
            <MousePointer2 className="h-4 w-4" />
            Scroll feed
          </motion.div>
        </Link>
      </div>
    </section >
  );
}
