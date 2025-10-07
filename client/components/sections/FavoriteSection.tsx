"use client";
import { useEffect, useRef, useState } from "react";
import type { All } from "@/types/all";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Film, Tv } from "lucide-react";
import { IconClock } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

async function fetchFavorites() {
  const base = process.env.NEST_API_URL || "http://localhost:4000";
  const res = await fetch(`${base}/all/favorites`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json as All[];
}

interface FavoritesSectionProps {
  data?: All[];
  title?: string;
  subtitle?: string;
  endpoint?: string;
}

export default function FavoritesSection({
  data,
  title = "Your Moodies Mix",
  subtitle = "A playlist of your personal faves, because your taste deserves the spotlight.",
  endpoint,
}: FavoritesSectionProps) {
  const [favorites, setFavorites] = useState<All[]>(data || []);
  const [loading, setLoading] = useState(!data);
  // fractional itemsPerView for peek: 1.5, 2.5, 3.5, 4.5
  const [itemsPerView, setItemsPerView] = useState(4.5);
  const router = useRouter();

  // DOM ref for scroll container
  const containerRef = useRef<HTMLDivElement | null>(null);

  // gap in px — tailwind 'gap-6' = 1.5rem = 24px
  const GAP_PX = 24;

  // dynamic measurements
  const [itemWidthPx, setItemWidthPx] = useState<number>(0);
  const [maxScrollLeft, setMaxScrollLeft] = useState<number>(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const getContentType = (item: Partial<All>): "movie" | "tv" => {
    if ((item as any).media_type) return (item as any).media_type;
    if ((item as any).type === "movies" || (item as any).type === "movie")
      return "movie";
    if ((item as any).type === "tv") return "tv";
    if (
      (item as any).number_of_seasons ||
      (item as any).first_air_date ||
      (item as any).name
    )
      return "tv";
    return "movie";
  };

  const handleClick = async (movie: All) => {
    const contentType = getContentType(movie);
    const routePath = contentType === "tv" ? "tv" : "movies";
    const href = `/${routePath}/${movie.id}`;
    router.push(href);
  };

  // Set itemsPerView based on width (fractional values for peek)
  useEffect(() => {
    const updateLayout = () => {
      const w = window.innerWidth;
      if (w < 640) setItemsPerView(1.5);
      else if (w < 768) setItemsPerView(2.5);
      else if (w < 1024) setItemsPerView(3.5);
      else setItemsPerView(4.5);
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  // Recompute measurements whenever container size, favorites, or itemsPerView changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const compute = () => {
      const containerWidth = el.clientWidth;
      // item width formula accounts for gaps between items:
      // total gaps visible in a single row = (itemsPerView - 1) * GAP_PX
      const iw = Math.max(
        40,
        (containerWidth - Math.max(0, itemsPerView - 1) * GAP_PX) / itemsPerView
      ); // min width guard
      setItemWidthPx(iw);

      const totalWidth =
        favorites.length * iw + Math.max(0, favorites.length - 1) * GAP_PX;
      const maxScroll = Math.max(0, totalWidth - containerWidth);
      setMaxScrollLeft(maxScroll);

      const sLeft = el.scrollLeft || 0;
      setCanScrollLeft(sLeft > 5);
      setCanScrollRight(sLeft < Math.max(0, maxScroll - 5));
    };

    compute();

    // ResizeObserver to handle layout changes (images, font-size, container resize)
    const ro = new ResizeObserver(() => compute());
    ro.observe(el);

    // update on favorites change + small delay to allow images to settle
    const t = setTimeout(() => compute(), 60);

    // scroll listener to update canScroll flags
    const onScroll = () => {
      const sLeft = el.scrollLeft || 0;
      setCanScrollLeft(sLeft > 5);
      setCanScrollRight(sLeft < Math.max(0, maxScrollLeft - 5));
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      ro.disconnect();
      clearTimeout(t);
      el.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites.length, itemsPerView, maxScrollLeft]);

  // scroll step (in pixels) — stepCount brings the half peek into full view
  const stepCount = Math.max(1, Math.floor(itemsPerView - 1)); // e.g., 4.5 -> 3
  const stepPx = Math.round(stepCount * (itemWidthPx + GAP_PX));

  const scrollLeft = () => {
    const el = containerRef.current;
    if (!el) return;
    const next = Math.max(0, el.scrollLeft - stepPx);
    el.scrollTo({ left: next, behavior: "smooth" });
  };

  const scrollRight = () => {
    const el = containerRef.current;
    if (!el) return;
    const next = Math.min(maxScrollLeft, el.scrollLeft + stepPx);
    el.scrollTo({ left: next, behavior: "smooth" });
  };

  // load data
  useEffect(() => {
    if (data) {
      setFavorites(data);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        let result: All[];

        if (endpoint) {
          const base = process.env.NEST_API_URL || "http://localhost:4000";
          const res = await fetch(`${base}${endpoint}`, {
            next: { revalidate: 60 },
          });
          if (!res.ok) throw new Error("Failed to fetch");
          result = await res.json();
        } else {
          result = await fetchFavorites();
        }

        setFavorites(result);
      } catch (error) {
        console.error("Error fetching favorites:", error);
        setFavorites([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [data, endpoint]);

  if (loading) {
    return (
      <section className="relative px-6 py-6 bg-gradient-to-b from-gray-900 via-black to-gray-900">
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {title}
          </h2>
          <p className="text-gray-400 text-sm mt-1">Loading...</p>
        </div>
        <div className="flex gap-6 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-64 h-80 bg-gray-800 animate-pulse rounded-2xl"
            />
          ))}
        </div>
      </section>
    );
  }

  if (favorites.length === 0) return null;

  return (
    <section id="favorites" className="relative py-26 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-900 via-black to-gray-900 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {title}
          </h2>
          <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
        </div>
      </div>

      {/* Carousel */}
      <div className="relative group/carousel">
        {canScrollLeft && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-50 w-12 h-12 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 shadow-2xl ring-2 ring-white/10"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-50 w-12 h-12 bg-gradient-to-r from-[#e94f37] to-[#ff6b58] backdrop-blur-sm rounded-full flex items-center justify-center hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 shadow-2xl ring-2 ring-white/10"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        <div
          ref={containerRef}
          className="flex gap-6 scroll-smooth snap-x snap-mandatory scrollbar-hide overflow-x-auto whitespace-nowrap py-4"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {favorites.map((item) => (
            <div
              key={`${item.type ?? item.type}-${item.id}`}
              style={{ flex: `0 0 ${Math.max(0, itemWidthPx)}px` }}
              className="relative group snap-start rounded-2xl overflow-hidden shadow-lg cursor-pointer"
              onClick={() => handleClick(item)}
            >
              <Image
                src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                alt={item.title}
                width={342}
                height={513}
                className="w-full h-80 object-cover group-hover:scale-105 transition-transform duration-300"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>

              <div className="absolute top-3 left-3 z-20 opacity-100 group-hover:opacity-0 transition-opacity duration-300">
                <div
                  className={[
                    "flex items-center gap-1 px-2 py-0.5 rounded-lg font-medium text-xs shadow-lg backdrop-blur-md border",
                    item.type === "tv"
                      ? "bg-blue-500/90 text-white border-blue-400/50"
                      : "bg-purple-500/90 text-white border-purple-400/50",
                  ].join(" ")}
                >
                  {item.type === "tv" ? <Tv size={12} /> : <Film size={12} />}
                  {item.type === "tv" ? "Series" : "Movie"}
                </div>
              </div>

              {typeof item.vote_average === "number" && (
                <div
                  className={`absolute top-2 right-2 z-20 text-xs px-2 py-1 rounded-lg font-bold shadow
      ${item.vote_average && item.vote_average >= 7
                      ? "bg-green-500 text-white"
                      : item.vote_average && item.vote_average >= 5
                        ? "bg-yellow-400 text-black"
                        : "bg-red-500 text-white"
                    }`}
                >
                  {item.vote_average.toFixed(1)}
                </div>
              )}

              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="text-lg font-bold text-white line-clamp-2">
                  {item.title}
                </h3>

                {item.genres && item.genres.length > 0 && (
                  <div className="text-xs text-blue-300 mb-1 line-clamp-1">
                    {item.genres.slice(0, 3).join(", ")}
                  </div>
                )}

                {item.release_date && (
                  <div className="flex items-center text-xs text-gray-300 mb-1 gap-1">
                    <IconClock size={12} />
                    <span>
                      {new Date(item.release_date).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
