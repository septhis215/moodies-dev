"use client";
import { useEffect, useState } from "react";
import type { All } from "@/types/all";
import Image from "next/image";
import { ChevronRight, Film, Tv, Play, Plus, Star, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWatchlist } from "@/hooks/useWatchlist";
import { Bookmark, BookmarkCheck } from "lucide-react";
interface MoodiesMixProps {
  data?: All[];
  title?: string;
  subtitle?: string;
  endpoint?: string;
}

async function fetchFavorites(): Promise<All[]> {
  const base = process.env.NEST_API_URL || "http://localhost:4000";
  const res = await fetch(`${base}/all/favorites`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json as All[];
}

export default function MoodiesMix({
  data,
  title = "Your Moodies Mix",
  subtitle = "A playlist of your personal faves, because your taste deserves the spotlight.",
  endpoint = "/all/favorites",
}: MoodiesMixProps) {
  const [items, setItems] = useState<All[]>(data || []);
  const [loading, setLoading] = useState(!data);
  const [offset, setOffset] = useState(0);
  const router = useRouter();

  const getContentType = (item: Partial<All>): "movie" | "tv" => {
    if ((item as any).media_type) return (item as any).media_type;
    if ((item as any).type === "movies" || (item as any).type === "movie") return "movie";
    if ((item as any).type === "tv") return "tv";
    if ((item as any).number_of_seasons || (item as any).first_air_date || (item as any).name) return "tv";
    return "movie";
  };

  const handleClick = (item: All) => {
    const type = getContentType(item);
    router.push(`/${type === "tv" ? "tv" : "movies"}/${item.id}`);
  };

  const scoreColor = (s: number) =>
    s >= 7 ? "text-green-400" : s >= 5 ? "text-yellow-400" : "text-red-400";

  const scoreBg = (s: number) =>
    s >= 7 ? "bg-green-400/10" : s >= 5 ? "bg-yellow-400/10" : "bg-red-400/10";

  useEffect(() => {
    if (data) { setItems(data); setLoading(false); return; }
    const load = async () => {
      try {
        setLoading(true);
        const result = await fetchFavorites();
        setItems(Array.isArray(result) ? result : []);
      } catch { setItems([]); }
      finally { setLoading(false); }
    };
    load();
  }, [data, endpoint]);

  const { add, remove, isInWatchlist, ready } = useWatchlist();
  const [wlLoading, setWlLoading] = useState(false);

  if (items.length === 0) return null;

  const ordered = items.map((_, i) => items[(offset + i) % items.length]);
  const primary = ordered[0];
  const backdropUrl = primary.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${primary.backdrop_path}`
    : primary.poster_path
      ? `https://image.tmdb.org/t/p/w780${primary.poster_path}`
      : "/placeholder-backdrop.svg";

  const currentKind = getContentType(primary);
  const toHookType = (k: "movie" | "tv"): "movie" | "series" =>
    k === "tv" ? "series" : "movie";
  const currentInWatchlist = primary?.id
    ? isInWatchlist(String(primary.id), toHookType(currentKind))
    : false;
  const toggleWatchlist = async () => {
    if (!primary?.id) return;
    if (!ready) {
      router.push("/auth/login");
      return;
    }
    setWlLoading(true);
    try {
      const title = primary.title ?? (primary as any).name ?? null;
      const posterUrl = primary.poster_path
        ? `https://image.tmdb.org/t/p/w154${primary.poster_path}`
        : primary.backdrop_path
          ? `https://image.tmdb.org/t/p/w154${primary.backdrop_path}`
          : "/placeholder-poster.svg";

      if (currentInWatchlist) {
        await remove(String(primary.id), toHookType(currentKind), { title, posterUrl });
      } else {
        await add(String(primary.id), toHookType(currentKind), { title, posterUrl });
      }
    } catch (e) {
      console.error("Watchlist toggle failed:", e);
    } finally {
      setWlLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-4">
          <p className="text-xs font-bold tracking-widest text-[#e94f37] uppercase mb-1">Recommended for you</p>
          <div className="h-7 w-48 bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="w-full h-[340px] rounded-2xl bg-zinc-900 animate-pulse mb-3" />
        <div className="flex gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[130px] h-[110px] rounded-xl bg-zinc-900 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-6xl xl:max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <p className="text-xs font-bold tracking-widest text-[#e94f37] uppercase mb-1">
          Recommended for you
        </p>
        <h2
          className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-transparent bg-clip-text"
          style={{
            backgroundImage: "linear-gradient(to right, #e94f37, #ff6b58)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-gray-500 text-xs sm:text-sm mt-1">{subtitle}</p>
        )}

      </div>

      {/* Hero banner */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`hero-${primary.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-full rounded-2xl overflow-hidden cursor-pointer group 
aspect-[16/7] sm:aspect-[16/8] 
max-h-[240px] sm:max-h-[260px] lg:max-h-[300px]" onClick={() => handleClick(primary)}
        >
          {/* Backdrop image */}
          <Image
            src={backdropUrl}
            alt={primary.title}
            fill
            className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
            priority
          />

          {/* Scrims */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 lg:p-8">
            {/* Badges */}
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center gap-1 bg-[#e94f37]/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
                {getContentType(primary) === "tv" ? <Tv size={10} /> : <Film size={10} />}
                {getContentType(primary) === "tv" ? "Series" : "Movie"}
              </span>
              {typeof primary.vote_average === "number" && (
                <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${scoreColor(primary.vote_average)} ${scoreBg(primary.vote_average)}`}>
                  <Star size={10} className="fill-current" />
                  {primary.vote_average.toFixed(1)}
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white leading-tight mb-2 max-w-lg">
              {primary.title}
            </h3>

            {/* Genres + year */}
            <div className="flex flex-wrap gap-2 mb-3">
              {(primary.release_date || primary.first_air_date) && (
                <span className="text-[11px] bg-[#e94f37]/20 text-[#e94f37] font-semibold px-2 py-0.5 rounded-full">
                  {(primary.release_date || primary.first_air_date || "").split("-")[0]}
                </span>
              )}
              {primary.genres?.slice(0, 3).map((g) => (
                <span key={g} className="text-[11px] bg-white/10 text-gray-300 font-medium px-2 py-0.5 rounded-full">
                  {g}
                </span>
              ))}
            </div>

            {/* Overview */}
            {primary.overview && (
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed line-clamp-2 max-w-md sm:max-w-lg mb-4">
                {primary.overview}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <button
                className="flex items-center gap-1 bg-[#e94f37] hover:bg-[#ff5a42] transition-colors text-white text-[11px] sm:text-xs font-bold px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg"
                onClick={(e) => { e.stopPropagation(); handleClick(primary); }}
              >
                <Info size={12} />
                More Info
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleWatchlist(); }}
                disabled={wlLoading}
                className={`flex items-center gap-1 text-[11px] sm:text-xs font-bold px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg border transition-colors ${currentInWatchlist
                  ? "bg-emerald-500/90 text-white border-emerald-400/50 hover:bg-emerald-600"
                  : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                  }`}
              >
                {wlLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                ) : currentInWatchlist ? (
                  <><BookmarkCheck size={12} /> Added</>
                ) : (
                  <><Bookmark size={12} /> My List</>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Queue strip */}
      <div className="flex gap-3.5 mt-3 overflow-x-auto scrollbar-hide pb-1">
        {ordered.map((item, i) => {
          const isActive = i === 0;
          const thumb = item.backdrop_path
            ? `https://image.tmdb.org/t/p/w185${item.backdrop_path}`
            : "/placeholder-backdrop.svg";

          return (
            <motion.div
              key={`${item.id}-${(offset + i) % items.length}`}
              layout
              whileTap={{ scale: 0.97 }}
              onClick={() => { setOffset((offset + i) % items.length); }}
              className={`flex-shrink-0 w-[130px] rounded-xl overflow-hidden cursor-pointer transition-all border-2 ${isActive
                ? "border-[#e94f37]"
                : "border-transparent hover:border-white/20"
                }`}
            >
              {/* Thumb */}
              <div className="relative w-full h-[76px]">
                <Image
                  src={thumb}
                  alt={item.title}
                  fill
                  className="object-cover"
                />
                {isActive && (
                  <div className="absolute inset-0 bg-[#e94f37]/20" />
                )}
              </div>
              {/* Info */}
              <div className="bg-zinc-900 px-2 py-1.5">
                <p className="text-[11px] font-semibold text-white truncate">{item.title}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] text-gray-500">{item.year || (item.release_date || "").split("-")[0]}</span>
                  {typeof item.vote_average === "number" && (
                    <span className={`text-[10px] font-bold ${scoreColor(item.vote_average)}`}>
                      {item.vote_average.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between mt-3">
        {/* Progress dots */}
        <div className="flex gap-1">
          {items.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${i === offset ? "w-5 bg-[#e94f37]" : "w-1 bg-white/15"
                }`}
            />
          ))}
        </div>
        {/* Next */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setOffset((prev) => (prev + 1) % items.length)}
          className="flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-xs font-semibold text-white px-3 py-2 rounded-lg"
        >
          Up next
          <ChevronRight size={14} className="text-[#e94f37]" />
        </motion.button>

      </div>
    </section>
  );
}