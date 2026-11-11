import SectionHeader from "@/components/ui/SectionHeader";
import Link from "next/link";
import { Search } from "lucide-react";
import styles from "./celebrity-hub.module.css";

const sections = [
  { label: "Home", href: "/celeb" },
  { label: "News", href: "/celeb/news" },
  { label: "Videos", href: "/celeb/videos" },
  { label: "People", href: "/celeb/explore" },
];
export default function CelebrityHubHeader({
  active,
  title,
  description,
  hero = false,
}: {
  active: string;
  title: string;
  description: string;
  hero?: boolean;
}) {
  return (
    <div className="ui-shell pt-8 lg:pt-24">
      <div className="mb-6 flex items-end justify-between gap-6 sm:mb-7">
        <SectionHeader as="h1" title={title} description={hero ? undefined : description} />

        {hero && (
          <p className="hidden max-w-xs text-sm leading-6 text-[var(--ink-muted)] md:block">
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 border-b border-[var(--surface-border)] pb-5">
        <nav className={styles.nav} aria-label="Celebrity hub">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              aria-current={active === section.href ? "page" : undefined}
            >
              {section.label}
            </Link>
          ))}
        </nav>
        {active !== "/celeb/explore" && (
          <Link
            href="/celeb/explore"
            aria-label="Search celebrities"
            className="hidden h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--surface-border)] text-[var(--ink-muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)] sm:grid"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
