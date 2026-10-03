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
      className={`grid h-11 w-11 place-items-center rounded-md border border-white/20 bg-[#0b0909]/88 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-md transition-[background-color,border-color,transform,opacity] duration-150 hover:border-[var(--brand-coral)] hover:bg-[#171111] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral)] disabled:cursor-default disabled:opacity-30 disabled:pointer-events-none ${className}`}
      {...props}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
