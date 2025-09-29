// app/loading.tsx - Global App Loading Screen
"use client";

import { motion, Variants } from "framer-motion";
import {
    Film,
    Tv,
    Star,
    Play,
    Sparkles,
    Loader2,
} from "lucide-react";

export default function AppLoading() {


    const pulseVariants: Variants = {
        initial: { scale: 1, opacity: 0.7 },
        animate: {
            scale: [1, 1.05, 1],
            opacity: [0.7, 1, 0.7],
            transition: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
            }
        }
    };

    const floatingVariants: Variants = {
        animate: {
            y: [-10, 10, -10],
            transition: {
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
            }
        }
    };

    const shimmerVariants: Variants = {
        animate: {
            backgroundPosition: ["200% 0", "-200% 0"],
            transition: {
                duration: 2,
                repeat: Infinity,
                ease: "linear"
            }
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex flex-col items-center justify-center">
            {/* Main Loading Content */}
            <div className="text-center space-y-8 max-w-md mx-auto px-6">
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
                            <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl">
                                <Play className="text-white" size={28} fill="white" />
                            </div>
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                className="absolute -inset-2 border-2 border-dashed border-orange-500/30 rounded-3xl"
                            />
                        </motion.div>
                    </div>

                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent mb-2">
                        Moodies
                    </h1>
                    <p className="text-gray-400 text-lg">Your gateway to movies & shows that match your vibe</p>
                </motion.div>

                {/* Loading Spinner */}
                <div className="flex items-center justify-center gap-3">
                    <Loader2 className="animate-spin text-orange-500" size={24} />
                    <span className="text-gray-300 font-medium">Finding the perfect stories for you...</span>
                </div>

                {/* Floating Icons */}
                <div className="flex justify-center gap-6">
                    {[
                        { Icon: Film, delay: 0, color: "text-purple-400" },
                        { Icon: Tv, delay: 0.5, color: "text-blue-400"},
                        { Icon: Star, delay: 1, color: "text-yellow-400" },
                        { Icon: Sparkles, delay: 1.5, color: "text-pink-400" }
                    ].map(({ Icon, delay, color }, index) => (
                        <motion.div
                            key={index}
                            animate={{
                                y: [-5, 5, -5],
                                rotate: [0, 10, -10, 0],
                            }}
                            transition={{
                                duration: 2,
                                delay,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className={`${color} opacity-60`}
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
                            style={{ backgroundSize: '200% 100%' }}
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        Curating recommendations tailored to your mood...
                    </p>
                </div>
            </div>

            {/* Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {Array.from({ length: 5 }).map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-orange-500/20 rounded-full"
                        animate={{ x: [0, window.innerWidth || 1200], y: [Math.random() * (window.innerHeight || 800), Math.random() * (window.innerHeight || 800)], opacity: [0, 1, 0] }}
                        transition={{
                            duration: 8 + Math.random() * 4,
                            repeat: Infinity,
                            delay: i * 2,
                            ease: "linear"
                        }}
                        style={{
                            left: -10,
                            top: `${Math.random() * 100}%`
                        }}
                    />
                ))}
            </div>
        </div>
    );
}