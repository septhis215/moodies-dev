"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Play, Zap, Repeat, Sparkles, Mouse } from "lucide-react";

export default function ImmersiveFeedSection() {
    const features = [
        {
            icon: Repeat,
            title: "Infinite Scroll",
            description: "Endless feed tailored to your taste.",
            href: "/feed",
        },
        {
            icon: Play,
            title: "Instant Trailers",
            description: "Watch previews without leaving.",
            href: "/feed",
        },
        {
            icon: Zap,
            title: "Fast & Smooth",
            description: "Seamless, optimized experience.",
            href: "/feed",
        },
    ];

    return (
        <section className="relative overflow-hidden bg-black py-16 px-4 sm:px-6 lg:px-8">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-gray-950" />
            <div className="absolute top-0 right-0 w-[180px] h-[180px] bg-red-500/10 blur-[90px] rounded-full" />
            <div className="absolute bottom-0 left-0 w-[160px] h-[160px] bg-purple-500/10 blur-[80px] rounded-full" />

            <div className="relative max-w-5xl mx-auto flex flex-col items-center">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 bg-gray-800/40 border border-gray-700 px-3 py-1.5 rounded-full text-xs text-gray-300 mb-4">
                        <Sparkles className="w-4 h-4 text-red-400" />
                        Experience
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                        Immersive <span className="text-red-500">Feed</span> Mode
                    </h2>
                    <p className="text-gray-400 text-sm sm:text-base max-w-lg mx-auto">
                        Discover movies and shows like TikTok or Reels — scroll, watch, and fall into your next obsession.
                    </p>
                </div>

                {/* Feature Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full mb-10">
                    {features.map((f) => (
                        <motion.div
                            key={f.title}
                            whileHover={{ scale: 1.04, y: -4 }}
                            transition={{ type: "spring", stiffness: 260, damping: 20 }}
                            className="group bg-gray-900/40 hover:bg-gray-800/60 border border-gray-800 hover:border-gray-700 rounded-xl p-4 text-center backdrop-blur-sm cursor-pointer"
                        >
                            <Link href={f.href} className="block h-full">
                                <div className="w-10 h-10 mb-3 mx-auto flex items-center justify-center rounded-lg bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 group-hover:from-red-500/20 group-hover:to-red-400/10 transition-colors">
                                    <f.icon className="w-5 h-5 text-gray-300 group-hover:text-red-400 transition-colors" />
                                </div>
                                <h3 className="text-white text-base font-semibold mb-1">{f.title}</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">{f.description}</p>
                            </Link>
                        </motion.div>
                    ))}
                </div>

                {/* CTA */}
                <div className="flex flex-col items-center gap-6">
                    <Link
                        href="/feed"
                        className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-lg font-semibold text-sm transition-all hover:bg-gray-100 hover:scale-105 shadow-md hover:shadow-lg"
                    >
                        Start Swiping
                        <Play className="w-4 h-4" />
                    </Link>

                    {/* Scroll Hint */}
                    <motion.div
                        animate={{ y: [0, 8, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                        className="text-white/60 flex flex-col items-center"
                    >
                        <Mouse className="w-5 h-5 mb-1" />
                        <span className="text-[10px] tracking-wide uppercase">Scroll Down</span>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
