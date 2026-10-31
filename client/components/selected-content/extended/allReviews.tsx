"use client";
import { sessionFetch } from "@/lib/auth/session";

import { tmdbImage } from "@/lib/tmdb";
import React, { useMemo, useState, useEffect } from "react";
import { ReviewComposer } from '../ReviewComposer';
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import { ArrowLeft, ArrowDownWideNarrow, ChevronDown, ChevronUp, Eye, Film, MessageCircle, Reply as ReplyIcon, Send, Star, Search, PenSquare, Share2, ThumbsUp, X } from "lucide-react";
import { BadgeMascot } from "@/components/ui/BadgeMascot";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/context/AuthProvider";
import { useReviewBanStatus } from "@/hooks/useReviewBanStatus";
import { useToast } from "@/app/context/ToastContext";
import { SnapshotShareModal } from "@/components/snapshot/SnapshotShareModal";
import type { SnapshotSource } from "@/lib/snapshot/snapshot-types";

type ReactionType = "LIKE" | "LOVE" | "HAHA" | "WOW" | "SAD" | "ANGRY";
type ReactionCount = { type: ReactionType; count: number };

const REACTIONS: Array<{ type: ReactionType; emoji: string; label: string }> = [
  { type: "LIKE", emoji: "👍", label: "Like" },
  { type: "LOVE", emoji: "❤️", label: "Love" },
  { type: "HAHA", emoji: "😂", label: "Haha" },
  { type: "WOW", emoji: "😮", label: "Wow" },
  { type: "SAD", emoji: "😢", label: "Sad" },
  { type: "ANGRY", emoji: "😡", label: "Angry" },
];

// Thread utilities stay visually quiet; touch devices retain a generous hit area.
const THREAD_ACTION_CLASS = "ui-secondary-action min-h-8 gap-1.5 rounded-lg border-transparent bg-transparent px-2.5 text-sm font-semibold leading-none text-[var(--ink-muted)] hover:border-[var(--surface-border)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] pointer-coarse:min-h-11";

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

function MoodChip({ value }: { value?: string }) {
  if (!value) return null;

  const label = moodLabelFromValue(value);

  return (
    <span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface-2)] py-1 pl-1 pr-2.5 text-[var(--ink-muted)]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] ring-1 ring-[var(--surface-border)]">
        {isPublicImagePath(value) ? (
          <Image
            src={value}
            alt=""
            width={36}
            height={36}
            className="h-8 w-8 object-contain opacity-95"
          />
        ) : (
          <span className="text-lg leading-none">{value}</span>
        )}
      </span>
      <span className="min-w-0 max-w-24 truncate text-xs font-semibold leading-none text-[var(--ink-muted)]">
        {label}
      </span>
    </span>
  );
}

function ReactionBar({
  counts = [],
  myReaction,
  onReact,
  disabled = false,
  pickerPlacement = "left",
}: {
  counts?: ReactionCount[];
  myReaction?: ReactionType | null;
  onReact: (type: ReactionType) => void;
  disabled?: boolean;
  pickerPlacement?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const selected = REACTIONS.find((reaction) => reaction.type === myReaction);
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  const topCounts = counts
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const pickerPlacementClass =
    pickerPlacement === "right" ? "left-0 origin-bottom-left" : "right-0 origin-bottom-right";

  return (
    <div
      className="relative inline-flex items-center gap-1.5"
      onMouseEnter={() => !disabled && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label="React to this review or reply"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((value) => !value)}
        className={`${THREAD_ACTION_CLASS} disabled:cursor-not-allowed disabled:opacity-45`}
      >
        <span>{selected?.label ?? "React"}</span>
        {selected ? <span aria-hidden="true">{selected.emoji}</span> : <ThumbsUp className="h-4 w-4" aria-hidden="true" />}
      </button>

      {total > 0 && (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ink-muted)]">
          <span className="flex -space-x-1">
            {topCounts.map((item) => {
              const reaction = REACTIONS.find((r) => r.type === item.type);
              return (
                <span
                  key={item.type}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-xs ring-1 ring-[var(--surface-border)]"
                  title={`${reaction?.label ?? item.type}: ${item.count}`}
                >
                  {reaction?.emoji}
                </span>
              );
            })}
          </span>
          {total}
        </span>
      )}

      <AnimatePresence>
        {open && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className={`absolute bottom-full z-40 grid grid-cols-3 gap-0.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)] p-1 shadow-xl shadow-black/30 sm:flex ${pickerPlacementClass}`}
          >
            {REACTIONS.map((reaction) => (
              <button
                key={reaction.type}
                type="button"
                title={reaction.label}
                aria-label={reaction.label}
                aria-pressed={myReaction === reaction.type}
                onClick={() => {
                  onReact(reaction.type);
                  setOpen(false);
                }}
                className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg transition hover:bg-[var(--brand-coral)]/10 focus-visible:outline-2 focus-visible:outline-[var(--brand-coral)] ${
                  myReaction === reaction.type ? "bg-[var(--brand-coral)]/15" : ""
                }`}
              >
                {reaction.emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type Reply = {
  id?: string;
  content: string;
  created_at: string;
  user: { id?: string; username: string; avatar_path?: string | null };
  reactionCounts?: ReactionCount[];
  myReaction?: ReactionType | null;
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
  reactionCounts?: ReactionCount[];
  myReaction?: ReactionType | null;
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
  number_of_seasons?: number;
  number_of_episodes?: number;
};

interface AllReviewsProps {
  reviews: Review[];
  info: Info;
  id?: string;
  topMoods?: Array<{ emoji: string; count: number }>;
  reviewStats?: { totalRatings: number; averageRating: number };
}

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://dev.api.moodies.tech/api";

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
  const [snapshotSource, setSnapshotSource] = useState<SnapshotSource | null>(null);

  useEffect(() => {
    setLocalReviews(reviews);
  }, [reviews]);

  const basePath = info.content_type === "movie" ? "movies" : "tv";
  const titleHref = `/${basePath}/${id ?? info.id}`;
  const leadingMood = [...topMoods].sort((a, b) => b.count - a.count)[0];
  const openWriteModal = () => {
    if (!isAuthenticated) {
      toast("Sign in to write a review.", "warning", 3000, "Not Logged In", null);
      return;
    }
    setWriteModalOpen(true);
  };

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
      const submittedContent = (
        (showReplyForm?.prefill ?? "") + replyContent
      ).trim();
      const res = await sessionFetch(`${API}/reviews/${reviewId}/replies`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: submittedContent }),
      });
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

  const handleReviewReaction = async (
    reviewId: string,
    currentReaction: ReactionType | null | undefined,
    nextReaction: ReactionType,
  ) => {
    if (!isAuthenticated) {
      toast("Sign in to react to reviews.", "warning", 3000, "Not Logged In", null);
      return;
    }

    const removing = currentReaction === nextReaction;
    try {
      const res = await sessionFetch(`${API}/reviews/${reviewId}/reactions`, {
        method: removing ? "DELETE" : "POST",
        credentials: "include",
        headers: removing ? undefined : { "Content-Type": "application/json" },
        body: removing ? undefined : JSON.stringify({ type: nextReaction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");

      setLocalReviews((prev) =>
        prev.map((review) =>
          review.id === reviewId
            ? {
                ...review,
                reactionCounts: data.reactionCounts || [],
                myReaction: data.myReaction || null,
              }
            : review,
        ),
      );
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Failed to update reaction.",
        "error",
        3000,
        "Error",
        null,
      );
    }
  };

  const handleReplyReaction = async (
    reviewId: string,
    replyId: string | undefined,
    currentReaction: ReactionType | null | undefined,
    nextReaction: ReactionType,
  ) => {
    if (!replyId) return;
    if (!isAuthenticated) {
      toast("Sign in to react to replies.", "warning", 3000, "Not Logged In", null);
      return;
    }

    const removing = currentReaction === nextReaction;
    try {
      const res = await sessionFetch(`${API}/reviews/replies/${replyId}/reactions`, {
        method: removing ? "DELETE" : "POST",
        credentials: "include",
        headers: removing ? undefined : { "Content-Type": "application/json" },
        body: removing ? undefined : JSON.stringify({ type: nextReaction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");

      setLocalReviews((prev) =>
        prev.map((review) =>
          review.id !== reviewId
            ? review
            : {
                ...review,
                replies: (review.replies || []).map((reply) =>
                  reply.id === replyId
                    ? {
                        ...reply,
                        reactionCounts: data.reactionCounts || [],
                        myReaction: data.myReaction || null,
                      }
                    : reply,
                ),
              },
        ),
      );
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Failed to update reaction.",
        "error",
        3000,
        "Error",
        null,
      );
    }
  };

  return (
    <div className="min-h-screen bg-[var(--surface-0)] pb-8 text-[var(--ink)]">
      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={
              info.backdrop_path
                ? tmdbImage(info.backdrop_path, "w1280")
                : "/placeholder-backdrop.svg"
            }
            alt={info.title}
            fill
            sizes="100vw"
            style={{
              objectFit: "cover",
              filter: "brightness(0.45) saturate(0.7)",
            }}
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-0)] via-[var(--surface-0)]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--surface-0)]/70 via-transparent to-transparent" />
        </div>

        <div className="ui-shell relative z-10 pb-8 pt-[calc(2rem+var(--mobile-nav-safe))] sm:pb-10 lg:pt-28">
          <nav aria-label="Title navigation" className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:mb-8">
            <Link href={titleHref} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--brand-coral-strong)]" aria-label={`Back to ${info.title}`}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="max-w-48 truncate">{info.title}</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link href={titleHref} className="ui-secondary-action leading-none">Details <Film className="h-4 w-4" aria-hidden="true" /></Link>
              <span aria-current="page" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--brand-coral)]/30 bg-[var(--brand-coral)]/10 px-4 text-sm font-semibold text-[var(--brand-coral-strong)]">Reviews <MessageCircle className="h-4 w-4" aria-hidden="true" /></span>
            </div>
          </nav>

          <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-x-5 gap-y-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-8 lg:grid-cols-[12rem_minmax(0,1fr)_19rem] lg:gap-x-10">
            <Link
              href={titleHref}
              aria-label={`View ${info.title} details`}
              className="group relative block aspect-[2/3] self-start overflow-hidden rounded-xl border border-[var(--surface-border)] shadow-xl shadow-black/30 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral)]"
            >
              <Image
                src={
                  info.poster_path
                    ? tmdbImage(info.poster_path, "w500")
                    : "/placeholder-poster.svg"
                }
                alt={info.title}
                fill
                sizes="(min-width: 1024px) 192px, (min-width: 640px) 160px, 80px"
                className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
              />
            </Link>

            <div className="contents sm:block sm:min-w-0">
              <div className="min-w-0">
                <p className="ui-kicker">Audience reviews</p>
                <h1 className="mt-3 max-w-3xl break-words text-balance text-[2.1rem] font-bold leading-[0.98] tracking-normal text-white min-[390px]:text-[2.45rem] sm:text-[clamp(2.45rem,4.6vw,4rem)] sm:leading-[0.96] xl:text-[clamp(2.45rem,4.2vw,4.8rem)]">
                  {info.title}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
                  <span>{info.content_type === "tv" ? "Series" : "Film"}</span>
                  {info.release_date && <span>{info.release_date.slice(0, 4)}</span>}
                  {info.content_type === "tv" && (info.number_of_seasons ?? 0) > 0 && (
                    <span>
                      {info.number_of_seasons} season
                      {info.number_of_seasons !== 1 ? "s" : ""}
                    </span>
                  )}
                  {info.content_type === "tv" && (info.number_of_episodes ?? 0) > 0 && (
                    <span>{info.number_of_episodes} episode{info.number_of_episodes === 1 ? "" : "s"}</span>
                  )}
                  {info.content_type === "movie" && info.runtime > 0 && <span>{info.runtime} min</span>}
                </div>
              </div>
              <div className="col-span-2 min-w-0 sm:mt-5">
                <p className="max-w-xl text-sm leading-6 text-white/80">Every watch feels different. See what stayed with the community.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {info.genres.slice(0, 3).map((g) => (
                    <span
                      key={g.id}
                      className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-1)]/80 px-3 py-1 text-xs font-semibold text-white/88"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <section aria-labelledby="audience-pulse-heading" className="col-span-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)]/90 p-5 backdrop-blur-sm lg:col-span-1 lg:col-start-3">
              <h2 id="audience-pulse-heading" className="text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl">Audience pulse</h2>
              {leadingMood && (
                <div className="mt-4 flex items-center gap-3">
                  {isPublicImagePath(leadingMood.emoji) ? (
                    <Image src={leadingMood.emoji} alt="" width={64} height={64} className="h-16 w-16 shrink-0 object-contain" />
                  ) : <span className="text-3xl" aria-hidden="true">{leadingMood.emoji}</span>}
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--ink-muted)]">Most shared mood</p>
                    <p className="break-words text-lg font-bold text-[var(--ink)]">{moodLabelFromValue(leadingMood.emoji)}</p>
                    <p className="text-xs text-[var(--ink-muted)]">{leadingMood.count.toLocaleString()} viewer{leadingMood.count === 1 ? "" : "s"}</p>
                  </div>
                </div>
              )}
              <dl className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <dt className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ink-muted)]"><MessageCircle className="h-4 w-4 text-[var(--brand-coral)]" aria-hidden="true" />Moodies</dt>
                  <dd className="mt-2">
                    <span data-display className="text-3xl font-bold leading-none text-[var(--brand-coral-strong)]">{reviewStats && reviewStats.totalRatings > 0 ? reviewStats.averageRating.toFixed(1) : "—"}</span>
                    {reviewStats && reviewStats.totalRatings > 0 && <span className="ml-1 text-xs text-[var(--ink-muted)]">/ 10</span>}
                    <span className="mt-1 block text-xs text-[var(--ink-muted)]">{reviewStats && reviewStats.totalRatings > 0 ? `${reviewStats.totalRatings.toLocaleString()} rating${reviewStats.totalRatings === 1 ? "" : "s"}` : "Not rated yet"}</span>
                  </dd>
                </div>
                <div className="border-l border-[var(--surface-border)] pl-4">
                  <dt className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ink-muted)]"><Star className="h-4 w-4 text-[var(--brand-gold)]" aria-hidden="true" />TMDb</dt>
                  <dd className="mt-2">
                    <span data-display className="text-3xl font-bold leading-none text-[var(--brand-gold)]">{info.vote_count > 0 ? info.vote_average.toFixed(1) : "—"}</span>
                    {info.vote_count > 0 && <span className="ml-1 text-xs text-[var(--ink-muted)]">/ 10</span>}
                    <span className="mt-1 block text-xs text-[var(--ink-muted)]">{info.vote_count > 0 ? `${info.vote_count.toLocaleString()} vote${info.vote_count === 1 ? "" : "s"}` : "No votes yet"}</span>
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </div>

      {/* ── Controls bar ── */}
      <section className="ui-shell py-8 sm:py-10" aria-labelledby="all-reviews-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="all-reviews-heading" className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">Audience Reviews</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]" role="status">{filteredAndSorted.length} review{filteredAndSorted.length === 1 ? "" : "s"}{searchQuery && ` for “${searchQuery}”`}</p>
          </div>
          {localReviews.length > 0 ? <button type="button" onClick={openWriteModal} className="ui-primary-action leading-none" aria-label="Write a review">Write <PenSquare className="h-4 w-4" aria-hidden="true" /></button> : null}
        </div>
        <div className="ui-panel mb-5 flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]"
            />
            <input
              type="text"
              aria-label="Search reviews by author or content"
              placeholder="Search reviews…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-0)] py-2 pl-10 pr-10 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus-visible:border-[var(--brand-coral-strong)] focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)]/30"
            />
            {searchQuery ? <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search" className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-[var(--ink-muted)] hover:text-[var(--ink)]"><X className="h-4 w-4" aria-hidden="true" /></button> : null}
          </div>

          <div className="relative shrink-0">
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} aria-label="Sort reviews" className="ui-secondary-action h-11 w-full appearance-none pr-10 leading-none [&>option]:bg-[var(--surface-1)]">
              <option value="latest">Latest</option><option value="highest">Highest</option><option value="popularity">Popular</option>
            </select>
            <ArrowDownWideNarrow className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* ── Reviews list ── */}
      <div className="ui-shell pb-8 sm:pb-10">
        <div className="space-y-5">
          <AnimatePresence mode="popLayout">
            {filteredAndSorted.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="ui-panel flex flex-col items-center justify-center gap-4 rounded-xl px-6 py-16 text-center"
              >
                <BadgeMascot name="conversation-starter" className="h-24 w-24" sizes="96px" />
                <p className="text-sm font-bold text-[var(--ink)]">
                  {searchQuery
                    ? "No reviews match your search."
                    : "No reviews yet."}
                </p>
                <p className="max-w-sm text-sm leading-6 text-[var(--ink-muted)]">{searchQuery ? "Try another name or phrase." : "Be the first to share how this made you feel."}</p>
                <button type="button" aria-label={searchQuery ? "Clear search" : "Write a review"} onClick={searchQuery ? () => setSearchQuery("") : openWriteModal} className="ui-secondary-action leading-none">
                  {searchQuery ? "Clear" : "Write"}{searchQuery ? <X className="h-4 w-4" aria-hidden="true" /> : <PenSquare className="h-4 w-4" aria-hidden="true" />}
                </button>
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
                const canShareReviewSnapshot = Boolean(
                  user?.id && review.userId === user.id,
                );

                return (
                  <motion.div
                    key={review.id}
                    id={`review-${review.id}`}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="ui-panel group scroll-mt-28 rounded-xl transition-colors duration-200 hover:border-[var(--brand-coral)]/40"
                  >
                    <div className="flex flex-col gap-4 px-4 pt-4 sm:px-5 sm:pt-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
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
                                className="block truncate text-sm font-bold text-[var(--ink)] underline-offset-4 transition-colors hover:text-[var(--brand-coral-strong)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)]"
                              >
                                {review.author}
                              </Link>
                            ) : (
                              <p className="truncate text-sm font-bold text-[var(--ink)]">
                                {review.author}
                              </p>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--ink-muted)]">
                              <span>{formatDate(review.created_at)}</span>
                              {review.author_details?.username && (
                                <span className="text-[var(--ink-muted)]">
                                  @{review.author_details.username}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-shrink-0 items-center gap-2">
                          <MoodChip value={review.moodEmojis?.[0]} />
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
                    <div className="px-4 pb-5 pt-4 sm:px-5">
                      <p className="whitespace-pre-wrap break-words text-base leading-7 text-[var(--ink)]">
                        {shouldTruncate && !isExpanded ? (
                          <>
                            {review.content.slice(0, 400)}
                            <span className="text-[var(--ink-muted)]">…</span>
                          </>
                        ) : (
                          review.content
                        )}
                      </p>
                      {shouldTruncate && (
                        <button
                          onClick={() => toggleExpanded(review.id)}
                          aria-expanded={isExpanded}
                          className={`${THREAD_ACTION_CLASS} mt-3`}
                        >
                          {isExpanded ? "Less" : "More"}
                          {isExpanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                        </button>
                      )}
                    </div>

                    {/* Replies */}
                    {review.replies && review.replies.length > 0 && (
                      <div className="mx-4 mb-4 rounded-xl border border-[var(--surface-border)] bg-black/20 p-3 sm:mx-5 sm:p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                            Replies
                          </p>
                          <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--ink-muted)]">
                            {review.replies.length}
                          </span>
                        </div>
                        <div className="relative space-y-2.5 pl-3 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-px before:bg-gradient-to-b before:from-[var(--brand-coral)]/45 before:via-white/12 before:to-transparent sm:pl-4">
                          {(repliesExpanded
                            ? review.replies
                            : review.replies.slice(0, 2)
                          ).map((reply, i) => {
                            const replyHref = profileHrefFor(reply.user.id);
                            return (
                              <div
                                key={reply.id ?? i}
                                className="relative rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)] px-3 py-3 transition-colors hover:border-[var(--surface-border)] hover:bg-[var(--surface-2)]"
                              >
                                <span className="absolute -left-3 top-5 h-px w-3 bg-[var(--surface-2)] sm:-left-4 sm:w-4" />
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
                                          className="truncate text-xs font-semibold text-[var(--ink)] underline-offset-4 transition-colors hover:text-[var(--brand-coral-strong)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)]"
                                        >
                                          {reply.user.username}
                                        </Link>
                                      ) : (
                                        <span className="truncate text-xs font-semibold text-[var(--ink-muted)]">
                                          {reply.user.username}
                                        </span>
                                      )}
                                      <span className="text-xs text-[var(--ink-muted)]">
                                        {formatDate(reply.created_at)}
                                      </span>
                                      <ReactionBar
                                        counts={reply.reactionCounts}
                                        myReaction={reply.myReaction}
                                        disabled={!isAuthenticated}
                                        pickerPlacement="right"
                                        onReact={(type) =>
                                          handleReplyReaction(
                                            review.id,
                                            reply.id,
                                            reply.myReaction,
                                            type,
                                          )
                                        }
                                      />
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
                                          className={`${THREAD_ACTION_CLASS} ml-auto`}
                                        >
                                          Reply <ReplyIcon className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                      )}
                                    </div>
                                    <p className="mt-2 break-words text-sm leading-6 text-[var(--ink)]">
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
                                                style={{ color: "var(--brand-coral-strong)" }}
                                              >
                                                {reply.content.slice(0, idx)}
                                              </span>
                                              <span className="text-[var(--ink-muted)]">
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
                                                style={{ color: "var(--brand-coral-strong)" }}
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
                            aria-expanded={repliesExpanded}
                            className={`${THREAD_ACTION_CLASS} mt-3`}
                          >
                            {repliesExpanded ? "Less" : "More"}
                            {repliesExpanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
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
                        className="mx-4 mb-4 space-y-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)] p-3 sm:mx-5"
                        >
                          {showReplyForm?.prefill && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/20 border border-[var(--surface-border)] rounded-xl">
                              <span
                                className="text-xs font-semibold"
                                style={{ color: "var(--brand-coral)" }}
                              >
                                {showReplyForm.prefill.trim()}
                              </span>
                              <span className="text-xs text-[var(--ink-muted)]">
                                replying to
                              </span>
                            </div>
                          )}
                          <textarea
                            aria-label="Your reply"
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder="Write your reply…"
                            rows={3}
                            autoFocus
                            className="w-full bg-black/20 border border-[var(--surface-border)] focus:border-[var(--brand-coral)]/45 rounded-xl px-3 py-2.5 text-sm text-[var(--ink-muted)] placeholder:text-[var(--ink-muted)] resize-none outline-none transition-colors"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => closeReplyForm()}
                              className="ui-secondary-action leading-none"
                            >
                              Cancel <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => handleReplySubmit(review.id)}
                              disabled={submittingReply}
                              className="ui-primary-action leading-none disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {submittingReply ? "Posting…" : "Post"} <Send className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Action footer */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-[var(--surface-border)] px-4 py-3 sm:px-5">
                      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-[var(--ink-muted)]">
                        <span>
                          {review.replies?.length ?? 0} repl
                          {(review.replies?.length ?? 0) === 1 ? "y" : "ies"}
                        </span>
                        {review.updated_at &&
                          review.updated_at !== review.created_at && (
                            <>
                              <span className="text-[var(--ink-muted)]">/</span>
                              <span>
                                Updated {formatDate(review.updated_at)}
                              </span>
                            </>
                          )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {canShareReviewSnapshot && (
                          <button
                            type="button"
                            onClick={() =>
                              setSnapshotSource({
                                type: "review",
                                reviewId: review.id,
                              })
                            }
                            aria-label="Share a review snapshot"
                            className={THREAD_ACTION_CLASS}
                          >
                            Share <Share2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                        <ReactionBar
                          counts={review.reactionCounts}
                          myReaction={review.myReaction}
                          disabled={!isAuthenticated}
                          pickerPlacement="left"
                          onReact={(type) =>
                            handleReviewReaction(
                              review.id,
                              review.myReaction,
                              type,
                            )
                          }
                        />
                        {banStatus.banned ? (
                          <span className="text-xs text-red-400/50">
                            Replies suspended
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              showReplyForm?.reviewId === review.id
                                ? closeReplyForm()
                                : openReplyForm(review.id)
                            }
                            aria-expanded={showReplyForm?.reviewId === review.id}
                            className={THREAD_ACTION_CLASS}
                          >
                            {showReplyForm?.reviewId === review.id
                              ? "Cancel"
                              : "Reply"}
                            {showReplyForm?.reviewId === review.id ? <X className="h-4 w-4" aria-hidden="true" /> : <ReplyIcon className="h-4 w-4" aria-hidden="true" />}
                          </button>
                        )}
                        {review.url && (
                          <Link
                            href={review.url}
                            target="_blank"
                            rel="noreferrer"
                            className={THREAD_ACTION_CLASS}
                          >
                            Original <Eye className="h-4 w-4" aria-hidden="true" />
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

      <ReviewComposer open={writeModalOpen} contentId={id} contentType={info.content_type === 'tv' ? 'tv' : 'movie'} title={info.title} posterPath={info.poster_path} onClose={() => setWriteModalOpen(false)} />

      <SnapshotShareModal
        open={Boolean(snapshotSource)}
        onClose={() => setSnapshotSource(null)}
        source={snapshotSource}
      />
    </div>
  );
}

/* ── Helpers ── */
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
    return tmdbImage(av, "w185");
  })();
  const initials = (review.author || "A")
    .split(" ")
    .map((s) => s[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
  const avatar = (
    <div
      style={{ width: size, height: size, minWidth: size }}
      className="rounded-full overflow-hidden bg-[var(--surface-2)] border border-[var(--surface-border)] flex items-center justify-center flex-shrink-0 transition-colors group-hover:border-[var(--brand-coral)]/50"
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
          className="text-[var(--ink-muted)] font-semibold"
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
      className="group rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)]"
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
    return tmdbImage(av, "w185");
  })();
  const initial = (reply.user.username || "A").charAt(0).toUpperCase();
  const avatar = (
    <div
      style={{ width: size, height: size, minWidth: size }}
      className="rounded-full overflow-hidden bg-[var(--surface-2)] border border-[var(--surface-border)] flex items-center justify-center flex-shrink-0 transition-colors group-hover:border-[var(--brand-coral)]/50"
    >
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt={reply.user.username}
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          className="object-cover w-full h-full"
        />
      ) : (
        <span className="text-[var(--ink-muted)] font-semibold text-xs">
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
      className="group rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)]"
    >
      {avatar}
    </Link>
  );
}
