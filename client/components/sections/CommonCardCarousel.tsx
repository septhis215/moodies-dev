"use client";

import React from "react";
import type { All } from "@/types/all";
import Image from "next/image";
import Link from "next/link";
import { Carousel } from "@/components/ui/Carousel";
import { Star, Plus, Info, Share2 } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";

interface CommonCardCarouselProps {
  title: string;
  subtitle?: string;
  type?: "movie" | "tv";
  items: All[];
}

export default function CommonCardCarousel({
  title,
  subtitle,
  type,
  items,
}: CommonCardCarouselProps) {
  const router = useRouter();
  const { isInWatchlist: hookIsIn, add, remove, ready } = useWatchlist();
  const [loadingStates, setLoadingStates] = useState<
    Record<string | number, boolean>
  >({});

  const getPosterUrl = (path?: string) =>
    path ? `https://image.tmdb.org/t/p/w500${path}` : "/coming-soon.png";

  const toWatchType = (show: All): "movie" | "series" =>
    type === "tv" ? "series" : "movie";

  const handleWatchlistToggle = async (show: All, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!ready) {
      router.push("/auth/login");
      return;
    }

    const itemId = show.id;
    const isCurrentlyInWatchlist = hookIsIn(String(itemId), toWatchType(show));

    setLoadingStates((prev) => ({ ...prev, [itemId]: true }));

    try {
      const title = show.title || show.name || null;
      const posterUrl = getPosterUrl(show.poster_path ?? undefined);

      if (isCurrentlyInWatchlist) {
        await remove(String(itemId), toWatchType(show), {
          title,
          posterUrl,
          variant: "info",
          duration: 3500,
        });
      } else {
        await add(String(itemId), toWatchType(show), {
          title,
          posterUrl,
          variant: "info",
          duration: 3500,
        });
      }
    } catch (error) {
      console.error("Error updating watchlist:", error);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const MovieCard = ({
    show,
    size = "default",
  }: {
    show?: All;
    size?: "default" | "large" | "wide";
  }) => {
    if (!show) return null;

    const isWide = size === "wide";
    const linkHref = type === "tv" ? `/tv/${show.id}` : `/movies/${show.id}`;

    return (
      <div className="group relative h-full">
        <Link href={linkHref} className="block h-full">
          <div
            className={`relative rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-xl ring-1 ring-white/5 ${
              isWide ? "aspect-video" : "aspect-[2/3]"
            }`}
          >
            <Image
              src={getPosterUrl(show.poster_path ?? undefined)}
              alt={show.title || show.name || ""}
              fill
              className="group-hover:scale-110 transition-transform duration-700 object-cover"
            />

            {/* Gradient overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Rating Badge */}
            <div className="absolute top-3 right-3 bg-black/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg ring-1 ring-white/10">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              {show.vote_average?.toFixed(1)}
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex justify-center gap-2 mb-3">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleWatchlistToggle(show, e);
                    }}
                    disabled={loadingStates[show.id]}
                    className={`w-10 h-10 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl ${
                      hookIsIn(String(show.id), toWatchType(show))
                        ? "bg-green-500 text-white"
                        : "bg-white text-black"
                    }`}
                    title={
                      loadingStates[show.id]
                        ? "Loading..."
                        : hookIsIn(String(show.id), toWatchType(show))
                        ? "Remove from Watchlist"
                        : "Add to Watchlist"
                    }
                  >
                    {loadingStates[show.id] ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : hookIsIn(String(show.id), toWatchType(show)) ? (
                      <BookmarkCheck className="w-5 h-5" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </button>

                  <button
                    className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
                    title="More Info"
                  >
                    <Info className="w-5 h-5 text-black" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.preventDefault();
                    }}
                    className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
                    title="Share"
                  >
                    <Share2 className="w-5 h-5 text-black" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 px-1">
            <h4 className="font-bold text-sm sm:text-base line-clamp-2 group-hover:text-[#e94f37] transition-colors leading-tight text-white">
              {show.title || show.name}
            </h4>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
              {show.release_date && (
                <span className="font-semibold">
                  {show.release_date.split("-")[0]}
                </span>
              )}
            </div>
          </div>
        </Link>
      </div>
    );
  };

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <section className="relative">
      <div className="flex flex-col gap-2 mb-8">
        <h2 className="text-3xl sm:text-4xl font-black text-white">{title}</h2>
        {subtitle && (
          <p className="text-gray-400 text-sm font-medium">{subtitle}</p>
        )}
      </div>
      <Carousel items={items} CardComponent={MovieCard} />
    </section>
  );
}
