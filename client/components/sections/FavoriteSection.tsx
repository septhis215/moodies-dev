"use client";
import { useEffect, useState } from "react";
import type { All } from "@/types/all";
import Image from "next/image";
import {
  ChevronRight,
  Film,
  Tv,
  Play,
  Plus,
  Star,
  Info,
  Sparkles,
  Heart,
  Clapperboard,
} from "lucide-react";
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

type FavoriteContent = Omit<Partial<All>, "type"> & {
  media_type?: "movie" | "tv";
  type?: All["type"] | "movies";
};

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

  const [token, setToken] = useState<string | null>(null);

  const router = useRouter();
  const { add, remove, isInWatchlist } = useWatchlist();

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

  const getContentType = (item: FavoriteContent): "movie" | "tv" => {
    if (item.media_type) return item.media_type;
    if (item.type === "movies" || item.type === "movie") return "movie";
    if (item.type === "tv") return "tv";
    if (item.number_of_seasons || item.first_air_date || item.name) return "tv";
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

  if (token === null) return null;

  if (!isAuthenticated) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-10 lg:px-8 xl:max-w-7xl">
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
          className="relative flex w-full items-stretch overflow-hidden rounded-xl border border-white/10 bg-[#090909] shadow-2xl shadow-black/30 sm:min-h-[286px] sm:rounded-2xl"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(233,79,55,0.22),transparent_30%),radial-gradient(circle_at_78%_20%,rgba(245,158,11,0.16),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_34%)]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ff8b78]/60 to-transparent" />
            <div className="absolute -right-12 top-8 h-40 w-40 rounded-full border border-[#e94f37]/20" />
            <div className="absolute -right-5 top-20 h-24 w-24 rounded-full border border-white/10" />
            <div className="absolute bottom-0 right-0 hidden h-full w-[46%] bg-[linear-gradient(90deg,transparent,rgba(233,79,55,0.08))] sm:block" />
          </div>

          <div className="absolute inset-0 bg-gradient-to-br from-[#090909] via-[#090909]/90 to-[#090909]/55 pointer-events-none sm:bg-gradient-to-r sm:from-[#090909] sm:via-[#090909]/78 sm:to-[#090909]/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10 flex w-full flex-col justify-center px-4 py-6 sm:max-w-[58%] sm:px-10 sm:py-8">

            {/* Headline */}
            <h3 className="mb-2 max-w-[13ch] text-2xl font-extrabold leading-tight text-white sm:text-3xl lg:text-[2.25rem]">
              Movies picked{" "}
              <span className="bg-gradient-to-r from-[#ff8b78] to-[#f59e0b] bg-clip-text text-transparent">
                just for you
              </span>
            </h3>

            {/* Subline */}
            <p className="mb-5 max-w-md text-sm leading-6 text-white/60">
              Sign in to unlock a cinematic mix shaped by your favorite moods,
              genres, and saved titles.
            </p>

            <div className="mb-5 flex flex-wrap gap-2">
              {["Cozy", "Thrilling", "Funny", "Epic"].map((mood, i) => (
                <span
                  key={mood}
                  className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold text-white/75"
                  style={{
                    boxShadow:
                      i === 1
                        ? "inset 0 0 0 1px rgba(233,79,55,0.28)"
                        : undefined,
                  }}
                >
                  {mood}
                </span>
              ))}
            </div>

            {/* Perks */}
            <ul className="mb-6 flex flex-col gap-2">
              {[
                "Daily picks tuned to your watch history",
                "Mood-aware movie routes for any night",
                "One tap to save and keep watching later",
              ].map((perk) => (
                <li
                  key={perk}
                  className="flex items-center gap-2.5 text-xs text-white/60"
                >
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
          <div className="absolute bottom-0 right-3 top-0 z-10 hidden items-center justify-center sm:flex lg:right-10">
            <div className="relative h-[238px] w-[248px]">
              {/* Back poster */}
              <div
                className="absolute h-[172px] w-[116px] overflow-hidden rounded-xl border border-white/15 shadow-2xl shadow-black/45"
                style={{
                  right: 4,
                  top: 32,
                  transform: "rotate(8deg)",
                  zIndex: 1,
                  background: "linear-gradient(145deg,#30140f,#b14332)",
                }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),transparent_36%),linear-gradient(to_top,rgba(0,0,0,0.7),transparent_55%)]" />
                <div className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-black/35 text-white ring-1 ring-white/15">
                  <Heart size={15} />
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/45">
                    Mood
                  </p>
                  <p className="mt-1 truncate text-sm font-black text-white">
                    Cozy
                  </p>
                </div>
              </div>
              {/* Middle poster */}
              <div
                className="absolute h-[172px] w-[116px] overflow-hidden rounded-xl border border-white/15 shadow-2xl shadow-black/45"
                style={{
                  left: 12,
                  top: 40,
                  transform: "rotate(-6deg)",
                  zIndex: 2,
                  background: "linear-gradient(145deg,#111827,#0f766e)",
                }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.18),transparent_36%),linear-gradient(to_top,rgba(0,0,0,0.7),transparent_55%)]" />
                <div className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-black/35 text-white ring-1 ring-white/15">
                  <Film size={15} />
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/45">
                    Mood
                  </p>
                  <p className="mt-1 truncate text-sm font-black text-white">
                    Thrill
                  </p>
                </div>
              </div>
              {/* Front poster — highlighted */}
              <div
                className="absolute h-[172px] w-[116px] overflow-hidden rounded-xl border border-[#e94f37]/45 shadow-2xl shadow-black/55"
                style={{
                  left: 64,
                  top: 4,
                  transform: "rotate(1deg)",
                  zIndex: 3,
                  background:
                    "linear-gradient(145deg,#240b08,#e94f37 62%,#f59e0b)",
                }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.2),transparent_36%),linear-gradient(to_top,rgba(0,0,0,0.68),transparent_55%)]" />
                <div className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-black/35 text-white ring-1 ring-white/15">
                  <Clapperboard size={15} />
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/55">
                    Mood
                  </p>
                  <p className="mt-1 truncate text-sm font-black text-white">
                    Your mix
                  </p>
                </div>
              </div>
              {/* Floating badge */}
              <div className="absolute bottom-8 left-0 z-20 flex items-center gap-2 rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-white shadow-2xl shadow-black/50 backdrop-blur">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e94f37]">
                  <Star size={14} className="fill-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                    Match ready
                  </p>
                  <p className="text-xs font-black">1,000+ titles</p>
                </div>
              </div>
              <div className="absolute bottom-0 right-4 z-20 rounded-full border border-[#e94f37]/35 bg-[#e94f37]/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#ff8b78]">
                Members only
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
            <div
              key={i}
              className="h-[96px] w-[116px] flex-shrink-0 animate-pulse rounded-xl bg-zinc-900 sm:h-[110px] sm:w-[130px]"
            />
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
  const toHookType = (k: "movie" | "tv"): "movie" | "series" =>
    k === "tv" ? "series" : "movie";
  const currentInWatchlist = primary?.id
    ? isInWatchlist(String(primary.id), toHookType(currentKind))
    : false;

  const toggleWatchlist = async () => {
    if (!primary?.id) return;
    setWlLoading(true);
    try {
      const title = primary.title ?? primary.name ?? null;
      const posterUrl = primary.poster_path
        ? `https://image.tmdb.org/t/p/w154${primary.poster_path}`
        : primary.backdrop_path
          ? `https://image.tmdb.org/t/p/w154${primary.backdrop_path}`
          : "/placeholder-poster.svg";

      if (currentInWatchlist) {
        await remove(String(primary.id), toHookType(currentKind), {
          title,
          posterUrl,
        });
      } else {
        await add(String(primary.id), toHookType(currentKind), {
          title,
          posterUrl,
        });
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
        {subtitle && (
          <p className="mt-2 max-w-[34ch] text-sm leading-5 text-gray-500 sm:max-w-none">
            {subtitle}
          </p>
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
          className="group relative min-h-[430px] w-full cursor-pointer overflow-hidden rounded-xl border border-white/10 sm:aspect-[16/8] sm:min-h-0 sm:max-h-[260px] sm:rounded-2xl lg:max-h-[300px]"
          onClick={() => handleClick(primary)}
        >
          <Image
            src={backdropUrl}
            alt={primary.title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent sm:bg-gradient-to-r sm:from-black/70 sm:via-black/30 sm:to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 lg:p-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex items-center gap-1 bg-[#e94f37]/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
                {getContentType(primary) === "tv" ? (
                  <Tv size={10} />
                ) : (
                  <Film size={10} />
                )}
                {getContentType(primary) === "tv" ? "Series" : "Movie"}
              </span>
              {typeof primary.vote_average === "number" && (
                <span
                  className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${scoreColor(primary.vote_average)} ${scoreBg(primary.vote_average)}`}
                >
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
                  {
                    (
                      primary.release_date ||
                      primary.first_air_date ||
                      ""
                    ).split("-")[0]
                  }
                </span>
              )}
              {primary.genres?.slice(0, 3).map((g) => (
                <span
                  key={g}
                  className="text-[11px] bg-white/10 text-gray-300 font-medium px-2 py-0.5 rounded-full"
                >
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick(primary);
                }}
              >
                <Info size={12} />
                More Info
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWatchlist();
                }}
                disabled={wlLoading}
                className={`flex items-center justify-center gap-1 rounded-lg border px-3 py-3 text-[11px] font-bold transition-colors sm:px-4 sm:py-2.5 sm:text-xs ${
                  currentInWatchlist
                    ? "bg-emerald-500/90 text-white border-emerald-400/50 hover:bg-emerald-600"
                    : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                }`}
              >
                {wlLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                ) : currentInWatchlist ? (
                  <>
                    <BookmarkCheck size={12} /> Added
                  </>
                ) : (
                  <>
                    <Bookmark size={12} /> My List
                  </>
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
                <Image
                  src={thumb}
                  alt={item.title}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
                {isActive && (
                  <div className="absolute inset-0 bg-[#e94f37]/20" />
                )}
              </div>
              <div className="bg-zinc-900 px-2 py-1.5">
                <p className="text-[11px] font-semibold text-white truncate">
                  {item.title}
                </p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] text-gray-500">
                    {item.year || (item.release_date || "").split("-")[0]}
                  </span>
                  {typeof item.vote_average === "number" && (
                    <span
                      className={`text-[10px] font-bold ${scoreColor(item.vote_average)}`}
                    >
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
