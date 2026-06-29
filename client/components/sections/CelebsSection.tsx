"use client";

import { tmdbImage } from "@/lib/tmdb";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  Award,
  ChevronLeft,
  ChevronRight,
  Film,
  Info,
  Star,
  Tv,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";

export interface Person {
  id: number;
  name: string;
  known_for_department: string;
  profile_path: string | null;
  popularity: number;
  known_for: {
    id: number;
    title?: string;
    name?: string;
    media_type: "movie" | "tv";
    poster_path?: string | null;
    overview?: string;
    vote_average?: number;
    release_date?: string;
    first_air_date?: string;
  }[];
}

type KnownForWork = Person["known_for"][number];

async function fetchPeople() {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const res = await fetch(`${base}/all/peoples`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json as Person[];
}

export default function CelebSection() {
  const [celebs, setCelebs] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itemsPerView, setItemsPerView] = useState(4.5);
  const router = useRouter();

  // DOM ref for scroll container
  const containerRef = useRef<HTMLDivElement | null>(null);

  // tailwind 'gap-6' -> 1.5rem = 24px
  const GAP_PX = 24;

  // pixel measurements for scroll math
  const [cardWidthPx, setCardWidthPx] = useState<number>(240); // safe initial fallback
  const [maxScrollLeft, setMaxScrollLeft] = useState<number>(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    fetchPeople()
      .then(setCelebs)
      .catch(() => setError("Failed to load celebrities"))
      .finally(() => setLoading(false));
  }, []);

  const handleOpenPerson = (celeb: Person) => {
    router.push(`/celeb/${celeb.id}`);
  };

  const handleOpenWork = (work: KnownForWork) => {
    if (work.media_type === "movie") router.push(`/movies/${work.id}`);
    else if (work.media_type === "tv") router.push(`/tv/${work.id}`);
  };

  const getDepartmentIcon = (department: string) => {
    switch (department?.toLowerCase()) {
      case "acting":
        return <Users size={16} className="text-blue-400" />;
      case "directing":
        return <Award size={16} className="text-purple-400" />;
      default:
        return <Star size={16} className="text-yellow-400" />;
    }
  };

  const getWorkYear = (work: KnownForWork) => {
    const date = work.release_date || work.first_air_date;
    return date ? date.slice(0, 4) : "";
  };

  // set itemsPerView responsive fractional
  useEffect(() => {
    const updateLayout = () => {
      const w = window.innerWidth;
      if (w < 640) setItemsPerView(1.75);
      else if (w < 768) setItemsPerView(2.5);
      else if (w < 1024) setItemsPerView(3.5);
      else setItemsPerView(4.5);
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  // compute sizes & scroll limits using the actual DOM measurements
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const compute = () => {
      const containerWidth = el.clientWidth || 0;

      // compute card width (px) from container width and gaps; clamp with a sensible min
      const computed = Math.max(
        152,
        (containerWidth - Math.max(0, itemsPerView - 1) * GAP_PX) / itemsPerView
      );
      setCardWidthPx(Math.round(computed));

      // compute max scroll from DOM (accurate)
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      setMaxScrollLeft(maxScroll);

      const sLeft = el.scrollLeft || 0;
      setCanScrollLeft(sLeft > 5);
      setCanScrollRight(sLeft < Math.max(0, maxScroll - 5));
    };

    compute();

    const ro = new ResizeObserver(() => compute());
    ro.observe(el);

    // also observe when images/fonts settle:
    const t = setTimeout(() => compute(), 100);

    const onScroll = () => {
      const sLeft = el.scrollLeft || 0;
      setCanScrollLeft(sLeft > 5);
      setCanScrollRight(sLeft < Math.max(0, el.scrollWidth - el.clientWidth - 5));
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      ro.disconnect();
      clearTimeout(t);
      el.removeEventListener("scroll", onScroll);
    };
  }, [celebs.length, itemsPerView]);

  // step in items (brings the peek into full view), use floor(itemsPerView - 1) but at least 1
  const stepCount = Math.max(1, Math.floor(itemsPerView - 1));
  const stepPx = Math.round(stepCount * (cardWidthPx + GAP_PX));

  const scrollLeft = () => {
    const el = containerRef.current;
    if (!el) return;
    const next = Math.max(0, el.scrollLeft - stepPx);
    el.scrollTo({ left: next, behavior: "smooth" });
  };

  const scrollRight = () => {
    const el = containerRef.current;
    if (!el) return;
    // clamp to maxScrollLeft so last item fully visible
    const desired = el.scrollLeft + stepPx;
    const next = Math.min(maxScrollLeft, desired);
    el.scrollTo({ left: next, behavior: "smooth" });
  };

  // CSS flex-basis calc (percentage + gap) so initial render has correct layout even before JS measurement
  const cardBasisCss = `calc((100% - ${(Math.max(0, itemsPerView - 1) * GAP_PX)}px) / ${itemsPerView})`;

  if (loading) {
    return (
      <section className="relative mx-auto w-full px-4 py-12 sm:px-6 sm:py-16">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-8">
            <div className="space-y-4">
              <div className="h-8 bg-gray-700 rounded-lg w-64"></div>
              <div className="h-4 w-full max-w-96 rounded bg-gray-800"></div>
            </div>
            <div className="flex gap-6 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-80 w-[72vw] max-w-72 flex-shrink-0 rounded-2xl bg-gray-800 sm:h-96"></div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="relative mx-auto w-full px-4 py-12 sm:px-6 sm:py-16">
        <div className="max-w-7xl mx-auto text-center">
          <div className="p-8 bg-gray-800/50 rounded-2xl border border-gray-700">
            <p className="text-gray-400 text-lg mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium">
              Try Again
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!celebs.length) return null;

  return (
    <section id="celebs" className="relative mx-auto w-full max-w-7xl scroll-mt-24 px-4 py-10 sm:px-6 sm:py-20 lg:px-8 lg:py-32">
      <div className="mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-5 sm:mb-10">
          <h2
            className="bg-clip-text text-[1.35rem] font-bold leading-tight tracking-tight text-transparent sm:text-2xl lg:text-3xl"
            style={{
              backgroundImage: "linear-gradient(to right, #e94f37, #ff6b58)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Your Moodies Icons
          </h2>

          <p className="mt-1 line-clamp-2 max-w-[34ch] text-[13px] leading-5 text-gray-400 sm:max-w-none sm:text-sm">
            Discover the most popular stars and rising talents in entertainment
          </p>
        </motion.div>

        <div className="relative group/carousel">
          {canScrollLeft && (
            <button onClick={scrollLeft} className="absolute left-0 top-1/2 z-50 hidden h-12 w-12 -translate-x-4 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-r from-[#e94f37] to-[#ff6b58] opacity-0 shadow-2xl ring-2 ring-white/10 transition-all hover:scale-110 group-hover/carousel:opacity-100 md:flex" aria-label="Previous celebrities">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {canScrollRight && (
            <button onClick={scrollRight} className="absolute right-0 top-1/2 z-50 hidden h-12 w-12 translate-x-4 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-r from-[#e94f37] to-[#ff6b58] opacity-0 shadow-2xl ring-2 ring-white/10 transition-all hover:scale-110 group-hover/carousel:opacity-100 md:flex" aria-label="Next celebrities">
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          <motion.div ref={containerRef} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 mobile-native-scroll sm:gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }} style={{ WebkitOverflowScrolling: "touch" }}>
            {celebs.map((celeb) => {
              const notableWorks = celeb.known_for?.slice(0, 2) ?? [];

              return (
                <motion.div
                  key={`celeb-${celeb.id}`}
                  className="group relative flex-shrink-0 snap-start"
                  style={{
                    flex: `0 0 ${cardBasisCss}`,
                    minWidth: `${cardWidthPx}px`,
                    maxWidth: `${Math.max(cardWidthPx, 200)}px`,
                    minHeight: "360px",
                    maxHeight: "470px",
                    width: cardBasisCss,
                  }}
                >
                  <div className="flex flex-col h-full overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/90 shadow-xl shadow-black/30 transition-colors duration-200 hover:border-white/20">
                    {/* --- Top: Profile Section (taller, responsive) --- */}
                    <div
                      onClick={() => handleOpenPerson(celeb)}
                      className="relative h-40 w-full flex-shrink-0 cursor-pointer overflow-hidden sm:h-52 md:h-56"
                    >
                      <div className="absolute inset-0">
                        <Image
                          src={
                            celeb.profile_path
                              ? tmdbImage(celeb.profile_path, "w500")
                              : "/placeholder-person.svg"
                          }
                          alt={celeb.name}
                          fill
                          className="object-cover object-center"
                          sizes="(max-width: 640px) 52vw, (max-width: 768px) 40vw, (max-width: 1200px) 33vw, 256px"
                          quality={90}
                        />

                        {/* Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent opacity-85" />
                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-neutral-950 to-transparent" />
                      </div>

                      <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-md ring-1 ring-white/10">
                        {getDepartmentIcon(celeb.known_for_department)}
                        <span>{celeb.known_for_department || "Entertainment"}</span>
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 flex items-end gap-2">
                        <h3
                          className="min-w-0 flex-1 cursor-pointer text-lg font-bold leading-tight text-white line-clamp-2 transition group-hover:text-[#ff7968]"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenPerson(celeb);
                          }}
                        >
                          {celeb.name}
                        </h3>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenPerson(celeb);
                          }}
                          className="shrink-0 cursor-pointer rounded-full bg-white/10 p-2 text-white ring-1 ring-white/10 backdrop-blur-md transition hover:bg-white/20"
                          aria-label={`More info about ${celeb.name}`}
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </div>

                    </div>

                    <div className="flex flex-1 flex-col justify-between gap-3 bg-neutral-950 p-3 sm:p-4">


                      {notableWorks.length > 0 ? (
                        <div className="min-h-0">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">Known for</p>
                            <span className="h-px flex-1 bg-white/10" />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {notableWorks.slice(0, 2).map((work) => (
                              <button
                                key={`${work.media_type}-${work.id}`}
                                onClick={() => handleOpenWork(work)}
                                className="group/work min-w-0 cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-left transition hover:border-white/25 hover:bg-white/[0.08]"
                              >
                                <div className="flex gap-2">
                                  <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-gray-800">
                                    <Image
                                      src={
                                        work.poster_path
                                          ? tmdbImage(work.poster_path, "w185")
                                          : "/placeholder-poster.svg"
                                      }
                                      alt={work.title || work.name || "Known work"}
                                      fill
                                      sizes="40px"
                                      className="object-cover transition-transform duration-500 group-hover/work:scale-105"
                                    />
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <span className="block truncate text-[11px] font-semibold leading-4 text-white">
                                      {work.title || work.name}
                                    </span>
                                    <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-400">
                                      {work.media_type === "movie" ? (
                                        <Film size={10} />
                                      ) : (
                                        <Tv size={10} />
                                      )}
                                      <span>{getWorkYear(work) || (work.media_type === "movie" ? "Movie" : "TV")}</span>
                                    </div>
                                    {work.vote_average ? (
                                      <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-yellow-300">
                                        <Star size={10} fill="currentColor" />
                                        {work.vote_average.toFixed(1)}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-xs text-gray-400">
                          More credits are waiting on the profile page.
                        </div>
                      )}

                      <button
                        onClick={() => handleOpenPerson(celeb)}
                        className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-gray-950 shadow-lg shadow-black/20 transition hover:bg-gray-100"
                      >
                        View profile
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}
