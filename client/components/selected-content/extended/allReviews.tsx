"use client";

import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { sGet } from "@/utils/secureStorage";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Star,
  Calendar,
  Search,
  PenSquare,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/context/AuthProvider";
import { useReviewBanStatus } from "@/hooks/useReviewBanStatus";
import { useToast } from "@/app/context/ToastContext";

type Reply = {
  id?: string;
  content: string;
  created_at: string;
  user: { username: string; avatar_path?: string | null };
};

// Tracks which review's reply form is open, and an optional @mention prefill
type ReplyFormState = { reviewId: string; prefill: string } | null;

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
  const { isAuthenticated, user } = useAuth();
  const { banStatus } = useReviewBanStatus();
  const { toast } = useToast();
  const router = useRouter();
  const [sortBy, setSortBy] = useState<"latest" | "highest" | "popularity">(
    "latest",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(
    new Set(),
  );
  const [showReplyForm, setShowReplyForm] = useState<ReplyFormState>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
    new Set(),
  );
  const [writeModalOpen, setWriteModalOpen] = useState(false);
  const [localReviews, setLocalReviews] = useState<Review[]>(reviews);
  const [mounted, setMounted] = useState(false);

  // Sync if server component re-renders with fresh data (e.g. after router.refresh())
  useEffect(() => { setLocalReviews(reviews); }, [reviews]);
  useEffect(() => setMounted(true), []);

  const basePath = info.content_type === "movie" ? "movies" : "tv";

  function popularityProxy(r: Review) {
    return (
      (r.author_details?.rating ?? 0) +
      Math.min(5, (r.content?.length ?? 0) / 200)
    );
  }

  const filteredAndSorted = useMemo(() => {
    let arr = [...localReviews];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      arr = arr.filter(
        (r) =>
          r.author.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q),
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
          const ra = a.author_details?.rating ?? -1,
            rb = b.author_details?.rating ?? -1;
          return ra === rb
            ? new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            : rb - ra;
        });
        break;
      case "popularity":
        arr.sort((a, b) => popularityProxy(b) - popularityProxy(a));
        break;
    }
    return arr;
  }, [localReviews, sortBy, searchQuery]);

  const toggleExpanded = (id: string) =>
    setExpandedReviews((p) => {
      const s = new Set(p);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  const toggleReplies = (id: string) =>
    setExpandedReplies((p) => {
      const s = new Set(p);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlightId = params.get("highlight");
    if (highlightId) {
      setTimeout(() => {
        const el = document.getElementById(`review-${highlightId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.style.transition = "box-shadow 0.3s";
          el.style.boxShadow = "0 0 0 2px rgba(233,79,55,0.5)";
          setTimeout(() => {
            el.style.boxShadow = "";
          }, 3000);
        }
      }, 300);
    }
  }, [filteredAndSorted]);

  // Escape + scroll lock for modal
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWriteModalOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    document.body.style.overflow = writeModalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [writeModalOpen]);

  const openReplyForm = (reviewId: string, prefill = "") => {
    setShowReplyForm({ reviewId, prefill });
    setReplyContent("");
  };
  const closeReplyForm = () => {
    setShowReplyForm(null);
    setReplyContent("");
  };

  const handleReplySubmit = async (reviewId: string) => {
    if (!isAuthenticated) {
      toast("Sign in to post a reply.", "warning", 3000, "Not Logged In", null);
      return;
    }
    if (!replyContent.trim()) {
      return;
    }
    setSubmittingReply(true);
    try {
      const token = sGet("authToken");
      const submittedContent = ((showReplyForm?.prefill ?? "") + replyContent).trim();
      const res = await fetch(
        `http://localhost:4000/reviews/${reviewId}/replies`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: submittedContent }),
        },
      );
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || "Failed");
      // Optimistically append the reply — no reload needed
      setLocalReviews((prev) =>
        prev.map((r) =>
          r.id !== reviewId
            ? r
            : {
                ...r,
                replies: [
                  ...(r.replies || []),
                  {
                    id: resData.id,
                    content: submittedContent,
                    created_at: resData.createdAt || new Date().toISOString(),
                    user: {
                      username: user?.username || "You",
                      avatar_path: user?.avatarUrl || null,
                    },
                  },
                ],
              }
        )
      );
      setReplyContent("");
      setShowReplyForm(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to post reply.", "error", 4000, "Error", null);
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={info.backdrop_path ? `https://image.tmdb.org/t/p/w1280${info.backdrop_path}` : "/placeholder-backdrop.svg"}
            alt={info.title}
            fill
            style={{
              objectFit: "cover",
              filter: "brightness(0.3) saturate(0.5)",
            }}
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
          {/* Back nav */}
          <Link
            href={`/${basePath}/${id}`}
            className="inline-flex items-center gap-1.5 text-white/40 hover:text-white transition-colors text-sm mb-8"
          >
            <ArrowLeft size={15} />
            Back to {info.title}
          </Link>

          {/* Content row */}
          <div className="flex gap-5 sm:gap-8 items-start">
            {/* Poster */}
            <div className="flex-shrink-0 w-20 sm:w-28 md:w-36 rounded-xl overflow-hidden shadow-2xl border border-white/[0.08]">
              <Image
                src={info.poster_path ? `https://image.tmdb.org/t/p/w500${info.poster_path}` : "/placeholder-poster.svg"}
                alt={info.title}
                width={144}
                height={216}
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* Eyebrow */}
              <p className="text-[11px] uppercase tracking-widest text-white/30">
                {info.content_type === "tv" ? "TV Series" : "Movie"} · Reviews
              </p>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
                {info.title}
              </h1>

              {/* Meta row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-white/40">
                  {new Date(info.release_date).getFullYear()}
                </span>
                {info.content_type === "tv" && info.number_of_seasons > 0 && (
                  <span className="text-xs text-white/40">
                    {info.number_of_seasons} Season
                    {info.number_of_seasons !== 1 ? "s" : ""}
                  </span>
                )}
                {info.content_type === "tv" && info.number_of_episodes > 0 && (
                  <span className="text-xs text-white/40">
                    {info.number_of_episodes} Episodes
                  </span>
                )}
                <div className="h-3 w-px bg-white/10" />
                {/* Genres */}
                {info.genres.slice(0, 3).map((g) => (
                  <span
                    key={g.id}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/50"
                  >
                    {g.name}
                  </span>
                ))}
              </div>

              {/* Scores row */}
              <div className="flex items-center gap-4 flex-wrap pt-1">
                {/* Community score */}
                {reviewStats && reviewStats.totalRatings > 0 && (
                  <div className="flex items-center gap-2">
                    <RatingArc
                      rating={reviewStats.averageRating}
                      color="#e94f37"
                    />
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-white/30">
                        Community
                      </p>
                      <p className="text-xs text-white/60">
                        {reviewStats.totalRatings} ratings
                      </p>
                    </div>
                  </div>
                )}

                {reviewStats && reviewStats.totalRatings > 0 && (
                  <div className="h-8 w-px bg-white/[0.08]" />
                )}

                {/* TMDb score */}
                <div className="flex items-center gap-2">
                  <RatingArc rating={info.vote_average} color="#01b4e4" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[#01b4e4]/60">
                      TMDb
                    </p>
                    <p className="text-xs text-white/40">
                      {info.vote_count.toLocaleString()} votes
                    </p>
                  </div>
                </div>

                {/* Top moods */}
                {topMoods.length > 0 && (
                  <>
                    <div className="h-8 w-px bg-white/[0.08]" />
                    <div className="flex items-center gap-1">
                      {topMoods.slice(0, 3).map((m, i) => (
                        <span
                          key={i}
                          title={`${m.count} votes`}
                          style={{
                            fontSize: "clamp(1.2rem, 2.5vw, 1.5rem)",
                            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                          }}
                        >
                          {m.emoji}
                        </span>
                      ))}
                      <span className="text-[11px] text-white/25 ml-1">
                        Community vibe
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls bar ── */}
      <div
        className="sticky top-0 z-20 border-b border-white/[0.06]"
        style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(12px)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
            />
            <input
              type="text"
              placeholder="Search reviews…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs bg-white/[0.05] border border-white/[0.07] rounded-lg text-white placeholder-white/25 outline-none focus:border-[#e94f37]/40 transition-colors"
            />
          </div>

          {/* Sort pills */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.07]">
            {(["latest", "highest", "popularity"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer capitalize ${sortBy === s ? "bg-[#e94f37] text-white" : "text-white/40 hover:text-white"}`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Result count */}
          <span className="text-[11px] text-white/25 hidden sm:block">
            {filteredAndSorted.length} review
            {filteredAndSorted.length !== 1 ? "s" : ""}
            {searchQuery && ` for "${searchQuery}"`}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Write CTA */}
          <button
            onClick={() => {
              if (!isAuthenticated) {
                toast("Sign in to write a review.", "warning", 3000, "Not Logged In", null);
                return;
              }
              setWriteModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#e94f37] hover:bg-[#d94432] text-white text-xs font-semibold transition-colors cursor-pointer shadow-lg shadow-[#e94f37]/20 active:scale-95"
          >
            <PenSquare size={12} strokeWidth={2.5} />
            Write a Review
          </button>
        </div>
      </div>

      {/* ── Reviews list ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredAndSorted.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-24 gap-3 rounded-xl bg-white/[0.02] border border-white/[0.06]"
              >
                <div className="text-4xl opacity-20">💬</div>
                <p className="text-sm text-white/25">
                  {searchQuery
                    ? "No reviews match your search."
                    : "No reviews yet."}
                </p>
              </motion.div>
            ) : (
              filteredAndSorted.map((review) => {
                const isExpanded = expandedReviews.has(review.id);
                const shouldTruncate = review.content.length > 400;
                const repliesExpanded = expandedReplies.has(review.id);

                return (
                  <motion.div
                    key={review.id}
                    id={`review-${review.id}`}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200 overflow-hidden"
                  >
                    <div className="p-5 sm:p-6">
                      {/* Review header */}
                      <div className="flex items-start gap-3 sm:gap-4 mb-4">
                        <AvatarBlock review={review} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-white truncate">
                                  {review.author}
                                </span>
                                {review.moodEmojis &&
                                  review.moodEmojis.length > 0 && (
                                    <span
                                      className="text-base"
                                      title={`Mood: ${review.moodEmojis[0]}`}
                                    >
                                      {review.moodEmojis[0]}
                                    </span>
                                  )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-white/30">
                                <Calendar size={11} />
                                {formatDate(review.created_at)}
                                {review.author_details?.username && (
                                  <span className="text-white/20">
                                    @{review.author_details.username}
                                  </span>
                                )}
                              </div>
                            </div>
                            {typeof review.author_details?.rating ===
                              "number" && (
                              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] flex-shrink-0">
                                <Star size={11} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                                <span className="text-xs font-semibold text-white/80 leading-none">
                                  {(review.author_details.rating / 2).toFixed(1)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap mb-4">
                        {shouldTruncate && !isExpanded ? (
                          <>
                            {review.content.slice(0, 400)}…
                            <button
                              onClick={() => toggleExpanded(review.id)}
                              className="ml-1 text-[#e94f37] hover:text-[#ff6b58] font-medium text-xs transition-colors cursor-pointer"
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
                                className="ml-1 text-[#e94f37] hover:text-[#ff6b58] font-medium text-xs transition-colors cursor-pointer"
                              >
                                Show less
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {/* Replies */}
                      {review.replies && review.replies.length > 0 && (
                        <div className="mb-4 pl-4 border-l-2 border-white/[0.06] space-y-2.5">
                          {(repliesExpanded
                            ? review.replies
                            : review.replies.slice(0, 2)
                          ).map((reply, i) => (
                            <div key={i} className="flex items-start gap-2.5">
                              <div className="w-6 h-6 rounded-full bg-white/[0.08] border border-white/10 flex-shrink-0 flex items-center justify-center text-[10px] font-semibold text-white/50">
                                {reply.user.username.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs font-medium text-white/70">
                                    {reply.user.username}
                                  </span>
                                  <span className="text-[10px] text-white/25">
                                    {formatDate(reply.created_at)}
                                  </span>
                                  {/* Reply-to-reply button */}
                                  {!banStatus.banned && (
                                    <button
                                      onClick={() =>
                                        showReplyForm?.reviewId === review.id &&
                                        showReplyForm?.prefill === `@${reply.user.username} — `
                                          ? closeReplyForm()
                                          : openReplyForm(review.id, `@${reply.user.username} — `)
                                      }
                                      className="text-[10px] text-white/20 hover:text-[#e94f37] transition-colors cursor-pointer ml-auto"
                                    >
                                      Reply
                                    </button>
                                  )}
                                </div>
                                <p className="text-xs text-white/55 leading-relaxed">
                                  {(() => {
                                    const sep = " \u2014 ";
                                    const idx = reply.content.indexOf(sep);
                                    if (reply.content.startsWith("@") && idx !== -1) {
                                      return (
                                        <>
                                          <span style={{ color: "#e94f37" }}>{reply.content.slice(0, idx)}</span>
                                          <span className="text-white/20"> — </span>
                                          {reply.content.slice(idx + sep.length)}
                                        </>
                                      );
                                    }
                                    // fallback for older content without separator
                                    return reply.content.split(/(@\S+)/).map((part, i) =>
                                      /^@\S+/.test(part)
                                        ? <span key={i} style={{ color: "#e94f37" }}>{part}</span>
                                        : part
                                    );
                                  })()}
                                </p>
                              </div>
                            </div>
                          ))}
                          {review.replies.length > 2 && (
                            <button
                              onClick={() => toggleReplies(review.id)}
                              className="text-[11px] text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                            >
                              {repliesExpanded
                                ? "Show less"
                                : `+ ${review.replies.length - 2} more repl${review.replies.length - 2 === 1 ? "y" : "ies"}`}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Footer: reply + link */}
                      <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                        <div className="flex items-center gap-4">
                          {banStatus.banned ? (
                            <span className="text-xs text-red-400/60">
                              Reply privileges suspended
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                showReplyForm?.reviewId === review.id
                                  ? closeReplyForm()
                                  : openReplyForm(review.id)
                              }
                              className="text-xs text-white/30 hover:text-[#e94f37] transition-colors cursor-pointer flex items-center gap-1"
                            >
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
                                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                                />
                              </svg>
                              {showReplyForm?.reviewId === review.id ? "Cancel" : "Reply"}
                            </button>
                          )}
                          {review.replies && review.replies.length > 0 && (
                            <span className="text-[11px] text-white/20">
                              {review.replies.length}{" "}
                              {review.replies.length === 1
                                ? "reply"
                                : "replies"}
                            </span>
                          )}
                        </div>
                        {review.url && (
                          <Link
                            href={review.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-white/25 hover:text-white/50 transition-colors"
                          >
                            Original →
                          </Link>
                        )}
                      </div>

                      {/* Reply form */}
                      <AnimatePresence>
                        {showReplyForm?.reviewId === review.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 space-y-2"
                          >
                            {showReplyForm?.prefill && (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                                <span className="text-xs font-semibold" style={{ color: "#e94f37" }}>
                                  {showReplyForm.prefill.trim()}
                                </span>
                                <span className="text-xs text-white/30"> replying to</span>
                              </div>
                            )}
                            <textarea
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder="Write your reply…"
                              rows={3}
                              autoFocus
                              className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[#e94f37]/40 rounded-lg px-3 py-2.5 text-xs text-white/80 placeholder-white/20 resize-none outline-none transition-colors"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => closeReplyForm()}
                                className="px-3 py-1.5 text-xs text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleReplySubmit(review.id)}
                                disabled={submittingReply}
                                className="px-4 py-1.5 bg-[#e94f37] hover:bg-[#d94432] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                              >
                                {submittingReply ? "Posting…" : "Post Reply"}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Write Review Modal ── */}
      {mounted && createPortal(
        <AnimatePresence>
        {writeModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
              background: "rgba(0,0,0,0.85)",
              backdropFilter: "blur(14px)",
            }}
            onClick={() => setWriteModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg rounded-2xl overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, rgba(20,20,24,0.99) 0%, rgba(14,14,18,1) 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 40px 80px rgba(0,0,0,0.7)",
              }}
            >
              {/* Red accent line */}
              <div className="h-0.5 w-full bg-gradient-to-r from-[#e94f37] via-[#ff6b58] to-transparent" />

              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Write a Review
                  </h2>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {info.title}
                  </p>
                </div>
                <button
                  onClick={() => setWriteModalOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-white/40 hover:text-white transition-all cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Modal body */}
              <div className="max-h-[80svh] overflow-y-auto scrollbar-none">
                {!isAuthenticated ? (
                  <div className="flex flex-col items-center justify-center py-14 px-6 text-center gap-4">
                    <div className="text-4xl">🔐</div>
                    <div>
                      <h3 className="text-sm font-bold text-white mb-1">
                        Sign in to continue
                      </h3>
                      <p className="text-xs text-white/40">
                        You need to be logged in to leave a review.
                      </p>
                    </div>
                    <Link
                      href="/auth/login"
                      className="px-6 py-2 rounded-lg bg-[#e94f37] text-white text-sm font-semibold hover:bg-[#d94432] transition-colors"
                    >
                      Sign in
                    </Link>
                  </div>
                ) : banStatus.banned ? (
                  <div className="flex items-start gap-4 p-6">
                    <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-red-400"
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
                    <div>
                      <h3 className="text-sm font-bold text-red-400 mb-1">
                        Review Privileges Suspended
                      </h3>
                      <p className="text-xs text-white/40 mb-2">
                        Temporarily restricted due to policy violations.
                      </p>
                      <p className="text-xs text-white/40">
                        Expires in{" "}
                        <span className="text-red-400 font-semibold">
                          {banStatus?.timeRemaining || "Unknown"}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <ReviewFormInModal
                    contentId={id}
                    contentType={info.content_type}
                    onSuccess={() => setWriteModalOpen(false)}
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

/* ── Review Form (modal version) ── */
function ReviewFormInModal({
  contentId,
  contentType,
  onSuccess,
}: {
  contentId?: string;
  contentType?: string;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  const moodOptions = [
    { emoji: "🔥", label: "Amazing", value: "amazing" },
    { emoji: "❤️", label: "Loved it", value: "loved" },
    { emoji: "😊", label: "Enjoyed", value: "enjoyed" },
    { emoji: "😐", label: "It's okay", value: "okay" },
    { emoji: "😕", label: "Meh", value: "meh" },
    { emoji: "😞", label: "Disliked", value: "disliked" },
  ];
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
    if (!mood) {
      setError("🎭 Pick a mood first");
      return;
    }
    if (rating === null) {
      setError("⭐ Add a rating");
      return;
    }
    if (!content.trim() || content.trim().length < 10) {
      setError("✍️ At least 10 characters needed");
      return;
    }
    setSubmitting(true);
    try {
      const token = sGet("authToken");
      const res = await fetch("http://localhost:4000/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating,
          content: content.trim(),
          moodEmojis: [moodToEmoji[mood]],
          tmdbId: contentId ? parseInt(contentId) : 0,
          mediaType: (contentType?.toUpperCase() || "MOVIE") as "MOVIE" | "TV",
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message || "Failed");
      }
      onSuccess?.();
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to submit review.", "error", 4000, "Error", null);
    } finally {
      setSubmitting(false);
    }
  }

  const displayRating = hoveredStar !== null ? hoveredStar : rating;
  const author = user?.username ?? user?.name ?? "User";

  return (
    <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
      {/* Mood */}
      <div>
        <p className="text-[11px] uppercase tracking-widest text-white/30 mb-2.5">
          How did it make you feel?
        </p>
        <div className="grid grid-cols-6 gap-1.5">
          {moodOptions.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMood(m.value)}
              className={`relative flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border transition-all duration-200 cursor-pointer ${mood === m.value ? "bg-white/[0.08] border-[#e94f37]/50 scale-[1.04]" : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/20"}`}
            >
              <span className="text-lg leading-none">{m.emoji}</span>
              <span
                className={`text-[9px] font-medium leading-none text-center ${mood === m.value ? "text-white" : "text-white/35"}`}
              >
                {m.label}
              </span>
              {mood === m.value && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#e94f37] rounded-full flex items-center justify-center">
                  <svg
                    className="w-2 h-2 text-white"
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

      {/* Text card */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06]">
          <div className="w-6 h-6 rounded-full bg-white/[0.1] border border-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-white/50 text-[10px] font-bold">
              {author.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-xs font-medium text-white/50 flex-1">
            {author}
          </span>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => {
              const val = (i + 1) * 2;
              const active = displayRating !== null && displayRating >= val;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating((p) => (p === val ? null : val))}
                  onMouseEnter={() => setHoveredStar(val)}
                  onMouseLeave={() => setHoveredStar(null)}
                  className="p-0.5 transition-transform hover:scale-110 cursor-pointer"
                >
                  <Star
                    size={14}
                    className={`transition-colors ${active ? "text-yellow-400 fill-yellow-400" : "text-white/15 hover:text-white/40"}`}
                  />
                </button>
              );
            })}
          </div>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What did you think? Share what you loved, hated, or found surprising…"
          rows={5}
          className="w-full bg-transparent px-4 py-3 text-sm text-white/80 placeholder-white/20 resize-none outline-none leading-relaxed"
        />
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.06]">
          <span className="text-[11px] text-white/20">
            {content.length} chars
          </span>
          <span
            className={`text-[11px] font-medium ${content.length < 10 ? "text-white/20" : "text-[#e94f37]"}`}
          >
            {content.length < 10
              ? `${10 - content.length} more needed`
              : "✓ Ready"}
          </span>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg"
          >
            <svg
              className="w-3.5 h-3.5 text-red-400 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs text-red-300">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px] text-white/20">
          Your review may be featured publicly.
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 rounded-lg bg-[#e94f37] hover:bg-[#d94432] text-white text-sm font-semibold transition-colors disabled:opacity-40 cursor-pointer"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
    </form>
  );
}

/* ── Helpers ── */
function RatingArc({
  rating,
  color = "#e94f37",
  size = 44,
}: {
  rating: number;
  color?: string;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(10, rating));
  const r = size * 0.28,
    circ = 2 * Math.PI * r;
  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - clamped / 10)}
          style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-bold text-white"
        style={{ fontSize: size < 36 ? "0.55rem" : "0.65rem" }}
      >
        {clamped.toFixed(1)}
      </span>
    </div>
  );
}

function AvatarBlock({ review }: { review: Review }) {
  const size = 44;
  const avatarSrc = (() => {
    const av = review.author_details?.avatar_path;
    if (!av) return null;
    // base64 data URL
    if (av.startsWith("data:")) return av;
    // full https URL (Google CDN, uploaded avatar, etc.)
    if (av.startsWith("https://") || av.startsWith("http://")) return av;
    // TMDB stores Gravatar as "/https://..."
    if (av.startsWith("/https") || av.startsWith("/http")) return av.slice(1);
    // relative TMDB path
    return `https://image.tmdb.org/t/p/w185${av}`;
  })();
  const initials = (review.author || "A")
    .split(" ")
    .map((s) => s[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
  return (
    <div
      style={{ width: size, height: size, minWidth: size }}
      className="rounded-full overflow-hidden bg-white/[0.08] border border-white/[0.1] flex items-center justify-center flex-shrink-0"
    >
      {avatarSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarSrc}
          alt={review.author}
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          className="object-cover w-full h-full"
        />
      ) : (
        <span className="text-white/50 font-semibold text-sm">{initials}</span>
      )}
    </div>
  );
}
