"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, Heart, Library, LogIn } from "lucide-react";
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
      ...Array.from(watchlist.movieIds).map((id) => ({ kind: "movie" as const, id })),
      ...Array.from(watchlist.seriesIds).map((id) => ({ kind: "tv" as const, id })),
      ...Array.from(liked.movieIds).map((id) => ({ kind: "movie" as const, id })),
      ...Array.from(liked.seriesIds).map((id) => ({ kind: "tv" as const, id })),
    ];
    return values.slice(0, 48);
  }, [watchlist.movieIds, watchlist.seriesIds, liked.movieIds, liked.seriesIds]);

  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchMediaSummaries(collectionIds, { cache: "no-store" }).then((nextItems) => {
      if (!cancelled) {
        setItems(nextItems);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [collectionIds, isAuthenticated]);

  const visibleItems = useMemo(() => {
    if (tab === "watchlist") {
      return items.filter((item) => watchlistActions.isInWatchlist(item.id, item.kind === "tv" ? "series" : "movie"));
    }
    if (tab === "liked") {
      return items.filter((item) => likedActions.isLiked(item.id, item.kind === "tv" ? "series" : "movie"));
    }
    return items;
  }, [items, tab, watchlistActions, likedActions]);

  const counts = {
    watchlist: watchlist.movieIds.size + watchlist.seriesIds.size,
    liked: liked.movieIds.size + liked.seriesIds.size,
  };

  if (authLoading) {
    return <main className="min-h-screen bg-surface-0 px-4 pb-20 pt-32 text-white" />;
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-surface-0 px-4 pb-20 pt-32 text-white">
        <div className="ui-shell">
          <div className="ui-panel mx-auto max-w-xl p-8 text-center sm:p-12">
            <Library className="mx-auto h-10 w-10 text-brand-coral-strong" aria-hidden="true" />
            <h1 className="mt-5 text-3xl font-black">Your collection starts here.</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/55">
              Sign in to keep a private shelf of titles you want to watch and stories you love.
            </p>
            <Link href="/auth/login" className="ui-primary-action mt-6"><LogIn className="h-4 w-4" aria-hidden="true" />Sign in</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-0 pb-20 pt-24 text-white sm:pt-32">
      <div className="ui-shell">
        <SectionHeader
          eyebrow="Your collection"
          title="Keep your next watches close."
          description="One place for saved titles and favorites. Open a title for details, reviews, and recommendations."
        />

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { key: "all" as const, label: "Everything", count: counts.watchlist + counts.liked, icon: Library },
            { key: "watchlist" as const, label: "My watchlist", count: counts.watchlist, icon: Bookmark },
            { key: "liked" as const, label: "Loved titles", count: counts.liked, icon: Heart },
          ].map((card) => {
            const Icon = card.icon;
            const active = tab === card.key;
            return (
              <button key={card.key} type="button" onClick={() => setTab(card.key)} className={`ui-panel-interactive flex min-h-24 items-center gap-4 p-4 text-left ${active ? "border-brand-coral/60 bg-brand-coral/10" : ""}`}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-brand-coral-strong"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <span><span className="block text-sm font-bold text-white">{card.label}</span><span className="mt-1 block text-xs text-white/45">{card.count} {card.count === 1 ? "title" : "titles"}</span></span>
              </button>
            );
          })}
        </div>

        <div className="mt-10 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-white">{tab === "all" ? "Your shelf" : tab === "watchlist" ? "My watchlist" : "Loved titles"}</h2>
          <div className="flex gap-2">
            <Link href="/watchlist" className="text-xs font-semibold text-white/45 hover:text-white">Manage watchlist</Link>
            <Link href="/liked" className="text-xs font-semibold text-white/45 hover:text-white">Manage likes</Link>
          </div>
        </div>

        {loading ? (
          <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }, (_, index) => <MediaCardSkeleton key={index} />)}
          </div>
        ) : visibleItems.length ? (
          <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
            {visibleItems.map((item) => {
              const watchType = item.kind === "tv" ? "series" : "movie";
              const saved = watchlistActions.isInWatchlist(item.id, watchType);
              const canRemove = tab === "watchlist";
              return (
                <MediaCard
                  key={`${item.kind}:${item.id}`}
                  item={{ ...item, type: item.kind }}
                  type={item.kind}
                  saved={saved}
                  onToggleSave={canRemove ? () => watchlistActions.remove(item.id, watchType) : undefined}
                  actionLabel="Remove from watchlist"
                />
              );
            })}
          </div>
        ) : (
          <div className="ui-panel mt-5 p-8 text-center">
            <h3 className="text-lg font-black text-white">Nothing here yet.</h3>
            <p className="mt-2 text-sm text-white/55">Explore the catalog and save a few titles to build your shelf.</p>
            <Link href="/discover" className="ui-primary-action mt-5">Explore titles</Link>
          </div>
        )}
      </div>
    </main>
  );
}
