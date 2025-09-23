// components/selected-movie/AllReviews.tsx
"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, Users2 } from "lucide-react";

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

export default function AllReviews({
  reviews,
  movieId,
  highlight,
}: {
  reviews: Review[];
  movieId?: string;
  highlight?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  // On mount, scroll highlight into view (if any)
  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      // small focus outline for accessibility
      highlightRef.current.classList.add("ring-2", "ring-indigo-500");
      setTimeout(() => {
        highlightRef.current?.classList.remove("ring-2", "ring-indigo-500");
      }, 2200);
    } else if (containerRef.current) {
      // scroll top
      containerRef.current.scrollTop = 0;
    }
  }, [highlight]);

  // pick highlighted review first (if exists), then others (exclude duplicate)
  const highlighted = highlight
    ? reviews.find((r) => r.id === highlight)
    : undefined;
  const others = reviews.filter((r) => r.id !== highlighted?.id);

  const renderStars = (rating?: number) => {
    if (typeof rating !== "number")
      return <span className="text-xs text-slate-400">—</span>;
    const raw = Math.max(0, Math.min(10, rating));
    const stars = Math.round((raw / 10) * 5 * 2) / 2;
    const full = Math.floor(stars);
    const half = stars % 1 >= 0.5;
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => {
          if (i < full)
            return <Star key={i} size={14} className="text-yellow-300" />;
          if (i === full && half)
            return (
              <Star key={i} size={14} className="text-yellow-300 opacity-60" />
            );
          return <Star key={i} size={14} className="text-slate-600" />;
        })}
      </div>
    );
  };

  const avatarSrc = (r: Review) => {
    const av = r.author_details?.avatar_path;
    if (!av) return null;
    if (av.startsWith("/https") || av.startsWith("/http")) return av.slice(1);
    return `https://image.tmdb.org/t/p/w185${av}`;
  };

  return (
    <div ref={containerRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">All Reviews</h1>
          <p className="text-slate-400 text-sm mt-1">
            {reviews.length} review(s)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/movies/${movieId ?? ""}`}
            className="text-xs text-indigo-400 hover:underline"
          >
            ← Back to movie
          </Link>
        </div>
      </div>

      {highlighted && (
        <article
          ref={highlightRef}
          className="rounded-2xl p-6 bg-gradient-to-br from-slate-900/80 to-slate-800/80 border border-white/10 shadow-lg"
        >
          <div className="flex gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center">
              {avatarSrc(highlighted) ? (
                <Image
                  src={avatarSrc(highlighted)!}
                  alt={highlighted.author}
                  width={56}
                  height={56}
                />
              ) : (
                <div className="text-slate-200 font-semibold">
                  {(highlighted.author || "A").slice(0, 2)}
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-start gap-3">
                <div>
                  <div className="text-lg font-semibold text-slate-100">
                    {highlighted.author}
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(highlighted.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="ml-auto text-right">
                  <div>{renderStars(highlighted.author_details?.rating)}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {typeof highlighted.author_details?.rating === "number"
                      ? `${highlighted.author_details.rating}/10`
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-slate-300 whitespace-pre-wrap">
                {highlighted.content}
              </div>

              <div className="mt-4">
                {highlighted.url ? (
                  <a
                    href={highlighted.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 text-sm hover:underline"
                  >
                    Open original review
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </article>
      )}

      {/* rest of reviews */}
      <div className="grid gap-4">
        {others.map((r) => (
          <article
            key={r.id}
            className="rounded-lg p-4 bg-slate-900/60 border border-white/6"
          >
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center">
                {avatarSrc(r) ? (
                  <Image
                    src={avatarSrc(r)!}
                    alt={r.author}
                    width={48}
                    height={48}
                  />
                ) : (
                  <div className="text-slate-200 font-semibold">
                    {(r.author || "A").slice(0, 2)}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      {r.author}
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-sm text-yellow-300">
                    {typeof r.author_details?.rating === "number"
                      ? `${r.author_details.rating}/10`
                      : "—"}
                  </div>
                </div>

                <div className="mt-2 text-slate-300 text-sm whitespace-pre-wrap line-clamp-6">
                  {r.content}
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <Link
                    href={`/movies/${
                      movieId ?? ""
                    }/reviews?highlight=${encodeURIComponent(r.id)}`}
                    className="text-xs text-indigo-400 hover:underline"
                  >
                    Focus this review
                  </Link>
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-slate-400 hover:underline ml-2"
                    >
                      Open original
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
