import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  id?: string;
  as?: "h1" | "h2";
  eyebrow?: string;
  title: string;
  titleHref?: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  className?: string;
};

export function SectionHeader({
  id,
  as: Heading = "h2",
  eyebrow,
  title,
  titleHref,
  description,
  href,
  linkLabel = "View all",
  className,
}: SectionHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-1",
        className,
      )}
    >
      <div className="min-w-0 flex-1 basis-48">
        {eyebrow ? <p className="ui-kicker mb-2 [overflow-wrap:anywhere]">{eyebrow}</p> : null}
        <Heading
          id={id}
          className={cn(
            "text-balance font-bold leading-none text-[var(--ink)] [overflow-wrap:anywhere]",
            Heading === "h1" ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl",
          )}
        >
          {titleHref ? (
            <Link href={titleHref} className="rounded-sm underline-offset-4 hover:text-[var(--brand-coral-strong)] hover:underline motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral-strong)]">
              {title}
            </Link>
          ) : title}
        </Heading>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm text-sm font-semibold text-[var(--ink-muted)] underline-offset-4 hover:text-[var(--brand-coral-strong)] hover:underline motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral-strong)]"
        >
          {linkLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
    </header>
  );
}

export default SectionHeader;
