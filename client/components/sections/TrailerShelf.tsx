"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Clock, Film, Play, Tv } from "lucide-react";
import { LoadingRegion } from "@/components/loading/PageSkeleton";
import { CarouselNavButton } from "@/components/ui/CarouselNavButton";
import RatingBadge from "@/components/ui/rating-badge";
import SectionHeader from "@/components/ui/SectionHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { useCarouselScroll } from "@/hooks/useCarouselScroll";
import { tmdbImage } from "@/lib/tmdb";
import type { All } from "@/types/all";

const TrailerModal = dynamic(() => import("./TrailerModal"), { ssr: false });
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
const trailerKey = (item: All) => (item.type === "tv" ? "tv" : "movie") + ":" + item.id;
const releaseFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const railClass = "mobile-native-scroll scrollbar-hide flex snap-x snap-proximity gap-3 overflow-x-auto pb-3 sm:gap-4 lg:gap-5";
const cardClass = "w-[74vw] max-w-[300px] shrink-0 snap-start sm:w-[46vw] sm:max-w-[360px] lg:w-[calc((100%-2.5rem)/3)] lg:max-w-none";

function getDaysUntilRelease(date: string) {
  const days = Math.ceil((Date.parse(date) - Date.now()) / 86_400_000);
  if (!Number.isFinite(days)) return "Date TBA";
  if (days < 0) return "Now showing";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return days <= 30 ? "In " + days + " days" : releaseFormatter.format(new Date(date));
}

export interface TrailerShelfOptions {
  data?: All[];
  title?: string;
  subtitle?: string;
  endpoint?: string;
}

export function TrailerShelf({ data, title, subtitle, endpoint, upcoming = false }:
  TrailerShelfOptions & { title: string; subtitle: string; endpoint: string; upcoming?: boolean }) {
  const [trailers, setTrailers] = useState<All[]>([]);
  const [selectedTrailer, setSelectedTrailer] = useState<All | null>(null);
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const recommendationCache = useRef(new Map<string, All[]>());
  const mouseDown = useRef<{ x: number; y: number } | null>(null);
  const suppressMouseClick = useRef(false);
  const railId = useId();
  const items = data ?? trailers;
  const trailerItems = useMemo(() => Array.from(new Map(items.map((item) => [trailerKey(item), item])).values())
    .filter((item) => !upcoming || item.trailer_key), [items, upcoming]);
  const isLoading = !data && loading;
  const { containerRef, canScrollLeft, canScrollRight, scroll } = useCarouselScroll(isLoading || error ? 0 : trailerItems.length);
  const closeTrailer = useCallback(() => setSelectedTrailer(null), []);
  const sectionId = upcoming ? "upcoming" : "premiere";
  const artworkAspect = upcoming ? "aspect-[16/11]" : "aspect-[16/10] lg:aspect-[16/11]";

  useEffect(() => {
    if (data) {
      setError(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch(API_BASE + endpoint, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("HTTP " + response.status);
        const items = await response.json();
        if (!Array.isArray(items)) throw new Error("Invalid trailer list");
        if (!controller.signal.aborted) setTrailers(items);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [data, endpoint, retry]);

  async function handleSelectTrailer(trailer: All) {
    if (!trailer.id) return;
    const key = trailerKey(trailer);
    const cached = recommendationCache.current.get(key);
    const selection = { ...trailer, recommendations: cached ?? trailer.recommendations ?? [] };
    setSelectedTrailer(selection);
    if (cached || selection.recommendations.length) return;

    try {
      const type = trailer.type === "tv" ? "tv" : "movie";
      const path = upcoming ? "/all/" + type + "/" + trailer.id + "/recommendations" : "/all/recommendations/" + type + "/" + trailer.id;
      const response = await fetch(API_BASE + path);
      if (!response.ok) return;
      const recommendations = await response.json();
      if (!Array.isArray(recommendations)) return;
      recommendationCache.current.set(key, recommendations);
      setSelectedTrailer((current) => current === selection ? { ...selection, recommendations } : current);
    } catch {
      // Recommendations are optional and the selected trailer is already available.
    }
  }

  return (
    <section id={sectionId} aria-labelledby={sectionId + "-heading"} className="ui-shell scroll-mt-24 border-b border-[var(--surface-border)] py-8 sm:py-10">
      <SectionHeader id={sectionId + "-heading"} title={title} titleHref={upcoming ? "/coming-soon" : "/fresh-off-the-screen"} description={subtitle} className="mb-5" />
      {isLoading ? (
        <LoadingRegion label={"Loading " + title}>
          <div className={railClass + " overflow-x-hidden"}>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className={`${cardClass} ${artworkAspect} rounded-xl`} />
            ))}
          </div>
        </LoadingRegion>
      ) : error || trailerItems.length === 0 ? (
        <div className="ui-panel flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <p className="text-sm text-[var(--ink-muted)]">
            {error ? "Couldn’t load trailers." : "No trailers available right now."}
          </p>
          {!data && <button type="button" onClick={() => setRetry((value) => value + 1)} className="ui-secondary-action">Try again</button>}
        </div>
      ) : (
        <div className="relative">
          {(canScrollLeft || canScrollRight) && (
            <div role="group" aria-label={`${title} navigation`}>
              <CarouselNavButton
                aria-controls={railId}
                direction="previous"
                onClick={() => scroll(-1)}
                disabled={!canScrollLeft}
                aria-label={`Previous ${title}`}
                className="absolute -left-5 top-1/2 z-30 -translate-y-1/2 xl:-left-6"
              />

              <CarouselNavButton
                aria-controls={railId}
                direction="next"
                onClick={() => scroll(1)}
                disabled={!canScrollRight}
                aria-label={`Next ${title}`}
                className="absolute -right-5 top-1/2 z-30 -translate-y-1/2 xl:-right-6"
              />
            </div>
          )}
          <div
            id={railId}
            ref={containerRef}
            className={railClass + " select-none"}
            onPointerDown={(event) => {
              suppressMouseClick.current = false;
              mouseDown.current = event.pointerType === "mouse" && event.button === 0
                ? { x: event.clientX, y: event.clientY }
                : null;
            }}
            onPointerUp={(event) => {
              const start = mouseDown.current;
              mouseDown.current = null;
              if (!start) return;
              const deltaX = event.clientX - start.x;
              if (Math.abs(deltaX) >= 80 && Math.abs(deltaX) > Math.abs(event.clientY - start.y)) {
                suppressMouseClick.current = true;
                scroll(deltaX < 0 ? 1 : -1);
              }
            }}
            onClickCapture={(event) => {
              if (!event.detail || !suppressMouseClick.current) return;
              event.stopPropagation();
              event.preventDefault();
            }}
          >
            {trailerItems.map((item) => (
              <div
                key={trailerKey(item)}
                className={"relative " + cardClass}
              >
                <button
                  type="button"
                  aria-label={(item.trailer_key ? "Play trailer for " : "View ") + item.title}
                  onClick={() => handleSelectTrailer(item)}
                  className="absolute inset-0 z-30 cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)]"
                />
                <div className={`relative ${artworkAspect} overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)]`}>
                  <Image
                    src={
                      item.backdrop_path
                        ? tmdbImage(item.backdrop_path, "backdropCard")
                        : "/placeholder-backdrop.svg"
                    }
                    alt=""
                    fill
                    sizes="(max-width: 639px) 74vw, (max-width: 1023px) 46vw, 33vw"
                    className="object-cover"
                  />

                  <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.94),rgba(0,0,0,0.45),rgba(0,0,0,0.08))]" />

                  <div className="absolute left-3 right-3 top-3 z-20 flex items-center justify-between gap-2">
                    {upcoming && item.release_date && (
                      <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-md">
                        <Clock size={12} />
                        <span>{getDaysUntilRelease(item.release_date)}</span>
                      </div>
                    )}

                    {!upcoming && <RatingBadge rating={item.vote_average} />}
                    <div className="ui-label ml-auto bg-black/75 text-white">
                      {item.type === "tv" ? <Tv size={12} /> : <Film size={12} />}
                      {item.type === "tv" ? "Series" : "Movie"}
                    </div>
                  </div>

                  {item.trailer_key && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center" aria-hidden="true">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-2xl sm:h-12 sm:w-12">
                        <Play
                          size={16}
                          className="ml-0.5 text-black sm:h-[18px] sm:w-[18px]"
                          fill="black"
                        />
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 z-10 p-3 sm:p-4">
                    <h3 className="mb-1.5 line-clamp-2 text-sm font-black leading-tight text-white sm:text-base">
                      {item.title}
                    </h3>

                    <div className="flex min-w-0 items-center gap-2 text-xs text-gray-300">
                      {item.release_date && Number.isFinite(Date.parse(item.release_date)) && (
                        <span className="shrink-0 font-medium">
                          {upcoming ? releaseFormatter.format(new Date(item.release_date)) : item.release_date.slice(0, 4)}
                        </span>
                      )}
                      {item.genres && item.genres.length > 0 && (
                        <span className="truncate">
                          {item.genres.slice(0, 2).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {selectedTrailer && (
        <TrailerModal trailer={selectedTrailer} onClose={closeTrailer} onSelectTrailer={handleSelectTrailer} />
      )}
    </section>
  );
}
