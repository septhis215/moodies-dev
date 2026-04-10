import React from "react";
import { Star } from "lucide-react";

interface RatingBadgeProps {
    rating: number | null | undefined;
    variant?: "colored" | "minimal";
    size?: "sm" | "md";
    className?: string;
}

function getRatingColor(rating: number, variant: "colored" | "minimal") {
    if (rating <= 4.5) {
        return variant === "colored"
            ? "bg-red-600 text-white"
            : "bg-red-500/20 text-red-400 ring-1 ring-red-400/40";
    }

    if (rating <= 7) {
        return variant === "colored"
            ? "bg-yellow-500 text-black"
            : "bg-yellow-400/20 text-yellow-400 ring-1 ring-yellow-400/40";
    }

    return variant === "colored"
        ? "bg-green-600 text-white"
        : "bg-green-500/20 text-green-400 ring-1 ring-green-400/40";
}

export function RatingBadge({
    rating,
    variant = "minimal",
    size = "sm", // default smaller now
    className = "",
}: RatingBadgeProps) {
    if (rating === null || rating === undefined) return null;

    const isNew = rating === 0;
    const displayRating = rating === 0 ? null : rating.toFixed(1);

    // ===== NEW STATE =====
    if (isNew) {
        const sizeClasses =
            size === "sm"
                ? "px-2 py-0.5 text-[10px]"
                : "px-2.5 py-1 text-xs";

        return (
            <div
                className={`flex items-center ${sizeClasses} gap-1.5 rounded-full font-semibold
    bg-indigo-600 text-white ${className}`}
            >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                New
            </div>
        );
    }

    // ===== NORMAL STATE =====
    const sizeClasses =
        size === "sm"
            ? "px-2 py-0.5 text-[11px] gap-1"
            : "px-2.5 py-1 text-xs gap-1.5";

    const colorClasses = getRatingColor(rating, variant);

    return (
        <div
            className={`flex items-center ${sizeClasses} rounded-full font-medium ${colorClasses} ${className}`}
        >
            <Star
                className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"}
                fill="currentColor"
            />
            {displayRating}
        </div>
    );
}

export default RatingBadge;