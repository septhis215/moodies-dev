import React from "react";
import { Star } from "lucide-react";

interface RatingBadgeProps {
  rating: number | null | undefined;
  variant?: "colored" | "minimal";
  size?: "sm" | "md";
  className?: string;
}

function getRatingColor(variant: "colored" | "minimal") {
  return variant === "colored"
    ? "border border-[var(--brand-gold)]/45 bg-[var(--surface-0)]/90 text-[var(--ink)] shadow-sm backdrop-blur-md"
    : "border border-[var(--brand-gold)]/25 bg-[var(--brand-gold)]/10 text-[var(--ink)]";
}

export function RatingBadge({
  rating,
  variant = "colored",
  size = "sm",
  className = "",
}: RatingBadgeProps) {
  if (rating === null || rating === undefined) return null;

  const numericRating = Number(rating);
  if (
    !Number.isFinite(numericRating) ||
    numericRating < 0 ||
    numericRating > 10
  )
    return null;
  const isNew = numericRating === 0;
  const displayRating = isNew ? null : numericRating.toFixed(1);

  // ===== NEW STATE =====
  if (isNew) {
    const sizeClasses =
      size === "sm"
        ? "gap-1.5 px-2 py-1 text-xs"
        : "gap-2 px-2.5 py-1.5 text-sm";
    const colorClasses =
      variant === "colored"
        ? "border-[var(--brand-coral)]/50 bg-[var(--surface-0)]/95 shadow-sm"
        : "border-[var(--brand-coral)]/30 bg-[var(--brand-coral)]/10";

    return (
      <div
        aria-label="New title, not yet rated"
        className={`inline-flex w-fit shrink-0 items-center rounded-md border font-semibold normal-case leading-none tracking-normal text-[var(--ink)] ${sizeClasses} ${colorClasses} ${className}`}
      >
        <span
          aria-hidden="true"
          className={`shrink-0 rounded-full border-2 border-[var(--brand-coral)] ${size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5"}`}
        />
        New
      </div>
    );
  }

  // ===== NORMAL STATE =====
  const sizeClasses =
    size === "sm" ? "gap-1.5 px-2 py-1 text-xs" : "gap-2 px-2.5 py-1.5 text-sm";

  const colorClasses = getRatingColor(variant);

  return (
    <div
      aria-label={`Rating: ${displayRating} out of 10`}
      className={`inline-flex w-fit shrink-0 items-center rounded-md font-semibold normal-case leading-none tracking-normal tabular-nums ${sizeClasses} ${colorClasses} ${className}`}
    >
      <Star
        aria-hidden="true"
        className={`text-[var(--brand-gold)] ${size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"}`}
        fill="currentColor"
      />
      {displayRating}
    </div>
  );
}

export default RatingBadge;
