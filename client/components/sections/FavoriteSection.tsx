"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, BookmarkCheck, ChevronRight, Star } from "lucide-react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { useAuth } from "@/app/context/AuthProvider";
import { useWatchlist } from "@/hooks/useWatchlist";
import { handleAppError, normalizeResponseError } from "@/lib/errors";
import { tmdbImage } from "@/lib/tmdb";
import type { All } from "@/types/all";

interface FavoriteSectionProps {
  data?: All[];
  title?: string;
  subtitle?: string;
  endpoint?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
function mediaType(item: All): "movie" | "tv" {
  return item.type === "tv" || item.first_air_date ? "tv" : "movie";
}
function titleOf(item: All) {
  return item.title || item.name || "Untitled pick";
}
function hrefOf(item: All) {
  return `/${mediaType(item) === "tv" ? "tv" : "movies"}/${item.id}`;
}
function PickMeta({ item }: { item: All }) {
  const year = item.year || (item.release_date || item.first_air_date)?.split("-")[0];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ink-muted)]">
      <span>{mediaType(item) === "tv" ? "Series" : "Movie"}</span>
      {year && <span>{year}</span>}
      {typeof item.vote_average === "number" && item.vote_average > 0 && (
        <span className="inline-flex items-center gap-1 text-[var(--brand-gold)]" aria-label={`TMDB rating ${item.vote_average.toFixed(1)} out of 10`}>
          <Star className="h-3.5 w-3.5" aria-hidden="true" />{item.vote_average.toFixed(1)}
        </span>
      )}
    </div>
  );
}

export default function FavoriteSection({
  data,
  title = "Curated for you",
  subtitle = "A personal mix of movies and series, chosen for your favourite genres and languages.",
  endpoint,
}: FavoriteSectionProps) {
  const { isAuthenticated, loading: authLoading, refreshSession, logoutSilent, user } = useAuth();
  const { add, remove, isInWatchlist } = useWatchlist();
  const [items, setItems] = useState<All[]>(data || []);
  const [loading, setLoading] = useState(!data);
  const [status, setStatus] = useState<"ready" | "preferences" | "error">("ready");
  const [retry, setRetry] = useState(0);
  const [offset, setOffset] = useState(0);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (data) {
      setItems(data);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setStatus("ready");
      setItems([]);
      setOffset(0);
      try {
        const url = endpoint || `${API_BASE}/all/favorites`;
        const options: RequestInit = { credentials: "include", cache: "no-store", signal: controller.signal };
        let response = await fetch(url, options);
        if (response.status === 401 || response.status === 498) {
          if (await refreshSession()) response = await fetch(url, options);
          if (controller.signal.aborted) return;
          if (response.status === 401 || response.status === 498) {
            logoutSilent();
            return;
          }
        }
        if (response.status === 400) {
          if (!controller.signal.aborted) setStatus("preferences");
          return;
        }
        if (!response.ok) throw await normalizeResponseError(response);
        const result = await response.json();
        if (!Array.isArray(result)) throw new Error("Invalid curated picks response");
        if (!controller.signal.aborted) setItems(result);
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatus("error");
        handleAppError(error, {
          fallbackMessage: "Could not load your curated picks. Please try again.",
          toastTitle: "Curated for you",
          toastKey: "curated-picks-error",
        });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [data, endpoint, authLoading, isAuthenticated, user?.id, retry, refreshSession, logoutSilent]);

  async function toggleSave(item: All) {
    const type = mediaType(item) === "tv" ? "series" : "movie";
    const key = `${type}-${item.id}`;
    if (saving[key]) return;
    setSaving((prev) => ({ ...prev, [key]: true }));
    const meta = { title: titleOf(item), posterUrl: tmdbImage(item.poster_path, "w154") };
    try {
      if (isInWatchlist(String(item.id), type)) await remove(String(item.id), type, meta);
      else await add(String(item.id), type, meta);
    } catch {
      // The watchlist hook owns rollback and the shared error toast.
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  }

  function saveButton(item: All, compact = false) {
    const type = mediaType(item) === "tv" ? "series" : "movie";
    const saved = isInWatchlist(String(item.id), type);
    const busy = !!saving[`${type}-${item.id}`];
    return (
      <button type="button" disabled={busy} onClick={() => void toggleSave(item)}
        aria-label={`${saved ? "Remove" : "Save"} ${titleOf(item)} ${saved ? "from" : "to"} your watchlist`} aria-pressed={saved}
        className={`${compact ? "grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[var(--surface-border)] bg-[var(--surface-1)] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]" : "ui-secondary-action"} disabled:cursor-wait disabled:opacity-60`}>
        {saved ? <BookmarkCheck className="h-4 w-4" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}
        {!compact && (busy ? "Updating…" : saved ? "Saved" : "Save to watchlist")}
      </button>
    );
  }

  if (authLoading || !isAuthenticated) return null;
  const ordered = items.length ? items.map((_, index) => items[(index + offset) % items.length]) : [];
  const [featured, ...more] = ordered;
  return (
    <section className="ui-shell border-b border-[var(--surface-border)] py-8 sm:py-10" aria-labelledby="curated-picks-heading">
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="ui-kicker">Your Moodies mix</p>
          <h2 id="curated-picks-heading" className="mt-2 text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">{subtitle}</p>
        </div>
        <Link href="/auth/onboarding" className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]">Edit your taste <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </header>
      {loading ? (
        <div role="status" aria-label="Loading your curated picks" className="ui-panel h-80 motion-safe:animate-pulse" />
      ) : status === "error" ? (
        <div className="ui-panel p-5 sm:p-7">
          <h3 className="text-xl font-bold text-[var(--ink)]">Couldn’t load your mix</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Try again to see the picks chosen for you.</p>
          <button type="button" className="ui-primary-action mt-4" onClick={() => setRetry((value) => value + 1)}>Try again</button>
        </div>
      ) : !featured ? (
        <div className="ui-panel flex items-start gap-4 p-5 sm:p-7">
          <Image src="/images/moods/sci-fi.png" alt="Sci-Fi mood mascot" width={80} height={80} unoptimized className="h-16 w-16 shrink-0 object-contain sm:h-20 sm:w-20" />
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-[var(--ink)]">{status === "preferences" ? "Make this mix yours" : "Your next favourites are on their way"}</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">{status === "preferences" ? "Choose your favourite genres and languages so we can find stories for your taste." : "Try updating your genres and languages, or explore a mood while we find more picks."}</p>
            <Link href="/auth/onboarding" className="ui-primary-action mt-4">Choose your preferences <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </div>
      ) : (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <article className="ui-panel min-w-0 overflow-hidden">
            <Link href={hrefOf(featured)} className="group relative block aspect-video overflow-hidden bg-[var(--surface-2)]" aria-label={`Explore ${titleOf(featured)}`}>
              <Image src={tmdbImage(featured.backdrop_path || featured.poster_path, "w1280") || "/placeholder-backdrop.svg"} alt={titleOf(featured)} fill sizes="(max-width: 1023px) 100vw, 640px" className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-105" />
            </Link>
            <div className="p-5 sm:p-6">
              <p className="ui-kicker">Start with this one</p>
              <h3 className="mt-3 text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl"><Link href={hrefOf(featured)}>{titleOf(featured)}</Link></h3>
              <div className="mt-2"><PickMeta item={featured} /></div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--ink-muted)]">{featured.overview || "Explore this pick to see its cast, trailers and community reviews."}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={hrefOf(featured)} className="ui-primary-action">Explore this pick <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                {saveButton(featured)}
              </div>
            </div>
          </article>
          {more.length > 0 && (
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-[var(--ink)]">More for your taste</h3>
                <button type="button" onClick={() => setOffset((value) => (value + 1) % items.length)} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]">Next picks <ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
              </div>
              <div className="mobile-native-scroll flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-1">
                {more.slice(0, 4).map((item) => (
                  <article key={`${mediaType(item)}-${item.id}`} className="ui-panel flex w-[88%] min-w-0 shrink-0 snap-start gap-3 p-3 sm:w-auto">
                    <Link href={hrefOf(item)} className="relative block aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-sm bg-[var(--surface-2)]" aria-label={`Explore ${titleOf(item)}`}>
                      <Image src={tmdbImage(item.poster_path, "w342") || "/placeholder-poster.svg"} alt={titleOf(item)} fill sizes="64px" className="object-cover" />
                    </Link>
                    <div className="min-w-0 flex-1 self-center">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)]"><Link href={hrefOf(item)}>{titleOf(item)}</Link></h3>
                      <div className="mt-2"><PickMeta item={item} /></div>
                      {item.genres?.length ? <p className="mt-2 line-clamp-1 text-xs text-[var(--ink-muted)]">{item.genres.slice(0, 2).join(" · ")}</p> : null}
                    </div>
                    <div className="self-center">{saveButton(item, true)}</div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
