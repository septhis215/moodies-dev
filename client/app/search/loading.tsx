// app/search/loading.tsx - Search Results Loading Screen
"use client";

import { motion, Variants } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  Filter,
  Star,
  Calendar,
  Globe,
  Film,
  Tv,
  Grid3X3,
  List,
  SlidersHorizontal,
  Loader2
} from "lucide-react";

export default function SearchLoading() {
  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const slideUp: Variants = {
    initial: { y: 20, opacity: 0 },
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.4,
        ease: "easeOut",
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

  const pulseVariants: Variants = {
    animate: {
      scale: [1, 1.02, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 pt-24 pb-8">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-8"
        >
          {/* Header Section */}
          <motion.div variants={slideUp} className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Search className="text-orange-500" size={24} />
              </motion.div>
              <Skeleton className="h-8 w-80 bg-gray-800/50" />
            </div>

            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-48 bg-gray-800/30" />
              <div className="flex gap-2">
                <Badge variant="outline" className="animate-pulse bg-orange-500/10 border-orange-500/30 text-orange-400">
                  <Loader2 size={12} className="animate-spin mr-1" />
                  Searching...
                </Badge>
              </div>
            </div>
          </motion.div>

          {/* Advanced Filters Section */}
          <motion.div
            variants={slideUp}
            className="bg-gray-800/40 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 shadow-2xl"
          >
            <div className="space-y-6">
              {/* Filter Header */}
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  disabled
                  className="bg-gradient-to-r from-gray-800/80 to-gray-700/80 backdrop-blur-sm border-gray-600 text-white opacity-70"
                >
                  <SlidersHorizontal size={16} className="mr-2" />
                  Advanced Filters
                  <Badge variant="secondary" className="ml-2 animate-pulse">
                    Loading
                  </Badge>
                </Button>

                {/* Quick Filter Badges */}
                <div className="flex gap-3">
                  {['All', 'Movies', 'TV Shows'].map((label, i) => (
                    <Badge
                      key={label}
                      variant="outline"
                      className="border-gray-600 text-gray-400 animate-pulse"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Filter Skeleton Content */}
              <div className="grid gap-6">
                {/* Sort Options Skeleton */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Filter className="text-blue-400 animate-pulse" size={14} />
                    <Skeleton className="h-4 w-32 bg-gray-700/50" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <motion.div
                        key={i}
                        variants={pulseVariants}
                        animate="animate"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      >
                        <Skeleton className="h-10 bg-gray-700/30 rounded-lg" />
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Slider Skeletons */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Year Range */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="text-blue-400 animate-pulse" size={14} />
                      <Skeleton className="h-4 w-24 bg-gray-700/50" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-2 w-full bg-gray-700/30 rounded-full" />
                      <div className="flex justify-between">
                        <Skeleton className="h-6 w-16 bg-gray-700/30" />
                        <Skeleton className="h-6 w-16 bg-gray-700/30" />
                      </div>
                    </div>
                  </div>

                  {/* Rating Range */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Star className="text-yellow-400 animate-pulse" size={14} />
                      <Skeleton className="h-4 w-24 bg-gray-700/50" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-2 w-full bg-gray-700/30 rounded-full" />
                      <div className="flex justify-between">
                        <Skeleton className="h-6 w-16 bg-gray-700/30" />
                        <Skeleton className="h-6 w-16 bg-gray-700/30" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Genre/Country Badges Skeleton */}
                <div className="grid gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Film className="text-purple-400 animate-pulse" size={14} />
                      <Skeleton className="h-4 w-16 bg-gray-700/50" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <Skeleton
                          key={i}
                          className="h-8 bg-gray-700/30 rounded-lg animate-pulse"
                          style={{ animationDelay: `${i * 0.1}s` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Globe className="text-green-400 animate-pulse" size={14} />
                      <Skeleton className="h-4 w-20 bg-gray-700/50" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <Skeleton
                          key={i}
                          className="h-8 bg-gray-700/30 rounded-lg animate-pulse"
                          style={{ animationDelay: `${i * 0.1}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Best Match Skeleton */}
          <motion.div variants={slideUp} className="space-y-6">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <Star className="text-yellow-400" size={24} />
              </motion.div>
              <Skeleton className="h-6 w-40 bg-gray-800/50" />
            </div>

            <div className="bg-gradient-to-r from-gray-800/50 via-gray-800/30 to-gray-800/50 backdrop-blur-md rounded-3xl p-8 border border-gray-700/50 shadow-2xl">
              <div className="flex flex-col lg:flex-row gap-8">
                <motion.div
                  variants={pulseVariants}
                  animate="animate"
                  className="flex-shrink-0"
                >
                  <Skeleton className="w-48 h-72 bg-gray-700/50 rounded-2xl" />
                </motion.div>

                <div className="flex-1 space-y-6">
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <Skeleton className="h-6 w-20 bg-gray-700/40 rounded-full" />
                      <Skeleton className="h-6 w-16 bg-gray-700/40 rounded-full" />
                    </div>
                    <Skeleton className="h-10 w-3/4 bg-gray-700/50" />
                    <div className="flex gap-4">
                      <Skeleton className="h-4 w-20 bg-gray-700/40" />
                      <Skeleton className="h-4 w-24 bg-gray-700/40" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full bg-gray-700/40" />
                    <Skeleton className="h-4 w-5/6 bg-gray-700/40" />
                    <Skeleton className="h-4 w-2/3 bg-gray-700/40" />
                  </div>

                  <div className="flex gap-3">
                    <Skeleton className="h-6 w-16 bg-gray-700/40 rounded-full" />
                    <Skeleton className="h-6 w-20 bg-gray-700/40 rounded-full" />
                  </div>

                  <div className="flex gap-4">
                    <Skeleton className="h-10 w-32 bg-gradient-to-r from-orange-500/30 to-red-500/30 rounded-lg" />
                    <Skeleton className="h-10 w-28 bg-gray-700/40 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Results Grid */}
          <motion.div variants={slideUp} className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="text-gray-400" size={20} />
                <Skeleton className="h-6 w-32 bg-gray-800/50" />
              </div>

              <div className="flex gap-2">
                <Skeleton className="h-10 w-10 bg-gray-800/50 rounded-lg" />
                <Skeleton className="h-10 w-10 bg-gray-800/50 rounded-lg" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <motion.div
                  key={i}
                  variants={slideUp}
                  className="space-y-3"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <motion.div
                    variants={pulseVariants}
                    animate="animate"
                    style={{ animationDelay: `${i * 0.2}s` }}
                    className="relative"
                  >
                    <Skeleton className="aspect-[2/3] w-full bg-gray-800/50 rounded-xl" />
                    <div className="absolute top-3 right-3">
                      <Skeleton className="h-6 w-12 bg-black/60 rounded-lg" />
                    </div>
                    <div className="absolute bottom-3 left-3">
                      <Skeleton className="h-5 w-14 bg-blue-500/30 rounded-full" />
                    </div>
                  </motion.div>
                  <Skeleton className="h-4 w-full bg-gray-800/50" />
                  <Skeleton className="h-3 w-3/4 bg-gray-800/30" />
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Pagination Skeleton */}
          <motion.div variants={slideUp} className="flex justify-center items-center gap-3 mt-12">
            <Skeleton className="h-12 w-20 bg-gray-800/50 rounded-lg" />
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-12 bg-gray-800/50 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-12 w-16 bg-gray-800/50 rounded-lg" />
          </motion.div>
        </motion.div>
      </div>

      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 3 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-orange-500/30 rounded-full"
            animate={{
              x: [0, window.innerWidth || 1200],
              y: [
                Math.random() * (window.innerHeight || 800),
                Math.random() * (window.innerHeight || 800)
              ],
              opacity: [0, 0.6, 0]
            }}
            transition={{
              duration: 6 + Math.random() * 3,
              repeat: Infinity,
              delay: i * 3,
              ease: "linear"
            }}
            style={{
              left: -10,
              top: Math.random() * 100 + '%'
            }}
          />
        ))}
      </div>
    </div>
  );
}