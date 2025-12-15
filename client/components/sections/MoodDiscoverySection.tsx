"use client";

import { useState, useEffect } from 'react';
import { Sparkles, Heart, Compass, Brain, Film, Tv, ArrowRight, Zap, Stars } from 'lucide-react';
import Link from 'next/link';

export default function MoodDiscoverySection() {
  const [hoveredCard, setHoveredCard] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const cards = [
    {
      id: 'wheel',
      title: 'Mood Wheels',
      subtitle: 'Spin Your Way',
      description: 'Interactive wheels that adapt to your feelings',
      href: '/moods',
      icon: Compass,
      gradient: 'from-purple-600 via-pink-600 to-rose-600',
      accentColor: 'bg-purple-500',
      emoji: '🎭',
      stats: '50+ Moods'
    },
    {
      id: 'tv-moods',
      title: 'TV Matcher',
      subtitle: 'Perfect Series',
      description: 'Find shows that match your current vibe',
      href: '/tv#moods',
      icon: Tv,
      gradient: 'from-cyan-600 via-blue-600 to-indigo-600',
      accentColor: 'bg-cyan-500',
      emoji: '📺',
      stats: '50K+ Shows'
    },
    {
      id: 'movie-moods',
      title: 'Movie Matcher',
      subtitle: 'Cinema for You',
      description: 'Discover films tailored to your emotions',
      href: '/movie#moods',
      icon: Film,
      gradient: 'from-orange-600 via-red-600 to-pink-600',
      accentColor: 'bg-orange-500',
      emoji: '🎬',
      stats: '50K+ Films'
    },
    {
      id: 'quiz',
      title: 'Personality Quiz',
      subtitle: 'Know Yourself',
      description: 'Get personalized recommendations by answering fun questions',
      href: '/quiz',
      icon: Brain,
      gradient: 'from-violet-600 via-purple-600 to-fuchsia-600',
      accentColor: 'bg-violet-500',
      emoji: '✨',
      stats: '95% Match Rate'
    }
  ];

  return (
    <section
      id="your-moods"
      className="relative bg-black py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-10">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
          style={{
            backgroundColor: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(148,163,184,0.06)",
            color: "#e6e6e6",
          }}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI-powered discovery</span>
          <Zap className="w-4 h-4" />
        </div>

        <h2 className="mt-6 text-3xl sm:text-4xl lg:text-4xl font-extrabold text-white tracking-tight">
          Find your perfect{" "}
          <span >Mood Match</span>
        </h2>

        <p className="mt-3 text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto">
          Personalized content and recommendations based on your mood — simple,
          fast and unobtrusive.
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          const isHovered = hoveredCard === card.id;

          return (
            <Link
              key={card.id}
              href={card.href}
              className="relative group"
              onMouseEnter={() => setHoveredCard(card.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              {/* outer glow */}
              <div
                className={`absolute inset-0 rounded-3xl blur-2xl transition-opacity duration-300 
          ${isHovered ? "opacity-50" : "opacity-30"}`}
              >
                <div className={`w-full h-full bg-gradient-to-br ${card.gradient}`} />
              </div>

              <div
                className={`relative h-full rounded-3xl overflow-hidden
          bg-gradient-to-br ${card.gradient}
          transition-all duration-300
          ${isHovered ? "scale-[1.05] -translate-y-2" : "scale-100"}
          `}
              >
                {/* dark overlay for readability */}
                <div className="absolute inset-0 bg-black/45" />

                {/* shimmer highlight */}
                <div
                  className={`absolute inset-0 transition-opacity duration-500
            ${isHovered ? "opacity-60" : "opacity-0"}`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
                </div>

                {/* content */}
                <div className="relative p-6 flex flex-col min-h-[260px] text-white">
                  {/* top row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/20 backdrop-blur border border-white/30 shadow-lg">
                      <Icon className="w-6 h-6 text-white" />
                    </div>

                    <span className="text-xs font-semibold text-white/80">
                      {card.stats}
                    </span>
                  </div>

                  {/* emoji accent */}
                  <div
                    className={`absolute right-4 top-4 text-7xl transition-all duration-500
              ${isHovered ? "opacity-40 scale-125 rotate-6" : "opacity-25"}`}
                  >
                    {card.emoji}
                  </div>

                  {/* text */}
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wide text-white/80 mb-1">
                      {card.subtitle}
                    </p>
                    <h3 className="text-2xl font-black leading-tight">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm text-white/85">
                      {card.description}
                    </p>
                  </div>

                  {/* CTA */}
                  <div className="mt-6">
                    <div
                      className={`flex items-center justify-between px-4 py-3 rounded-xl
                bg-gradient-to-r from-black/30 to-black/10
                border border-white/20
                transition-all duration-300
                ${isHovered ? "translate-x-1" : ""}
                `}
                    >
                      <span className="font-bold">Explore</span>
                      <ArrowRight
                        className={`w-4 h-4 transition-transform duration-300
                  ${isHovered ? "translate-x-1" : ""}`}
                      />
                    </div>
                  </div>
                </div>
              </div>


            </Link>
          );
        })}
      </div>


      <style>{`
        /* small accessibility improvement: focus outline */
        a:focus > div {
          outline: 3px solid rgba(233,79,55,0.12);
          outline-offset: 3px;
        }
      `}</style>
    </section>
  );
}