import { IconChevronCompactLeft, IconChevronCompactRight } from "@tabler/icons-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

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
  const Icon = direction === "previous" ? IconChevronCompactLeft : IconChevronCompactRight;

  return (
    <button
      type="button"
      aria-label={direction === "previous" ? "Previous cards" : "Next cards"}
      className={cn("group relative isolate hidden size-11 shrink-0 place-items-center bg-transparent text-[var(--ink)] enabled:cursor-pointer enabled:active:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-default disabled:opacity-30 before:pointer-events-none before:absolute before:-inset-x-2 before:-inset-y-6 before:-z-10 before:bg-[radial-gradient(ellipse_at_center,var(--surface-0)_0%,transparent_72%)] before:opacity-65 enabled:hover:before:opacity-100 focus-visible:before:opacity-100 motion-safe:before:transition-opacity motion-safe:before:duration-200 lg:grid", className)}
      {...props}
    >
      <Icon stroke={2} className="relative size-9 opacity-85 drop-shadow-[0_1px_4px_black] group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:group-active:scale-90" aria-hidden="true" />
    </button>
  );
}
