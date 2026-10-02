"use client";

import Link from "next/link";
import type { All } from "@/types/all";
import { Carousel } from "@/components/ui/Carousel";
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
      className="scroll-mt-24 border-t border-[var(--surface-border)] pt-8 sm:pt-10"
    >
      <div className="mb-5 flex items-end justify-between gap-5 border-l-2 border-[var(--brand-coral)] pl-4">
        <div className="max-w-2xl">
          {eyebrow ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--brand-coral-strong)]">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 text-2xl font-bold leading-none text-[var(--ink)] sm:text-[28px]">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="mb-0.5 hidden w-fit shrink-0 border-b border-[var(--surface-border)] pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-coral)] hover:text-[var(--ink)] sm:block"
          >
            View all
          </Link>
        ) : null}
      </div>
      <Carousel items={items} CardComponent={Card} />
    </section>
  );
}
