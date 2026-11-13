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
}: {
  active: string;
  title: string;
  description: string;
}) {
  return (
    <div className="ui-shell pt-8 lg:pt-24">
      <SectionHeader as="h1" title={title} description={description} className="mb-4 sm:mb-5" />
      <div className="flex flex-wrap items-center justify-between gap-x-4">
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
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-sm text-sm font-semibold text-[var(--ink-muted)] underline-offset-4 hover:text-[var(--brand-coral-strong)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
            <span className="hidden sm:inline">Find people</span>
          </Link>
        )}
      </div>
    </div>
  );
}
