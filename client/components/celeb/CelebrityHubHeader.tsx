import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Search } from "lucide-react";

const sections = [
  { label: "Overview", href: "/celeb" },
  { label: "News digest", href: "/celeb/news" },
  { label: "Happenings", href: "/celeb/happenings" },
  { label: "Videos", href: "/celeb/videos" },
  { label: "Explore people", href: "/celeb/explore" },
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
    <>
      <header className="relative isolate overflow-hidden border-b border-[var(--surface-border)]">
        {hero && (
          <>
            <Image
              src="/images/celeb-homepage-hero.png"
              alt=""
              fill
              priority
              sizes="100vw"
              className="-z-20 object-cover object-center"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[var(--surface-0)] via-[var(--surface-0)]/90 to-black/50" />
            <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-[var(--surface-0)] to-transparent" />
          </>
        )}
        <div
          className={`ui-shell relative pt-8 lg:pt-28 ${hero ? "pb-12 sm:pb-16" : "pb-8"}`}
        >
          <p className="ui-kicker">Moodies / Celebrity hub</p>
          <h1
            className={`mt-4 max-w-3xl text-balance font-bold leading-none ${hero ? "text-5xl sm:text-6xl lg:text-7xl" : "text-4xl sm:text-5xl"}`}
          >
            {title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[var(--ink-muted)]">
            {description}
          </p>
          {hero && (
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/celeb/explore" className="ui-primary-action text-[var(--surface-0)]">
                <Search className="h-4 w-4" aria-hidden="true" />
                Find a celebrity
              </Link>
              <Link href="/celeb/news" className="ui-secondary-action">
                Read the news digest
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </header>
      <nav
        aria-label="Celebrity hub"
        className="border-b border-[var(--surface-border)] bg-[var(--surface-0)]"
      >
        <div className="ui-shell flex flex-wrap gap-x-6 gap-y-1 py-2">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              aria-current={active === section.href ? "page" : undefined}
              className={`inline-flex min-h-11 items-center border-b-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral-strong)] ${active === section.href ? "border-[var(--brand-coral)] text-[var(--ink)]" : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
            >
              {section.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
