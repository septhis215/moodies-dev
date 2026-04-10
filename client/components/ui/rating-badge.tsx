import React from "react";
import { Star } from "lucide-react";

interface RatingBadgeProps {
    rating: number | null | undefined;
    /**
     * "colored" - Uses color-coded backgrounds based on rating thresholds
     * "minimal" - Simple dark backdrop with yellow star
     * @default "minimal"
     */
    variant?: "colored" | "minimal";
    /**
     * Size variant for responsive design
     * @default "md"
     */
    size?: "sm" | "md";
    className?: string;
}

/**
 * Shared RatingBadge component for consistent rating display across the app
 * 
 * @example
 * // Colored variant (for cards/carousels)
 * <RatingBadge rating={7.5} variant="colored" />
 * 
 * @example
 * // Minimal variant (for details/watchlist)
 * <RatingBadge rating={7.5} variant="minimal" size="sm" />
 */
export function RatingBadge({
    rating,
    variant = "minimal",
    size = "md",
    className = "",
}: RatingBadgeProps) {
    // Don't render if no rating
    if (rating === null || rating === undefined) {
        return null;
    }

    const displayRating = rating === 0 ? null : rating?.toFixed(1);
    const isNew = rating === 0;

    // Colored variant — New state
    if (isNew && variant === "colored") {
        const sizeClasses =
            size === "sm"
                ? "px-1.5 py-0.5 text-[10px] gap-1"
                : "px-2 py-1 text-xs gap-1.5";

        return (
            <div
                className={`
        relative flex items-center ${sizeClasses} rounded-lg font-bold shadow-lg overflow-hidden
        bg-gradient-to-br from-indigo-500 to-violet-500
        border border-violet-400/50 text-white
        ${className}
      `}
            >
                <span className={`
        flex items-center justify-center rounded
        bg-white/20 font-bold
        ${size === "sm" ? "w-3 h-3 text-[8px]" : "w-3.5 h-3.5 text-[9px]"}
      `}>
                    ✦
                </span>
                New
            </div>
        );
    }

    // Minimal variant — New state
    if (isNew && variant === "minimal") {
        const sizeClasses =
            size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";

        return (
            <div
                className={`
        flex items-center ${sizeClasses} gap-1.5 rounded-full font-bold
        bg-indigo-500/15 ring-1 ring-indigo-400/35 text-indigo-400
        ${className}
      `}
            >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                New
            </div>
        );
    }
}

export default RatingBadge;
