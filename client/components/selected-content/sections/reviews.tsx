"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { Star, PenSquare, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/context/AuthProvider";
import { useReviewBanStatus } from "@/hooks/useReviewBanStatus";
import { useToast } from "@/app/context/ToastContext";
import { useRouter } from "next/navigation";
import { sGet } from "@/utils/secureStorage";

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
  moodEmojis?: string[];
};

interface ReviewsSectionProps {
  reviews: Review[] | { results?: Review[] } | undefined;
  contentId?: string;
  contentType?: "movie" | "tv";
}

export default function ReviewsSection({
  reviews,
  contentId,
  contentType,
}: ReviewsSectionProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const reviewsArray: Review[] = Array.isArray(reviews)
    ? reviews.map((r: any) => ({
        id: r.id || `review-${r.createdAt}`,
        author: r.user?.username || "Anonymous",
        author_details: {
          username: r.user?.username,
          name: r.user?.username,
          avatar_path: r.user?.avatarUrl,
          rating: r.rating,
        },
        content: r.content,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
        url: "",
        moodEmojis: r.moodEmojis || [],
      }))
    : [];

  const [sortBy, setSortBy] = useState<"latest" | "highest" | "popularity">(
    "latest",
  );
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  function popularityProxy(r: Review) {
    return (
      (r.author_details?.rating ?? 0) +
      Math.min(5, (r.content?.length ?? 0) / 200)
    );
  }

  const sorted = useMemo(() => {
    const arr = [...reviewsArray];
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
  }, [reviewsArray, sortBy]);

  const topThree = sorted.slice(0, 3);
  const basePath = contentType === "tv" ? "tv" : "movies";
  const viewAllHref = contentId ? `/${basePath}/${contentId}/reviews` : "#";
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(
    new Set(),
  );

  const toggleExpand = (id: string) => {
    setExpandedReviews((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  // close modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReviewModalOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // prevent body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = reviewModalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [reviewModalOpen]);

  return (
    <>
      <section className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Audience Reviews
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Top community picks & latest opinions
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Sort pills — desktop */}
            <div className="hidden md:flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.07]">
              {(["latest", "highest", "popularity"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer capitalize ${sortBy === s ? "bg-[#e94f37] text-white" : "text-slate-400 hover:text-white"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            {/* Sort — mobile */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="md:hidden bg-white/[0.05] text-slate-200 rounded-lg px-3 py-2 text-sm border border-white/[0.07] outline-none cursor-pointer"
            >
              <option value="latest">Latest</option>
              <option value="highest">Highest</option>
              <option value="popularity">Popularity</option>
            </select>

            {/* Divider */}
            <div className="hidden sm:block h-5 w-px bg-white/[0.1]" />

            {/* Write a Review — primary CTA */}
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  toast("Sign in to write a review.", "warning", 3000, "Not Logged In", null);
                  return;
                }
                setReviewModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#e94f37] hover:bg-[#d94432] active:scale-95 text-white text-xs font-semibold transition-all duration-150 cursor-pointer shadow-lg shadow-[#e94f37]/20"
            >
              <PenSquare size={13} strokeWidth={2.5} />
              Write a Review
            </button>

            {/* View all — text link style */}
            <Link
              href={viewAllHref}
              className="text-xs font-medium text-white/40 hover:text-white transition-colors underline underline-offset-2 decoration-white/20 hover:decoration-white/60 whitespace-nowrap"
            >
              View all
            </Link>
          </div>
        </div>

        {/* ── Review cards ── */}
        <div
          className={`grid gap-4 transition-all duration-300 ${expandedReviews.size > 0 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}
        >
          <AnimatePresence mode="popLayout">
            {topThree.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 gap-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="text-3xl opacity-30">💬</div>
                <p className="text-sm text-white/30">
                  No reviews yet. Be the first!
                </p>
              </div>
            ) : (
              topThree.map((r, idx) => {
                const isExpanded = expandedReviews.has(r.id);
                const preview = r.content.slice(0, 150);
                const needsTruncation = r.content.length > 150;
                return (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{
                      layout: { duration: 0.3, ease: "easeInOut" },
                      opacity: { duration: 0.2 },
                    }}
                    className="relative flex flex-col gap-4 p-5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200 overflow-hidden"
                  >
                    <svg
                      className="absolute top-3 right-3 w-7 h-7 text-white/[0.04]"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                    </svg>
                    <div className="flex items-center gap-3 min-w-0">
                      <AvatarBlock review={r} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {r.author}
                        </p>
                        <p className="text-[11px] text-white/30">
                          {new Date(r.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {typeof r.author_details?.rating === "number" && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] flex-shrink-0">
                          <Star size={11} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                          <span className="text-xs font-semibold text-white/80 leading-none">
                            {(r.author_details.rating / 2).toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>
                    {r.moodEmojis && r.moodEmojis.length > 0 && (
                      <div className="flex gap-1">
                        {r.moodEmojis.slice(0, 3).map((e, i) => (
                          <span key={i} className="text-base">
                            {e}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm text-white/70 leading-relaxed break-words">
                        {isExpanded ? r.content : preview}
                        {!isExpanded && needsTruncation && "…"}
                      </p>
                      {needsTruncation && (
                        <button
                          onClick={() => toggleExpand(r.id)}
                          className="mt-2 text-xs text-[#e94f37] hover:text-[#ff6b58] font-medium transition-colors cursor-pointer"
                        >
                          {isExpanded ? "Show less" : "Read more"}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                      <Link
                        href={
                          contentId
                            ? `/${basePath}/${contentId}/reviews?highlight=${encodeURIComponent(r.id)}`
                            : r.url || "#"
                        }
                        className="text-xs text-white/30 hover:text-[#e94f37] transition-colors"
                      >
                        Full review →
                      </Link>
                      <span className="text-[11px] text-white/20">
                        #{idx + 1} of {sorted.length}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ── Review Modal ── */}
      <AnimatePresence>
        {reviewModalOpen && (
          <ReviewModal
            contentId={contentId}
            contentType={contentType}
            onClose={() => setReviewModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Review Modal ─── */
function ReviewModal({
  contentId,
  contentType,
  onClose,
}: {
  contentId?: string;
  contentType?: "movie" | "tv";
  onClose: () => void;
}) {
  const { isAuthenticated, user } = useAuth();
  const { banStatus } = useReviewBanStatus();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(14px)" }}
      onClick={onClose}
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
            "linear-gradient(135deg, rgba(20,20,24,0.98) 0%, rgba(14,14,18,0.99) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "0 40px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        {/* Red accent bar at top */}
        <div className="h-0.5 w-full bg-gradient-to-r from-[#e94f37] via-[#ff6b58] to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-base font-bold text-white">Write a Review</h2>
            <p className="text-xs text-white/30 mt-0.5">
              Share your experience with the community
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-white/50 hover:text-white transition-all cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[80svh] overflow-y-auto scrollbar-none">
          {!isAuthenticated ? (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center gap-4">
              <div className="text-5xl">🔐</div>
              <div>
                <h3 className="text-base font-bold text-white mb-1">
                  Sign in to continue
                </h3>
                <p className="text-sm text-white/40">
                  You need to be logged in to leave a review.
                </p>
              </div>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#e94f37] text-white text-sm font-semibold hover:bg-[#d94432] transition-colors"
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
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-red-400 mb-1">
                  Review Privileges Suspended
                </h3>
                <p className="text-xs text-white/40 mb-3">
                  Temporarily restricted due to policy violations.
                </p>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <svg
                    className="w-3.5 h-3.5 text-red-400"
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
                  Expires in{" "}
                  <span className="text-red-400 font-semibold ml-1">
                    {banStatus?.timeRemaining || "Unknown"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <ReviewForm
              contentId={contentId}
              contentType={contentType}
              onSuccess={onClose}
              user={user}
            />
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

/* ─── ReviewForm (inside modal) ─── */
function ReviewForm({
  contentId,
  contentType,
  onSuccess,
  user,
}: {
  contentId?: string;
  contentType?: "movie" | "tv";
  onSuccess?: () => void;
  user?: any;
}) {
  const [content, setContent] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const { toast } = useToast();
  const router = useRouter();

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
    if (!contentId) {
      setError("Content ID is missing.");
      return;
    }
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
          tmdbId: parseInt(contentId),
          mediaType: (contentType?.toUpperCase() || "MOVIE") as "MOVIE" | "TV",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed");
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
      {/* Mood selector */}
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
              className={`relative flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border transition-all duration-200 cursor-pointer ${
                mood === m.value
                  ? "bg-white/[0.08] border-[#e94f37]/50 scale-[1.04]"
                  : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/20"
              }`}
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

      {/* Review text + rating card */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
        {/* Author strip */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06]">
          <div className="w-6 h-6 rounded-full bg-white/[0.1] border border-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-white/50 text-[10px] font-bold">
              {author.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-xs font-medium text-white/50">{author}</span>

          {/* Stars inline */}
          <div className="ml-auto flex items-center gap-0.5">
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

        {/* Textarea */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What did you think? Share what you loved, hated, or found surprising…"
          rows={5}
          className="w-full bg-transparent px-4 py-3 text-sm text-white/80 placeholder-white/20 resize-none outline-none leading-relaxed"
        />

        {/* Char count footer */}
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

      {/* Submit */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px] text-white/20">
          Your review may be featured publicly.
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 rounded-lg bg-[#e94f37] hover:bg-[#d94432] text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
    </form>
  );
}

/* ─── Helpers ─── */
function RatingArc({ rating }: { rating: number }) {
  const clamped = Math.max(0, Math.min(10, rating));
  const r = 10,
    circ = 2 * Math.PI * r;
  return (
    <div className="relative flex-shrink-0 w-9 h-9">
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="#e94f37"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - clamped / 10)}
          style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
        {clamped.toFixed(1)}
      </span>
    </div>
  );
}

function AvatarBlock({ review }: { review: Review }) {
  const size = 40;
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
      style={{ width: size, height: size, minWidth: size }}
      className="rounded-full overflow-hidden bg-white/[0.08] flex items-center justify-center ring-1 ring-white/10 flex-shrink-0"
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
        <span className="text-white/60 font-semibold text-xs">{initials}</span>
      )}
    </div>
  );
}
