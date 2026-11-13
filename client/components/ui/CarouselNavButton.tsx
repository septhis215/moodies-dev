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
      className={`hidden size-11 shrink-0 place-items-center rounded-md border border-[var(--surface-border)] bg-[var(--surface-1)] text-[var(--ink)] transition-colors duration-150 enabled:cursor-pointer enabled:hover:text-[var(--brand-coral-strong)] enabled:active:bg-[var(--surface-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral)] disabled:cursor-default disabled:opacity-30 motion-reduce:transition-none lg:grid ${className}`}
      {...props}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
