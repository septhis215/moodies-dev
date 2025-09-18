"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
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
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetchPeople().then(setCelebs);
  }, []);

  const visibleCards = 4; // how many celebs to show per slide
  const totalSlides = Math.ceil(celebs.length / visibleCards);

  const next = () => setIndex((prev) => (prev + 1) % totalSlides);
  const prev = () => setIndex((prev) => (prev - 1 + totalSlides) % totalSlides);

  if (!celebs.length) return null;

  return (
    <section className="py-12 bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 relative">
        {/* Heading */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Popular Celebs
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Must-watch hits from across the world.
          </p>
        </div>

        {/* Carousel Container */}
        <div className="relative overflow-hidden">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          >
            {celebs
              .slice(index * visibleCards, index * visibleCards + visibleCards)
              .map((celeb) => (
                <div className="bg-gray-900 rounded-xl flex items-center gap-3 p-3 shadow-md hover:scale-[1.02] transition-transform">
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={
                        celeb.profile_path
                          ? `https://image.tmdb.org/t/p/w200${celeb.profile_path}`
                          : "/placeholder-person.png"
                      }
                      alt={celeb.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold truncate">{celeb.name}</h3>
                    <p className="text-gray-400 text-xs line-clamp-1">
                      {celeb.known_for.map((work) => work.title || work.name).join(", ")}
                    </p>
                  </div>
                </div>



              ))}
          </motion.div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-center gap-4 mt-8">
          <button
            onClick={prev}
            className="p-3 rounded-full bg-gray-800 hover:bg-gray-700 transition"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={next}
            className="p-3 rounded-full bg-gray-800 hover:bg-gray-700 transition"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </section>
  );
}
