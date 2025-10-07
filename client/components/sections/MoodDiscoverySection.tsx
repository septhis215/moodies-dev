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
    <section className="relative bg-black py-22 px-4 sm:px-6 lg:px-8 overflow-hidden max-w-7xl mx-auto">
      {/* Dynamic Animated Background */}
      <div className="absolute inset-0 opacity-30">
        <div
          className="absolute w-[600px] h-[600px] bg-purple-600 rounded-full blur-3xl transition-all duration-1000 ease-out"
          style={{
            left: `${mousePosition.x * 0.5}%`,
            top: `${mousePosition.y * 0.5}%`,
            transform: 'translate(-50%, -50%)'
          }}
        ></div>
        <div
          className="absolute w-[500px] h-[500px] bg-pink-600 rounded-full blur-3xl transition-all duration-1000 ease-out"
          style={{
            right: `${(100 - mousePosition.x) * 0.3}%`,
            bottom: `${(100 - mousePosition.y) * 0.3}%`,
            transform: 'translate(50%, 50%)'
          }}
        ></div>
        <div className="absolute w-[400px] h-[400px] bg-blue-600 rounded-full blur-3xl top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full opacity-20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${5 + Math.random() * 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`
            }}
          ></div>
        ))}
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Enhanced Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600/30 to-pink-600/30 backdrop-blur-sm border border-purple-500/30 text-white px-5 py-2.5 rounded-full text-sm font-semibold mb-6 shadow-lg shadow-purple-500/20">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>AI-Powered Discovery</span>
            <Zap className="w-4 h-4" />
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 tracking-tight">
            Find Your Perfect{' '}
            <span className="relative inline-block">
              <span className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 blur-xl opacity-50"></span>
              <span className="relative bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">
                Mood Match
              </span>
            </span>
          </h2>

          <p className="text-gray-400 text-base sm:text-md max-w-2xl mx-auto leading-relaxed">
            Unlock personalized content through intelligent mood detection and interactive discovery tools
          </p>
        </div>

        {/* Enhanced Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {cards.map((card, index) => {
            const Icon = card.icon;
            const isHovered = hoveredCard === card.id;

            return (
              <Link
                key={card.id}
                href={card.href}
                className="group relative"
                onMouseEnter={() => setHoveredCard(card.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  animationDelay: `${index * 100}ms`
                }}
              >
                {/* Card Container with 3D effect */}
                <div className={`relative overflow-hidden rounded-3xl transition-all duration-500 ${isHovered ? 'scale-105 -translate-y-2' : 'scale-100'
                  }`}
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: isHovered ? 'rotateX(5deg) rotateY(-5deg)' : 'rotateX(0) rotateY(0)'
                  }}>
                  {/* Multi-layer Gradient Background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-95`}></div>
                  <div className={`absolute inset-0 bg-gradient-to-t from-black/40 to-transparent`}></div>

                  {/* Animated mesh gradient overlay */}
                  <div className="absolute inset-0 opacity-30">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent animate-pulse"></div>
                  </div>

                  {/* Noise Texture */}
                  <div className="absolute inset-0 opacity-10 mix-blend-overlay" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`
                  }}></div>

                  {/* Shimmer effect */}
                  <div className={`absolute inset-0 transition-all duration-700 ${isHovered ? 'opacity-100' : 'opacity-0'
                    }`}>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 animate-shimmer"></div>
                  </div>

                  {/* Content */}
                  <div className="relative p-6 flex flex-col h-full min-h-[240px]">
                    {/* Large Emoji Background with parallax */}
                    <div className={`absolute right-2 top-2 text-7xl transition-all duration-700 ${isHovered ? 'scale-125 rotate-12 opacity-40' : 'scale-100 rotate-0 opacity-20'
                      }`}>
                      {card.emoji}
                    </div>

                    {/* Top Row: Icon Badge + Stats */}
                    <div className="flex items-start justify-between mb-4">
                      <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 shadow-xl transition-all duration-500 ${isHovered ? 'scale-110 rotate-6 bg-white/30' : 'scale-100 rotate-0'
                        }`}>
                        <Icon className="w-7 h-7 text-white drop-shadow-lg" />
                      </div>

                      <div className={`px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 transition-all duration-300 ${isHovered ? 'scale-105' : 'scale-100'
                        }`}>
                        <p className="text-xs font-bold text-white">{card.stats}</p>
                      </div>
                    </div>

                    {/* Text Content */}
                    <div className="flex-1 space-y-2">
                      <div className={`inline-block px-2 py-0.5 rounded-md ${card.accentColor} bg-opacity-20 backdrop-blur-sm mb-1`}>
                        <p className="text-xs font-semibold text-white/90">{card.subtitle}</p>
                      </div>

                      <h3 className="text-2xl font-black text-white tracking-tight leading-tight">
                        {card.title}
                      </h3>

                      <p className="text-white/80 text-sm leading-relaxed">
                        {card.description}
                      </p>
                    </div>

                    {/* Enhanced CTA */}
                    <div className={`flex items-center justify-between mt-5 pt-4 border-t border-white/10 transition-all duration-300 ${isHovered ? 'translate-x-0' : '-translate-x-1'
                      }`}>
                      <div className="flex items-center gap-2 text-white font-bold text-sm">
                        <span>Explore Now</span>
                        <ArrowRight className={`w-4 h-4 transition-transform duration-300 ${isHovered ? 'translate-x-2' : 'translate-x-0'
                          }`} />
                      </div>
                      <Stars className={`w-5 h-5 text-white/60 transition-all duration-300 ${isHovered ? 'rotate-180 text-white' : 'rotate-0'
                        }`} />
                    </div>
                  </div>

                  {/* Bottom Glow Line */}
                  <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white to-transparent transition-opacity duration-300 ${isHovered ? 'opacity-60' : 'opacity-0'
                    }`}></div>

                  {/* Corner Accent */}
                  <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/20 to-transparent rounded-bl-3xl transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'
                    }`}></div>
                </div>

                {/* Enhanced Outer Glow */}
                <div className={`absolute inset-0 rounded-3xl transition-all duration-500 ${isHovered ? 'opacity-100 scale-105' : 'opacity-0 scale-100'
                  } -z-10`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} blur-2xl opacity-60`}></div>
                </div>

                {/* Hover Ring */}
                <div className={`absolute inset-0 rounded-3xl border-2 border-white/0 transition-all duration-300 ${isHovered ? 'border-white/30 scale-105' : 'border-white/0 scale-100'
                  }`}></div>
              </Link>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%) skewX(-12deg);
          }
          100% {
            transform: translateX(200%) skewX(-12deg);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
      `}</style>
    </section>
  );
}