// components/selected-movie/reviewsSection.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Users2, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Review = {
  id: string;
  author: string;
  author_details: {
    name?: string;
    username?: string;
    avatar_path?: string;
    rating?: number;
  };
  content: string;
  created_at: string;
  updated_at: string;
  url: string;
};

interface ReviewsSectionProps {
  // accept either an array or TMDB-style object { results: Review[] }
  reviews: Review[] | { results?: Review[] } | undefined;
  contentId?: string; // optional id used to build the "view all" link
  contentType?: "movie" | "tv"; // default is movie; pass "tv" from your tv page
}

export default function ReviewsSection({
  reviews,
  contentId,
  contentType,
}: ReviewsSectionProps) {
  // Normalize incoming reviews to an array
  const reviewsArray: Review[] = Array.isArray(reviews)
    ? reviews
    : (reviews && (reviews as any).results) || [];

  const [localReviews, setLocalReviews] = useState<Review[]>(
    reviewsArray ? [...reviewsArray] : []
  );
  const [sortBy, setSortBy] = useState<"latest" | "highest" | "popularity">(
    "latest"
  );

  useEffect(() => {
    const map: Record<string, number> = {};
    localReviews.forEach((r) => {
      map[r.id] = Math.max(0, Math.round(popularityProxy(r) / 2));
    });
  }, []);

  function popularityProxy(r: Review) {
    const rating = r.author_details?.rating ?? 0;
    const lenScore = Math.min(5, (r.content?.length ?? 0) / 200);
    return rating + lenScore;
  }

  const sorted = useMemo(() => {
    const arr = [...localReviews];
    switch (sortBy) {
      case "latest":
        arr.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case "highest":
        arr.sort((a, b) => {
          const ra = a.author_details?.rating ?? -1;
          const rb = b.author_details?.rating ?? -1;
          if (ra === rb) {
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );
          }
          return rb - ra;
        });
        break;
      case "popularity":
        arr.sort((a, b) => popularityProxy(b) - popularityProxy(a));
        break;
    }
    return arr;
  }, [localReviews, sortBy]);

  const topThree = sorted.slice(0, 3);

  function addLocalReview(payload: {
    author: string;
    content: string;
    rating?: number;
  }) {
    const now = new Date().toISOString();
    const newReview: Review = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      author: payload.author || "Anonymous",
      author_details: {
        username: payload.author?.toLowerCase() || "anonymous",
        name: payload.author || undefined,
        avatar_path: undefined,
        rating: payload.rating ?? undefined,
      },
      content: payload.content,
      created_at: now,
      updated_at: now,
      url: "",
    };
    setLocalReviews((prev) => [newReview, ...prev]);
  }

  // build base path depending on contentType (movie or tv)
  const basePath = contentType === "tv" ? "tv" : "movies";
  const viewAllHref = contentId ? `/${basePath}/${contentId}/reviews` : "#";

  return (
    <section className="space-y-6">
      {/* Header + controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
            Audience Reviews
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Top community picks & latest opinions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs">
            <SortButton
              active={sortBy === "latest"}
              onClick={() => setSortBy("latest")}
            >
              Latest
            </SortButton>
            <SortButton
              active={sortBy === "highest"}
              onClick={() => setSortBy("highest")}
            >
              Highest
            </SortButton>
            <SortButton
              active={sortBy === "popularity"}
              onClick={() => setSortBy("popularity")}
            >
              Popularity
            </SortButton>
          </div>

          <div className="md:hidden">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-800/60 text-slate-200 rounded-lg px-3 py-2 text-sm border border-white/6 cursor-pointer"
            >
              <option value="latest">Latest</option>
              <option value="highest">Highest</option>
              <option value="popularity">Popularity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Top 3 grid - Fixed with proper constraints */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {topThree.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-1 md:col-span-3 text-slate-400"
            >
              No reviews yet — be the first to share your thoughts.
            </motion.div>
          ) : (
            topThree.map((r, idx) => (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                whileHover={{ scale: 1.02 }}
                className="relative rounded-2xl p-5 border border-white/8 bg-gradient-to-br from-slate-900/70 to-slate-800/70 shadow-lg overflow-hidden"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div className="flex-shrink-0">
                    <AvatarBlock review={r} />
                  </div>

                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Header section with author and rating */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs text-slate-100 font-semibold truncate">
                          {r.author}
                        </h3>
                        <div className="text-xs text-slate-400">
                          {new Date(r.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex-shrink-0 flex items-center gap-3">
                        <RatingDisplay rating={r.author_details?.rating} />
                        <div className="text-xs text-slate-400">
                          {(r.content?.length ?? 0) > 0
                            ? `${Math.min(
                                10,
                                Math.round(r.content.length / 25)
                              )} ch`
                            : ""}
                        </div>
                      </div>
                    </div>

                    {/* Review content with proper text wrapping */}
                    <div className="text-slate-300 text-sm leading-relaxed max-h-36 overflow-hidden">
                      <div className="relative">
                        <p className="line-clamp-6 break-words">{r.content}</p>
                      </div>
                    </div>

                    {/* Action buttons - wrapped properly */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Link to the dedicated all-reviews page */}
                        {contentId ? (
                          <Link
                            href={`/${basePath}/${contentId}/reviews?highlight=${encodeURIComponent(
                              r.id
                            )}`}
                            className="text-xs text-indigo-400 hover:underline truncate"
                          >
                            Read full review
                          </Link>
                        ) : (
                          <Link
                            href={r.url || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-indigo-400 hover:underline truncate"
                          >
                            Read full review
                          </Link>
                        )}
                      </div>

                      <div className="text-xs text-slate-400 flex-shrink-0">
                        #{idx + 1} of {sorted.length}
                      </div>
                    </div>
                  </div>
                </div>

                <svg
                  className="absolute top-3 right-3 opacity-8 w-8 h-8 text-slate-700"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M7 7h4v6H5V9a2 2 0 0 1 2-2zM17 7h4v6h-6V9a2 2 0 0 1 2-2z"
                    fill="currentColor"
                  />
                </svg>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* 'View all' button that navigates to the dedicated page */}
      <div className="pt-4">
        {contentId ? (
          <Link href={viewAllHref} className="inline-block">
            <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white text-sm font-medium shadow cursor-pointer">
              View all reviews
            </button>
          </Link>
        ) : (
          <a href={viewAllHref} className="inline-block">
            <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white text-sm font-medium shadow cursor-pointer">
              View all reviews
            </button>
          </a>
        )}
      </div>

      {/* Write a review form */}
      <div className="mt-8 rounded-3xl p-8 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 border-2 border-white/10 shadow-2xl">
        <ReviewForm onSubmit={addLocalReview} />
      </div>
    </section>
  );
}

/* ---------- small helpers (unchanged) ---------- */

function SortButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
        active
          ? "bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white shadow"
          : "bg-white/5 text-slate-200 hover:bg-white/6"
      }`}
    >
      {children}
    </button>
  );
}

function AvatarBlock({
  review,
  small = false,
}: {
  review: Review;
  small?: boolean;
}) {
  const size = small ? 36 : 56;
  const avatarSrc = (() => {
    const av = review.author_details?.avatar_path;
    if (!av) return null;
    if (av.startsWith("/https") || av.startsWith("/http")) return av.slice(1);
    return `https://image.tmdb.org/t/p/w185${av}`;
  })();

  const initials = (review.author || "A")
    .split(" ")
    .map((s) => s[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  return (
    <div
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      className="rounded-full overflow-hidden bg-slate-700 flex items-center justify-center ring-1 ring-white/6"
    >
      {avatarSrc ? (
        <Image
          src={avatarSrc}
          alt={review.author}
          width={size}
          height={size}
          className="object-cover"
        />
      ) : (
        <div className="text-slate-200 font-semibold">{initials}</div>
      )}
    </div>
  );
}

function RatingDisplay({ rating }: { rating?: number }) {
  if (typeof rating !== "number") {
    return <div className="text-xs text-slate-400">—</div>;
  }
  const raw = Math.max(0, Math.min(10, rating));
  const stars = Math.round((raw / 10) * 5 * 2) / 2;
  const full = Math.floor(stars);
  const half = stars % 1 >= 0.5;

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => {
          if (i < full) {
            return <Star key={i} size={14} className="text-yellow-300" />;
          }
          if (i === full && half) {
            return (
              <Star key={i} size={14} className="text-yellow-300 opacity-60" />
            );
          }
          return <Star key={i} size={14} className="text-slate-600" />;
        })}
      </div>
      <div className="text-xs text-slate-300 ml-2">{rating.toFixed(1)}/10</div>
    </div>
  );
}

function ReviewForm({
  onSubmit,
}: {
  onSubmit: (v: {
    author: string;
    content: string;
    rating?: number;
    mood?: string;
  }) => void;
}) {
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  const moods = [
    {
      emoji: "🎬",
      label: "Epic",
      value: "epic",
      color: "from-purple-500 to-pink-500",
    },
    {
      emoji: "❤️",
      label: "Loved",
      value: "loved",
      color: "from-red-500 to-rose-500",
    },
    {
      emoji: "😄",
      label: "Fun",
      value: "fun",
      color: "from-yellow-500 to-orange-500",
    },
    {
      emoji: "😮",
      label: "Shocking",
      value: "shocking",
      color: "from-blue-500 to-cyan-500",
    },
    {
      emoji: "😴",
      label: "Boring",
      value: "boring",
      color: "from-slate-500 to-gray-500",
    },
    {
      emoji: "💔",
      label: "Bad",
      value: "bad",
      color: "from-gray-600 to-slate-600",
    },
  ];

  function toggleStar(index: number) {
    const newRating = index * 2;
    setRating((prev) => (prev === newRating ? null : newRating));
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);

    if (!author.trim()) {
      setError("👤 Please enter your name");
      return;
    }

    if (!mood) {
      setError("🎭 Pick a mood that matches your vibe");
      return;
    }

    if (rating === null) {
      setError("⭐ Don't forget to rate it");
      return;
    }

    if (!content.trim() || content.trim().length < 10) {
      setError("✍️ Tell us more! At least 10 characters");
      return;
    }

    setSubmitting(true);
    try {
      onSubmit({
        author: author.trim(),
        content: content.trim(),
        rating: rating,
        mood: mood,
      });
      setAuthor("");
      setContent("");
      setRating(null);
      setMood(null);
    } finally {
      setSubmitting(false);
    }
  }

  const displayRating = hoveredStar !== null ? hoveredStar : rating;

  return (
    <div className="relative overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 animate-pulse" />

      <div className="relative backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Hero Header */}
          <div className="text-center pb-4 border-b border-white/10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 mb-3 shadow-lg">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </div>
            <h3 className="text-3xl font-black text-white mb-2">
              Drop Your Review
            </h3>
            <p className="text-slate-400">We'd love to hear what you think!</p>
          </div>

          {/* Two Column Layout */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left Column - Quick Info */}
            <div className="space-y-5">
              {/* Name Input Card */}
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-5 border border-white/10 backdrop-blur">
                <label className="block text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <span className="text-xl">👤</span>
                  Who are you?
                </label>
                <input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Enter your name..."
                  className="w-full bg-black/30 text-white placeholder-slate-500 rounded-xl px-4 py-3.5 border border-white/5 focus:border-violet-400/50 focus:ring-4 focus:ring-violet-400/10 transition-all outline-none text-lg"
                />
              </div>

              {/* Mood Selection Card */}
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-5 border border-white/10 backdrop-blur">
                <label className="block text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <span className="text-xl">🎭</span>
                  How did it make you feel?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {moods.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMood(m.value)}
                      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-300 cursor-pointer ${
                        mood === m.value
                          ? `bg-gradient-to-br ${m.color} shadow-lg scale-105`
                          : "bg-black/30 hover:bg-black/50 border border-white/10"
                      }`}
                    >
                      <span className="text-3xl">{m.emoji}</span>
                      <span
                        className={`text-xs font-semibold ${
                          mood === m.value ? "text-white" : "text-slate-400"
                        }`}
                      >
                        {m.label}
                      </span>
                      {mood === m.value && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-green-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Star Rating Card */}
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-5 border border-white/10 backdrop-blur">
                <label className="block text-sm font-bold text-slate-200 mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="text-xl">⭐</span>
                    Your Score
                  </span>
                </label>
                <div className="flex items-center justify-center gap-1 py-2">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const starValue = (i + 1) * 2;
                    const active =
                      displayRating !== null && displayRating >= starValue;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleStar(i + 1)}
                        onMouseEnter={() => setHoveredStar(starValue)}
                        onMouseLeave={() => setHoveredStar(null)}
                        className="p-1 transition-transform hover:scale-125 cursor-pointer"
                      >
                        <Star
                          size={36}
                          className={`transition-all duration-200 ${
                            active
                              ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
                              : "text-slate-700"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column - Review Text */}
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-5 border border-white/10 backdrop-blur h-full flex flex-col">
                <label className="block text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                  <span className="text-xl">💭</span>
                  Share your thoughts
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What stood out to you? Any favorite moments? Would you recommend it to others? Share the details..."
                  rows={11}
                  className="flex-1 w-full bg-black/30 text-white placeholder-slate-500 rounded-xl px-4 py-3 border border-white/5 focus:border-violet-400/50 focus:ring-4 focus:ring-violet-400/10 transition-all outline-none resize-none"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="group relative w-full sm:w-auto px-4 py-2 mt-3 rounded-lg bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white text-sm font-medium shadow cursor-pointer"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {submitting ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Publishing...
                      </>
                    ) : (
                      <>Post</>
                    )}
                  </span>
                </button>
                <div className="flex items-center justify-between mt-3 text-xs">
                  <span
                    className={`font-medium ${
                      content.length < 10 ? "text-slate-500" : "text-green-400"
                    }`}
                  >
                    {content.length} characters
                  </span>
                  <span className="text-slate-500">
                    {content.length < 10
                      ? `${10 - content.length} more needed`
                      : "✓ Good to go!"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 p-4 bg-red-500/10 border-2 border-red-500/30 rounded-xl backdrop-blur"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="text-lg">⚠️</span>
              </div>
              <span className="text-red-300 font-medium">{error}</span>
            </motion.div>
          )}

          {/* Submit Section */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2"></div>
        </form>
      </div>
    </div>
  );
}
