import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type CarouselNavButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  direction: "previous" | "next";
};

export function CarouselNavButton({
  direction,
  className = "",
  ...props
}: CarouselNavButtonProps) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      aria-label={direction === "previous" ? "Previous cards" : "Next cards"}
      className={`hidden h-11 w-11 shrink-0 place-items-center rounded-full border border-white/20 bg-[#0b0909]/92 text-white shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur-md transition-[transform,background-color,border-color,color,opacity] duration-150 enabled:cursor-pointer enabled:hover:scale-105 enabled:hover:border-[var(--brand-coral)] enabled:hover:bg-[var(--surface-2)] enabled:hover:text-[var(--brand-coral-strong)] enabled:active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral)] disabled:cursor-default disabled:opacity-30 motion-reduce:transition-none lg:grid ${className}`}
      {...props}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
