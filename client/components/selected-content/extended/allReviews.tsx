"use client";

import React, { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Users2,
  Star,
  Calendar,
  Filter,
  Search,
} from "lucide-react";
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

type Info = {
  id: number;
  title: string;
  overview: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date: string;
  vote_average: number;
  vote_count: number;
  runtime: number;
  genres: Array<{ id: number; name: string }>;
  content_type: string;
  number_of_seasons: number;
  number_of_episodes: number;
};

interface AllReviewsProps {
  reviews: Review[];
  info: Info;
  id?: string;
}

export default function AllReviews({ reviews, info, id }: AllReviewsProps) {
  const [localReviews, setLocalReviews] = useState<Review[]>(
    reviews ? [...reviews] : []
  );
  const [sortBy, setSortBy] = useState<"latest" | "highest" | "popularity">(
    "latest"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(
    new Set()
  );
  function popularityProxy(r: Review) {
    const rating = r.author_details?.rating ?? 0;
    const lenScore = Math.min(5, (r.content?.length ?? 0) / 200);
    return rating + lenScore;
  }

  const filteredAndSorted = useMemo(() => {
    let arr = [...localReviews];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      arr = arr.filter(
        (r) =>
          r.author.toLowerCase().includes(query) ||
          r.content.toLowerCase().includes(query)
      );
    }

    // Sort
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
  }, [localReviews, sortBy, searchQuery]);

  const toggleExpanded = (id: string) => {
    setExpandedReviews((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const contentType = (type: string) => {
    if (type === "movie") return "movies";
    else return "tv";
  };

  useEffect(() => {
    const map: Record<string, number> = {};
    localReviews.forEach((r) => {
      map[r.id] = Math.max(0, Math.round(popularityProxy(r) / 2));
    });
  }, [localReviews]);

  // Add this useEffect after your other useEffects in AllReviews component
  useEffect(() => {
    // Get highlight parameter from URL
    const params = new URLSearchParams(window.location.search);
    const highlightId = params.get("highlight");

    if (highlightId) {
      // Wait for the DOM to be ready
      setTimeout(() => {
        const element = document.getElementById(`review-${highlightId}`);
        if (element) {
          element.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });

          // Optional: Add a temporary highlight effect
          element.style.transition = "all 0.3s ease";
          element.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.5)";
          setTimeout(() => {
            element.style.boxShadow = "";
          }, 3000);
        }
      }, 300); // Small delay to ensure content is rendered
    }
  }, [filteredAndSorted]); // Re-run if reviews change

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

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section with Info */}
      <div className="relative">
        {/* Backdrop */}
        {info.backdrop_path && (
          <div className="absolute inset-0 w-full h-full">
            <Image
              src={`https://image.tmdb.org/t/p/w1280${info.backdrop_path}`}
              alt={info.title}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20" />
          </div>
        )}

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-14 pb-16">
          {/* Back Navigation */}
          <Link
            href={`/${contentType(info.content_type)}/${id}`}
            className="inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft size={20} />
            Back to {info.title}
          </Link>

          {/* Header */}
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Poster */}
            <div className="flex-shrink-0">
              <div className="w-48 h-72 rounded-xl overflow-hidden shadow-2xl border border-white/10">
                {info.poster_path ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/w500${info.poster_path}`}
                    alt={info.title}
                    width={192}
                    height={288}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                    <Users2 size={48} className="text-slate-500" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-4xl lg:text-5xl font-bold text-white mb-2">
                  {info.title}
                </h1>
                <div className="flex items-center gap-4 text-slate-300 text-sm">
                  <span>{new Date(info.release_date).getFullYear()}</span>
                  <span className="text-sm text-white/70 flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <line x1="9" x2="9" y1="9" y2="15" />
                      <line x1="15" x2="15" y1="9" y2="15" />
                    </svg>
                    {info.number_of_seasons} Season
                    {info.number_of_seasons !== 1 ? "s" : ""}
                  </span>
                  <span className="text-sm text-white/70">
                    {info.number_of_episodes} Episodes
                  </span>
                  <div className="flex items-center gap-1">
                    <Star
                      size={16}
                      className="text-yellow-400 fill-yellow-400"
                    />
                    <span>{info.vote_average.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-2">
                {info.genres.map((genre) => (
                  <span
                    key={genre.id}
                    className="px-3 py-1 rounded-full bg-white/10 text-slate-200 text-sm border border-white/20"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>

              {/* Overview */}
              {info.overview && (
                <p className="text-slate-300 leading-relaxed max-w-3xl">
                  {info.overview}
                </p>
              )}

              {/* Review Stats */}
              <div className="flex items-center gap-6 pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {filteredAndSorted.length}
                  </div>
                  <div className="text-sm text-slate-400">Reviews</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {info.vote_count.toLocaleString()}
                  </div>
                  <div className="text-sm text-slate-400">Total Ratings</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <ReviewForm onSubmit={addLocalReview} />
      </div>

      {/* Reviews Section */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Controls */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <h2 className="text-3xl font-bold text-white">All Reviews</h2>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              {/* Search */}
              <div className="relative">
                <Search
                  size={20}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search reviews..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-800/60 text-slate-200 placeholder-slate-400 rounded-lg border border-white/10 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 outline-none w-full sm:w-64"
                />
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <Filter size={20} className="text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-800/60 text-slate-200 rounded-lg px-3 py-2 border border-white/10 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 outline-none"
                >
                  <option value="latest">Latest</option>
                  <option value="highest">Highest Rated</option>
                  <option value="popularity">Most Popular</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results count */}
          <div className="mt-4 text-slate-400 text-sm">
            {searchQuery
              ? `Found ${filteredAndSorted.length} review(s) matching "${searchQuery}"`
              : `Showing ${filteredAndSorted.length} review(s)`}
          </div>
        </div>

        {/* Reviews List */}
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {filteredAndSorted.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <div className="text-slate-400 text-lg">
                  {searchQuery
                    ? "No reviews found matching your search."
                    : "No reviews yet."}
                </div>
              </motion.div>
            ) : (
              filteredAndSorted.map((review) => {
                const isExpanded = expandedReviews.has(review.id);
                const shouldTruncate = review.content.length > 400;

                return (
                  <motion.div
                    key={review.id}
                    id={`review-${review.id}`} // Add this line
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`rounded-2xl p-6 border border-white/10 bg-gradient-to-br from-slate-900/70 to-slate-800/70 shadow-lg hover:border-white/20 transition-all duration-300`}
                  >
                    {/* Review Header */}
                    <div className="flex items-start gap-4 mb-4">
                      <AvatarBlock review={review} />

                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-slate-100 font-semibold text-lg">
                              {review.author}
                            </h3>
                            <div className="flex items-center gap-3 text-sm text-slate-400">
                              <div className="flex items-center gap-1">
                                <Calendar size={14} />
                                {formatDate(review.created_at)}
                              </div>
                              {review.author_details?.username && (
                                <span>@{review.author_details.username}</span>
                              )}
                            </div>
                          </div>

                          <RatingDisplay
                            rating={review.author_details?.rating}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Review Content */}
                    <div className="mb-4">
                      <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {shouldTruncate && !isExpanded ? (
                          <>
                            {review.content.slice(0, 400)}...
                            <button
                              onClick={() => toggleExpanded(review.id)}
                              className="ml-2 text-indigo-400 hover:text-indigo-300 font-medium text-sm"
                            >
                              Read more
                            </button>
                          </>
                        ) : (
                          <>
                            {review.content}
                            {shouldTruncate && isExpanded && (
                              <button
                                onClick={() => toggleExpanded(review.id)}
                                className="ml-2 text-indigo-400 hover:text-indigo-300 font-medium text-sm"
                              >
                                Show less
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Review Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                      {review.url && (
                        <Link
                          href={review.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          View Original →
                        </Link>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// Helper Components (same as before but with minor styling updates)
function AvatarBlock({ review, size = 56 }: { review: Review; size?: number }) {
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
      className="rounded-full overflow-hidden bg-slate-700 flex items-center justify-center ring-2 ring-white/10 shadow-lg"
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
        <div className="text-slate-200 font-semibold text-lg">{initials}</div>
      )}
    </div>
  );
}

function RatingDisplay({ rating }: { rating?: number }) {
  if (typeof rating !== "number") {
    return <div className="text-sm text-slate-400">No rating</div>;
  }

  const stars = Math.round((rating / 10) * 5);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={16}
            className={
              i < stars ? "text-yellow-400 fill-yellow-400" : "text-slate-600"
            }
          />
        ))}
      </div>
      <div className="text-sm text-slate-300 font-medium">
        {rating.toFixed(1)}/10
      </div>
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
