"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star, Users, Award, TrendingUp, Info } from "lucide-react";
import { useRouter } from "next/navigation";

// Type definitions
export interface Person {
  id: number;
  name: string;
  known_for_department: string;
  profile_path: string | null;
  popularity: number;
  known_for: {
    id: number;
    title?: string;
    name?: string;
    media_type: "movie" | "tv";
    poster_path?: string | null;
    overview?: string;
    vote_average?: number;
    release_date?: string;
    first_air_date?: string;
  }[];
}


async function fetchPeople() {
  const base = process.env.NEST_API_URL || 'http://localhost:4000';
  const res = await fetch(`${base}/all/peoples`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as Person[];
}

export default function CelebSection() {
  const [celebs, setCelebs] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleOpenPerson = (celeb: Person) => {
    // replace with your modal if you prefer (this navigates)
    router.push(`/person/${celeb.id}`);
  };

  const handleOpenWork = (work: any) => {
    if (work.media_type === "movie") {
      router.push(`/movies/${work.id}`);
    } else if (work.media_type === "tv") {
      router.push(`/tv/${work.id}`);
    }
  };

  useEffect(() => {
    fetchPeople().then(setCelebs).catch(() => setError('Failed to load celebrities')).finally(() => setLoading(false));
  }, []);

  const scrollByAmount = (amount: number) => {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  };

  const getDepartmentIcon = (department: string) => {
    switch (department?.toLowerCase()) {
      case 'acting':
        return <Users size={16} className="text-blue-400" />;
      case 'directing':
        return <Award size={16} className="text-purple-400" />;
      default:
        return <Star size={16} className="text-yellow-400" />;
    }
  };

  const getPopularityLevel = (popularity: number) => {
    if (popularity >= 40) return { level: "Top Tier", color: "text-red-400", bg: "bg-red-500/10" };
    if (popularity >= 20) return { level: "Popular", color: "text-orange-400", bg: "bg-orange-500/10" };
    if (popularity >= 10) return { level: "Rising", color: "text-green-400", bg: "bg-green-500/10" };
    return { level: "Emerging", color: "text-blue-400", bg: "bg-blue-500/10" };
  };

  if (loading) {
    return (
      <section className="relative w-full px-6 py-16 mx-auto">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-8">
            <div className="space-y-4">
              <div className="h-8 bg-gray-700 rounded-lg w-64"></div>
              <div className="h-4 bg-gray-800 rounded w-96"></div>
            </div>
            <div className="flex gap-6 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-72 h-96 bg-gray-800 rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="relative w-full px-6 py-16 mx-auto">
        <div className="max-w-7xl mx-auto text-center">
          <div className="p-8 bg-gray-800/50 rounded-2xl border border-gray-700">
            <p className="text-gray-400 text-lg mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors duration-200"
            >
              Try Again
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!celebs.length) return null;

  return (
    <section className="relative w-full px-6 py-16 mx-auto">
      <div className="mx-auto">

        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Your Moodies Icons
            </h2>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Discover the most popular stars and rising talents in entertainment
          </p>
        </motion.div>

        {/* Celebrity Cards */}
        <div className="relative">
          <motion.div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto scroll-smooth scrollbar-hide pb-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {celebs.map((celeb) => {
              const popularityInfo = getPopularityLevel(celeb.popularity || 0);

              return (
                <motion.div
                  key={celeb.id}
                  className="relative flex-shrink-0 w-44 group"
                  style={{ minHeight: "380px", maxHeight: "400px" }}
                >
                  {/* Main Card */}
                  <div className="flex flex-col h-full bg-black/70 backdrop-blur-md rounded-2xl overflow-hidden border border-gray-800/60 shadow-md hover:shadow-xl transition-all duration-300">

                    {/* --- Top: Profile Section --- */}
                    <div
                      onClick={() => handleOpenPerson(celeb)}
                      className="relative w-full h-48 cursor-pointer flex-shrink-0"
                    >
                      {/* Profile Image */}
                      <Image
                        src={
                          celeb.profile_path
                            ? `https://image.tmdb.org/t/p/w400${celeb.profile_path}`
                            : "/placeholder-person.png"
                        }
                        alt={celeb.name}
                        fill
                        className="object-cover object-top brightness-105 contrast-105 group-hover: opacity-100 transition-transform duration-500"
                        sizes="256px"
                      />

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-40 group-hover:opacity-80 transition" />

                      {/* Popularity Badge */}
                      <div
                        className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium 
      border border-white/10 backdrop-blur-sm 
      ${popularityInfo.bg} ${popularityInfo.color}`}
                      >
                        {popularityInfo.level}
                      </div>

                      {/* Department Icon */}
                      <div className="absolute top-3 left-3 p-2 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10">
                        {getDepartmentIcon(celeb.known_for_department)}
                      </div>
                    </div>


                    {/* --- Bottom: Content Section --- */}
                    <div className="flex-1 flex flex-col p-4 justify-between bg-black/50 h-[calc(400px-192px)]">
                      {/* Name & Info */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3
                            className="text-md font-semibold text-white line-clamp-2 cursor-pointer hover:text-[#e94f37] transition"
                            onClick={() => handleOpenPerson(celeb)}
                          >
                            {celeb.name}
                          </h3>
                          <button
                            onClick={() => handleOpenPerson(celeb)}
                            className="ml-1 shrink-0 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
                            aria-label={`More info about ${celeb.name}`}
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        </div>

                        <p className="text-xs text-gray-400 mb-2">
                          {celeb.known_for_department || "Entertainment"}
                        </p>
                      </div>

                      {/* Notable Works */}
                      {celeb.known_for && celeb.known_for.length > 0 ? (
                        <div className="space-y-1 overflow-hidden">
                          <p className="text-xs text-gray-500">Notable Works</p>
                          {celeb.known_for.slice(0, 1).map((work: any, idx: number) => (
                            <div
                              key={idx}
                              onClick={() => handleOpenWork(work)}
                              className="flex items-center gap-2 p-2 rounded-md bg-gray-800/50 border border-gray-700/30 hover:bg-gray-700/50 cursor-pointer transition"
                            >
                              {/* Thumbnail */}
                              <div className="w-10 h-14 rounded-md overflow-hidden bg-gray-700">
                                {work.poster_path ? (
                                  <Image
                                    src={`https://image.tmdb.org/t/p/w154${work.poster_path}`}
                                    alt={work.title || work.name}
                                    width={40}
                                    height={56}
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-300">N/A</div>
                                )}
                              </div>

                              {/* Work Meta */}
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-white font-medium truncate block">
                                  {work.title || work.name}
                                </span>
                                {work.release_date || work.first_air_date ? (
                                  <span className="text-[11px] text-gray-400">
                                    {new Date(work.release_date ?? work.first_air_date).getFullYear()}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">No notable works</div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Navigation Buttons */}
          <button
            onClick={() => scrollByAmount(-400)}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 p-3 rounded-full bg-gray-900/80 hover:bg-gray-800 text-white backdrop-blur-sm border border-gray-700 shadow-lg transition-all duration-200 hover:scale-110"
            aria-label="Previous celebrities"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            onClick={() => scrollByAmount(400)}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 p-3 rounded-full bg-gray-900/80 hover:bg-gray-800 text-white backdrop-blur-sm border border-gray-700 shadow-lg transition-all duration-200 hover:scale-110"
            aria-label="Next celebrities"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Custom scrollbar styles */}
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