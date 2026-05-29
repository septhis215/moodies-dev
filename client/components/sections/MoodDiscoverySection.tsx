"use client";

import { useState, useEffect } from 'react';
import { Sparkles, Heart, Compass, Brain, Film, Tv, ArrowRight, Zap, Stars } from 'lucide-react';
import Link from 'next/link';

export default function MoodDiscoverySection() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
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
      className="relative mx-auto max-w-7xl bg-black px-4 py-10 sm:px-6 sm:py-16 lg:px-8"
    >
      {/* Header */}
      <div className="mb-6 text-left sm:mb-10 sm:text-center">
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

        <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-white sm:mt-6 sm:text-4xl lg:text-4xl">
          Find your perfect{" "}
          <span >Mood Match</span>
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:mx-auto sm:text-base">
          Personalized content and recommendations based on your mood — simple,
          fast and unobtrusive.
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
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
                className={`absolute inset-0 rounded-xl blur-xl transition-opacity duration-300 sm:rounded-3xl sm:blur-2xl 
          ${isHovered ? "opacity-50" : "opacity-30"}`}
              >
                <div className={`w-full h-full bg-gradient-to-br ${card.gradient}`} />
              </div>

              <div
                className={`relative h-full overflow-hidden rounded-xl sm:rounded-3xl
          bg-gradient-to-br ${card.gradient}
          transition-all duration-300
                  ${isHovered ? "sm:scale-[1.05] sm:-translate-y-2" : "scale-100"}
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
                <div className="relative flex min-h-[150px] flex-col p-4 text-white sm:min-h-[260px] sm:p-6">
                  {/* top row */}
                  <div className="mb-3 flex items-start justify-between sm:mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/30 bg-white/20 shadow-lg backdrop-blur sm:h-12 sm:w-12 sm:rounded-xl">
                      <Icon className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                    </div>

                    <span className="text-xs font-semibold text-white/80">
                      {card.stats}
                    </span>
                  </div>

                  {/* emoji accent */}
                  <div
                    className={`absolute right-4 top-4 text-5xl transition-all duration-500 sm:text-7xl
              ${isHovered ? "opacity-40 scale-125 rotate-6" : "opacity-25"}`}
                  >
                    {card.emoji}
                  </div>

                  {/* text */}
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wide text-white/80 mb-1">
                      {card.subtitle}
                    </p>
                    <h3 className="text-xl font-black leading-tight sm:text-2xl">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm text-white/85">
                      {card.description}
                    </p>
                  </div>

                  {/* CTA */}
                  <div className="mt-4 sm:mt-6">
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
