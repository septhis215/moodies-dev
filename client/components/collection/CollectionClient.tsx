"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Library, LogIn } from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import { useLiked } from "@/hooks/useLiked";
import { useWatchlist } from "@/hooks/useWatchlist";
import { fetchMediaSummaries, type MediaSummary } from "@/lib/mediaApi";
import MediaCard, { MediaCardSkeleton } from "@/components/ui/MediaCard";
import SectionHeader from "@/components/ui/SectionHeader";

type CollectionTab = "all" | "watchlist" | "liked";

export default function CollectionClient() {
  const { isAuthenticated, loading: authLoading, watchlist, liked } = useAuth();
  const watchlistActions = useWatchlist();
  const likedActions = useLiked();
  const [tab, setTab] = useState<CollectionTab>("all");
  const [items, setItems] = useState<MediaSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const collectionIds = useMemo(() => {
    const values = [
      ...Array.from(watchlist.movieIds).map((id) => ({
        kind: "movie" as const,
        id,
      })),
      ...Array.from(watchlist.seriesIds).map((id) => ({
        kind: "tv" as const,
        id,
      })),
      ...Array.from(liked.movieIds).map((id) => ({
        kind: "movie" as const,
        id,
      })),
      ...Array.from(liked.seriesIds).map((id) => ({ kind: "tv" as const, id })),
    ];

    const seen = new Set<string>();
    return values
      .filter((item) => {
        const key = `${item.kind}:${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 48);
  }, [
    watchlist.movieIds,
    watchlist.seriesIds,
    liked.movieIds,
    liked.seriesIds,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchMediaSummaries(collectionIds, { cache: "no-store" }).then(
      (nextItems) => {
        if (!cancelled) {
          setItems(nextItems);
          setLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [collectionIds, isAuthenticated]);

  const visibleItems = useMemo(() => {
    if (tab === "watchlist") {
      return items.filter((item) =>
        watchlistActions.isInWatchlist(
          item.id,
          item.kind === "tv" ? "series" : "movie",
        ),
      );
    }
    if (tab === "liked") {
      return items.filter((item) =>
        likedActions.isLiked(item.id, item.kind === "tv" ? "series" : "movie"),
      );
    }
    return items;
  }, [items, tab, watchlistActions, likedActions]);

  const counts = {
    all: collectionIds.length,
    watchlist: watchlist.movieIds.size + watchlist.seriesIds.size,
    liked: liked.movieIds.size + liked.seriesIds.size,
  };

  const tabs = [
    { key: "all" as const, label: "Everything", count: counts.all },
    {
      key: "watchlist" as const,
      label: "My watchlist",
      count: counts.watchlist,
    },
    { key: "liked" as const, label: "Loved titles", count: counts.liked },
  ];

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[var(--surface-0)] pb-20 pt-24 text-[var(--ink)] sm:pt-32">
        <div
          className="ui-shell animate-pulse motion-reduce:animate-none"
          aria-label="Loading your collection"
        >
          <div className="h-3 w-28 rounded bg-white/[0.08]" />
          <div className="mt-4 h-9 w-full max-w-md rounded bg-white/[0.08]" />
          <div className="mt-3 h-5 w-full max-w-xl rounded bg-white/[0.06]" />
          <div className="mt-8 h-12 w-full border-b border-[var(--surface-border)]" />
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }, (_, index) => (
              <MediaCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[var(--surface-0)] pb-20 pt-24 text-[var(--ink)] sm:pt-32">
        <div className="ui-shell">
          <div className="ui-panel mx-auto max-w-xl p-8 text-center sm:p-12">
            <Library
              className="mx-auto h-10 w-10 text-brand-coral-strong"
              aria-hidden="true"
            />
            <h1 className="mt-5 text-3xl font-bold text-[var(--ink)]">
              Your collection starts here.
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--ink-muted)]">
              Sign in to keep a private shelf of titles you want to watch and
              stories you love.
            </p>
            <Link href="/auth/login" className="ui-primary-action mt-6">
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--surface-0)] pb-20 pt-24 text-[var(--ink)] sm:pt-32">
      <div className="ui-shell">
        <SectionHeader
          eyebrow="Your collection"
          title="Keep your next watches close."
          description="One place for saved titles and favorites. Open a title for details, reviews, and recommendations."
        />

        <div className="mt-8 overflow-x-auto mobile-native-scroll border-b border-[var(--surface-border)]">
          <div
            role="tablist"
            aria-label="Collection filter"
            className="flex min-w-max gap-6 sm:gap-8"
          >
            {tabs.map((item) => {
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  id={`collection-tab-${item.key}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="collection-panel"
                  onClick={() => setTab(item.key)}
                  className={`inline-flex min-h-12 items-center border-b-2 px-0.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-strong)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface-0)] ${
                    active
                      ? "border-[var(--brand-coral)] text-[var(--ink)]"
                      : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {item.label}
                  <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-2 sm:mt-10 sm:flex-row sm:items-center sm:gap-4">
          <h2 className="text-2xl font-bold leading-none text-[var(--ink)]">
            {tab === "all"
              ? "Your shelf"
              : tab === "watchlist"
                ? "My watchlist"
                : "Loved titles"}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4">
            {tab !== "liked" ? (
              <Link
                href="/watchlist"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
              >
                Manage watchlist
              </Link>
            ) : null}
            {tab !== "watchlist" ? (
              <Link
                href="/liked"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
              >
                Manage likes
              </Link>
            ) : null}
          </div>
        </div>

        <div
          id="collection-panel"
          role="tabpanel"
          aria-labelledby={`collection-tab-${tab}`}
          tabIndex={0}
          className="focus-visible:outline-none"
        >
          {loading ? (
            <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 12 }, (_, index) => (
                <MediaCardSkeleton key={index} />
              ))}
            </div>
          ) : visibleItems.length ? (
            <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
              {visibleItems.map((item) => {
                const watchType = item.kind === "tv" ? "series" : "movie";
                const saved = watchlistActions.isInWatchlist(
                  item.id,
                  watchType,
                );
                const canRemove = tab === "watchlist";
                return (
                  <MediaCard
                    key={`${item.kind}:${item.id}`}
                    item={{ ...item, type: item.kind }}
                    type={item.kind}
                    saved={saved}
                    onToggleSave={
                      canRemove
                        ? () => watchlistActions.remove(item.id, watchType)
                        : undefined
                    }
                    actionLabel="Remove from watchlist"
                  />
                );
              })}
            </div>
          ) : (
            <div className="mt-5 border border-[var(--surface-border)] bg-[var(--surface-1)] p-8 text-center sm:p-10">
              <h3 className="text-lg font-bold text-[var(--ink)]">
                Nothing here yet.
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                Explore the catalog and save a few titles to build your shelf.
              </p>
              <Link href="/search" className="ui-primary-action mt-5">
                Explore titles
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
