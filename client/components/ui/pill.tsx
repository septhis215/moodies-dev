import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type PillProps = ComponentProps<"span"> & {
  variant: "genre" | "age-rating";
};

const themes = {
  genre: "bg-surface-2 text-[var(--ink-muted)]",
  "age-rating": "bg-[color-mix(in_srgb,var(--brand-gold)_16%,var(--surface-2))] font-bold text-[var(--brand-gold)]",
};

export function Pill({ variant, children, className, ...props }: PillProps) {
  return (
    <span
      {...props}
      className={cn(
        "inline-block max-w-full rounded-full px-3 py-1.5 text-xs font-semibold leading-5 [overflow-wrap:anywhere]",
        themes[variant],
        className,
      )}
    >
      <span className="sr-only">{variant === "genre" ? "Genres: " : "Age rating: "}</span>
      {children}
    </span>
  );
}
