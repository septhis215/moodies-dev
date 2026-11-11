"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CuratedShelf, CuratedShelfSkeleton } from "./CuratedShelf";
import SectionHeader from "@/components/ui/SectionHeader";
import { useAuth } from "@/app/context/AuthProvider";
import { sessionFetch } from "@/lib/auth/session";
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
  subtitle,
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
      className="ui-shell scroll-mt-24 border-b border-[var(--surface-border)] py-8 sm:py-10"
      aria-labelledby="curated-picks-heading"
    >
      <SectionHeader
        id="curated-picks-heading"
        title={title}
        description={subtitle}
        eyebrow={displayName ? `Picked for ${displayName}` : undefined}
        href={status === "preferences" ? undefined : "/auth/onboarding"}
        linkLabel="Adjust your taste"
        className="mb-5"
      />
      {loading ? (
        <CuratedShelfSkeleton />
      ) : status === "error" && !available.length ? (
        <div className="rounded-lg border border-[var(--surface-border)] p-5">
          <h3 className="text-lg font-bold text-[var(--ink)]">
            Couldn’t load your picks
          </h3>
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
              ? "Choose your tastes"
              : items.length
                ? "All picks saved"
                : "No picks available"}
          </h3>
          {status === "preferences" ? (
            <Link href="/auth/onboarding" className="ui-primary-action mt-3">
              Choose your preferences
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <button
              type="button"
              className="ui-secondary-action mt-3"
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
    </section>
  );
}
