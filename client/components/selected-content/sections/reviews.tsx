// components/selected-movie/reviewsSection.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Users2, Star } from "lucide-react";
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

interface ReviewsSectionProps {
  // accept either an array or TMDB-style object { results: Review[] }
  reviews: Review[] | { results?: Review[] } | undefined;
  movieId?: string; // optional id used to build the "view all" link
  contentType?: "movie" | "tv"; // default is movie; pass "tv" from your tv page
}

export default function ReviewsSection({
  reviews,
  movieId,
  contentType = "movie",
}: ReviewsSectionProps) {
  // Normalize incoming reviews to an array
  const reviewsArray: Review[] = Array.isArray(reviews)
    ? reviews
    : (reviews && (reviews as any).results) || [];

  const [localReviews, setLocalReviews] = useState<Review[]>(
    reviewsArray ? [...reviewsArray] : []
  );
  const [sortBy, setSortBy] = useState<"latest" | "highest" | "popularity">(
    "latest"
  );

  const [helpfulMap, setHelpfulMap] = useState<Record<string, number>>({});
  const [markedHelpful, setMarkedHelpful] = useState<Record<string, boolean>>(
    {}
  );

  useEffect(() => {
    const map: Record<string, number> = {};
    localReviews.forEach((r) => {
      map[r.id] = Math.max(0, Math.round(popularityProxy(r) / 2));
    });
    setHelpfulMap(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  function popularityProxy(r: Review) {
    const rating = r.author_details?.rating ?? 0;
    const lenScore = Math.min(5, (r.content?.length ?? 0) / 200);
    return rating + lenScore;
  }

  const sorted = useMemo(() => {
    const arr = [...localReviews];
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
  }, [localReviews, sortBy]);

  const topThree = sorted.slice(0, 3);

  function toggleHelpful(id: string) {
    setMarkedHelpful((prev) => {
      const currently = !!prev[id];
      const copy = { ...prev, [id]: !currently };
      setHelpfulMap((hm) => {
        const currentCount = hm[id] ?? 0;
        const next = {
          ...hm,
          [id]: currently ? Math.max(0, currentCount - 1) : currentCount + 1,
        };
        return next;
      });
      return copy;
    });
  }

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
    setHelpfulMap((h) => ({ ...h, [newReview.id]: 0 }));
    setMarkedHelpful((m) => ({ ...m, [newReview.id]: false }));
  }

  // build base path depending on contentType (movie or tv)
  const basePath = contentType === "tv" ? "tv" : "movies";
  const viewAllHref = movieId ? `/${basePath}/${movieId}/reviews` : "#";

  return (
    <section className="space-y-6">
      {/* Header + controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
            Audience Reviews
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Top community picks & latest opinions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs">
            <SortButton
              active={sortBy === "latest"}
              onClick={() => setSortBy("latest")}
            >
              Latest
            </SortButton>
            <SortButton
              active={sortBy === "highest"}
              onClick={() => setSortBy("highest")}
            >
              Highest
            </SortButton>
            <SortButton
              active={sortBy === "popularity"}
              onClick={() => setSortBy("popularity")}
            >
              Popularity
            </SortButton>
          </div>

          <div className="md:hidden">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-800/60 text-slate-200 rounded-lg px-3 py-2 text-sm border border-white/6"
            >
              <option value="latest">Latest</option>
              <option value="highest">Highest</option>
              <option value="popularity">Popularity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Top 3 grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {topThree.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-1 md:col-span-3 text-slate-400"
            >
              No reviews yet — be the first to share your thoughts.
            </motion.div>
          ) : (
            topThree.map((r, idx) => (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                whileHover={{ scale: 1.02 }}
                className={`relative rounded-2xl p-5 border border-white/8 bg-gradient-to-br from-slate-900/70 to-slate-800/70 shadow-lg`}
              >
                <div className="flex items-start gap-4">
                  <AvatarBlock review={r} />
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div>
                        <h3 className="text-slate-100 font-semibold">
                          {r.author}
                        </h3>
                        <div className="text-xs text-slate-400">
                          {new Date(r.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="ml-auto flex items-center gap-3">
                        <RatingDisplay rating={r.author_details?.rating} />
                        <div className="text-xs text-slate-400">
                          {(r.content?.length ?? 0) > 0
                            ? `${Math.min(
                                10,
                                Math.round(r.content.length / 25)
                              )} ch`
                            : ""}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap max-h-36 overflow-hidden">
                      <div className="relative">
                        <p className="line-clamp-6">{r.content}</p>
                        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t pointer-events-none" />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <button
                        onClick={() => toggleHelpful(r.id)}
                        className={`inline-flex items-center gap-2 text-sm px-3 py-1 rounded-full transition ${
                          markedHelpful[r.id]
                            ? "bg-indigo-600/80 text-white shadow-sm"
                            : "bg-white/5 text-slate-200 hover:bg-white/6"
                        }`}
                        aria-pressed={!!markedHelpful[r.id]}
                      >
                        <motion.span
                          whileTap={{ scale: 0.92 }}
                          className="flex items-center gap-2"
                        >
                          <svg
                            width={14}
                            height={14}
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden
                          >
                            <path d="M2 21h4V9H2v12zM22 10c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 2 7.59 7.59C7.22 7.95 7 8.45 7 9v9c0 1.1.9 2 2 2h7c.88 0 1.63-.58 1.86-1.41L22 12.5V10z" />
                          </svg>
                          <span className="text-xs">
                            {helpfulMap[r.id] ?? 0}
                          </span>
                        </motion.span>
                      </button>

                      {/* Link to the dedicated all-reviews page; include highlight param */}
                      {movieId ? (
                        <Link
                          href={`/${basePath}/${movieId}/reviews?highlight=${encodeURIComponent(
                            r.id
                          )}`}
                          className="text-xs text-indigo-400 hover:underline"
                        >
                          Read full review
                        </Link>
                      ) : (
                        <a
                          href={r.url || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-indigo-400 hover:underline"
                        >
                          Read full review
                        </a>
                      )}

                      <div className="ml-auto text-xs text-slate-400">
                        #{idx + 1} of {sorted.length}
                      </div>
                    </div>
                  </div>
                </div>

                <svg
                  className="absolute top-3 right-3 opacity-8 w-8 h-8 text-slate-700"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M7 7h4v6H5V9a2 2 0 0 1 2-2zM17 7h4v6h-6V9a2 2 0 0 1 2-2z"
                    fill="currentColor"
                  />
                </svg>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* 'View all' button that navigates to the dedicated page */}
      <div className="pt-4">
        {movieId ? (
          <Link href={viewAllHref} className="inline-block">
            <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium shadow">
              View all reviews
            </button>
          </Link>
        ) : (
          <a href={viewAllHref} className="inline-block">
            <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium shadow">
              View all reviews
            </button>
          </a>
        )}
      </div>

      {/* Write a review form */}
      <div className="mt-6 rounded-2xl p-6 bg-gradient-to-br from-slate-800/70 to-slate-900/70 border border-white/12 shadow-md">
        <ReviewForm onSubmit={addLocalReview} />
      </div>
    </section>
  );
}

/* ---------- small helpers (unchanged) ---------- */

function SortButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition ${
        active
          ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow"
          : "bg-white/5 text-slate-200 hover:bg-white/6"
      }`}
    >
      {children}
    </button>
  );
}

function AvatarBlock({
  review,
  small = false,
}: {
  review: Review;
  small?: boolean;
}) {
  const size = small ? 36 : 56;
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
      className="rounded-full overflow-hidden bg-slate-700 flex items-center justify-center ring-1 ring-white/6"
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
        <div className="text-slate-200 font-semibold">{initials}</div>
      )}
    </div>
  );
}

function RatingDisplay({ rating }: { rating?: number }) {
  if (typeof rating !== "number") {
    return <div className="text-xs text-slate-400">—</div>;
  }
  const raw = Math.max(0, Math.min(10, rating));
  const stars = Math.round((raw / 10) * 5 * 2) / 2;
  const full = Math.floor(stars);
  const half = stars % 1 >= 0.5;

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => {
          if (i < full) {
            return <Star key={i} size={14} className="text-yellow-300" />;
          }
          if (i === full && half) {
            return (
              <Star key={i} size={14} className="text-yellow-300 opacity-60" />
            );
          }
          return <Star key={i} size={14} className="text-slate-600" />;
        })}
      </div>
      <div className="text-xs text-slate-300 ml-2">{rating.toFixed(1)}/10</div>
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
