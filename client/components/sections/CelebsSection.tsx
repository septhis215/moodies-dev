"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Person } from "@/types/person";
import { ChevronLeft, ChevronRight } from "lucide-react";

async function fetchPeople() {
  const base = process.env.NEXT_PUBLIC_NEST_API_URL || "http://localhost:4000";
  const res = await fetch(`${base}/all/peoples`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as Person[];
}

export default function CelebSection() {
  const [celebs, setCelebs] = useState<Person[]>([]);
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

  return (
    <section className="relative w-full px-6 py-12 mx-auto">
      {/* Section header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Your Moodies Icons
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            From red carpets to your screens — the stars shaping your moods.
          </p>
        </div>
      </div>
      {/* Scrollable Row */}
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto scroll-smooth scrollbar-hide snap-x snap-mandatory px-1"
        >
          {celebs.map((celeb) => (
            <motion.div
              key={celeb.id}
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="relative w-28 sm:w-32 flex-shrink-0 snap-start rounded-xl overflow-hidden
               border border-white/20 bg-white/10 backdrop-blur-md shadow-lg"
            >
              {/* Image */}
              <div className="relative aspect-[2/3]">
                <Image
                  src={
                    celeb.profile_path
                      ? `https://image.tmdb.org/t/p/w300${celeb.profile_path}`
                      : "/placeholder-person.png"
                  }
                  alt={celeb.name}
                  fill
                  className="object-cover opacity-80"
                  sizes="(max-width: 640px) 112px, 128px"
                />

                {/* Overlay (gradient for better text visibility) */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2">
                  <h3 className="text-sm font-semibold text-white truncate drop-shadow">
                    {celeb.name}
                  </h3>
                  <p className="text-[11px] text-gray-200 truncate drop-shadow-sm">
                    {celeb.known_for
                      .map((work) => work.title || work.name)
                      .slice(0, 1)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}

        </div>

        {/* Navigation Buttons */}
        <button
          onClick={() => scrollByAmount(-600)}
          className="absolute top-1/2 left-0 -translate-y-1/2 p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 transition shadow-md"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => scrollByAmount(600)}
          className="absolute top-1/2 right-0 -translate-y-1/2 p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 transition shadow-md"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div >

    </section >
  );
}