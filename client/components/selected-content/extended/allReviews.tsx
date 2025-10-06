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
                        <a
                          href={review.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          View Original →
                        </a>
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
  onSubmit: (v: { author: string; content: string; rating?: number }) => void;
}) {
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleStar(index: number) {
    const newRating = index * 2;
    setRating((prev) => (prev === newRating ? null : newRating));
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!content.trim()) {
      setError("Write something before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      onSubmit({
        author: author.trim() || "Anonymous",
        content: content.trim(),
        rating: rating ?? undefined,
      });
      setAuthor("");
      setContent("");
      setRating(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Your name (optional)"
          className="flex-1 bg-slate-800/60 text-slate-100 placeholder-slate-400 rounded-lg px-3 py-2 border border-white/8"
        />
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-400">Your rating</div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => {
              const starValue = (i + 1) * 2;
              const active = rating !== null && rating >= starValue;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleStar(i + 1)}
                  className={`p-1 rounded ${
                    active ? "bg-yellow-500/10" : "hover:bg-white/6"
                  }`}
                >
                  <Star
                    size={18}
                    className={active ? "text-yellow-300" : "text-slate-500"}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your review — be respectful and constructive."
        rows={5}
        className="w-full bg-slate-800/60 text-slate-100 placeholder-slate-400 rounded-lg px-3 py-3 border border-white/8"
      />

      {error && <div className="text-xs text-red-400">{error}</div>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium shadow"
        >
          {submitting ? "Posting…" : "Post Review"}
        </button>
        <div className="text-xs text-slate-400">
          Your review will appear locally (demo). To save server-side, wire the
          submit to your API.
        </div>
      </div>
    </form>
  );
}
