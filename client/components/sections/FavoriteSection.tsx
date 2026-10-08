"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, SlidersHorizontal } from "lucide-react";
import { CuratedShelf, CuratedShelfSkeleton } from "./CuratedShelf";
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
export default function FavoriteSection({
  data,
  title = "Curated for you",
  subtitle = "Movies and series shaped by your taste.",
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
  const displayName = user?.username || user?.name;
  return (
    <section
      className="scroll-mt-24 overflow-hidden border-b border-[var(--surface-border)] bg-[var(--surface-0)]"
      aria-labelledby="curated-picks-heading"
    >
      <div className="ui-shell py-6 sm:py-8">
        <header className="mb-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className="mb-1 break-words text-xs font-semibold text-[var(--brand-coral-strong)]">
              {displayName
                ? `Picked for ${displayName}`
                : "Picked around your taste"}
            </p>
            <h2
              id="curated-picks-heading"
              className="text-2xl font-bold leading-tight text-[var(--ink)] sm:text-3xl"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm leading-5 text-[var(--ink-muted)]">
              {subtitle}
            </p>
          </div>
          <Link
            href="/auth/onboarding"
            className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Adjust
            your taste
          </Link>
        </header>
        {loading ? (
          <CuratedShelfSkeleton />
        ) : status === "error" ? (
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
              onClick={() => setRetry((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : !available.length ? (
          <div className="rounded-lg border border-[var(--surface-border)] p-5">
            <h3 className="text-lg font-bold text-[var(--ink)]">
              {status === "preferences"
                ? "Make this mix yours"
                : "Let’s find your next favourite"}
            </h3>
            <p className="mt-1 text-sm leading-5 text-[var(--ink-muted)]">
              {status === "preferences"
                ? "Tell us the genres and languages you enjoy. Your personal picks will appear here."
                : "Update your preferences to discover more movies and series for your taste."}
            </p>
            <Link href="/auth/onboarding" className="ui-primary-action mt-3">
              Choose your preferences{" "}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <CuratedShelf items={available} />
        )}
        {!loading && available.length > 0 && (
          <Link
            href="/watchlist"
            className="mt-1 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
          >
            <Bookmark className="h-3.5 w-3.5" aria-hidden="true" /> Your
            watchlist <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}
