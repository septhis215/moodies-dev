"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  SlidersHorizontal,
  Star,
} from "lucide-react";
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

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
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
  const year =
    item.year || (item.release_date || item.first_air_date)?.split("-")[0];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ink-muted)]">
      <span>{mediaType(item) === "tv" ? "Series" : "Movie"}</span>
      {year && <span>{year}</span>}
      {typeof item.vote_average === "number" && item.vote_average > 0 && (
        <span
          className="inline-flex items-center gap-1 text-[var(--brand-gold)]"
          aria-label={`TMDB rating ${item.vote_average.toFixed(1)} out of 10`}
        >
          <Star className="h-3.5 w-3.5" aria-hidden="true" />
          {item.vote_average.toFixed(1)}
        </span>
      )}
    </div>
  );
}

export default function FavoriteSection({
  data,
  title = "Curated for you",
  subtitle = "Movies and series picked around the genres and languages you love.",
  endpoint,
}: FavoriteSectionProps) {
  const {
    isAuthenticated,
    loading: authLoading,
    refreshSession,
    logoutSilent,
    user,
  } = useAuth();
  const { add, remove, isInWatchlist } = useWatchlist();
  const [items, setItems] = useState<All[]>(data || []);
  const [loading, setLoading] = useState(!data);
  const [status, setStatus] = useState<"ready" | "preferences" | "error">(
    "ready",
  );
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<"all" | "movie" | "tv">("all");
  const [visibleCount, setVisibleCount] = useState(6);
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
      setFilter("all");
      setVisibleCount(6);
      try {
        const url = endpoint || `${API_BASE}/all/favorites`;
        const options: RequestInit = {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        };
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
        if (!Array.isArray(result))
          throw new Error("Invalid curated picks response");
        if (!controller.signal.aborted) setItems(result);
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatus("error");
        handleAppError(error, {
          fallbackMessage:
            "Could not load your curated picks. Please try again.",
          toastTitle: "Curated for you",
          toastKey: "curated-picks-error",
        });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [
    data,
    endpoint,
    authLoading,
    isAuthenticated,
    user?.id,
    retry,
    refreshSession,
    logoutSilent,
  ]);

  async function toggleSave(item: All) {
    const type = mediaType(item) === "tv" ? "series" : "movie";
    const key = `${type}-${item.id}`;
    if (saving[key]) return;
    setSaving((prev) => ({ ...prev, [key]: true }));
    const meta = {
      title: titleOf(item),
      posterUrl: tmdbImage(item.poster_path, "w154"),
    };
    try {
      if (isInWatchlist(String(item.id), type))
        await remove(String(item.id), type, meta);
      else await add(String(item.id), type, meta);
    } catch {
      // The watchlist hook owns rollback and the shared error toast.
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  }

  function saveButton(item: All) {
    const type = mediaType(item) === "tv" ? "series" : "movie";
    const saved = isInWatchlist(String(item.id), type);
    const busy = !!saving[`${type}-${item.id}`];
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggleSave(item)}
        aria-label={`${saved ? "Remove" : "Save"} ${titleOf(item)} ${saved ? "from" : "to"} your watchlist`}
        aria-pressed={saved}
        title={
          busy
            ? "Updating watchlist…"
            : saved
              ? "Remove from watchlist"
              : "Save to watchlist"
        }
        className={`absolute right-2 top-2 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/75 shadow-sm transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)] disabled:cursor-wait disabled:opacity-60 ${saved ? "text-[var(--brand-coral-strong)]" : "text-white"}`}
      >
        {saved ? (
          <BookmarkCheck className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Bookmark className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    );
  }

  if (authLoading || !isAuthenticated) return null;
  const available = items.filter((item) => item.type !== "person");
  const filtered = available.filter(
    (item) => filter === "all" || mediaType(item) === filter,
  );
  const filters = [
    { value: "all", label: "All picks" },
    { value: "movie", label: "Movies" },
    { value: "tv", label: "Series" },
  ] as const;
  return (
    <section
      className="ui-shell scroll-mt-24 border-b border-[var(--surface-border)] py-8 sm:py-10"
      aria-labelledby="curated-picks-heading"
    >
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="ui-kicker">Made for your taste</p>
          <h2
            id="curated-picks-heading"
            className="mt-2 text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
          >
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
            {subtitle}
          </p>
        </div>
        <Link
          href="/auth/onboarding"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-md border border-[var(--surface-border)] px-3 text-sm font-semibold text-[var(--ink-muted)] transition-colors hover:border-[var(--ink-muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)]"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Adjust
          your taste
        </Link>
      </header>
      {loading ? (
        <div role="status" aria-label="Loading your curated picks">
          <span className="sr-only">Finding your picks…</span>
          <div
            aria-hidden="true"
            className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-6"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="motion-safe:animate-pulse">
                <div className="aspect-[2/3] rounded-lg bg-[var(--surface-2)]" />
                <div className="mt-3 h-4 w-4/5 rounded bg-[var(--surface-2)]" />
                <div className="mt-2 h-3 w-1/2 rounded bg-[var(--surface-2)]" />
              </div>
            ))}
          </div>
        </div>
      ) : status === "error" ? (
        <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-1)] p-6 sm:p-8">
          <h3 className="text-xl font-bold text-[var(--ink)]">
            Couldn’t load your mix
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            Try again to see the picks chosen for you.
          </p>
          <button
            type="button"
            className="ui-primary-action mt-4"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      ) : !available.length ? (
        <div className="flex flex-col gap-5 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-1)] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="min-w-0 max-w-xl">
            <h3 className="text-xl font-bold text-[var(--ink)]">
              {status === "preferences"
                ? "Make this mix yours"
                : "Let’s find your next favourite"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              {status === "preferences"
                ? "Tell us the genres and languages you enjoy. Your personal picks will appear here."
                : "Update your preferences to discover more movies and series for your taste."}
            </p>
          </div>
          <Link
            href="/auth/onboarding"
            className="ui-primary-action shrink-0 self-start"
          >
            Choose your preferences{" "}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-5 flex min-w-0 items-center justify-between gap-3 border-b border-[var(--surface-border)]">
            <div
              role="group"
              aria-label="Filter your curated picks"
              className="flex min-w-0 gap-4 sm:gap-6"
            >
              {filters.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => {
                    setFilter(value);
                    setVisibleCount(6);
                  }}
                  className={`min-h-12 whitespace-nowrap border-b-2 px-0.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)] ${filter === value ? "border-[var(--brand-coral-strong)] text-[var(--ink)]" : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p
              aria-live="polite"
              aria-atomic="true"
              className="shrink-0 text-xs text-[var(--ink-muted)]"
            >
              {filtered.length} {filtered.length === 1 ? "pick" : "picks"}
            </p>
          </div>
          {filtered.length ? (
            <ul
              aria-label="Your personalised recommendations"
              className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5 xl:grid-cols-6"
            >
              {filtered.slice(0, visibleCount).map((item) => (
                <li key={`${mediaType(item)}-${item.id}`} className="min-w-0">
                  <article>
                    <div className="relative">
                      <Link
                        href={hrefOf(item)}
                        className="group relative block aspect-[2/3] overflow-hidden rounded-lg bg-[var(--surface-2)] ring-1 ring-inset ring-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral-strong)]"
                        aria-label={`Explore ${titleOf(item)}`}
                      >
                        <Image
                          src={
                            tmdbImage(item.poster_path, "w500") ||
                            "/placeholder-poster.svg"
                          }
                          alt={titleOf(item)}
                          fill
                          sizes="(max-width: 639px) 50vw, (max-width: 1279px) 33vw, 210px"
                          className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
                        />
                      </Link>
                      {saveButton(item)}
                    </div>
                    <h3 className="mt-3 min-h-10 line-clamp-2 text-sm font-semibold leading-5 text-[var(--ink)]">
                      <Link
                        href={hrefOf(item)}
                        className="transition-colors hover:text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
                      >
                        {titleOf(item)}
                      </Link>
                    </h3>
                    <div className="mt-1">
                      <PickMeta item={item} />
                    </div>
                    {item.genres?.length ? (
                      <p className="mt-2 line-clamp-1 text-xs leading-5 text-[var(--ink-muted)]">
                        {item.genres.slice(0, 2).join(" · ")}
                      </p>
                    ) : null}
                  </article>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center">
              <h3 className="text-base font-semibold text-[var(--ink)]">
                No {filter === "tv" ? "series" : "movies"} in this mix yet
              </h3>
              <p className="mt-2 text-sm text-[var(--ink-muted)]">
                Browse all picks or adjust your preferences for a different mix.
              </p>
              <button
                type="button"
                className="ui-secondary-action mt-4"
                onClick={() => {
                  setFilter("all");
                  setVisibleCount(6);
                }}
              >
                Show all picks
              </button>
            </div>
          )}
          <footer className="mt-6 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-[var(--surface-border)] pt-4">
            <Link
              href="/watchlist"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
            >
              <Bookmark className="h-4 w-4" aria-hidden="true" /> Your watchlist{" "}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            {filtered.length > visibleCount && (
              <button
                type="button"
                onClick={() => setVisibleCount((value) => value + 6)}
                className="ui-secondary-action"
              >
                More picks <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </footer>
        </>
      )}
    </section>
  );
}
