"use client";

import type { All } from "@/types/all";
import { Carousel } from "@/components/ui/Carousel";
import SectionHeader from "@/components/ui/SectionHeader";
import { MediaPosterCard } from "./MediaPosterCard";

type Props = {
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  items: All[];
  hrefBase: "/movies" | "/tv";
  watchType: "movie" | "series";
  viewAllHref?: string;
};

export function MediaShelf({
  id,
  eyebrow,
  title,
  description,
  items,
  hrefBase,
  watchType,
  viewAllHref,
}: Props) {
  if (!items.length) return null;
  const Card = ({ show }: { show?: All }) =>
    show ? (
      <MediaPosterCard item={show} hrefBase={hrefBase} watchType={watchType} />
    ) : null;

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-24 border-t border-[var(--surface-border)] pt-8 sm:pt-10"
    >
      <SectionHeader
        id={`${id}-heading`}
        eyebrow={eyebrow}
        title={title}
        description={description}
        href={viewAllHref}
        className="mb-5"
      />
      <Carousel items={items} CardComponent={Card} label={title} />
    </section>
  );
}
