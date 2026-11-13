"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bookmark, BookmarkCheck, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import type { All } from "@/types/all";
import { tmdbImage } from "@/lib/tmdb";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import RatingBadge from "@/components/ui/rating-badge";
import { useWatchlist } from "@/hooks/useWatchlist";
import useCarousel from "@/hooks/useCarousel";
import { useHeroSwipe } from "@/hooks/useHeroSwipe";
import { FeaturedPosterWave } from "./FeaturedPosterWave";
import { HeroEdgeNavigation } from "./HeroEdgeNavigation";

type HomepageMediaHeroProps = {
  items: All[];
  mediaType: "movie" | "tv";
  title: string;
  mediaLabel: string;
  primaryCta?: string;
};

const getBackdropUrl = (path?: string | null) =>
  path ? tmdbImage(path, "backdropHero") : "/placeholder-backdrop.svg";

const getPosterUrl = (path?: string | null) =>
  path ? tmdbImage(path, "posterCard") : "/placeholder-poster.svg";

const getTitle = (item?: All | null) => item?.title || item?.name || "Untitled";

const getYear = (item?: All | null) =>
  (item?.release_date || item?.first_air_date || item?.year || "TBA")
    .toString()
    .slice(0, 4);

export function HomepageMediaHero({
  items,
  mediaType,
  title,
  mediaLabel,
  primaryCta = "View details",
}: HomepageMediaHeroProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { add, remove, isInWatchlist, ready } = useWatchlist();
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const heroItems = useMemo(() => items.slice(0, 8), [items]);
  const {
    index: activeIndex,
    setIndex: setActiveIndex,
    pause,
    resume,
  } = useCarousel({ length: heroItems.length, intervalMs: 8000 });
  const swipeHandlers = useHeroSwipe({
    onSwipe: direction => setActiveIndex(current => heroItems.length > 1
      ? (current + direction + heroItems.length) % heroItems.length : current),
    pause,
    resume,
  });
  const featured = heroItems[activeIndex] || heroItems[0] || null;
  const routeBase = mediaType === "tv" ? "tv" : "movies";
  const watchlistType = mediaType === "tv" ? "series" : "movie";
  const saved = featured?.id
    ? isInWatchlist(String(featured.id), watchlistType)
    : false;

  useEffect(() => {
    if (heroItems.length < 2) return;
    for (const offset of [-1, 1]) {
      const item = heroItems[(activeIndex + offset + heroItems.length) % heroItems.length];
      const image = new window.Image();
      image.fetchPriority = "low";
      image.src = window.matchMedia("(width < 640px)").matches
        ? tmdbImage(item.poster_path, "posterLarge") ?? "/placeholder-poster.svg"
        : getBackdropUrl(item.backdrop_path || item.poster_path);
    }
  }, [activeIndex, heroItems]);

  const toggleWatchlist = async () => {
    if (!featured?.id) return;
    if (!ready) {
      router.push("/auth/login");
      return;
    }

    setWatchlistLoading(true);
    const titleValue = getTitle(featured);
    const posterUrl = getPosterUrl(featured.poster_path);
    try {
      if (saved) {
        await remove(String(featured.id), watchlistType, {
          title: titleValue,
          posterUrl,
        });
      } else {
        await add(String(featured.id), watchlistType, {
          title: titleValue,
          posterUrl,
        });
      }
    } finally {
      setWatchlistLoading(false);
    }
  };

  if (!featured) return <h1 className="ui-shell py-8 text-4xl font-bold lg:pt-28">{title}</h1>;

  const selectRelative = (offset: number) => {
    if (!heroItems.length) return;
    setActiveIndex(
      (activeIndex + offset + heroItems.length) % heroItems.length,
    );
  };

  return (
    <section
      className="relative isolate overflow-hidden bg-[var(--surface-0)]"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
      aria-labelledby={`${mediaType}-hub-heading`}
    >
      <div {...swipeHandlers} className="relative">
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            key={`backdrop-${featured.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeOut" }}
            className="absolute inset-0"
            style={{ touchAction: "pan-y pinch-zoom" }}
          >
            <picture>
              <source
                media="(width < 640px)"
                srcSet={
                  tmdbImage(featured.poster_path, "posterLarge") ??
                  "/placeholder-poster.svg"
                }
              />
              <Image
                src={getBackdropUrl(
                  featured.backdrop_path || featured.poster_path,
                )}
                alt=""
                fill
                loading="eager"
                fetchPriority={activeIndex === 0 ? "high" : "auto"}
                sizes="100vw"
                className="object-cover object-[center_25%] sm:object-center"
              />
            </picture>
            <div className="absolute inset-0 hidden bg-[radial-gradient(ellipse_at_0%_75%,rgba(8,7,7,0.9),rgba(8,7,7,0.54)_36%,transparent_72%)] sm:block" />
          </motion.div>
        </AnimatePresence>
        <div aria-hidden="true" className="homepage-hero-fade pointer-events-none absolute inset-0 z-[2]" />

        {heroItems.length > 1 && <HeroEdgeNavigation onNavigate={selectRelative} />}

        <div className="ui-shell pointer-events-none relative z-10 [&_button]:pointer-events-auto [&_a]:pointer-events-auto flex min-h-[min(620px,calc(100svh-var(--mobile-nav-safe)))] min-w-0 flex-col pb-5 pt-5 sm:min-h-[min(720px,86svh)] sm:pb-8 lg:pt-28">
          <h1 id={`${mediaType}-hub-heading`} className="text-3xl font-bold leading-none text-white drop-shadow-md sm:text-4xl">{title}</h1>
          <div className="mt-auto grid items-end gap-6 pt-28 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_auto]">
            <motion.div
              key={`copy-${featured.id}`}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.18,
                ease: "easeOut",
              }}
              className="min-w-0"
              style={{ touchAction: "pan-y pinch-zoom" }}
            >
              <div className="min-w-0 max-w-2xl self-end sm:self-center">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/65">
                  <span className="text-[var(--brand-coral-strong)]">Featured {mediaLabel.toLowerCase()}</span>
                  <span aria-hidden="true">/</span>
                  <span>{getYear(featured)}</span>
                  <RatingBadge rating={featured.vote_average} variant="minimal" size="md" className="min-h-8" />
                </div>

                <h2
                  aria-label={getTitle(featured)}
                  title={getTitle(featured)}
                  className="mt-3 line-clamp-3 max-w-[20ch] break-words text-balance text-4xl font-bold leading-none tracking-normal text-white drop-shadow-lg sm:line-clamp-2 sm:text-5xl sm:leading-[0.95]"
                >
                  {getTitle(featured)}
                </h2>

                <p
                  className="mt-3 line-clamp-2 max-w-xl text-sm leading-6 text-white/72 sm:text-base"
                >
                  {featured.overview || "No description available."}
                </p>

                <div
                  className="mt-5 grid max-w-sm grid-cols-2 items-stretch gap-3 sm:max-w-xs"
                >
                  <Link
                    href={`/${routeBase}/${featured.id}`}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--brand-coral)] px-3 text-sm font-bold text-white transition-colors hover:bg-[var(--brand-coral-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:min-h-11 sm:px-5"
                  >
                    <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {primaryCta}
                  </Link>
                  <button
                    type="button"
                    onClick={toggleWatchlist}
                    disabled={watchlistLoading}
                    aria-pressed={saved}
                    aria-busy={watchlistLoading}
                    className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60 sm:min-h-11 sm:px-5 ${
                      saved
                        ? "border-[var(--brand-coral-strong)]/60 bg-black/40 text-[var(--brand-coral-strong)] hover:bg-black/55"
                        : "border-white/25 bg-black/30 text-white backdrop-blur-sm hover:border-white/55 hover:bg-black/50"
                    }`}
                    aria-label={
                      saved ? "Remove from My List" : "Add to My List"
                    }
                  >
                    {watchlistLoading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
                    ) : saved ? (
                      <BookmarkCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <Bookmark className="h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      {saved ? "Saved" : "My List"}
                    </span>
                  </button>
                </div>
              </div>

            </motion.div>

            {heroItems.length > 1 && (
              <div className="self-end">
                <FeaturedPosterWave items={heroItems} index={activeIndex} onSelect={setActiveIndex} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
