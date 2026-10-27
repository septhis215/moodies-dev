"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, SlidersHorizontal } from "lucide-react";
import { CuratedShelf, CuratedShelfSkeleton } from "./CuratedShelf";
import { useAuth } from "@/app/context/AuthProvider";
import { sessionFetch } from "@/lib/auth/session";
import { handleAppError, normalizeResponseError } from "@/lib/errors";
import type { All } from "@/types/all";
import { TmdbImage } from "@/components/ui/TmdbImage";
import styles from "./FavoriteSection.module.css";

interface FavoriteSectionProps {
  data?: All[];
  title?: string;
  subtitle?: string;
  endpoint?: string;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api";
export default function FavoriteSection({
  data,
  title = "Curated for you",
  subtitle = "A shortlist for your taste. Save a story you like; we’ll find another.",
  endpoint,
}: FavoriteSectionProps) {
  const { isAuthenticated, loading: authLoading, user, watchlist } = useAuth();
  const [items, setItems] = useState<All[]>(data || []);
  const [loading, setLoading] = useState(!data);
  const [status, setStatus] = useState<"ready" | "preferences" | "error">(
    "ready",
  );
  const [retry, setRetry] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (data) {
      setItems(data);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    async function load() {
      if (retry === 0) setLoading(true);
      else setRefreshing(true);
      setStatus("ready");
      if (retry === 0) setItems([]);
      try {
        const url = endpoint || `${API_BASE}/all/favorites`;
        const options: RequestInit = {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        };
        const response = await sessionFetch(url, options);
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
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [data, endpoint, authLoading, isAuthenticated, user?.id, retry]);

  const available = useMemo(
    () =>
      items.filter(
        (item) =>
          item.type !== "person" &&
          !(
            item.type === "tv" || item.first_air_date
              ? watchlist.seriesIds
              : watchlist.movieIds
          ).has(String(item.id)),
      ),
    [items, watchlist.movieIds, watchlist.seriesIds],
  );
  if (authLoading || !isAuthenticated) return null;
  const displayName = user?.username || user?.name;
  return (
    <section
      className={`${styles.section} scroll-mt-24`}
      aria-labelledby="curated-picks-heading"
    >
      <div className={`${styles.content} ui-shell py-8 sm:py-10`}>
        <header className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--surface-border)] bg-[var(--surface-2)] text-sm font-bold text-[var(--brand-coral-strong)]"
              >
                {user?.avatarUrl ? (
                  <TmdbImage
                    src={user.avatarUrl}
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (displayName || "You").charAt(0).toUpperCase()
                )}
              </span>
              <p className="ui-kicker min-w-0 [overflow-wrap:anywhere]">
                {displayName
                  ? `Picked for ${displayName}`
                  : "Picked around your taste"}
              </p>
            </div>
            <h2
              id="curated-picks-heading"
              className="text-3xl font-bold leading-tight text-[var(--ink)] sm:text-4xl"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm leading-5 text-[var(--ink-muted)]">
              {subtitle}
            </p>
          </div>
          <Link
            href="/auth/onboarding"
            aria-label="Adjust your taste"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Adjust your taste</span>
          </Link>
        </header>
        {loading ? (
          <CuratedShelfSkeleton />
        ) : status === "error" && !available.length ? (
          <div className="rounded-lg border border-[var(--surface-border)] p-5">
            <h3 className="text-lg font-bold text-[var(--ink)]">
              Couldn’t load your mix
            </h3>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Try again to see the picks chosen for you.
            </p>
            <button
              type="button"
              className="ui-primary-action mt-3"
              disabled={refreshing}
              onClick={() => setRetry((value) => value + 1)}
            >
              {refreshing ? "Trying again…" : "Try again"}
            </button>
          </div>
        ) : !available.length && refreshing ? (
          <p role="status" className="py-8 text-sm text-[var(--ink-muted)]">
            Finding your next picks…
          </p>
        ) : !available.length ? (
          <div className="rounded-lg border border-[var(--surface-border)] p-5">
            <h3 className="text-lg font-bold text-[var(--ink)]">
              {status === "preferences"
                ? "Make this mix yours"
                : items.length
                  ? "You’ve saved this whole mix"
                  : "Let’s find your next favourite"}
            </h3>
            <p className="mt-1 text-sm leading-5 text-[var(--ink-muted)]">
              {status === "preferences"
                ? "Tell us the genres and languages you enjoy. Your personal picks will appear here."
                : "Your picks are in your watchlist. Try another mix or update your taste."}
            </p>
            <Link href="/auth/onboarding" className="ui-primary-action mt-3">
              Choose your preferences{" "}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            {status !== "preferences" && (
              <button
                type="button"
                className="ui-secondary-action mt-3 ml-2"
                onClick={() => setRetry((value) => value + 1)}
              >
                Find more picks
              </button>
            )}
          </div>
        ) : (
          <CuratedShelf
            items={available}
            onSaved={() => setRetry((value) => value + 1)}
          />
        )}
        {refreshing && available.length > 0 && (
          <p role="status" className="sr-only">
            Refreshing your picks…
          </p>
        )}
        {status === "error" && available.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--ink-muted)]">
            <p>New picks couldn’t load. Your current mix is still here.</p>
            <button
              type="button"
              className="ui-secondary-action"
              disabled={refreshing}
              onClick={() => setRetry((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
