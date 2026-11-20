import { IconChevronCompactLeft, IconChevronCompactRight } from "@tabler/icons-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CarouselNavButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  direction: "previous" | "next";
  variant?: "edge" | "inline";
};

export function CarouselNavButton({
  direction,
  variant = "edge",
  className = "",
  ...props
}: CarouselNavButtonProps) {
  const Icon = direction === "previous" ? IconChevronCompactLeft : IconChevronCompactRight;

  const button = (
    <button
      type="button"
      aria-label={direction === "previous" ? "Previous cards" : "Next cards"}
      className={cn("group relative grid size-14 shrink-0 place-items-center bg-transparent text-[var(--ink)] enabled:cursor-pointer enabled:active:opacity-70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white disabled:cursor-default disabled:opacity-30", variant === "edge" ? "pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" : "hidden lg:grid", variant === "inline" && className)}
      {...props}
    >
      <Icon stroke={2} className="relative size-12 opacity-85 drop-shadow-[0_1px_4px_black] group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:group-active:scale-90" aria-hidden="true" />
    </button>
  );

  if (variant === "inline") return button;

  return (
    <div data-carousel-edge={direction} className={cn("group/edge pointer-events-none absolute inset-y-0 z-40 hidden w-24 lg:grid lg:justify-items-center xl:w-28", direction === "previous" ? "left-0" : "right-0", className)}>
      <span aria-hidden="true" className={cn("pointer-events-none absolute inset-0 motion-safe:transition-opacity motion-safe:duration-300", props.disabled ? "opacity-0" : "opacity-75 group-hover/edge:opacity-100 group-focus-within/edge:opacity-100", direction === "previous" ? "bg-[linear-gradient(to_right,var(--surface-0),transparent)]" : "bg-[linear-gradient(to_left,var(--surface-0),transparent)]")} />
      {button}
    </div>
  );
}
