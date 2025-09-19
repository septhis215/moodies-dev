"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Person } from "@/types/person";
import { ChevronLeft, ChevronRight } from "lucide-react";

async function fetchPeople() {
  const base = process.env.NEXT_PUBLIC_NEST_API_URL || "http://localhost:4000";
  const res = await fetch(`${base}/api/general/peoples`, { next: { revalidate: 60 } });
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
    <section className="py-12 bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 relative">
        {/* Heading */}
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Popular Celebs
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Must-watch hits from across the world.
          </p>
        </div>

        {/* Scrollable Row */}
        <div className="relative">
          <div
            ref={scrollRef}
            className="flex gap-5 overflow-x-auto scroll-smooth scrollbar-hide snap-x snap-mandatory"
          >
            {celebs.map((celeb) => (
              <motion.div
                key={celeb.id}
                whileHover={{ scale: 1.05 }}
                className="relative w-32 sm:w-36 flex-shrink-0 snap-start rounded-lg overflow-hidden shadow-md"
              >
                {/* Image */}
                <div className="relative aspect-[2/3] w-full">
                  <Image
                    src={
                      celeb.profile_path
                        ? `https://image.tmdb.org/t/p/w300${celeb.profile_path}`
                        : "/placeholder-person.png"
                    }
                    alt={celeb.name}
                    fill
                    className="object-cover"
                  />

                  {/* Gradient + Info Overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2">
                    <h3 className="text-xs font-semibold text-white truncate">
                      {celeb.name}
                    </h3>
                    <p className="text-[10px] text-gray-300 line-clamp-1">
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
            onClick={() => scrollByAmount(-200)}
            className="absolute top-1/2 left-0 -translate-y-1/2 p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 transition shadow-md"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scrollByAmount(200)}
            className="absolute top-1/2 right-0 -translate-y-1/2 p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 transition shadow-md"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
}