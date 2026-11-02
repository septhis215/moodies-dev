"use client";

import { tmdbImage } from "@/lib/tmdb";
import { BadgeMascot } from "@/components/ui/BadgeMascot";
import React, { useMemo, useState } from "react";
import { ReviewComposer } from '../ReviewComposer';
import { ReviewPreviewCard } from '../ReviewPreviewCard';
import Link from "next/link";
import {
  ArrowDownWideNarrow,
  Eye,
  PenSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/context/AuthProvider";
import { useToast } from "@/app/context/ToastContext";
import { SnapshotShareModal } from "@/components/snapshot/SnapshotShareModal";
import type { SnapshotSource } from "@/lib/snapshot/snapshot-types";

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

interface ReviewsSectionProps {
  reviews: Review[] | { results?: Review[] } | undefined;
  contentId?: string;
  contentType?: "movie" | "tv";
  title?: string;
  posterPath?: string;
}

export default function ReviewsSection({
  reviews,
  contentId,
  contentType,
  title,
  posterPath,
}: ReviewsSectionProps) {
  const { isAuthenticated, user } = useAuth();
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
  const [snapshotSource, setSnapshotSource] = useState<SnapshotSource | null>(null);

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
      <section
        className="ui-shell scroll-mt-24 py-8 sm:py-10"
        aria-labelledby="reviews-heading"
      >
        {/* ── Header ── */}
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h2
              id="reviews-heading"
              className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
            >
              Audience Reviews
            </h2>
            {sorted.length > 0 ? (
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                {sorted.length} review{sorted.length !== 1 ? "s" : ""} from the community
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sorted.length > 0 ? (
              <>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    aria-label="Sort reviews"
                    className="ui-secondary-action h-11 cursor-pointer appearance-none pr-10 leading-none [&>option]:bg-[var(--surface-1)] [&>option]:text-[var(--ink)]"
                  >
                    <option value="latest">Latest</option>
                    <option value="highest">Highest</option>
                    <option value="popularity">Popular</option>
                  </select>
                  <ArrowDownWideNarrow className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" aria-hidden="true" />
                </div>
                <button type="button" onClick={openModal} className="ui-primary-action leading-none" aria-label="Write a review">
                  Write
                  <PenSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              </>
            ) : null}

            <Link
              href={viewAllHref}
              className="ui-secondary-action leading-none"
              aria-label="View all reviews"
            >
              Reviews
              <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* ── Cards ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {topThree.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full flex flex-col items-center justify-center gap-4 border-y border-[var(--surface-border)] py-16"
              >
                <BadgeMascot name="conversation-starter" className="h-24 w-24" sizes="96px" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    No reviews yet
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                    Be the first to share your thoughts
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openModal}
                  className="ui-secondary-action leading-none"
                  aria-label="Write a review"
                >
                  Write
                  <PenSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              </motion.div>
            ) : (
              topThree.map((r) => {
                const profileHref = r.userId
                  ? `/profile/${encodeURIComponent(r.userId)}`
                  : undefined;
                const normalizedRating =
                  r.author_details?.rating != null
                    ? r.author_details.rating / 2
                    : null;
                const canShareReviewSnapshot = Boolean(
                  user?.id && r.userId === user.id,
                );

                return (
                  <motion.div key={r.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="min-w-0">
                    <ReviewPreviewCard author={r.author} authorHref={profileHref} date={r.created_at}
                      avatar={<AvatarBlock review={r} href={profileHref} size={36} />}
                      rating={normalizedRating} content={r.content} mood={r.moodEmojis?.[0]}
                      href={contentId ? `/${basePath}/${contentId}/reviews?highlight=${encodeURIComponent(r.id)}` : r.url || '#'}
                      onShare={canShareReviewSnapshot ? () => setSnapshotSource({ type: 'review', reviewId: r.id }) : undefined} />
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </section>

      <ReviewComposer open={reviewModalOpen} contentId={contentId} contentType={contentType} title={title} posterPath={posterPath} onClose={() => setReviewModalOpen(false)} />

      <SnapshotShareModal
        open={Boolean(snapshotSource)}
        onClose={() => setSnapshotSource(null)}
        source={snapshotSource}
      />
    </>
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
