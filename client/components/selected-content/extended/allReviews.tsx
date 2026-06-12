"use client";

"use client";

import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { sGet } from "@/utils/secureStorage";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Star, Search, PenSquare, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/context/AuthProvider";
import { useReviewBanStatus } from "@/hooks/useReviewBanStatus";
import { useToast } from "@/app/context/ToastContext";

function toAccentColor(rating?: number): string | null {
  if (rating == null) return null;
  const n = rating / 2;
  if (n >= 4) return "#4ade80";
  if (n >= 2.5) return "#facc15";
  return "#f87171";
}

type Reply = {
  id?: string;
  content: string;
  created_at: string;
  user: { id?: string; username: string; avatar_path?: string | null };
};

type ReplyFormState = { reviewId: string; prefill: string } | null;

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

  useEffect(() => {
    setLocalReviews(reviews);
  }, [reviews]);
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
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  const toggleReplies = (id: string) =>
    setExpandedReplies((p) => {
      const s = new Set(p);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const formatDate = (d: string) => {
    const parsed = new Date(d);
    if (Number.isNaN(parsed.getTime())) return "Date unavailable";
    return parsed.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const profileHrefFor = (userId?: string) =>
    userId ? `/profile/${encodeURIComponent(userId)}` : undefined;

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
    if (!replyContent.trim()) return;
    setSubmittingReply(true);
    try {
      const token = sGet("authToken");
      const submittedContent = (
        (showReplyForm?.prefill ?? "") + replyContent
      ).trim();
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
              },
        ),
      );
      setReplyContent("");
      setShowReplyForm(null);
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Failed to post reply.",
        "error",
        4000,
        "Error",
        null,
      );
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
            src={
              info.backdrop_path
                ? `https://image.tmdb.org/t/p/w1280${info.backdrop_path}`
                : "/placeholder-backdrop.svg"
            }
            alt={info.title}
            fill
            sizes="100vw"
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
          <Link
            href={`/${basePath}/${id}`}
            className="inline-flex items-center gap-1.5 text-white/40 hover:text-white transition-colors text-sm mb-8"
          >
            <ArrowLeft size={15} />
            Back to {info.title}
          </Link>

          <div className="flex gap-5 sm:gap-8 items-start">
            <div className="flex-shrink-0 w-20 sm:w-28 md:w-36 rounded-xl overflow-hidden shadow-2xl border border-white/[0.08]">
              <Image
                src={
                  info.poster_path
                    ? `https://image.tmdb.org/t/p/w500${info.poster_path}`
                    : "/placeholder-poster.svg"
                }
                alt={info.title}
                width={144}
                height={216}
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>

            <div className="flex-1 min-w-0 space-y-3">
              <p className="text-[11px] uppercase tracking-widest text-white/40">
                {info.content_type === "tv" ? "TV Series" : "Movie"} · Reviews
              </p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
                {info.title}
              </h1>

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
                <div className="h-3 w-px bg-white/20" />
                {info.genres.slice(0, 3).map((g) => (
                  <span
                    key={g.id}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/50"
                  >
                    {g.name}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-4 flex-wrap pt-1">
                {reviewStats && reviewStats.totalRatings > 0 && (
                  <>
                    <div className="flex items-center gap-2">
                      <RatingArc
                        rating={reviewStats.averageRating}
                        color="#e94f37"
                      />
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-white/40">
                          Community
                        </p>
                        <p className="text-xs text-white/60">
                          {reviewStats.totalRatings} ratings
                        </p>
                      </div>
                    </div>
                    <div className="h-8 w-px bg-white/[0.08]" />
                  </>
                )}
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
                      <span className="text-[11px] text-white/45 ml-1">
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
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45"
            />
            <input
              type="text"
              placeholder="Search reviews…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-white/45 outline-none focus:border-[#e94f37]/35 transition-colors"
            />
          </div>

          {/* Sort pills — individual card tiles */}
          <div className="flex items-center gap-1.5">
            {(["latest", "highest", "popularity"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer capitalize border ${
                  sortBy === s
                    ? "bg-[#e94f37]/[0.12] border-[#e94f37]/50 text-[#e94f37]"
                    : "bg-white/[0.04] border-white/[0.08] text-white/55 hover:text-white/80 hover:bg-white/[0.07] hover:border-white/[0.15]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-white/45 hidden sm:block">
            {filteredAndSorted.length} review
            {filteredAndSorted.length !== 1 ? "s" : ""}
            {searchQuery && ` for "${searchQuery}"`}
          </span>

          <div className="flex-1" />

          {/* Write CTA — transparent red border */}
          <button
            onClick={() => {
              if (!isAuthenticated) {
                toast(
                  "Sign in to write a review.",
                  "warning",
                  3000,
                  "Not Logged In",
                  null,
                );
                return;
              }
              setWriteModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-[#e94f37]/40 text-[#e94f37] text-xs font-semibold hover:bg-[#e94f37]/[0.10] hover:border-[#e94f37]/70 active:scale-95 transition-all cursor-pointer"
          >
            <PenSquare size={11} strokeWidth={2.5} />
            Write a Review
          </button>
        </div>
      </div>

      {/* ── Reviews list ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredAndSorted.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-6 py-20 text-center shadow-[0_18px_70px_rgba(0,0,0,0.24)]"
              >
                <div className="text-4xl opacity-20 select-none">💬</div>
                <p className="text-sm font-bold text-white/82">
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
                const normalizedRating =
                  review.author_details?.rating != null
                    ? review.author_details.rating / 2
                    : null;
                const accentColor = toAccentColor(
                  review.author_details?.rating,
                );
                const profileHref = profileHrefFor(review.userId);

                return (
                  <motion.div
                    key={review.id}
                    id={`review-${review.id}`}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="group rounded-2xl border border-white/[0.08] bg-[rgba(255,255,255,0.045)] shadow-[0_18px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-[#e94f37]/25 hover:bg-white/[0.065] overflow-hidden"
                  >
                    <div className="flex flex-col gap-4 px-4 pt-4 sm:px-5 sm:pt-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <AvatarBlock
                            review={review}
                            href={profileHref}
                            size={40}
                          />
                          <div className="min-w-0">
                            {profileHref ? (
                              <Link
                                href={profileHref}
                                className="block truncate text-sm font-bold text-white/90 underline-offset-4 transition-colors hover:text-[#ff8a78] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e94f37]"
                              >
                                {review.author}
                              </Link>
                            ) : (
                              <p className="truncate text-sm font-bold text-white/88">
                                {review.author}
                              </p>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/50">
                              <span>{formatDate(review.created_at)}</span>
                              {review.author_details?.username && (
                                <span className="text-white/36">
                                  @{review.author_details.username}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-shrink-0 items-center gap-2">
                          {review.moodEmojis?.[0] && (
                            <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-2 py-1 text-sm leading-none">
                              {review.moodEmojis[0]}
                            </span>
                          )}
                          {normalizedRating !== null && (
                            <div
                              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
                              style={{
                                color: accentColor!,
                                background: `${accentColor}18`,
                                border: `1px solid ${accentColor}40`,
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
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Review text — hero */}
                    <div className="px-5 pt-3 pb-4">
                      <p className="text-[15px] text-white/78 leading-7 whitespace-pre-wrap">
                        {shouldTruncate && !isExpanded ? (
                          <>
                            {review.content.slice(0, 400)}
                            <span className="text-white/25">…</span>
                          </>
                        ) : (
                          review.content
                        )}
                      </p>
                      {shouldTruncate && (
                        <button
                          onClick={() => toggleExpanded(review.id)}
                          className="mt-3 text-[12px] text-[#ff8a78] hover:text-[#ffb3a7] font-semibold transition-colors cursor-pointer"
                        >
                          {isExpanded ? "Show less" : "Read more"}
                        </button>
                      )}
                    </div>

                    {/* Replies */}
                    {review.replies && review.replies.length > 0 && (
                      <div className="mx-4 mb-4 rounded-2xl border border-white/[0.07] bg-black/20 p-3 sm:mx-5 sm:p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                            Replies
                          </p>
                          <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/45">
                            {review.replies.length}
                          </span>
                        </div>
                        <div className="relative space-y-2.5 pl-3 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-px before:bg-gradient-to-b before:from-[#e94f37]/45 before:via-white/12 before:to-transparent sm:pl-4">
                          {(repliesExpanded
                            ? review.replies
                            : review.replies.slice(0, 2)
                          ).map((reply, i) => {
                            const replyHref = profileHrefFor(reply.user.id);
                            return (
                              <div
                                key={reply.id ?? i}
                                className="relative rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-3 transition-colors hover:border-white/[0.12] hover:bg-white/[0.055]"
                              >
                                <span className="absolute -left-3 top-5 h-px w-3 bg-white/14 sm:-left-4 sm:w-4" />
                                <div className="flex items-start gap-2.5">
                                  <ReplyAvatarBlock
                                    reply={reply}
                                    href={replyHref}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-0.5">
                                      {replyHref ? (
                                        <Link
                                          href={replyHref}
                                          className="truncate text-xs font-semibold text-white/82 underline-offset-4 transition-colors hover:text-[#ff8a78] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e94f37]"
                                        >
                                          {reply.user.username}
                                        </Link>
                                      ) : (
                                        <span className="truncate text-xs font-semibold text-white/72">
                                          {reply.user.username}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-white/45">
                                        {formatDate(reply.created_at)}
                                      </span>
                                      {!banStatus.banned && (
                                        <button
                                          onClick={() =>
                                            showReplyForm?.reviewId ===
                                              review.id &&
                                            showReplyForm?.prefill ===
                                              `@${reply.user.username} — `
                                              ? closeReplyForm()
                                              : openReplyForm(
                                                  review.id,
                                                  `@${reply.user.username} — `,
                                                )
                                          }
                                          className="text-[10px] text-white/38 hover:text-[#ff8a78] transition-colors cursor-pointer ml-auto font-semibold"
                                        >
                                          Reply
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-xs text-white/68 leading-5 mt-1.5">
                                      {(() => {
                                        const sep = " — ";
                                        const idx = reply.content.indexOf(sep);
                                        if (
                                          reply.content.startsWith("@") &&
                                          idx !== -1
                                        ) {
                                          return (
                                            <>
                                              <span
                                                className="font-semibold"
                                                style={{ color: "#ff8a78" }}
                                              >
                                                {reply.content.slice(0, idx)}
                                              </span>
                                              <span className="text-white/20">
                                                {" "}
                                                —{" "}
                                              </span>
                                              {reply.content.slice(
                                                idx + sep.length,
                                              )}
                                            </>
                                          );
                                        }
                                        return reply.content
                                          .split(/(@\S+)/)
                                          .map((part, i) =>
                                            /^@\S+/.test(part) ? (
                                              <span
                                                key={i}
                                                className="font-semibold"
                                                style={{ color: "#ff8a78" }}
                                              >
                                                {part}
                                              </span>
                                            ) : (
                                              part
                                            ),
                                          );
                                      })()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {review.replies.length > 2 && (
                          <button
                            onClick={() => toggleReplies(review.id)}
                            className="mt-3 text-[11px] text-white/45 hover:text-white/72 transition-colors cursor-pointer font-semibold"
                          >
                            {repliesExpanded
                              ? "Show less"
                              : `+ ${review.replies.length - 2} more repl${review.replies.length - 2 === 1 ? "y" : "ies"}`}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Reply compose */}
                    <AnimatePresence>
                      {showReplyForm?.reviewId === review.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mx-4 mb-4 space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3 sm:mx-5"
                        >
                          {showReplyForm?.prefill && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/20 border border-white/[0.07] rounded-xl">
                              <span
                                className="text-xs font-semibold"
                                style={{ color: "#e94f37" }}
                              >
                                {showReplyForm.prefill.trim()}
                              </span>
                              <span className="text-xs text-white/48">
                                replying to
                              </span>
                            </div>
                          )}
                          <textarea
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder="Write your reply…"
                            rows={3}
                            autoFocus
                            className="w-full bg-black/20 border border-white/[0.08] focus:border-[#e94f37]/45 rounded-xl px-3 py-2.5 text-sm text-white/78 placeholder-white/35 resize-none outline-none transition-colors"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => closeReplyForm()}
                              className="px-3 py-1.5 text-xs text-white/48 hover:text-white/78 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleReplySubmit(review.id)}
                              disabled={submittingReply}
                              className="px-4 py-1.5 rounded-xl bg-white/[0.04] border border-[#e94f37]/40 text-[#e94f37] text-xs font-semibold hover:bg-[#e94f37]/[0.10] hover:border-[#e94f37]/70 transition-all disabled:opacity-40 cursor-pointer"
                            >
                              {submittingReply ? "Posting…" : "Post Reply"}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Action footer */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] bg-white/[0.025] px-4 py-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-white/45">
                        <span>
                          {review.replies?.length ?? 0} repl
                          {(review.replies?.length ?? 0) === 1 ? "y" : "ies"}
                        </span>
                        {review.updated_at &&
                          review.updated_at !== review.created_at && (
                            <>
                              <span className="text-white/18">/</span>
                              <span>
                                Updated {formatDate(review.updated_at)}
                              </span>
                            </>
                          )}
                      </div>

                      <div className="flex flex-shrink-0 items-center gap-3">
                        {banStatus.banned ? (
                          <span className="text-[10px] text-red-400/50">
                            Replies suspended
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              showReplyForm?.reviewId === review.id
                                ? closeReplyForm()
                                : openReplyForm(review.id)
                            }
                            className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[11px] font-semibold text-white/58 transition-all hover:border-[#e94f37]/35 hover:bg-[#e94f37]/10 hover:text-[#ff8a78] cursor-pointer"
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
                            {showReplyForm?.reviewId === review.id
                              ? "Cancel"
                              : "Reply"}
                          </button>
                        )}
                        {review.url && (
                          <Link
                            href={review.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] font-medium text-white/38 hover:text-[#ff8a78] transition-colors"
                          >
                            Original →
                          </Link>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Write Review Modal ── */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {writeModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{
                  background: "rgba(8, 10, 22, 0.90)",
                  backdropFilter: "blur(20px)",
                }}
                onClick={() => setWriteModalOpen(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 14 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-w-lg rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.09]"
                  style={{
                    boxShadow:
                      "0 32px 72px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)",
                  }}
                >
                  {/* Header — quote glyph + title + close */}
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
                        <h2 className="text-sm font-bold text-white leading-none">
                          Write a Review
                        </h2>
                        <p className="text-[11px] text-white/30 mt-1">
                          {info.title}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setWriteModalOpen(false)}
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
                          <h3 className="text-sm font-bold text-white mb-1">
                            Sign in to continue
                          </h3>
                          <p className="text-xs text-white/35">
                            You need to be logged in to leave a review.
                          </p>
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
                          <h3 className="text-xs font-bold text-red-400 mb-1">
                            Review Privileges Suspended
                          </h3>
                          <p className="text-[11px] text-white/35 mb-3">
                            Temporarily restricted due to policy violations.
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-white/35">
                            <svg
                              className="w-3 h-3 text-red-400"
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
                            <span className="text-red-400 font-semibold">
                              {banStatus?.timeRemaining || "Unknown"}
                            </span>
                          </div>
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
          document.body,
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
      toast(
        err instanceof Error ? err.message : "Failed to submit review.",
        "error",
        4000,
        "Error",
        null,
      );
    } finally {
      setSubmitting(false);
    }
  }

  const displayRating = hoveredStar !== null ? hoveredStar : rating;
  const normalizedDisplay = displayRating !== null ? displayRating / 2 : null;
  const ratingColor =
    normalizedDisplay === null
      ? null
      : normalizedDisplay >= 4
        ? "#4ade80"
        : normalizedDisplay >= 2.5
          ? "#facc15"
          : "#f87171";
  const author = user?.username ?? user?.name ?? "User";

  return (
    <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
      {/* Compose card — hero */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
        {/* Top: quote glyph + live rating pill */}
        <div className="flex items-center justify-between px-4 pt-4 pb-0">
          <svg
            className="w-6 h-6 opacity-[0.08]"
            viewBox="0 0 32 32"
            fill="white"
            aria-hidden
          >
            <path d="M10 8C5.6 8 2 11.6 2 16v8h8v-8H4c0-3.3 2.7-6 6-6V8zm12 0c-4.4 0-8 3.6-8 8v8h8v-8h-6c0-3.3 2.7-6 6-6V8z" />
          </svg>

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
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill={ratingColor!}
                  aria-hidden
                >
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
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                —
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Textarea — hero */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What did you think? Share what you loved, hated, or found surprising…"
          rows={5}
          className="w-full bg-transparent px-4 py-3 text-[13px] text-white/75 placeholder-white/20 resize-none outline-none leading-[1.75]"
        />

        {/* Author attribution footer */}
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
              <p className="text-xs font-semibold text-white/75 leading-none">
                {author}
              </p>
              <p className="text-[10px] text-white/25 mt-0.5">Posting as you</p>
            </div>
          </div>
          <span
            className={`text-[10px] font-semibold ${content.length < 10 ? "text-white/20" : "text-[#4ade80]"}`}
          >
            {content.length < 10 ? `${10 - content.length} more` : "✓ Ready"}
          </span>
        </div>
      </div>

      {/* Rating row */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] text-white/35 font-medium">
          Your rating
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

      {/* Mood grid */}
      <div>
        <p className="text-[11px] text-white/35 font-medium px-1 mb-2">
          How did it make you feel?
        </p>
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
              <span
                className={`text-[9px] font-medium leading-none text-center ${mood === m.value ? "text-white/80" : "text-white/30"}`}
              >
                {m.label}
              </span>
              {mood === m.value && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#e94f37] rounded-full flex items-center justify-center">
                  <svg
                    className="w-1.5 h-1.5 text-white"
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

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-red-500/20"
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
            <span className="text-xs text-red-300">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
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

function AvatarBlock({
  review,
  href,
  size = 44,
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
      className="rounded-full overflow-hidden bg-white/[0.08] border border-white/[0.10] flex items-center justify-center flex-shrink-0 transition-colors group-hover:border-[#e94f37]/50"
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
        <span
          className="text-white/50 font-semibold"
          style={{ fontSize: size < 36 ? "10px" : "13px" }}
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

function ReplyAvatarBlock({
  reply,
  href,
  size = 26,
}: {
  reply: Reply;
  href?: string;
  size?: number;
}) {
  const avatarSrc = (() => {
    const av = reply.user?.avatar_path;
    if (!av) return null;
    if (av.startsWith("data:")) return av;
    if (av.startsWith("https://") || av.startsWith("http://")) return av;
    if (av.startsWith("/https") || av.startsWith("/http")) return av.slice(1);
    return `https://image.tmdb.org/t/p/w185${av}`;
  })();
  const initial = (reply.user.username || "A").charAt(0).toUpperCase();
  const avatar = (
    <div
      style={{ width: size, height: size, minWidth: size }}
      className="rounded-full overflow-hidden bg-white/[0.08] border border-white/[0.10] flex items-center justify-center flex-shrink-0 transition-colors group-hover:border-[#e94f37]/50"
    >
      {avatarSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarSrc}
          alt={reply.user.username}
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          className="object-cover w-full h-full"
        />
      ) : (
        <span className="text-white/58 font-semibold text-[10px]">
          {initial}
        </span>
      )}
    </div>
  );
  if (!href) return avatar;
  return (
    <Link
      href={href}
      aria-label={`View ${reply.user.username}'s profile`}
      className="group rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e94f37]"
    >
      {avatar}
    </Link>
  );
}
