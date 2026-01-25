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
import { useReviewBanStatus } from "@/hooks/useReviewBanStatus";

type Reply = {
  id?: string;
  content: string;
  created_at: string;
  user: {
    username: string;
    avatar_path?: string | null;
  };
};

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
  replies?: Reply[];
  moodEmojis?: string[];
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
  topMoods?: Array<{ emoji: string; count: number }>;
  reviewStats?: { totalRatings: number; averageRating: number };
}

export default function AllReviews({
  reviews,
  info,
  id,
  topMoods = [],
  reviewStats,
}: AllReviewsProps) {
  const { isAuthenticated } = useAuth();
  const { banStatus, loading: banLoading } = useReviewBanStatus();
  const [sortBy, setSortBy] = useState<"latest" | "highest" | "popularity">(
    "latest",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(
    new Set(),
  );
  const [showReplyForm, setShowReplyForm] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
    new Set(),
  );

  const toggleReplies = (reviewId: string) => {
    setExpandedReplies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(reviewId)) {
        newSet.delete(reviewId);
      } else {
        newSet.add(reviewId);
      }
      return newSet;
    });
  };

  function popularityProxy(r: Review) {
    const rating = r.author_details?.rating ?? 0;
    const lenScore = Math.min(5, (r.content?.length ?? 0) / 200);
    return rating + lenScore;
  }

  const filteredAndSorted = useMemo(() => {
    let arr = [...reviews];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      arr = arr.filter(
        (r) =>
          r.author.toLowerCase().includes(query) ||
          r.content.toLowerCase().includes(query),
      );
    }

    switch (sortBy) {
      case "latest":
        arr.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
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
  }, [reviews, sortBy, searchQuery]);

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

  const handleReplySubmit = async (reviewId: string) => {
    if (!isAuthenticated) {
      Swal.fire({
        icon: "warning",
        title: "Not Logged In",
        text: "You need to be logged in to reply.",
        confirmButtonText: "Go to Login",
        confirmButtonColor: "#e94f37",
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = "/auth/login";
        }
      });
      return;
    }

    if (banStatus.banned) {
      Swal.fire({
        icon: "error",
        title: "Reply Privileges Suspended",
        html: `
        <p>Your review and reply privileges have been suspended due to policy violations.</p>
        <p style="margin-top: 1rem;">Ban expires in: <strong>${banStatus?.timeRemaining || "Unknown"}</strong></p>
      `,
        confirmButtonColor: "#e94f37",
        confirmButtonText: "I Understand",
      });
      return;
    }

    if (!replyContent.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Empty Reply",
        text: "Please write something before submitting.",
        confirmButtonColor: "#e94f37",
      });
      return;
    }

    setSubmittingReply(true);
    try {
      const token = localStorage.getItem("authToken");

      // Add check if token exists
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch(
        `http://localhost:4000/reviews/${reviewId}/replies`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: replyContent.trim(),
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit reply");
      }

      Swal.fire({
        icon: "success",
        title: "Reply Posted!",
        text: "Refreshing...",
        confirmButtonColor: "#e94f37",
        timer: 1500,
        showConfirmButton: false,
      });

      setReplyContent("");
      setShowReplyForm(null);

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to post reply. Please try again.",
        confirmButtonColor: "#e94f37",
      });
    } finally {
      setSubmittingReply(false);
    }
  };

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

              {/* Review Stats & Community Vibe */}
              <div className="flex items-end gap-8 pt-4">
                {/* Star Rating with Custom and TMDb */}
                <div className="flex items-center gap-4">
                  {/* Custom Rating (if available) */}
                  {reviewStats && reviewStats.totalRatings > 0 && (
                    <div className="flex items-center gap-2 bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 px-3 py-2 rounded-lg">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const fullStars = Math.round(
                            reviewStats.averageRating / 2,
                          );
                          return (
                            <Star
                              key={i}
                              size={16}
                              className={
                                i < fullStars
                                  ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.4)]"
                                  : "text-slate-600"
                              }
                            />
                          );
                        })}
                      </div>
                      <span className="text-base font-bold text-white">
                        {reviewStats.averageRating.toFixed(1)}
                      </span>
                      <span className="text-xs text-slate-400">
                        ({reviewStats.totalRatings})
                      </span>
                    </div>
                  )}

                  {/* TMDb Rating */}
                  {reviewStats && reviewStats.totalRatings > 0 && (
                    <div className="h-8 w-px bg-white/20" />
                  )}
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-lg">
                    <div className="bg-[#0d253f] rounded px-2 py-0.5 border border-[#01b4e4]/30">
                      <span className="text-[#01b4e4] font-bold text-xs tracking-wide">
                        TMDb
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star
                        size={14}
                        className="text-[#01b4e4] fill-[#01b4e4]"
                      />
                      <span className="text-base font-bold text-white">
                        {info.vote_average.toFixed(1)}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      ({info.vote_count.toLocaleString()})
                    </span>
                  </div>
                </div>

                {/* Top Moods - Card Deck Spread */}
                {topMoods && topMoods.length > 0 && (
                  <div className="flex-1">
                    <div className="text-xs text-slate-400 mb-2">
                      Community Vibe
                    </div>

                    <div className="relative h-12 flex items-center">
                      {/* Overlapping card spread */}
                      <div className="relative flex items-center -space-x-4">
                        {topMoods.map((mood, idx) => {
                          const rotations = [
                            "-rotate-6",
                            "rotate-0",
                            "rotate-6",
                          ];
                          const zIndexes = [1, 3, 2];

                          return (
                            <div
                              key={idx}
                              className={`group relative transition-all duration-300 hover:scale-125 hover:z-50 cursor-pointer ${rotations[idx]} origin-center`}
                              style={{ zIndex: zIndexes[idx] }}
                            >
                              <span className="text-3xl block transition-all duration-300 filter drop-shadow-lg group-hover:drop-shadow-2xl">
                                {mood.emoji}
                              </span>

                              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50">
                                <div className="bg-slate-900 border border-white/20 rounded-lg px-2 py-1 shadow-xl">
                                  <p className="text-xs text-white font-medium">
                                    {mood.count}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <ReviewForm id={id} contentType={info.content_type} />
        </div>
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
                    id={`review-${review.id}`}
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
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-slate-100 font-semibold text-lg">
                                {review.author}
                              </h3>
                              {/* Mood emoji display */}
                              {review.moodEmojis &&
                                review.moodEmojis.length > 0 && (
                                  <span
                                    className="text-lg"
                                    title={`Mood: ${review.moodEmojis.join(", ")}`}
                                  >
                                    {review.moodEmojis[0]}
                                  </span>
                                )}
                            </div>
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

                    {/* Replies Section */}
                    {review.replies && review.replies.length > 0 && (
                      <div className="mt-4 space-y-3 pl-4 border-l-2 border-indigo-500/30">
                        {/* Show first 3 replies or all if expanded */}
                        {(expandedReplies.has(review.id)
                          ? review.replies
                          : review.replies.slice(0, 3)
                        ).map((reply, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-800/30 rounded-lg p-3 border border-white/5"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200">
                                {reply.user.username.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-slate-200">
                                    {reply.user.username}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {formatDate(reply.created_at)}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-300 leading-relaxed">
                                  {reply.content}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Show More/Less button if more than 3 replies */}
                        {review.replies.length > 3 && (
                          <button
                            onClick={() => toggleReplies(review.id)}
                            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 mt-2 pb-3"
                          >
                            {expandedReplies.has(review.id) ? (
                              <>
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 15l7-7 7 7"
                                  />
                                </svg>
                                Show less replies
                              </>
                            ) : (
                              <>
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                                Show {review.replies.length - 3} more{" "}
                                {review.replies.length - 3 === 1
                                  ? "reply"
                                  : "replies"}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Reply Section - Show ban message or reply form */}
                    <div className="pt-4 border-t border-white/10">
                      {banStatus.banned ? (
                        <div className="bg-gradient-to-br from-red-950/20 via-slate-900/50 to-slate-950/50 border border-red-500/15 rounded-lg p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-red-500/10 to-red-600/10 border border-red-500/20 flex items-center justify-center">
                              <svg
                                className="w-4 h-4 text-red-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                              </svg>
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-red-400 mb-0.5">
                                Reply Privileges Suspended
                              </p>
                              <p className="text-xs text-slate-400">
                                Expires in:{" "}
                                <span className="text-red-400 font-medium">
                                  {banStatus?.timeRemaining || "Unknown"}
                                </span>
                              </p>
                            </div>

                            {review.replies && review.replies.length > 0 && (
                              <span className="text-xs text-slate-500 flex-shrink-0">
                                {review.replies.length}{" "}
                                {review.replies.length === 1
                                  ? "reply"
                                  : "replies"}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Reply Form Toggle */}
                          <div className="flex items-center justify-between pb-3">
                            <button
                              onClick={() =>
                                setShowReplyForm(
                                  showReplyForm === review.id
                                    ? null
                                    : review.id,
                                )
                              }
                              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                                />
                              </svg>
                              {showReplyForm === review.id ? "Cancel" : "Reply"}
                            </button>

                            {review.replies && review.replies.length > 0 && (
                              <span className="text-xs text-slate-500">
                                {review.replies.length}{" "}
                                {review.replies.length === 1
                                  ? "reply"
                                  : "replies"}
                              </span>
                            )}
                          </div>

                          {/* Reply Form */}
                          {showReplyForm === review.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-4 space-y-3"
                            >
                              <textarea
                                value={replyContent}
                                onChange={(e) =>
                                  setReplyContent(e.target.value)
                                }
                                placeholder="Write your reply..."
                                rows={3}
                                className="w-full bg-slate-800/60 text-slate-200 placeholder-slate-400 rounded-lg border border-white/10 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 outline-none p-3 text-sm resize-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setShowReplyForm(null);
                                    setReplyContent("");
                                  }}
                                  className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleReplySubmit(review.id)}
                                  disabled={submittingReply}
                                  className="px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {submittingReply
                                    ? "Posting..."
                                    : "Post Reply"}
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </>
                      )}
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
  id,
  contentType,
}: {
  id?: string;
  contentType?: string;
}) {
  const { isAuthenticated, user } = useAuth();
  const { banStatus, loading: banLoading } = useReviewBanStatus();
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [showReplyForm, setShowReplyForm] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

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

  const moodToEmoji: Record<string, string> = {
    amazing: "🔥",
    loved: "❤️",
    enjoyed: "😊",
    okay: "😐",
    meh: "😕",
    disliked: "😞",
  };

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);

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
      const token = localStorage.getItem("authToken");

      const response = await fetch("http://localhost:4000/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating: rating,
          content: content.trim(),
          moodEmojis: [moodToEmoji[mood]],
          tmdbId: id ? parseInt(id) : 0,
          mediaType: (contentType?.toUpperCase() || "MOVIE") as "MOVIE" | "TV",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit review");
      }

      await response.json();

      Swal.fire({
        icon: "success",
        title: "Review Submitted!",
        text: "Refreshing reviews...",
        confirmButtonColor: "#e94f37",
        timer: 1500,
        showConfirmButton: false,
      });

      setContent("");
      setRating(null);
      setMood(null);

      // Reload the page to fetch updated reviews
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to submit review";

      Swal.fire({
        icon: "error",
        title: "Error",
        text: errorMessage,
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

  if (banStatus.banned) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-950/30 via-slate-900/80 to-slate-950/80 border border-red-500/20 shadow-xl">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              rgba(239, 68, 68, 0.2) 10px,
              rgba(239, 68, 68, 0.2) 20px
            )`,
            }}
          />
        </div>

        <div className="relative p-5">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/15 to-red-600/15 border border-red-500/30 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold mb-1 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                Review Privileges Suspended
              </h3>
              <p className="text-slate-400 text-xs mb-3">
                Temporarily restricted due to policy violations
              </p>

              {/* Compact info grid */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span className="text-red-300">
                    Profanity & harmful content detected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-slate-300 text-xs">
                    Expires in:{" "}
                    <span className="font-semibold text-red-400">
                      {banStatus?.timeRemaining || "Unknown"}
                    </span>
                  </span>
                </div>
              </div>

              {/* Small info note */}
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <svg
                  className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Your privileges will be restored automatically after the ban
                  expires.
                </p>
              </div>
            </div>
          </div>
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
