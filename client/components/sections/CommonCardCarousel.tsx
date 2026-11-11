"use client";

import type { All } from "@/types/all";
import SectionHeader from "@/components/ui/SectionHeader";
import { Carousel } from "@/components/ui/Carousel";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useRouter } from "next/navigation";
import { useState } from "react";
import MediaCard from "@/components/ui/MediaCard";

interface CommonCardCarouselProps {
  title: string;
  subtitle?: string;
  showHeader?: boolean;
  type?: "movie" | "tv";
  items: All[];
}

export default function CommonCardCarousel({
  title,
  subtitle,
  showHeader = true,
  type,
  items,
}: CommonCardCarouselProps) {
  const router = useRouter();
  const { isInWatchlist: hookIsIn, add, remove, ready } = useWatchlist();
  const [loadingStates, setLoadingStates] = useState<
    Record<string | number, boolean>
  >({});

  const toWatchType = (): "movie" | "series" =>
    type === "tv" ? "series" : "movie";

  const handleWatchlistToggle = async (show: All) => {
    if (!ready) {
      router.push("/auth/login");
      return;
    }

    const itemId = show.id;
    const isCurrentlyInWatchlist = hookIsIn(String(itemId), toWatchType());

    setLoadingStates((prev) => ({ ...prev, [itemId]: true }));

    try {
      const title = show.title || show.name || null;

      if (isCurrentlyInWatchlist) {
        await remove(String(itemId), toWatchType(), {
          title,
          variant: "info",
          duration: 3500,
        });
      } else {
        await add(String(itemId), toWatchType(), {
          title,
          variant: "info",
          duration: 3500,
        });
      }
    } catch (error) {
      console.error("Error updating watchlist:", error);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const MovieCard = ({ show }: { show?: All }) => {
    if (!show) return null;
    return (
      <MediaCard
        item={show}
        type={type === "tv" ? "tv" : "movie"}
        saved={hookIsIn(String(show.id), toWatchType())}
        saving={Boolean(loadingStates[show.id])}
        onToggleSave={() => {
          setLoadingStates((prev) => ({ ...prev, [show.id]: true }));
          handleWatchlistToggle(show).catch(() => undefined).finally(() => {
            setLoadingStates((prev) => ({ ...prev, [show.id]: false }));
          });
        }}
      />
    );
  };

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <section className="relative" aria-label={title}>
      {showHeader && <SectionHeader title={title} description={subtitle} className="mb-5" />}
      <Carousel items={items} CardComponent={MovieCard} label={title} mobileBleed={false} />
    </section>
  );
}
