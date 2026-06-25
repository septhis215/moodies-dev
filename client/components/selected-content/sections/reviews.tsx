"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle2,
  PenSquare,
  Star,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/context/AuthProvider";
import { useReviewBanStatus } from "@/hooks/useReviewBanStatus";
import { useToast } from "@/app/context/ToastContext";
import { useRouter } from "next/navigation";

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

function isPublicImagePath(value?: string): boolean {
  return Boolean(
    value && /^\/images\/.+\.(png|jpe?g|webp|gif|svg)$/i.test(value),
  );
}

function moodLabelFromValue(value: string): string {
  if (!isPublicImagePath(value)) return "Mood";

  const fileName = value.split("/").pop() ?? "";
  const baseName = fileName.replace(/\.(png|jpe?g|webp|gif|svg)$/i, "");

  return baseName
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function ReviewMoodPanel({ value }: { value?: string }) {
  if (!value) return null;

  const label = moodLabelFromValue(value);
  const isImage = isPublicImagePath(value);

  return (
    <div className="flex min-w-0 items-center gap-2 text-white/35">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
        {isImage ? (
          <Image
            src={value}
            alt={label}
            width={36}
            height={36}
            className="h-8 w-8 object-contain opacity-90"
          />
        ) : (
          <span className="text-lg leading-none">{value}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">
          Mood
        </p>
        <p className="truncate text-xs font-semibold text-white/55">
          {label}
        </p>
      </div>
    </div>
  );
}

const PREVIEW_LEN = 220;

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

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
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(
    new Set(),
  );

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
      if (s.has(id)) {
        s.delete(id);
      } else {
        s.add(id);
      }
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
    return () => {
      document.body.style.overflow = "";
    };
  }, [reviewModalOpen]);

  const openModal = () => {
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
              className="min-h-10 bg-white/[0.04] text-white/70 rounded-xl px-3 py-1.5 text-xs border border-white/[0.09] outline-none cursor-pointer md:hidden"
            >
              <option value="latest">Latest</option>
              <option value="highest">Highest</option>
              <option value="popularity">Popularity</option>
            </select>

            <button
              onClick={openModal}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#e94f37]/40 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-[#e94f37] transition-all duration-150 hover:border-[#e94f37]/70 hover:bg-[#e94f37]/[0.10] active:scale-95 cursor-pointer"
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
                  <p className="text-sm font-semibold text-white/50">
                    No reviews yet
                  </p>
                  <p className="text-xs text-white/25 mt-0.5">
                    Be the first to share your thoughts
                  </p>
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
                    className="group flex flex-col rounded-2xl border border-white/[0.08] bg-[#0d0d0f] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition-all duration-200 hover:border-[#e94f37]/30 hover:bg-[#111113]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <AvatarBlock review={r} href={profileHref} size={36} />
                        <div className="min-w-0">
                          {profileHref ? (
                            <Link
                              href={profileHref}
                              className="block truncate text-sm font-bold text-white/85 transition-colors hover:text-[#ff8a78]"
                            >
                              {r.author}
                            </Link>
                          ) : (
                            <p className="truncate text-sm font-bold text-white/85">
                              {r.author}
                            </p>
                          )}
                          <p className="mt-0.5 text-[11px] font-medium text-white/30">
                            {new Date(r.created_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {normalizedRating !== null && (
                          <div
                            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
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
                        )}
                      </div>
                    </div>

                    {/* Review text — the hero */}
                    <div className="mt-4">
                      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.035] text-white/15">
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 32 32"
                          fill="currentColor"
                          aria-hidden
                        >
                          <path d="M10 8C5.6 8 2 11.6 2 16v8h8v-8H4c0-3.3 2.7-6 6-6V8zm12 0c-4.4 0-8 3.6-8 8v8h8v-8h-6c0-3.3 2.7-6 6-6V8z" />
                        </svg>
                      </div>
                      <p className="text-[14px] leading-[1.75] text-white/72 break-words">
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
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
                      <ReviewMoodPanel value={r.moodEmojis?.[0]} />

                      <Link
                        href={
                          contentId
                            ? `/${basePath}/${contentId}/reviews?highlight=${encodeURIComponent(r.id)}`
                            : r.url || "#"
                        }
                        className="inline-flex shrink-0 text-[11px] font-bold text-white/28 transition-colors hover:text-[#e94f37]"
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusTimer = window.setTimeout(
      () => closeButtonRef.current?.focus(),
      80,
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-5"
      onClick={onClose}
    >
      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, scale: 0.98, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 24 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-dialog-title"
        aria-describedby="review-dialog-description"
        className="relative flex max-h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0a0a0b]/96 shadow-2xl shadow-black/70 sm:max-h-[min(90dvh,780px)] sm:rounded-2xl"
        style={{
          boxShadow:
            "0 32px 90px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(233,79,55,0.18),transparent_34%),radial-gradient(circle_at_90%_12%,rgba(255,255,255,0.06),transparent_28%)]" />
        {/* Header — matches card top: quote glyph + title + close */}
        <div className="relative z-20 flex shrink-0 items-center justify-between border-b border-white/[0.08] bg-black/35 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e94f37]/25 bg-[#e94f37]/10 text-[#ff8c79]">
              <PenSquare className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2
                id="review-dialog-title"
                className="text-base font-black leading-tight text-white sm:text-lg"
              >
                Share your viewing mood
              </h2>
              <p
                id="review-dialog-description"
                className="mt-0.5 text-xs text-white/45"
              >
                Rate it, name the feeling, and tell the community why.
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close review dialog"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/55 transition hover:border-white/20 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e94f37]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain mobile-native-scroll scrollbar-none">
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

type ReviewMood = {
  label: string;
  value: string;
  imagePath: string;
  mascot: string;
  accent: string;
};

const REVIEW_MOODS: ReviewMood[] = [
  { imagePath: "/images/review-icons/amazing.png", label: "Amazing", value: "amazing", mascot: "epic", accent: "#4ade80" },
  { imagePath: "/images/review-icons/loved-it.png", label: "Loved it", value: "loved", mascot: "romantic", accent: "#fb7185" },
  { imagePath: "/images/review-icons/enjoyed-it.png", label: "Enjoyed", value: "enjoyed", mascot: "happy", accent: "#facc15" },
  { imagePath: "/images/review-icons/its-okay.png", label: "Thoughtful", value: "okay", mascot: "mind-bending", accent: "#38bdf8" },
  { imagePath: "/images/review-icons/meh.png", label: "Mixed", value: "meh", mascot: "bittersweet", accent: "#f59e0b" },
  { imagePath: "/images/review-icons/skip-it.png", label: "Disappointed", value: "disliked", mascot: "sad", accent: "#f87171" },
];

const RATING_GUIDANCE = [
  { min: 9, mascot: "epic", accent: "#4ade80", label: "A standout watch", helper: "What made it memorable enough to recommend?" },
  { min: 7, mascot: "happy", accent: "#a3e635", label: "A good time", helper: "Share what worked best and who would enjoy it." },
  { min: 5, mascot: "mind-bending", accent: "#facc15", label: "A mixed experience", helper: "What worked, and what held it back?" },
  { min: 3, mascot: "bittersweet", accent: "#fb923c", label: "More misses than hits", helper: "Be specific about pacing, story, or performances." },
  { min: 0, mascot: "sad", accent: "#f87171", label: "Not for you", helper: "Help others understand what did not connect." },
];

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
  const [submitState, setSubmitState] = useState<
    "idle" | "submitting" | "success"
  >("idle");
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const completionTimerRef = useRef<number | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const moodToImagePath: Record<string, string> = {
    amazing: "/images/review-icons/amazing.png",
    loved: "/images/review-icons/loved-it.png",
    enjoyed: "/images/review-icons/enjoyed-it.png",
    okay: "/images/review-icons/its-okay.png",
    meh: "/images/review-icons/meh.png",
    disliked: "/images/review-icons/skip-it.png",
  };

  useEffect(
    () => () => {
      if (completionTimerRef.current) {
        window.clearTimeout(completionTimerRef.current);
      }
    },
    [],
  );

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!contentId) {
      setError("Content ID is missing.");
      return;
    }
    if (!mood) {
      setError("Choose the mood that best matches your experience.");
      return;
    }
    if (rating === null) {
      setError("Add a rating before sharing your review.");
      return;
    }
    if (!content.trim() || content.trim().length < 10) {
      setError("Write at least 10 characters so the community has some context.");
      return;
    }
    setSubmitState("submitting");
    try {
      const res = await fetch(`${API}/reviews`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating,
          content: content.trim(),
          moodEmojis: mood ? [moodToImagePath[mood]] : [],
          tmdbId: parseInt(contentId),
          mediaType: (contentType?.toUpperCase() || "MOVIE") as "MOVIE" | "TV",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed");
      }
      setSubmitState("success");
      completionTimerRef.current = window.setTimeout(() => {
        router.refresh();
        onSuccess?.();
      }, 900);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit review.";
      setError(message);
      setSubmitState("idle");
      toast(
        message,
        "error",
        4000,
        "Review not submitted",
        null,
      );
    }
  }

  const displayRating = hoveredStar !== null ? hoveredStar : rating;
  const normalizedDisplay =
    displayRating !== null ? displayRating / 2 : null;
  const ratingGuidance =
    RATING_GUIDANCE.find((item) => (displayRating ?? 0) >= item.min) ??
    RATING_GUIDANCE[RATING_GUIDANCE.length - 1];
  const ratingColor =
    normalizedDisplay !== null ? ratingGuidance.accent : null;
  const moodOptions = REVIEW_MOODS;
  const submitting = submitState === "submitting";
  const isReady =
    Boolean(mood) && rating !== null && content.trim().length >= 10;
  const author = user?.username ?? user?.name ?? "User";

  if (submitState === "success") {
    return (
      <div
        className="flex min-h-[420px] flex-col items-center justify-center px-6 py-10 text-center sm:min-h-[480px]"
        role="status"
        aria-live="polite"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.75, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative h-28 w-28"
        >
          <Image
            src="/images/moods/happy.png"
            alt="Happy Moodies mascot"
            fill
            sizes="112px"
            className="object-contain"
          />
        </motion.div>
        <span className="mt-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/25">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <h3 className="mt-4 text-2xl font-black text-white">
          Your mood is in
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-white/55">
          Thanks for helping the Moodies community decide what to watch next.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-5 px-4 py-4 sm:px-6 sm:py-5">
      {/* ── Compose card — the hero ── */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
        {/* Top: quote glyph + rating score pill — mirrors review card */}
        <div className="flex items-center justify-between px-4 pt-4 pb-0">
          <svg
            className="w-6 h-6 opacity-[0.08]"
            viewBox="0 0 32 32"
            fill="white"
            aria-hidden
          >
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

      {/* ── Rating row ── */}
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

      {/* ── Mood grid ── */}
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
              <img
                src={m.imagePath}
                alt={m.label}
                width={24}
                height={24}
                className="object-contain"
              />
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

      {/* ── Error ── */}
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

      {/* ── Footer: notice + submit ── */}
      <div className="flex items-center justify-between pt-1 pb-1">
        <p className="text-[10px] text-white/20">May be featured publicly.</p>
        <button
          type="submit"
          disabled={submitting || !isReady}
          className="px-5 py-2 rounded-xl bg-white/[0.04] border border-[#e94f37]/40 text-[#e94f37] text-xs font-semibold hover:bg-[#e94f37]/[0.10] hover:border-[#e94f37]/70 active:scale-95 transition-all disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
        >
          {submitting ? "Submitting…" : "Submit Review"}
        </button>
      </div>
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
