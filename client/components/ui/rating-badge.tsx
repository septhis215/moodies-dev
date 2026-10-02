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
    ? "bg-[var(--brand-gold)] text-[#0b0909]"
    : "border border-[var(--brand-gold)]/35 bg-[var(--brand-gold)]/10 text-[var(--brand-gold)]";
}

export function RatingBadge({
  rating,
  variant = "colored",
  size = "sm",
  className = "",
}: RatingBadgeProps) {
  if (rating === null || rating === undefined) return null;

  const numericRating = Number(rating);
  const isNew = numericRating === 0;
  const displayRating = isNew ? null : numericRating.toFixed(1);

  // ===== NEW STATE =====
  if (isNew) {
    const sizeClasses =
      size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

    return (
      <div
        className={`flex items-center gap-1.5 rounded-full border border-[var(--surface-border)] bg-[var(--surface-2)] font-semibold text-[var(--ink)] ${sizeClasses} ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-coral)]" />
        New
      </div>
    );
  }

  // ===== NORMAL STATE =====
  const sizeClasses =
    size === "sm"
      ? "gap-1 px-2 py-0.5 text-[11px]"
      : "gap-1.5 px-2.5 py-1 text-xs";

  const colorClasses = getRatingColor(variant);

  return (
    <div
      className={`flex items-center rounded-full font-semibold ${sizeClasses} ${colorClasses} ${className}`}
    >
      <Star
        className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"}
        fill="currentColor"
      />
      {displayRating}
    </div>
  );
}

export default RatingBadge;
