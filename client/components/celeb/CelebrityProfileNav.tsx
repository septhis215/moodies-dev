import Link from "next/link";

export default function CelebrityProfileNav({
  id,
  active = "overview",
}: {
  id: number;
  active?: string;
}) {
  return (
    <nav
      aria-label="Celebrity content"
      className="mt-6 flex flex-wrap gap-x-6 border-b border-[var(--surface-border)] sm:mt-8"
    >
      {[
        { key: "overview", label: "Profile", href: `/celeb/${id}` },
        { key: "news", label: "News", href: `/celeb/${id}/news` },
        { key: "videos", label: "Videos", href: `/celeb/${id}/videos` },
        { key: "photos", label: "Photos", href: `/celeb/${id}/photos` },
      ].map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={active === item.key ? "page" : undefined}
          className={`inline-flex min-h-11 items-center border-b-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral-strong)] ${active === item.key ? "border-[var(--brand-coral)] text-[var(--ink)]" : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
