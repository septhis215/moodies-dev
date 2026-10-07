"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, SlidersHorizontal } from "lucide-react";
import CardCarousel from "./CardCarousel";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { useAuth } from "@/app/context/AuthProvider";
import { handleAppError, normalizeResponseError } from "@/lib/errors";
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
export default function FavoriteSection({
  data,
  title = "Curated for you",
  subtitle = "A little familiar. A little unexpected. Movies and series picked around your taste.",
  endpoint,
}: FavoriteSectionProps) {
  const {
    isAuthenticated,
    loading: authLoading,
    refreshSession,
    logoutSilent,
    user,
  } = useAuth();
  const [items, setItems] = useState<All[]>(data || []);
  const [loading, setLoading] = useState(!data);
  const [status, setStatus] = useState<"ready" | "preferences" | "error">(
    "ready",
  );
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<"all" | "movie" | "tv">("all");
  const [visibleCount, setVisibleCount] = useState(6);

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

  if (authLoading || !isAuthenticated) return null;
  const available = items.filter((item) => item.type !== "person");
  const filtered = available.filter(
    (item) => filter === "all" || mediaType(item) === filter,
  );
  const mixGenres = Array.from(
    new Set(available.flatMap((item) => item.genres ?? [])),
  ).slice(0, 3);
  const displayName = user?.username || user?.name;
  const filters = [
    { value: "all", label: "All picks" },
    { value: "movie", label: "Movies" },
    { value: "tv", label: "Series" },
  ] as const;
  return (
    <section
      className="relative isolate scroll-mt-24 overflow-hidden border-b border-[var(--surface-border)] bg-[var(--surface-1)]"
      aria-labelledby="curated-picks-heading"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_100%_0%,rgba(230,182,92,0.14),transparent_50%),radial-gradient(ellipse_at_0%_100%,rgba(240,100,75,0.08),transparent_60%)]"
      />
      <div className="ui-shell py-8 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--surface-border)] pb-4">
          <p className="ui-kicker">Your next good watch</p>
          <Link
            href="/quiz"
            className="group inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] sm:text-sm"
          >
            Your film personality
            <ArrowRight
              aria-hidden="true"
              className="h-4 w-4 text-[var(--brand-coral-strong)] transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
            />
          </Link>
        </div>
        <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2
              id="curated-picks-heading"
              className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
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
          <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
            <aside
              className="relative border-l-2 border-[var(--brand-coral)] pl-5 lg:pt-2"
              aria-label="About your personal mix"
            >
              <div className="flex items-center gap-4 lg:flex-col lg:items-start">
                <Image
                  src="/images/moods/cozy.png"
                  alt="Cozy mood mascot"
                  width={112}
                  height={112}
                  unoptimized
                  className="h-20 w-20 shrink-0 object-contain lg:h-28 lg:w-28"
                />
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-[var(--brand-coral-strong)]">
                    {displayName
                      ? `Picked for ${displayName}`
                      : "Picked around your taste"}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold leading-tight text-[var(--ink)]">
                    Your kind of stories.
                  </h3>
                  <p className="mt-3 hidden max-w-sm text-sm leading-6 text-[var(--ink-muted)] lg:block">
                    Your favourite genres and languages set the direction. These
                    picks give you somewhere to start.
                  </p>
                </div>
              </div>
              {mixGenres.length ? (
                <div className="mt-3 lg:mt-5 lg:border-t lg:border-[var(--surface-border)] lg:pt-4">
                  <p className="text-xs text-[var(--ink-muted)]">In your mix</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ink)]">
                    {mixGenres.join(" · ")}
                  </p>
                </div>
              ) : null}
            </aside>
            <div className="min-w-0">
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
                <CardCarousel
                  title={title}
                  items={filtered.slice(0, visibleCount)}
                  sectionId="curated-picks-rail"
                  embedded
                />
              ) : (
                <div className="py-8 text-center">
                  <h3 className="text-base font-semibold text-[var(--ink)]">
                    No {filter === "tv" ? "series" : "movies"} in this mix yet
                  </h3>
                  <p className="mt-2 text-sm text-[var(--ink-muted)]">
                    Browse all picks or adjust your preferences for a different
                    mix.
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
                  <Bookmark className="h-4 w-4" aria-hidden="true" /> Your
                  watchlist{" "}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                {filtered.length > visibleCount && (
                  <button
                    type="button"
                    onClick={() => setVisibleCount((value) => value + 6)}
                    className="ui-secondary-action"
                  >
                    More picks{" "}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </footer>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
