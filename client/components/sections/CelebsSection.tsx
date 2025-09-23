"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Person } from "@/types/person";
import { ChevronLeft, ChevronRight, Star, Heart, Award, Users } from "lucide-react";

async function fetchPeople() {
  const base = process.env.NEXT_PUBLIC_NEST_API_URL || "http://localhost:4000";
  const res = await fetch(`${base}/all/peoples`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as Person[];
}

export default function CelebSection() {
  const [celebs, setCelebs] = useState<Person[]>([]);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPeople().then(setCelebs);
  }, []);

  if (!celebs.length) return null;

  const scrollByAmount = (amount: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: amount,
        behavior: "smooth",
      });
    }
  };

  const getDepartmentIcon = (department: string) => {
    switch (department?.toLowerCase()) {
      case 'acting':
        return <Users size={12} />;
      case 'directing':
        return <Award size={12} />;
      default:
        return <Star size={12} />;
    }
  };

  const getPopularityLevel = (popularity: number) => {
    if (popularity >= 50) return { level: "Superstar", color: "text-yellow-400", bg: "bg-yellow-400/20" };
    if (popularity >= 25) return { level: "Rising", color: "text-green-400", bg: "bg-green-400/20" };
    if (popularity >= 10) return { level: "Popular", color: "text-blue-400", bg: "bg-blue-400/20" };
    return { level: "Talent", color: "text-purple-400", bg: "bg-purple-400/20" };
  };

  return (
    <section className="relative w-full px-4 sm:px-6 py-8 sm:py-12 mx-auto overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-900/10 via-transparent to-pink-900/10 pointer-events-none" />
      <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-br from-yellow-400/10 to-orange-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-40 h-40 bg-gradient-to-br from-pink-500/10 to-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-8 text-center sm:text-left"
      >
        <div className="flex items-center gap-3 justify-center sm:justify-start mb-2">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="p-2 rounded-full bg-gradient-to-r from-yellow-400/20 to-pink-500/20 backdrop-blur-sm border border-white/10"
          >
            <Star className="w-5 h-5 text-yellow-400" fill="currentColor" />
          </motion.div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
            Your Moodies Icons
          </h2>
        </div>
        <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto sm:mx-0">
          From red carpets to your screens — the stars shaping your moods and defining entertainment.
        </p>
      </motion.div>

      {/* Scrollable Row */}
      <div className="relative">
        <motion.div
          ref={scrollRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto scroll-smooth scrollbar-hide snap-x snap-mandatory px-2 pb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {celebs.map((celeb, index) => {
            const popularityInfo = getPopularityLevel(celeb.popularity || 0);

            return (
              <motion.div
                key={celeb.id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  delay: index * 0.1,
                  type: "spring",
                  stiffness: 100
                }}
                whileHover={{
                  scale: 1.05,
                  rotateY: 5,
                  z: 50
                }}
                onHoverStart={() => setHoveredCard(celeb.id)}
                onHoverEnd={() => setHoveredCard(null)}
                className="relative w-36 sm:w-40 lg:w-44 flex-shrink-0 snap-start group cursor-pointer"
                style={{ transformStyle: "preserve-3d" }}
              >
                {/* Main Card */}
                <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl shadow-2xl hover:shadow-3xl transition-all duration-500">
                  {/* Image Container */}
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <Image
                      src={
                        celeb.profile_path
                          ? `https://image.tmdb.org/t/p/w300${celeb.profile_path}`
                          : "/placeholder-person.png"
                      }
                      alt={celeb.name}
                      fill
                      className="object-cover transition-all duration-700 group-hover:scale-110"
                      sizes="(max-width: 640px) 144px, (max-width: 1024px) 160px, 176px"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />

                    {/* Popularity Badge */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 + 0.3 }}
                      className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-bold backdrop-blur-md border border-white/20 ${popularityInfo.bg} ${popularityInfo.color}`}
                    >
                      {popularityInfo.level}
                    </motion.div>

                    {/* Department Icon */}
                    <div className="absolute top-3 left-3 p-2 rounded-full bg-black/40 backdrop-blur-sm border border-white/20">
                      {getDepartmentIcon(celeb.known_for_department)}
                    </div>

                    {/* Basic Info - Always Visible */}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <motion.h3
                        className="text-base sm:text-lg font-bold text-white mb-1 line-clamp-2 drop-shadow-lg"
                        layout
                      >
                        {celeb.name}
                      </motion.h3>
                      <p className="text-xs sm:text-sm text-gray-300 truncate drop-shadow">
                        {celeb.known_for_department || "Actor"}
                      </p>
                    </div>
                  </div>

                  {/* Hover Overlay with Extended Info */}
                  <AnimatePresence>
                    {hoveredCard === celeb.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/85 to-transparent backdrop-blur-sm p-4 pt-8"
                      >
                        {/* Known For Works */}
                        <div className="space-y-2 mb-3">
                          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Heart size={12} className="text-pink-400" />
                            Known For
                          </h4>
                          <div className="space-y-1">
                            {celeb.known_for?.slice(0, 2).map((work, idx) => (
                              <div key={idx} className="flex items-center justify-between">
                                <span className="text-xs text-gray-300 truncate flex-1 mr-2">
                                  {work.title || work.name}
                                </span>
                                {work.vote_average && (
                                  <div className="flex items-center gap-1 text-xs text-yellow-400">
                                    <Star size={10} fill="currentColor" />
                                    <span>{work.vote_average.toFixed(1)}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-white/10 rounded-lg p-2 backdrop-blur-sm border border-white/10">
                            <div className="text-gray-400 mb-1">Popularity</div>
                            <div className="text-white font-semibold">
                              {Math.round(celeb.popularity || 0)}
                            </div>
                          </div>
                          <div className="bg-white/10 rounded-lg p-2 backdrop-blur-sm border border-white/10">
                            <div className="text-gray-400 mb-1">Works</div>
                            <div className="text-white font-semibold">
                              {celeb.known_for?.length || 0}+
                            </div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="w-full mt-3 px-3 py-2 bg-gradient-to-r from-purple-500/80 to-pink-500/80 text-white text-xs font-semibold rounded-lg backdrop-blur-sm border border-white/20 hover:from-purple-500 hover:to-pink-500 transition-all duration-300"
                        >
                          View Profile
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Subtle Glow Effect */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/20 via-transparent to-pink-500/20 blur-xl" />
                  </div>
                </div>

                {/* Floating Elements */}
                <motion.div
                  className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full opacity-0 group-hover:opacity-100"
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 180, 360]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              </motion.div>
            );
          })}
        </motion.div>

        {/* Enhanced Navigation Buttons */}
        <motion.button
          onClick={() => scrollByAmount(-400)}
          whileHover={{ scale: 1.1, x: -2 }}
          whileTap={{ scale: 0.9 }}
          className="absolute top-1/2 -left-2 -translate-y-1/2 p-3 rounded-full bg-gradient-to-r from-gray-800/90 to-gray-700/90 hover:from-gray-700 hover:to-gray-600 text-white backdrop-blur-md border border-white/20 shadow-xl transition-all duration-300"
        >
          <ChevronLeft className="w-5 h-5" />
        </motion.button>

        <motion.button
          onClick={() => scrollByAmount(400)}
          whileHover={{ scale: 1.1, x: 2 }}
          whileTap={{ scale: 0.9 }}
          className="absolute top-1/2 -right-2 -translate-y-1/2 p-3 rounded-full bg-gradient-to-r from-gray-800/90 to-gray-700/90 hover:from-gray-700 hover:to-gray-600 text-white backdrop-blur-md border border-white/20 shadow-xl transition-all duration-300"
        >
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}