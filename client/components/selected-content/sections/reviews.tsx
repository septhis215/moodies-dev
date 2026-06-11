"use client";

import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  userId?: string;
  author: string;
  author_details: {
    id?: string;
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

type RawReview = Partial<Review> & {
  id?: string;
  userId?: string;
  user?: {
    id?: string;
    username?: string;
    name?: string | null;
    avatarUrl?: string | null;
  };
  rating?: number;
  createdAt?: string;
  updatedAt?: string;
  moodEmojis?: string[];
};

type SortOption = "latest" | "highest" | "popularity";

type ReviewFormUser = {
  username?: string | null;
  name?: string | null;
};

interface ReviewsSectionProps {
  reviews: Review[] | { results?: Review[] } | undefined;
  contentId?: string;
  contentType?: "movie" | "tv";
}

function toAccentColor(rating?: number): string | null {
  if (rating == null) return null;
  const n = rating / 2;
  if (n >= 4) return "#4ade80";
  if (n >= 2.5) return "#facc15";
  return "#f87171";
}

const PREVIEW_LEN = 220;

export default function ReviewsSection({
  reviews,
  contentId,
  contentType,
}: ReviewsSectionProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const reviewsArray: Review[] = useMemo(
    () =>
      Array.isArray(reviews)
        ? reviews.map((r: RawReview) => ({
            id: r.id || `review-${r.createdAt}`,
            userId: r.user?.id || r.userId,
            author: r.user?.name || r.user?.username || "Anonymous",
            author_details: {
              id: r.user?.id || r.userId,
              username: r.user?.username,
              name: r.user?.name || r.user?.username,
              avatar_path: r.user?.avatarUrl ?? undefined,
              rating: r.rating,
            },
            content: r.content ?? "",
            created_at: r.createdAt ?? new Date().toISOString(),
            updated_at: r.updatedAt ?? r.createdAt ?? new Date().toISOString(),
            url: "",
            moodEmojis: r.moodEmojis || [],
          }))
        : [],
    [reviews],
  );

  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());

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

  const toggleExpand = (id: string) => {
    setExpandedReviews((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReviewModalOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = reviewModalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [reviewModalOpen]);

  const openModal = () => {
    if (!isAuthenticated) {
      toast("Sign in to write a review.", "warning", 3000, "Not Logged In", null);
      return;
    }
    setReviewModalOpen(true);
  };

  return (
    <>
      <section className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Audience Reviews
            </h2>
            <p className="text-white/45 text-sm mt-0.5">
              {sorted.length > 0
                ? `${sorted.length} review${sorted.length !== 1 ? "s" : ""} from the community`
                : "No reviews yet"}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Sort pills */}
            <div className="hidden md:flex items-center gap-1.5">
              {(["latest", "highest", "popularity"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer capitalize border ${
                    sortBy === s
                      ? "bg-[#e94f37]/[0.12] border-[#e94f37]/50 text-[#e94f37]"
                      : "bg-white/[0.04] border-white/[0.08] text-white/45 hover:text-white/80 hover:bg-white/[0.07] hover:border-white/[0.15]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="md:hidden bg-white/[0.04] text-white/70 rounded-xl px-3 py-1.5 text-xs border border-white/[0.09] outline-none cursor-pointer"
            >
              <option value="latest">Latest</option>
              <option value="highest">Highest</option>
              <option value="popularity">Popularity</option>
            </select>

            <button
              onClick={openModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-[#e94f37]/40 text-[#e94f37] text-xs font-semibold hover:bg-[#e94f37]/[0.10] hover:border-[#e94f37]/70 active:scale-95 transition-all duration-150 cursor-pointer"
            >
              <PenSquare size={11} strokeWidth={2.5} />
              Write a Review
            </button>

            <Link
              href={viewAllHref}
              className="text-xs text-white/40 hover:text-white transition-colors whitespace-nowrap"
            >
              View all →
            </Link>
          </div>
        </div>

        {/* ── Cards ── */}
        <div
          className={`grid gap-3 ${
            expandedReviews.size > 0
              ? "grid-cols-1"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          <AnimatePresence mode="popLayout">
            {topThree.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full flex flex-col items-center justify-center py-16 gap-4 rounded-2xl bg-white/[0.03] border border-white/[0.07]"
              >
                <div className="text-4xl opacity-20 select-none">💬</div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white/50">No reviews yet</p>
                  <p className="text-xs text-white/25 mt-0.5">Be the first to share your thoughts</p>
                </div>
                <button
                  onClick={openModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.07] hover:bg-white/[0.11] border border-white/[0.10] text-white/60 hover:text-white text-xs font-medium transition-all duration-150 cursor-pointer"
                >
                  <PenSquare size={12} strokeWidth={2.5} />
                  Write a Review
                </button>
              </motion.div>
            ) : (
              topThree.map((r) => {
                const isExpanded = expandedReviews.has(r.id);
                const needsTruncation = r.content.length > PREVIEW_LEN;
                const profileHref = r.userId
                  ? `/profile/${encodeURIComponent(r.userId)}`
                  : undefined;
                const normalizedRating =
                  r.author_details?.rating != null
                    ? r.author_details.rating / 2
                    : null;
                const accentColor = toAccentColor(r.author_details?.rating);

                return (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{
                      layout: { duration: 0.3, ease: "easeInOut" },
                      opacity: { duration: 0.2 },
                    }}
                    className="group flex flex-col rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.06] transition-all duration-200 overflow-hidden"
                  >
                    {/* Top: quote glyph + score badge */}
                    <div className="flex items-start justify-between px-5 pt-5 pb-0">
                      {/* Decorative quote mark */}
                      <svg
                        className="w-7 h-7 flex-shrink-0 opacity-[0.08]"
                        viewBox="0 0 32 32"
                        fill="white"
                        aria-hidden
                      >
                        <path d="M10 8C5.6 8 2 11.6 2 16v8h8v-8H4c0-3.3 2.7-6 6-6V8zm12 0c-4.4 0-8 3.6-8 8v8h8v-8h-6c0-3.3 2.7-6 6-6V8z" />
                      </svg>

                      {/* Rating score pill */}
                      {normalizedRating !== null ? (
                        <div
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0"
                          style={{
                            color: accentColor!,
                            background: `${accentColor}18`,
                            border: `1px solid ${accentColor}35`,
                          }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill={accentColor!}
                            aria-hidden
                          >
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                          {normalizedRating.toFixed(1)}
                        </div>
                      ) : r.moodEmojis?.[0] ? (
                        <span className="text-xl leading-none" title="Mood">
                          {r.moodEmojis[0]}
                        </span>
                      ) : null}
                    </div>

                    {/* Review text — the hero */}
                    <div className="flex-1 px-5 pt-3 pb-4">
                      <p className="text-[13px] text-white/70 leading-[1.75] break-words">
                        {isExpanded
                          ? r.content
                          : r.content.slice(0, PREVIEW_LEN)}
                        {!isExpanded && needsTruncation && (
                          <span className="text-white/25">…</span>
                        )}
                      </p>
                      {needsTruncation && (
                        <button
                          onClick={() => toggleExpand(r.id)}
                          className="mt-2 text-[11px] text-[#e94f37]/70 hover:text-[#e94f37] font-semibold transition-colors cursor-pointer"
                        >
                          {isExpanded ? "Show less" : "Read more"}
                        </button>
                      )}
                    </div>

                    {/* Author attribution footer */}
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-white/[0.07] bg-white/[0.025]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AvatarBlock review={r} href={profileHref} size={28} />
                        <div className="min-w-0">
                          {profileHref ? (
                            <Link
                              href={profileHref}
                              className="text-xs font-semibold text-white/75 hover:text-[#ff8a78] transition-colors truncate block"
                            >
                              {r.author}
                            </Link>
                          ) : (
                            <p className="text-xs font-semibold text-white/75 truncate">
                              {r.author}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-white/25">
                              {new Date(r.created_at).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric", year: "numeric" },
                              )}
                            </span>
                            {r.moodEmojis?.[0] && normalizedRating !== null && (
                              <span className="text-xs leading-none">
                                {r.moodEmojis[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <Link
                        href={
                          contentId
                            ? `/${basePath}/${contentId}/reviews?highlight=${encodeURIComponent(r.id)}`
                            : r.url || "#"
                        }
                        className="text-[10px] font-medium text-white/20 hover:text-[#e94f37] transition-colors flex-shrink-0"
                      >
                        Full →
                      </Link>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </section>

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
      style={{ background: "rgba(8, 10, 22, 0.90)", backdropFilter: "blur(20px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 14 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.09]"
        style={{ boxShadow: "0 32px 72px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)" }}
      >
        {/* Header — matches card top: quote glyph + title + close */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <svg
              className="w-7 h-7 opacity-[0.09] flex-shrink-0"
              viewBox="0 0 32 32"
              fill="white"
              aria-hidden
            >
              <path d="M10 8C5.6 8 2 11.6 2 16v8h8v-8H4c0-3.3 2.7-6 6-6V8zm12 0c-4.4 0-8 3.6-8 8v8h8v-8h-6c0-3.3 2.7-6 6-6V8z" />
            </svg>
            <div>
              <h2 className="text-sm font-bold text-white leading-none">Write a Review</h2>
              <p className="text-[11px] text-white/30 mt-1">Share your take with the community</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-xl bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] hover:border-white/[0.16] text-white/40 hover:text-white transition-all cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        <div className="max-h-[80svh] overflow-y-auto scrollbar-none">
          {!isAuthenticated ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-2xl">
                🔐
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Sign in to continue</h3>
                <p className="text-xs text-white/35">You need to be logged in to leave a review.</p>
              </div>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-white/[0.04] border border-[#e94f37]/40 text-[#e94f37] text-xs font-semibold hover:bg-[#e94f37]/[0.10] hover:border-[#e94f37]/70 transition-all"
              >
                Sign in
              </Link>
            </div>
          ) : banStatus.banned ? (
            <div className="flex items-start gap-4 px-5 py-5">
              <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-white/[0.04] border border-red-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-red-400 mb-1">Review Privileges Suspended</h3>
                <p className="text-[11px] text-white/35 mb-3">Temporarily restricted due to policy violations.</p>
                <div className="flex items-center gap-1.5 text-[11px] text-white/35">
                  <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Expires in{" "}
                  <span className="text-red-400 font-semibold">{banStatus?.timeRemaining || "Unknown"}</span>
                </div>
              </div>
            </div>
          ) : (
            <ReviewForm
              contentId={contentId}
              contentType={contentType}
              onSuccess={onClose}
              user={user ?? undefined}
            />
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/* ─── ReviewForm ─── */
function ReviewForm({
  contentId,
  contentType,
  onSuccess,
  user,
}: {
  contentId?: string;
  contentType?: "movie" | "tv";
  onSuccess?: () => void;
  user?: ReviewFormUser;
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
    amazing: "🔥", loved: "❤️", enjoyed: "😊",
    okay: "😐", meh: "😕", disliked: "😞",
  };

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!contentId) { setError("Content ID is missing."); return; }
    if (!mood) { setError("🎭 Pick a mood first"); return; }
    if (rating === null) { setError("⭐ Add a rating"); return; }
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
      toast(
        err instanceof Error ? err.message : "Failed to submit review.",
        "error", 4000, "Error", null,
      );
    } finally {
      setSubmitting(false);
    }
  }

  const displayRating = hoveredStar !== null ? hoveredStar : rating;
  const normalizedDisplay = displayRating !== null ? displayRating / 2 : null;
  const ratingColor =
    normalizedDisplay === null ? null
    : normalizedDisplay >= 4 ? "#4ade80"
    : normalizedDisplay >= 2.5 ? "#facc15"
    : "#f87171";
  const author = user?.username ?? user?.name ?? "User";

  return (
    <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">

      {/* ── Compose card — the hero ── */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">

        {/* Top: quote glyph + rating score pill — mirrors review card */}
        <div className="flex items-center justify-between px-4 pt-4 pb-0">
          <svg className="w-6 h-6 opacity-[0.08]" viewBox="0 0 32 32" fill="white" aria-hidden>
            <path d="M10 8C5.6 8 2 11.6 2 16v8h8v-8H4c0-3.3 2.7-6 6-6V8zm12 0c-4.4 0-8 3.6-8 8v8h8v-8h-6c0-3.3 2.7-6 6-6V8z" />
          </svg>

          {/* Rating score pill — same as card, animates as you hover stars */}
          <AnimatePresence mode="popLayout">
            {normalizedDisplay !== null ? (
              <motion.div
                key="pill"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0"
                style={{
                  color: ratingColor!,
                  background: `${ratingColor}18`,
                  border: `1px solid ${ratingColor}35`,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill={ratingColor!} aria-hidden>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {normalizedDisplay.toFixed(1)}
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/[0.08] text-[10px] text-white/20"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                —
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Textarea — hero content */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What did you think? Share what you loved, hated, or found surprising…"
          rows={5}
          className="w-full bg-transparent px-4 py-3 text-[13px] text-white/75 placeholder-white/20 resize-none outline-none leading-[1.75]"
        />

        {/* Attribution footer — mirrors card's author row */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-white/[0.07] bg-white/[0.025]">
          <div className="flex items-center gap-2.5">
            <div
              style={{ width: 28, height: 28, minWidth: 28 }}
              className="rounded-full bg-white/[0.09] border border-white/[0.12] flex items-center justify-center flex-shrink-0"
            >
              <span className="text-white/60 font-semibold text-[10px]">
                {author.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/75 leading-none">{author}</p>
              <p className="text-[10px] text-white/25 mt-0.5">Posting as you</p>
            </div>
          </div>
          <span className={`text-[10px] font-semibold ${content.length < 10 ? "text-white/20" : "text-[#4ade80]"}`}>
            {content.length < 10 ? `${10 - content.length} more` : "✓ Ready"}
          </span>
        </div>
      </div>

      {/* ── Rating row ── */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] text-white/35 font-medium">Your rating</span>
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
                className="p-1 transition-transform hover:scale-110 cursor-pointer"
              >
                <Star
                  size={16}
                  className={`transition-colors duration-100 ${active ? "text-yellow-400 fill-yellow-400" : "text-white/20 hover:text-white/35"}`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Mood grid ── */}
      <div>
        <p className="text-[11px] text-white/35 font-medium px-1 mb-2">How did it make you feel?</p>
        <div className="grid grid-cols-6 gap-1.5">
          {moodOptions.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMood(m.value)}
              className={`relative flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border transition-all duration-200 cursor-pointer ${
                mood === m.value
                  ? "bg-[#e94f37]/[0.10] border-[#e94f37]/50 scale-[1.04]"
                  : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.07] hover:border-white/[0.15]"
              }`}
            >
              <span className="text-base leading-none">{m.emoji}</span>
              <span className={`text-[9px] font-medium leading-none text-center ${mood === m.value ? "text-white/80" : "text-white/30"}`}>
                {m.label}
              </span>
              {mood === m.value && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#e94f37] rounded-full flex items-center justify-center">
                  <svg className="w-1.5 h-1.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-red-500/20"
          >
            <svg className="w-3 h-3 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-xs text-red-300">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer: notice + submit ── */}
      <div className="flex items-center justify-between pt-1 pb-1">
        <p className="text-[10px] text-white/20">May be featured publicly.</p>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 rounded-xl bg-white/[0.04] border border-[#e94f37]/40 text-[#e94f37] text-xs font-semibold hover:bg-[#e94f37]/[0.10] hover:border-[#e94f37]/70 active:scale-95 transition-all disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
        >
          {submitting ? "Submitting…" : "Submit Review"}
        </button>
      </div>
    </form>
  );
}

/* ─── Helpers ─── */
function AvatarBlock({
  review,
  href,
  size = 40,
}: {
  review: Review;
  href?: string;
  size?: number;
}) {
  const avatarSrc = (() => {
    const av = review.author_details?.avatar_path;
    if (!av) return null;
    if (av.startsWith("data:")) return av;
    if (av.startsWith("https://") || av.startsWith("http://")) return av;
    if (av.startsWith("/https") || av.startsWith("/http")) return av.slice(1);
    return `https://image.tmdb.org/t/p/w185${av}`;
  })();
  const initials = (review.author || "A")
    .split(" ")
    .map((s) => s[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
  const avatar = (
    <div
      style={{ width: size, height: size, minWidth: size }}
      className="rounded-full overflow-hidden bg-white/[0.09] flex items-center justify-center ring-1 ring-white/[0.12] flex-shrink-0 transition-all group-hover:ring-[#e94f37]/50"
    >
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt={review.author}
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          className="object-cover w-full h-full"
        />
      ) : (
        <span
          className="text-white/60 font-semibold"
          style={{ fontSize: size < 32 ? "10px" : "12px" }}
        >
          {initials}
        </span>
      )}
    </div>
  );

  if (!href) return avatar;

  return (
    <Link
      href={href}
      aria-label={`View ${review.author}'s profile`}
      className="group rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e94f37]"
    >
      {avatar}
    </Link>
  );
}
