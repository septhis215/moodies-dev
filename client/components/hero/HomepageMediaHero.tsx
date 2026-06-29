"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, Info } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import type { All } from "@/types/all";
import { useWatchlist } from "@/hooks/useWatchlist";
import RatingBadge from "@/components/ui/rating-badge";

type HomepageMediaHeroProps = {
  items: All[];
  mediaType: "movie" | "tv";
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  spotlightLabel: string;
  mediaLabel: string;
  primaryCta?: string;
};

const getBackdropUrl = (path?: string | null) =>
  path
    ? `https://image.tmdb.org/t/p/original${path}`
    : "/placeholder-backdrop.svg";

const getPosterUrl = (path?: string | null) =>
  path ? `https://image.tmdb.org/t/p/w500${path}` : "/placeholder-poster.svg";

const getTitle = (item?: All | null) => item?.title || item?.name || "Untitled";

const getYear = (item?: All | null) => {
  const date = item?.release_date || item?.first_air_date;
  return date?.split("-")[0] || item?.year || "TBA";
};

export function HomepageMediaHero({
  items,
  mediaType,
  icon,
  eyebrow,
  title,
  description,
  spotlightLabel,
  mediaLabel,
  primaryCta = "View details",
}: HomepageMediaHeroProps) {
  const router = useRouter();
  const { add, remove, isInWatchlist, ready } = useWatchlist();
  const [activeIndex, setActiveIndex] = useState(0);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const heroItems = useMemo(() => items.slice(0, 18), [items]);
  const featured = heroItems[activeIndex] || heroItems[0] || null;
  const routeBase = mediaType === "tv" ? "tv" : "movies";
  const watchlistType = mediaType === "tv" ? "series" : "movie";
  const isSaved = featured?.id
    ? isInWatchlist(String(featured.id), watchlistType)
    : false;

  useEffect(() => {
    if (heroItems.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % heroItems.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [heroItems.length]);

  useEffect(() => {
    if (activeIndex >= heroItems.length) setActiveIndex(0);
  }, [activeIndex, heroItems.length]);

  const toggleWatchlist = async () => {
    if (!featured?.id) return;
    if (!ready) {
      router.push("/auth/login");
      return;
    }

    setWatchlistLoading(true);
    const titleValue = getTitle(featured);
    const posterUrl = featured.poster_path
      ? getPosterUrl(featured.poster_path)
      : getBackdropUrl(featured.backdrop_path);

    try {
      if (isSaved) {
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
    } catch (error) {
      console.error("Failed to update featured watchlist:", error);
    } finally {
      setWatchlistLoading(false);
    }
  };

  if (!featured) {
    return (
      <section className="relative px-4 pb-6 pt-4 text-white sm:px-6 sm:pb-8 sm:pt-20">
        <div className="mx-auto flex min-h-72 max-w-7xl items-center justify-center rounded-2xl border border-white/10 bg-neutral-950/80 p-6 text-center">
          <div>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.055] text-[#ff7a66] ring-1 ring-white/10">
              {icon}
            </div>
            <h1 className="mt-4 text-2xl font-black">{title}</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Featured titles are unavailable right now.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black via-black/45 to-transparent" />

      <div className="relative z-20 mx-auto max-w-7xl px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-20 lg:px-8 lg:pt-16">
        <div className="grid items-stretch gap-3 md:grid-cols-12 lg:gap-4">
          <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl bg-neutral-950/80 p-3 shadow-2xl shadow-black/35 ring-1 ring-white/10 backdrop-blur-xl md:col-span-7">
            <div className="-mx-3 -mt-3 mb-3 h-1 bg-gradient-to-r from-[#e94f37] via-[#ff7a66] to-[#38bdf8]" />

            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.045] text-[#ff7a66] ring-1 ring-white/10">
                {icon}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ff8b78]">
                  {eyebrow}
                </p>
                <h1 className="truncate text-2xl font-black leading-tight text-white sm:text-3xl">
                  {title}
                </h1>
              </div>
            </div>

            <p className="mb-3 hidden text-sm leading-5 text-zinc-400 sm:block">
              {description}
            </p>

            <div className="relative h-[230px] min-h-0 overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10 sm:h-[330px] md:h-auto md:min-h-[340px] md:flex-1 lg:min-h-[360px]">
              <div className="flex h-full snap-x snap-mandatory gap-2.5 overflow-x-auto py-3 scroll-smooth sm:hidden">
                {heroItems.slice(0, 8).map((item, index) => {
                  const isActive = featured.id === item.id;
                  return (
                    <button
                      key={`${item.id}-${index}`}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      className={`relative h-full w-[38vw] min-w-[132px] max-w-[154px] shrink-0 snap-start overflow-hidden rounded-xl border transition first:ml-3 last:mr-3 ${
                        isActive
                          ? "border-[#e94f37] shadow-xl shadow-[#e94f37]/20"
                          : "border-white/10"
                      }`}
                      aria-label={`Feature ${getTitle(item)}`}
                    >
                      <Image
                        src={getPosterUrl(item.poster_path)}
                        alt={getTitle(item)}
                        fill
                        sizes="154px"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                      <p className="absolute inset-x-0 bottom-0 line-clamp-2 p-2.5 text-left text-xs font-black leading-tight">
                        {getTitle(item)}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="absolute inset-0 hidden grid-cols-6 grid-rows-2 gap-2 p-2 sm:grid">
                {heroItems.slice(0, 12).map((item, index) => {
                  const isActive = featured.id === item.id;
                  return (
                    <button
                      key={`${item.id}-${index}`}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      className={`relative min-h-0 overflow-hidden rounded-lg border transition duration-300 hover:z-10 hover:scale-[1.03] focus:outline-none ${
                        isActive
                          ? "scale-[1.025] border-[#e94f37] shadow-xl shadow-[#e94f37]/25"
                          : "border-white/10 hover:border-[#e94f37]/50"
                      }`}
                      aria-label={`Feature ${getTitle(item)}`}
                    >
                      <Image
                        src={getPosterUrl(item.poster_path)}
                        alt={getTitle(item)}
                        fill
                        sizes="(max-width: 1024px) 14vw, 120px"
                        className="object-cover"
                      />
                    </button>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_58%,rgba(0,0,0,0.72)_100%)]" />
            </div>
          </div>

          <div className="flex min-w-0 md:col-span-5">
            <AnimatePresence mode="wait">
              <motion.article
                key={featured.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="relative flex w-full flex-col overflow-hidden rounded-2xl bg-neutral-950/90 shadow-2xl shadow-black/35 ring-1 ring-white/10"
              >
                <div className="relative h-44 w-full overflow-hidden sm:h-48 lg:h-52">
                  <Image
                    src={getBackdropUrl(
                      featured.backdrop_path || featured.poster_path,
                    )}
                    alt={getTitle(featured)}
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, 42vw"
                    className="object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-black/35 to-black/5" />
                  <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] backdrop-blur">
                    {spotlightLabel}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-3.5 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-white/[0.07] px-2.5 py-1 font-bold text-zinc-200 ring-1 ring-white/10">
                      {mediaLabel}
                    </span>
                    <span className="rounded-full bg-white/[0.07] px-2.5 py-1 font-bold text-zinc-200 ring-1 ring-white/10">
                      {getYear(featured)}
                    </span>
                    <RatingBadge
                      rating={featured.vote_average}
                      variant="colored"
                      size="sm"
                    />
                  </div>

                  <h2 className="mt-3 line-clamp-2 text-2xl font-black leading-tight text-white sm:text-3xl">
                    {getTitle(featured)}
                  </h2>

                  <p className="mt-2 line-clamp-2 text-sm leading-5 text-zinc-300 sm:line-clamp-3">
                    {featured.overview || "No description available"}
                  </p>

                  <div className="mt-auto flex gap-2 border-t border-white/10 pt-3">
                    <Link
                      href={`/${routeBase}/${featured.id}`}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#e94f37] px-4 text-sm font-black text-white shadow-lg shadow-[#e94f37]/20 transition hover:bg-[#ff604b]"
                    >
                      <Info className="h-4 w-4" />
                      {primaryCta}
                    </Link>
                    <button
                      type="button"
                      onClick={toggleWatchlist}
                      disabled={watchlistLoading}
                      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition ${
                        isSaved
                          ? "border-emerald-400/40 bg-emerald-500/90 text-white"
                          : "border-white/15 bg-white/[0.07] text-white hover:bg-white/[0.12]"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      title={isSaved ? "Remove from My List" : "Add to My List"}
                      aria-label={
                        isSaved ? "Remove from My List" : "Add to My List"
                      }
                    >
                      {watchlistLoading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : isSaved ? (
                        <BookmarkCheck className="h-5 w-5" />
                      ) : (
                        <Bookmark className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </motion.article>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
