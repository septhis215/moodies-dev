"use client";
import { useEffect, useState, useRef } from "react";
import type { All } from "@/types/all";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Film, Tv } from "lucide-react";
import { IconClock } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

// Default fetch function for backwards compatibility
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
  endpoint?: string; // Custom endpoint for fetching
}

export default function FavoritesSection({
  data,
  title = "Your Moodies Mix",
  subtitle = "A playlist of your personal faves, because your taste deserves the spotlight.",
  endpoint,
}: FavoritesSectionProps) {
  const [favorites, setFavorites] = useState<All[]>(data || []);
  const [loading, setLoading] = useState(!data);
  const carouselRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  useEffect(() => {
    // If data is passed as props, use it directly
    if (data) {
      setFavorites(data);
      setLoading(false);
      return;
    }

    // Otherwise fetch data
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

  const scroll = (direction: "left" | "right") => {
    if (!carouselRef.current) return;
    const scrollAmount = carouselRef.current.offsetWidth * 0.8;
    carouselRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!carouselRef.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
    };
    const ref = carouselRef.current;
    if (ref) {
      ref.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll();
    }
    return () => {
      if (ref) ref.removeEventListener("scroll", handleScroll);
    };
  }, [favorites]);

  if (loading) {
    return (
      <section className="relative px-6 py-6  bg-gradient-to-b from-gray-900 via-black to-gray-900">
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
    <section className="relative px-6 py-6 bg-gradient-to-b from-gray-900 via-black to-gray-900 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {title}
          </h2>
          <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
        </div>
        {/* Controls */}
        <div className="flex gap-2 mt-2 sm:mt-0">
          <button
            onClick={() => scroll("left")}
            className="px-3 py-1 rounded-full bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-30 transition-opacity"
            disabled={!canScrollLeft}
          >
            <ChevronLeft size={28} />
          </button>
          <button
            onClick={() => scroll("right")}
            className="px-3 py-1 rounded-full bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-30 transition-opacity"
            disabled={!canScrollRight}
          >
            <ChevronRight size={28} />
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div
        ref={carouselRef}
        className="flex gap-6 scroll-smooth snap-x snap-mandatory overflow-x-auto whitespace-nowrap 
               scrollbar-hide py-4"
      >
        {favorites.map((item) => (
          <div
            key={item.id}
            className="relative group flex-shrink-0 w-64 snap-start rounded-2xl overflow-hidden shadow-lg cursor-pointer"
            onClick={() => handleClick(item)}
          >
            {/* Poster */}
            <Image
              src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
              alt={item.title}
              width={342}
              height={513}
              className="w-full h-80 object-cover group-hover:scale-105 transition-transform duration-300"
            />

            {/* Overlay */}
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

            {/* Rating - Top Right */}
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

            {/* Text Info - Bottom Left */}
            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="text-lg font-bold text-white line-clamp-2">
                {item.title}
              </h3>

              {/* Genres */}
              {item.genres && item.genres.length > 0 && (
                <div className="text-xs text-blue-300 mb-1 line-clamp-1">
                  {item.genres.slice(0, 3).join(", ")}
                </div>
              )}

              {/* Release Date with Icon */}
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
    </section>
  );
}
