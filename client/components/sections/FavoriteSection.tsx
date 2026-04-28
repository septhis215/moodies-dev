"use client";
import { useEffect, useState } from "react";
import type { All } from "@/types/all";
import Image from "next/image";
import { ChevronRight, Film, Tv, Play, Plus, Star, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWatchlist } from "@/hooks/useWatchlist";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { sGet } from "@/utils/secureStorage";

interface MoodiesMixProps {
  data?: All[];
  title?: string;
  subtitle?: string;
  endpoint?: string;
}

async function fetchFavorites(token: string): Promise<All[]> {
  const base = process.env.NEXT_PUBLIC_NEST_API_URL || "http://localhost:4000";

  try {
    const res = await fetch(`${base}/all/favorites`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      console.error("Favorites fetch failed:", res.status, res.statusText);
      return [];
    }
    return (await res.json()) as All[];
  } catch (err) {
    console.error("Failed to fetch favorites:", err);
    return [];
  }
}

export default function MoodiesMix({
  data,
  title = "Your Moodies Mix",
  subtitle = "A playlist of your personal faves, because your taste deserves the spotlight.",
}: MoodiesMixProps) {
  const [items, setItems] = useState<All[]>(data || []);
  const [loading, setLoading] = useState(!data);
  const [offset, setOffset] = useState(0);
  const [wlLoading, setWlLoading] = useState(false);

  // Derive auth state from token — this is the single source of truth.
  // `null`  = not yet resolved (hydrating)
  // `""`    = resolved, guest
  // `"xyz"` = resolved, authenticated
  const [token, setToken] = useState<string | null>(null);

  const router = useRouter();
  const { ready, add, remove, isInWatchlist } = useWatchlist();

  // Resolve token once on mount (client-only)
  useEffect(() => {
    const t = sGet("authToken") ?? "";
    setToken(t);
  }, []);

  const isAuthenticated = token !== null && token !== "";

  // Fetch favorites only when we have a confirmed token
  useEffect(() => {
    if (data) {
      setItems(data);
      setLoading(false);
      return;
    }

    // Still resolving token — wait
    if (token === null) return;

    // Guest — nothing to fetch
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    // Authenticated — safe to fetch
    const load = async () => {
      setLoading(true);
      try {
        const result = await fetchFavorites(token);
        setItems(Array.isArray(result) ? result : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [data, token, isAuthenticated]);

  // ─── Helpers ────────────────────────────────────────────────────────────────

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

  // ─── State: hydrating (token not yet read) ──────────────────────────────────
  if (token === null) return null;

  // ─── State: guest ───────────────────────────────────────────────────────────
  if (!isAuthenticated) {
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
        </div>

        {/* Banner */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative w-full rounded-2xl overflow-hidden bg-[#0e0e0e] min-h-[220px] sm:min-h-[260px] flex items-stretch"
        >
          {/* Tiled mood-grid background */}
          <div className="absolute inset-0 grid grid-cols-5 gap-[3px] opacity-20 pointer-events-none">
            {[
              "#1e1e2e", "#2a1a0e", "#0e1a2a", "#1a0e1a", "#0e1e0e",
              "#2a0e0e", "#1e2a0e", "#0e2a1a", "#2a1e0e", "#1a1a1a",
              "#0e1a1e", "#2a0e1a", "#1e0e2a", "#0e2e0e", "#2e1a0e",
            ].map((bg, i) => (
              <div key={i} className="rounded-sm" style={{ background: bg }} />
            ))}
          </div>

          {/* Left-to-right scrim */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/95 via-[#0a0a0a]/75 to-transparent pointer-events-none" />
          {/* Bottom scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/50 via-transparent to-transparent pointer-events-none" />

          {/* ── Left: copy + CTA ── */}
          <div className="relative z-10 flex flex-col justify-center px-6 sm:px-10 py-8 w-full sm:max-w-[58%]">
            {/* Eyebrow pill */}
            <div className="inline-flex items-center gap-1.5 bg-[#e94f37]/15 border border-[#e94f37]/30 text-[#e94f37] text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full w-fit mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e94f37]" />
              Members only
            </div>

            {/* Headline */}
            <h3 className="text-2xl sm:text-3xl lg:text-[2rem] font-extrabold text-white leading-tight mb-2">
              Movies picked{" "}
              <span className="text-[#e94f37]">just for you</span>
            </h3>

            {/* Subline */}
            <p className="text-xs sm:text-sm text-white/50 leading-relaxed mb-5 max-w-sm">
              Sign in to unlock recommendations built around your taste — your genres, your vibe, your watchlist.
            </p>

            {/* Perks */}
            <ul className="flex flex-col gap-2 mb-6">
              {[
                "Personalised picks refreshed daily",
                "Save titles to your watchlist",
                "Sync across all your devices",
              ].map((perk) => (
                <li key={perk} className="flex items-center gap-2.5 text-[11px] sm:text-xs text-white/55">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[#e94f37]/15 flex items-center justify-center">
                    <span className="w-[5px] h-[5px] rounded-full bg-[#e94f37]" />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>

            {/* CTAs */}
            <div className="flex gap-2.5 flex-wrap">
              <button
                onClick={() => router.push("/auth/login")}
                className="flex cursor-pointer items-center gap-2 bg-[#e94f37] hover:bg-[#ff5a42] active:scale-[0.98] transition-all text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl"
              >
                <Play size={13} className="fill-white" />
                Sign in free
              </button>
              <button
                onClick={() => router.push("/auth/signup")}
                className="flex cursor-pointer items-center gap-2 bg-white/8 hover:bg-white/14 active:scale-[0.98] transition-all border border-white/15 text-white/80 text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl"
              >
                <Plus size={13} />
                Create account
              </button>
            </div>
          </div>

          {/* ── Right: poster stack (hidden on very small screens) ── */}
          <div className="absolute right-6 sm:right-10 top-0 bottom-0 hidden sm:flex items-center justify-center z-10">
            <div className="relative w-[170px] h-[210px]">
              {/* Back poster */}
              <div
                className="absolute w-[108px] h-[158px] rounded-xl border-2 border-white/10 overflow-hidden"
                style={{ right: 0, top: 14, transform: "rotate(8deg)", zIndex: 1, background: "linear-gradient(135deg,#1a1a2e,#0f3460)" }}
              >
                <div className="flex items-center justify-center h-full">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Drama</span>
                </div>
              </div>
              {/* Middle poster */}
              <div
                className="absolute w-[108px] h-[158px] rounded-xl border-2 border-white/10 overflow-hidden"
                style={{ left: 0, top: 22, transform: "rotate(-5deg)", zIndex: 2, background: "linear-gradient(135deg,#2d1b00,#8b4513)" }}
              >
                <div className="flex items-center justify-center h-full">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Thriller</span>
                </div>
              </div>
              {/* Front poster — highlighted */}
              <div
                className="absolute w-[108px] h-[158px] rounded-xl border-2 overflow-hidden"
                style={{ left: 30, top: 8, transform: "rotate(1deg)", zIndex: 3, borderColor: "rgba(233,79,55,0.45)", background: "linear-gradient(135deg,#1a0a0a,#6b0000)", boxShadow: "0 8px 32px rgba(0,0,0,0.55)" }}
              >
                <div className="flex items-center justify-center h-full">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Your mix</span>
                </div>
              </div>
              {/* Floating badge */}
              <div
                className="absolute left-1/2 -translate-x-1/2 -bottom-3 bg-[#e94f37] text-white text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap z-20"
                style={{ boxShadow: "0 2px 12px rgba(233,79,55,0.45)" }}
              >
                1,000+ titles waiting
              </div>
            </div>
          </div>
        </motion.div>
      </section>
    );
  }

  // ─── State: authenticated, loading ──────────────────────────────────────────
  if (loading) {
    return (
      <section className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-4">
          <p className="text-xs font-bold tracking-widest text-[#e94f37] uppercase mb-1">
            Recommended for you
          </p>
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

  // ─── State: authenticated, no favourites ────────────────────────────────────
  if (items.length === 0) return null;

  // ─── State: authenticated, has favourites ───────────────────────────────────
  const ordered = items.map((_, i) => items[(offset + i) % items.length]);
  const primary = ordered[0];

  const backdropUrl = primary.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${primary.backdrop_path}`
    : primary.poster_path
      ? `https://image.tmdb.org/t/p/w780${primary.poster_path}`
      : "/placeholder-backdrop.svg";

  const currentKind = getContentType(primary);
  const toHookType = (k: "movie" | "tv"): "movie" | "series" => (k === "tv" ? "series" : "movie");
  const currentInWatchlist = primary?.id ? isInWatchlist(String(primary.id), toHookType(currentKind)) : false;

  const toggleWatchlist = async () => {
    if (!primary?.id) return;
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
        {subtitle && <p className="text-gray-500 text-xs sm:text-sm mt-1">{subtitle}</p>}
      </div>

      {/* Hero banner */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`hero-${primary.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-full rounded-2xl overflow-hidden cursor-pointer group aspect-[16/7] sm:aspect-[16/8] max-h-[240px] sm:max-h-[260px] lg:max-h-[300px]"
          onClick={() => handleClick(primary)}
        >
          <Image
            src={backdropUrl}
            alt={primary.title}
            fill
            className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 lg:p-8">
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

            <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white leading-tight mb-2 max-w-lg">
              {primary.title}
            </h3>

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

            {primary.overview && (
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed line-clamp-2 max-w-md sm:max-w-lg mb-4">
                {primary.overview}
              </p>
            )}

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
              onClick={() => setOffset((offset + i) % items.length)}
              className={`flex-shrink-0 w-[130px] rounded-xl overflow-hidden cursor-pointer transition-all border-2 ${isActive ? "border-[#e94f37]" : "border-transparent hover:border-white/20"}`}
            >
              <div className="relative w-full h-[76px]">
                <Image src={thumb} alt={item.title} fill className="object-cover" />
                {isActive && <div className="absolute inset-0 bg-[#e94f37]/20" />}
              </div>
              <div className="bg-zinc-900 px-2 py-1.5">
                <p className="text-[11px] font-semibold text-white truncate">{item.title}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] text-gray-500">
                    {item.year || (item.release_date || "").split("-")[0]}
                  </span>
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
        <div className="flex gap-1">
          {items.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${i === offset ? "w-5 bg-[#e94f37]" : "w-1 bg-white/15"}`}
            />
          ))}
        </div>
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