"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Film,
  Info,
  Languages,
  Play,
  Plus,
  Star,
  Tv,
} from "lucide-react";
import type { All } from "@/types/all";
import { tmdbImage } from "@/lib/tmdb";
import { useWatchlist } from "@/hooks/useWatchlist";
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

type TasteSignal = {
  topGenres: string[];
  topCountries: string[];
  averageRating: number | null;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
async function fetchFavorites(
  token: string,
  endpoint?: string,
): Promise<All[]> {
  try {
    const res = await fetch(endpoint || `${API_BASE}/all/favorites`, {
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

function getContentType(item: FavoriteContent): "movie" | "tv" {
  if (item.media_type) return item.media_type;
  if (item.type === "movies" || item.type === "movie") return "movie";
  if (item.type === "tv") return "tv";
  if (item.number_of_seasons || item.first_air_date || item.name) return "tv";
  return "movie";
}

function getTitle(item: All) {
  return item.title || item.name || "Untitled pick";
}

function getYear(item: All) {
  return (
    item.year ||
    item.release_date?.split("-")[0] ||
    item.first_air_date?.split("-")[0] ||
    null
  );
}

function getBackdrop(item: All) {
  return (
    tmdbImage(item.backdrop_path || item.poster_path, "w1280") ||
    "/placeholder-backdrop.svg"
  );
}

function getPoster(item: All, size: "w154" | "w342" | "w500" = "w342") {
  return (
    tmdbImage(item.poster_path || item.backdrop_path, size) ||
    "/placeholder-poster.svg"
  );
}

function countValues(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function topValues(values: string[], limit: number) {
  return Object.entries(countValues(values))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function buildTasteSignal(items: All[]): TasteSignal {
  const genres = items.flatMap((item) => item.genres || []);
  const countries = items.flatMap((item) => item.origin_country || []);
  const ratings = items
    .map((item) => item.vote_average)
    .filter((rating): rating is number => typeof rating === "number");

  return {
    topGenres: topValues(genres, 4),
    topCountries: topValues(countries, 3),
    averageRating: ratings.length
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : null,
  };
}

function getMatchScore(item: All, signal: TasteSignal, saved: boolean) {
  let score = 78;

  if (saved) score += 8;
  if (item.genres?.some((genre) => signal.topGenres.includes(genre)))
    score += 8;
  if (
    item.origin_country?.some((country) =>
      signal.topCountries.includes(country),
    )
  ) {
    score += 4;
  }
  if (typeof item.vote_average === "number" && item.vote_average >= 7.5) {
    score += 4;
  }

  return Math.min(score, 98);
}

function getShortReason(item: All, signal: TasteSignal, saved: boolean) {
  const matchedGenre = item.genres?.find((genre) =>
    signal.topGenres.includes(genre),
  );
  const matchedCountry = item.origin_country?.find((country) =>
    signal.topCountries.includes(country),
  );

  if (saved) return "From your saved list";
  if (matchedGenre) return `Matches ${matchedGenre}`;
  if (matchedCountry) return `${matchedCountry} preference`;
  if (typeof item.vote_average === "number" && item.vote_average >= 7.5) {
    return "Highly rated nearby";
  }
  return "Expands your taste";
}

function toWatchType(item: All): "movie" | "series" {
  return getContentType(item) === "tv" ? "series" : "movie";
}

export default function MoodiesMix({
  data,
  title = "Your curated picks",
  subtitle = "A compact Moodies shelf shaped by your genres, saves, languages, and recent taste signals.",
  endpoint,
}: MoodiesMixProps) {
  const [items, setItems] = useState<All[]>(data || []);
  const [loading, setLoading] = useState(!data);
  const [offset, setOffset] = useState(0);
  const [loadingStates, setLoadingStates] = useState<Record<number, boolean>>(
    {},
  );
  const [token, setToken] = useState<string | null>(null);

  const router = useRouter();
  const { add, remove, isInWatchlist } = useWatchlist();

  useEffect(() => {
    setToken(sGet("authToken") ?? "");
  }, []);

  const isAuthenticated = token !== null && token !== "";

  useEffect(() => {
    if (data) {
      setItems(data);
      setLoading(false);
      return;
    }

    if (token === null) return;

    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);

      try {
        const result = await fetchFavorites(token, endpoint);
        setItems(Array.isArray(result) ? result : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [data, endpoint, token, isAuthenticated]);

  const ordered = useMemo(
    () => items.map((_, index) => items[(offset + index) % items.length]),
    [items, offset],
  );

  const tasteSignal = useMemo(() => buildTasteSignal(items), [items]);
  const primary = ordered[0];

  const handleClick = (item: All) => {
    const type = getContentType(item);
    router.push(`/${type === "tv" ? "tv" : "movies"}/${item.id}`);
  };

  const toggleWatchlist = async (item: All) => {
    if (!item?.id) return;

    setLoadingStates((prev) => ({ ...prev, [item.id]: true }));

    try {
      const title = getTitle(item);
      const posterUrl = getPoster(item, "w154");
      const saved = isInWatchlist(String(item.id), toWatchType(item));

      if (saved) {
        await remove(String(item.id), toWatchType(item), { title, posterUrl });
      } else {
        await add(String(item.id), toWatchType(item), { title, posterUrl });
      }
    } catch (error) {
      console.error("Watchlist toggle failed:", error);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  if (token === null) return null;

  if (!isAuthenticated) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <CuratedGuestPanel routerPush={router.push} />
      </section>
    );
  }

  if (loading) {
    return <FavoriteLoadingState />;
  }

  if (!primary || items.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <EmptyTasteState routerPush={router.push} />
      </section>
    );
  }

  const primarySaved = isInWatchlist(String(primary.id), toWatchType(primary));
  const primaryMatch = getMatchScore(primary, tasteSignal, primarySaved);
  const visibleCards = ordered.slice(1, 7);

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#ff8b78]">
            For your taste
          </p>
          <h2 className="text-xl font-black tracking-normal text-[#e94f37] sm:text-2xl lg:text-3xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 max-w-2xl text-sm leading-6 text-white/50">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-3">
          {/* <TasteSummary signal={tasteSignal} count={items.length} /> */}
          <button
            type="button"
            onClick={() => setOffset((prev) => (prev + 1) % items.length)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-xs font-black text-white/78 transition hover:bg-white/[0.1]"
          >
            Refresh the mix
            <ChevronRight className="h-4 w-4 text-[#e94f37]" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-2.5 sm:p-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(300px,0.42fr)_minmax(0,1fr)]">
          <article className="group grid overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0d] sm:grid-cols-[170px_minmax(0,1fr)] lg:grid-cols-1">
            <button
              type="button"
              onClick={() => handleClick(primary)}
              className="relative min-h-[174px] overflow-hidden bg-zinc-900 sm:min-h-full lg:h-[168px]"
              aria-label={`Open ${getTitle(primary)}`}
            >
              <Image
                src={getBackdrop(primary)}
                alt={getTitle(primary)}
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover transition duration-500 group-hover:scale-[1.03]"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/24 to-transparent" />
              <div className="absolute left-3 top-3 rounded-full bg-black/64 px-2.5 py-1 text-[11px] font-black text-white">
                {primaryMatch}% match
              </div>
            </button>

            <div className="p-3.5 lg:p-4">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <ContentTypeBadge item={primary} />
                {getYear(primary) ? (
                  <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-bold text-white/58">
                    {getYear(primary)}
                  </span>
                ) : null}
                {typeof primary.vote_average === "number" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#f6b73c]/10 px-2.5 py-1 text-[11px] font-bold text-[#ffd78a]">
                    <Star className="h-3 w-3 fill-current" />
                    {primary.vote_average.toFixed(1)}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => handleClick(primary)}
                className="line-clamp-2 text-left text-lg font-black leading-tight text-white transition group-hover:text-[#ff9b8a] sm:text-xl"
              >
                {getTitle(primary)}
              </button>

              <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/54">
                {getShortReason(primary, tasteSignal, primarySaved)}
              </p>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {primary.genres?.slice(0, 3).map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-white/54"
                  >
                    {genre}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleClick(primary)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#e94f37] px-4 py-2 text-xs font-black text-white transition hover:bg-[#ff5a42]"
                >
                  <Info className="h-3.5 w-3.5" />
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => toggleWatchlist(primary)}
                  disabled={loadingStates[primary.id]}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.06] px-4 py-2 text-xs font-black text-white/78 transition hover:bg-white/[0.1]"
                >
                  {loadingStates[primary.id] ? (
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/60 border-t-transparent motion-safe:animate-spin" />
                  ) : primarySaved ? (
                    <BookmarkCheck className="h-3.5 w-3.5" />
                  ) : (
                    <Bookmark className="h-3.5 w-3.5" />
                  )}
                  {primarySaved ? "Saved" : "Save"}
                </button>
              </div>
            </div>
          </article>

          <div className="grid gap-2.5 sm:grid-cols-2 xl:gap-3">
            {visibleCards.map((item, index) => {
              const saved = isInWatchlist(String(item.id), toWatchType(item));
              return (
                <PersonalPickCard
                  key={`${item.id}-${index}`}
                  item={item}
                  signal={tasteSignal}
                  saved={saved}
                  loading={!!loadingStates[item.id]}
                  onOpen={() => handleClick(item)}
                  onToggle={() => toggleWatchlist(item)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function TasteSummary({
  signal,
  count,
}: {
  signal: TasteSignal;
  count: number;
}) {
  const labels = [
    ...signal.topGenres.slice(0, 2),
    ...signal.topCountries.slice(0, 1),
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3 sm:min-w-[260px]">
      <div className="flex items-center gap-3">
        <div className="h-9 w-1.5 shrink-0 rounded-full bg-[#e94f37]" />
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#ff9b8a]">
            Taste profile
          </p>
          <p className="mt-0.5 text-xs font-semibold text-white/58">
            Based on {count} favorite{count === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {(labels.length ? labels : ["Popular", "Highly rated"]).map((label) => (
          <span
            key={label}
            className="rounded-full bg-black/24 px-2 py-1 text-[10px] font-bold text-white/56"
          >
            {label}
          </span>
        ))}
        {signal.averageRating ? (
          <span className="rounded-full bg-[#f6b73c]/10 px-2 py-1 text-[10px] font-bold text-[#ffd78a]">
            Avg {signal.averageRating.toFixed(1)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ContentTypeBadge({ item }: { item: All }) {
  const type = getContentType(item);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#e94f37]/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#ff9b8a]">
      {type === "tv" ? (
        <Tv className="h-3 w-3" />
      ) : (
        <Film className="h-3 w-3" />
      )}
      {type === "tv" ? "Series" : "Movie"}
    </span>
  );
}

function PersonalPickCard({
  item,
  signal,
  saved,
  loading,
  onOpen,
  onToggle,
}: {
  item: All;
  signal: TasteSignal;
  saved: boolean;
  loading: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const match = getMatchScore(item, signal, saved);
  const shortReason = getShortReason(item, signal, saved);

  return (
    <article className="group grid grid-cols-[58px_minmax(0,1fr)] gap-2.5 rounded-xl border border-white/10 bg-[#101012] p-2 transition hover:border-[#e94f37]/30 hover:bg-white/[0.055] sm:grid-cols-[64px_minmax(0,1fr)]">
      <button
        type="button"
        onClick={onOpen}
        className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900"
        aria-label={`Open ${getTitle(item)}`}
      >
        <Image
          src={getPoster(item, "w342")}
          alt={getTitle(item)}
          fill
          sizes="120px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute left-1 top-1 rounded-full bg-black/72 px-1.5 py-0.5 text-[8px] font-black text-white">
          {match}%
        </div>
      </button>

      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-1 overflow-hidden">
          <ContentTypeBadge item={item} />
          {item.origin_country?.[0] ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/[0.055] px-1.5 py-0.5 text-[9px] font-bold text-white/50">
              <Languages className="h-2.5 w-2.5" />
              {item.origin_country[0]}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="line-clamp-2 text-left text-[13px] font-black leading-tight text-white transition group-hover:text-[#ff9b8a] sm:text-sm"
        >
          {getTitle(item)}
        </button>

        <p className="mt-1 line-clamp-1 text-[10px] font-semibold leading-4 text-[#ff9b8a]/76">
          {shortReason}
        </p>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-1">
            {item.genres?.slice(0, 1).map((genre) => (
              <span
                key={genre}
                className="truncate rounded-full bg-black/24 px-1.5 py-0.5 text-[9px] font-semibold text-white/42"
              >
                {genre}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggle}
            disabled={loading}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-black/24 text-white/64 transition hover:bg-white/10 hover:text-white"
            aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}
          >
            {loading ? (
              <span className="h-3 w-3 rounded-full border-2 border-white/60 border-t-transparent motion-safe:animate-spin" />
            ) : saved ? (
              <BookmarkCheck className="h-3.5 w-3.5 text-emerald-300" />
            ) : (
              <Bookmark className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

function FavoriteLoadingState() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-col gap-2">
        <div className="h-4 w-28 animate-pulse rounded-full bg-[#e94f37]/16" />
        <div className="h-7 w-64 max-w-full animate-pulse rounded bg-zinc-900" />
        <div className="h-4 w-full max-w-lg animate-pulse rounded bg-zinc-900/80" />
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(300px,0.42fr)_minmax(0,1fr)]">
          <div className="h-[300px] animate-pulse rounded-xl bg-zinc-900" />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {[...Array(6)].map((_, index) => (
              <div
                key={index}
                className="h-[92px] animate-pulse rounded-xl bg-zinc-900"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CuratedGuestPanel({
  routerPush,
}: {
  routerPush: (href: string) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0b0b0c] p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <p className="mb-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#e94f37]">
            Popular picks to learn your taste
          </p>
          <h2 className="max-w-2xl text-xl font-black leading-tight text-white sm:text-2xl">
            Sign in for a quieter, more personal mix.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/56">
            Sign in to unlock recommendations shaped by your favorite genres,
            saved titles, and languages.
          </p>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {["Trending now", "Highly rated", "Easy starters"].map((label) => (
              <span
                key={label}
                className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold text-white/54"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={() => routerPush("/auth/login")}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#e94f37] px-4 py-2 text-xs font-black text-white transition hover:bg-[#ff5a42]"
          >
            <Play className="h-3.5 w-3.5 fill-white" />
            Sign in
          </button>
          <button
            type="button"
            onClick={() => routerPush("/auth/signup")}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.06] px-4 py-2 text-xs font-black text-white/78 transition hover:bg-white/[0.1]"
          >
            <Plus className="h-3.5 w-3.5" />
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyTasteState({
  routerPush,
}: {
  routerPush: (href: string) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0b] p-4 sm:p-5">
      <div className="max-w-2xl">
        <p className="mb-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#e94f37]">
          Popular picks to help us learn your taste
        </p>
        <h2 className="text-xl font-black text-white sm:text-2xl">
          Your personal mix is almost ready.
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/58">
          Save or favorite a few titles and Moodies will turn them into a
          sharper recommendation lane with genre, language, and mood reasoning.
        </p>
        <button
          type="button"
          onClick={() => routerPush("/moods/explore")}
          className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#e94f37] px-4 py-2 text-xs font-black text-white transition hover:bg-[#ff5a42]"
        >
          Explore moods
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
