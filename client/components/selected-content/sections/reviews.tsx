// components/selected-movie/reviewsSection.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Users2, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import { useAuth } from "@/app/context/AuthProvider";

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
      author: "Guest User",
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
                    <div className="text-slate-300 text-sm leading-relaxed">
                      <div className="relative">
                        <p className="break-words">{r.content}</p>
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
      <div className="mt-8 rounded-3xl p-6 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 shadow-2xl">
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
  const { isAuthenticated, user } = useAuth();
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  // Set author name from authenticated user on mount
  useEffect(() => {
    if (isAuthenticated && user) {
      setAuthor(user.username ?? user.name ?? "");
    }
  }, [isAuthenticated, user]);

  function toggleStar(index: number) {
    const newRating = index * 2;
    setRating((prev) => (prev === newRating ? null : newRating));
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);

    // Check if user is authenticated
    if (!isAuthenticated) {
      Swal.fire({
        icon: "warning",
        title: "Not Logged In",
        text: "You need to be logged in to write a review.",
        confirmButtonText: "Go to Login",
        confirmButtonColor: "#e94f37",
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = "/auth/login";
        }
      });
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
        author: user?.username ?? user?.name ?? "Anonymous",
        content: content.trim(),
        rating: rating,
        mood: mood,
      });

      // Show success message
      Swal.fire({
        icon: "success",
        title: "Review Submitted!",
        text: "Thank you for sharing your thoughts!",
        confirmButtonColor: "#e94f37",
        timer: 2000,
      });

      setContent("");
      setRating(null);
      setMood(null);
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to submit review. Please try again.",
        confirmButtonColor: "#e94f37",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const displayRating = hoveredStar !== null ? hoveredStar : rating;

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="relative rounded-3xl p-6 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 shadow-2xl">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-4xl mb-4">🔐</div>
          <h3 className="text-xl font-bold text-white mb-2">Write a Review</h3>
          <p className="text-slate-300 mb-6">
            You need to be logged in to write a review and share your thoughts
            with the community.
          </p>
          <Link
            href="/auth/login"
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#e94f37] to-[#ff6b58] text-white font-medium hover:shadow-lg transition-shadow"
          >
            Sign In to Write a Review
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Dynamic background based on mood */}
      <div
        className={`absolute inset-0 rounded-2xl transition-all duration-500 ${
          mood === "amazing"
            ? "bg-gradient-to-br from-orange-500/20 to-red-500/20"
            : mood === "loved"
            ? "bg-gradient-to-br from-pink-500/20 to-rose-500/20"
            : mood === "enjoyed"
            ? "bg-gradient-to-br from-green-500/20 to-emerald-500/20"
            : mood === "okay"
            ? "bg-gradient-to-br from-slate-500/20 to-gray-500/20"
            : mood === "meh"
            ? "bg-gradient-to-br from-gray-600/20 to-slate-600/20"
            : mood === "disliked"
            ? "bg-gradient-to-br from-slate-700/20 to-gray-700/20"
            : "bg-slate-900/50"
        }`}
      />

      <form
        onSubmit={handleSubmit}
        className="relative space-y-3 p-5 rounded-2xl transition-all duration-500"
        style={{
          borderColor:
            mood === "amazing"
              ? "rgba(249, 115, 22, 0.3)"
              : mood === "loved"
              ? "rgba(236, 72, 153, 0.3)"
              : mood === "enjoyed"
              ? "rgba(34, 197, 94, 0.3)"
              : mood === "okay"
              ? "rgba(100, 116, 139, 0.3)"
              : mood === "meh"
              ? "rgba(75, 85, 99, 0.3)"
              : mood === "disliked"
              ? "rgba(71, 85, 105, 0.3)"
              : "rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Header with dynamic accent */}
        <div className="transition-colors duration-500">
          <h3 className="text-lg font-bold text-white">Write a Review</h3>
          <p
            className={`text-xs mt-0.5 transition-colors duration-500 ${
              mood === "amazing"
                ? "text-orange-300"
                : mood === "loved"
                ? "text-pink-300"
                : mood === "enjoyed"
                ? "text-green-300"
                : mood === "okay"
                ? "text-slate-400"
                : mood === "meh"
                ? "text-gray-400"
                : mood === "disliked"
                ? "text-slate-500"
                : "text-slate-400"
            }`}
          >
            {mood === "amazing"
              ? "🔥 Amazing! Tell us what made it incredible"
              : mood === "loved"
              ? "❤️ You loved it! Share what touched your heart"
              : mood === "enjoyed"
              ? "😊 Great! What did you enjoy most?"
              : mood === "okay"
              ? "😐 It was okay. What worked and what didn't?"
              : mood === "meh"
              ? "😕 Not impressed? Tell us why"
              : mood === "disliked"
              ? "😞 Sorry it disappointed. What went wrong?"
              : "Share your experience with the community"}
          </p>
        </div>

        {/* Mood Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            How did it make you feel?
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {[
              {
                emoji: "🔥",
                label: "Amazing",
                value: "amazing",
                color: "from-orange-500 to-red-500",
              },
              {
                emoji: "❤️",
                label: "Loved it",
                value: "loved",
                color: "from-pink-500 to-rose-500",
              },
              {
                emoji: "😊",
                label: "Enjoyed",
                value: "enjoyed",
                color: "from-green-500 to-emerald-500",
              },
              {
                emoji: "😐",
                label: "It's okay",
                value: "okay",
                color: "from-slate-500 to-gray-500",
              },
              {
                emoji: "😕",
                label: "Meh",
                value: "meh",
                color: "from-gray-600 to-slate-600",
              },
              {
                emoji: "😞",
                label: "Disliked",
                value: "disliked",
                color: "from-slate-700 to-gray-700",
              },
            ].map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(m.value)}
                className={`relative flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-300 cursor-pointer ${
                  mood === m.value
                    ? `bg-gradient-to-br ${m.color} shadow-lg scale-105 border-2 border-white/30`
                    : "bg-slate-900/30 hover:bg-slate-800/50 border border-white/10"
                }`}
              >
                <span className="text-xl">{m.emoji}</span>
                <span
                  className={`text-[9px] font-medium ${
                    mood === m.value ? "text-white" : "text-slate-400"
                  }`}
                >
                  {m.label}
                </span>
                {mood === m.value && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center shadow-lg">
                    <svg
                      className="w-1.5 h-1.5 text-green-600"
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

        {/* Combined Quote Card - Name, Rating, and Review */}
        <div className="relative bg-slate-900/50 rounded-lg p-4 transition-all">
          {/* Opening quote mark */}
          <svg
            className="absolute top-2 left-2 w-6 h-6 opacity-20 transition-colors"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{
              color:
                mood === "amazing"
                  ? "rgb(249, 115, 22)"
                  : mood === "loved"
                  ? "rgb(236, 72, 153)"
                  : mood === "enjoyed"
                  ? "rgb(34, 197, 94)"
                  : mood === "okay"
                  ? "rgb(100, 116, 139)"
                  : mood === "meh"
                  ? "rgb(75, 85, 99)"
                  : mood === "disliked"
                  ? "rgb(71, 85, 105)"
                  : "rgb(255, 255, 255)",
            }}
          >
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
          </svg>

          {/* Name input section - Display only, not editable */}
          <div className="flex items-center gap-2 mb-2 pl-8">
            <div
              className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 border-2 transition-colors flex items-center justify-center"
              style={{
                borderColor:
                  mood === "amazing"
                    ? "rgb(249, 115, 22)"
                    : mood === "loved"
                    ? "rgb(236, 72, 153)"
                    : mood === "enjoyed"
                    ? "rgb(34, 197, 94)"
                    : mood === "okay"
                    ? "rgb(100, 116, 139)"
                    : mood === "meh"
                    ? "rgb(75, 85, 99)"
                    : mood === "disliked"
                    ? "rgb(71, 85, 105)"
                    : "rgba(255, 255, 255, 0.3)",
              }}
            >
              <span className="text-slate-400 text-xs font-semibold">
                {author ? author.charAt(0).toUpperCase() : "A"}
              </span>
            </div>

            <div className="flex-1 text-white text-xs font-medium">
              {user?.username ?? user?.name ?? "User"}
            </div>
          </div>

          {/* Rating section */}
          <div className="flex items-center justify-center gap-0.5 py-2 mb-3">
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
                  className="p-0.5 transition-transform hover:scale-110 cursor-pointer"
                >
                  <Star
                    size={18}
                    className={`transition-colors ${
                      active
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-slate-700 hover:text-slate-600"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Review textarea */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your thoughts about this title. What did you like or dislike? Would you recommend it?"
            rows={4}
            className="w-full bg-transparent text-white placeholder-slate-500 resize-none text-xs focus:outline-none mb-3"
          />

          {/* Closing quote mark */}
          <svg
            className="absolute bottom-2 right-2 w-6 h-6 opacity-20 transition-colors rotate-180"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{
              color:
                mood === "amazing"
                  ? "rgb(249, 115, 22)"
                  : mood === "loved"
                  ? "rgb(236, 72, 153)"
                  : mood === "enjoyed"
                  ? "rgb(34, 197, 94)"
                  : mood === "okay"
                  ? "rgb(100, 116, 139)"
                  : mood === "meh"
                  ? "rgb(75, 85, 99)"
                  : mood === "disliked"
                  ? "rgb(71, 85, 105)"
                  : "rgb(255, 255, 255)",
            }}
          >
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
          </svg>

          {/* Bottom author attribution and character count */}
          <div className="flex items-center justify-between pt-3 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">—</span>
              <span
                className="text-xs font-medium transition-colors"
                style={{
                  color:
                    mood === "amazing"
                      ? "rgb(249, 115, 22)"
                      : mood === "loved"
                      ? "rgb(236, 72, 153)"
                      : mood === "enjoyed"
                      ? "rgb(34, 197, 94)"
                      : mood === "okay"
                      ? "rgb(100, 116, 139)"
                      : mood === "meh"
                      ? "rgb(75, 85, 99)"
                      : mood === "disliked"
                      ? "rgb(71, 85, 105)"
                      : "rgb(148, 163, 184)",
                }}
              >
                {user?.username ?? user?.name ?? "User"}
              </span>
            </div>
            <span
              className={`text-xs mr-6 ${
                content.length < 10 ? "text-slate-500" : "text-slate-400"
              }`}
            >
              {content.length < 10 ? `${10 - content.length} more needed` : "✓"}
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg"
          >
            <svg
              className="w-3 h-3 text-red-400 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-red-300 text-xs">{error}</span>
          </motion.div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-1.5 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-xs"
            style={{
              background:
                mood === "amazing"
                  ? "linear-gradient(to right, rgb(249, 115, 22), rgb(239, 68, 68))"
                  : mood === "loved"
                  ? "linear-gradient(to right, rgb(236, 72, 153), rgb(244, 63, 94))"
                  : mood === "enjoyed"
                  ? "linear-gradient(to right, rgb(34, 197, 94), rgb(16, 185, 129))"
                  : mood === "okay"
                  ? "linear-gradient(to right, rgb(100, 116, 139), rgb(107, 114, 128))"
                  : mood === "meh"
                  ? "linear-gradient(to right, rgb(75, 85, 99), rgb(100, 116, 139))"
                  : mood === "disliked"
                  ? "linear-gradient(to right, rgb(71, 85, 105), rgb(107, 114, 128))"
                  : "white",
              color: mood ? "white" : "black",
            }}
          >
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </div>
      </form>
    </div>
  );
}
