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
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-10 lg:px-8 xl:max-w-7xl">
        {/* Header */}
        <div className="mb-5">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[#e94f37]">
            Recommended for you
          </p>
          <h2
            className="bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-2xl lg:text-3xl"
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
          className="relative flex w-full items-stretch overflow-hidden rounded-xl border border-white/10 bg-[#0e0e0e] sm:min-h-[260px] sm:rounded-2xl"
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
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a]/95 via-[#0a0a0a]/85 to-[#0a0a0a]/45 pointer-events-none sm:bg-gradient-to-r sm:from-[#0a0a0a]/95 sm:via-[#0a0a0a]/75 sm:to-transparent" />
          {/* Bottom scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/50 via-transparent to-transparent pointer-events-none" />

          {/* ── Left: copy + CTA ── */}
          <div className="relative z-10 flex w-full flex-col justify-center px-4 py-6 sm:max-w-[58%] sm:px-10 sm:py-8">
            {/* Eyebrow pill */}
            <div className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-[#e94f37]/30 bg-[#e94f37]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#e94f37]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e94f37]" />
              Members only
            </div>

            {/* Headline */}
            <h3 className="mb-2 text-2xl font-extrabold leading-tight text-white sm:text-3xl lg:text-[2rem]">
              Movies picked{" "}
              <span className="text-[#e94f37]">just for you</span>
            </h3>

            {/* Subline */}
            <p className="mb-5 max-w-sm text-sm leading-6 text-white/55">
              Sign in to unlock recommendations built around your taste — your genres, your vibe, your watchlist.
            </p>

            {/* Perks */}
            <ul className="mb-6 flex flex-col gap-2">
              {[
                "Personalised picks refreshed daily",
                "Save titles to your watchlist",
                "Sync across all your devices",
              ].map((perk) => (
                <li key={perk} className="flex items-center gap-2.5 text-xs text-white/60">
                  <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#e94f37]/15">
                    <span className="h-[5px] w-[5px] rounded-full bg-[#e94f37]" />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>

            {/* CTAs */}
            <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
              <button
                onClick={() => router.push("/auth/login")}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#e94f37] px-4 py-3 text-xs font-bold text-white transition-all hover:bg-[#ff5a42] active:scale-[0.98] sm:rounded-xl sm:px-5 sm:py-2.5 sm:text-sm"
              >
                <Play size={13} className="fill-white" />
                Sign in free
              </button>
              <button
                onClick={() => router.push("/auth/signup")}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.08] px-4 py-3 text-xs font-semibold text-white/80 transition-all hover:bg-white/[0.14] active:scale-[0.98] sm:rounded-xl sm:px-5 sm:py-2.5 sm:text-sm"
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
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-4">
          <p className="text-xs font-bold tracking-widest text-[#e94f37] uppercase mb-1">
            Recommended for you
          </p>
          <div className="h-7 w-48 bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="mb-3 h-[360px] w-full animate-pulse rounded-xl bg-zinc-900 sm:h-[340px] sm:rounded-2xl" />
        <div className="flex gap-3 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-[96px] w-[116px] flex-shrink-0 animate-pulse rounded-xl bg-zinc-900 sm:h-[110px] sm:w-[130px]" />
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
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-10 lg:px-8 xl:max-w-7xl">
      {/* Header */}
      <div className="mb-5">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[#e94f37]">
          Recommended for you
        </p>
        <h2
          className="bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-2xl lg:text-3xl"
          style={{
            backgroundImage: "linear-gradient(to right, #e94f37, #ff6b58)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {title}
        </h2>
        {subtitle && <p className="mt-2 max-w-[34ch] text-sm leading-5 text-gray-500 sm:max-w-none">{subtitle}</p>}
      </div>

      {/* Hero banner */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`hero-${primary.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="group relative min-h-[430px] w-full cursor-pointer overflow-hidden rounded-xl border border-white/10 sm:aspect-[16/8] sm:min-h-0 sm:max-h-[260px] sm:rounded-2xl lg:max-h-[300px]"
          onClick={() => handleClick(primary)}
        >
          <Image
            src={backdropUrl}
            alt={primary.title}
            fill
            className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent sm:bg-gradient-to-r sm:from-black/70 sm:via-black/30 sm:to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 lg:p-8">
            <div className="mb-3 flex items-center gap-2">
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

            <h3 className="mb-2 max-w-lg text-2xl font-extrabold leading-tight text-white sm:text-2xl lg:text-3xl">
              {primary.title}
            </h3>

            <div className="mb-3 flex flex-wrap gap-2">
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
              <p className="mb-4 line-clamp-3 max-w-md text-sm leading-6 text-gray-300 sm:line-clamp-2 sm:max-w-lg">
                {primary.overview}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <button
                className="flex items-center justify-center gap-1 rounded-lg bg-[#e94f37] px-3 py-3 text-[11px] font-bold text-white transition-colors hover:bg-[#ff5a42] sm:px-4 sm:py-2.5 sm:text-xs"
                onClick={(e) => { e.stopPropagation(); handleClick(primary); }}
              >
                <Info size={12} />
                More Info
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleWatchlist(); }}
                disabled={wlLoading}
                className={`flex items-center justify-center gap-1 rounded-lg border px-3 py-3 text-[11px] font-bold transition-colors sm:px-4 sm:py-2.5 sm:text-xs ${currentInWatchlist
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
      <div className="scrollbar-hide mt-3 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-3.5 [&::-webkit-scrollbar]:hidden">
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
              className={`w-[116px] flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-all sm:w-[130px] sm:rounded-xl ${isActive ? "border-[#e94f37]" : "border-transparent hover:border-white/20"}`}
            >
              <div className="relative h-[68px] w-full sm:h-[76px]">
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
      <div className="mt-3 flex items-center justify-between">
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
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-white/10"
        >
          Up next
          <ChevronRight size={14} className="text-[#e94f37]" />
        </motion.button>
      </div>
    </section>
  );
}
