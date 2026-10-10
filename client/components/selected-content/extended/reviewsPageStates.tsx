import { ArrowLeft, MessageCircle } from "lucide-react";
import Link from "next/link";

type ReviewsPageStateProps = {
  title?: string;
  message?: string;
  backHref?: string;
};

export function ReviewsPageLoading() {
  return (
    <main className="min-h-screen bg-[var(--surface-0)] text-[var(--ink)]" aria-busy="true">
      <div className="ui-shell pb-12 pt-[calc(2rem+var(--mobile-nav-safe))] lg:pt-28">
        <p className="sr-only" role="status">Loading reviews</p>
        <div className="motion-safe:animate-pulse" aria-hidden="true">
          <div className="flex items-center gap-4">
            <div className="aspect-[2/3] w-20 shrink-0 rounded-xl bg-[var(--surface-2)] sm:w-28" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-3 w-28 rounded bg-[var(--surface-2)]" />
              <div className="h-10 w-2/3 rounded bg-[var(--surface-2)]" />
              <div className="flex gap-2">
                <div className="h-6 w-20 rounded-full bg-[var(--surface-2)]" />
                <div className="h-6 w-24 rounded-full bg-[var(--surface-2)]" />
              </div>
            </div>
          </div>
          <div className="ui-panel mb-5 mt-8 h-20 rounded-xl" />
          <div className="space-y-5">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="ui-panel rounded-xl p-5"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[var(--surface-2)]" />
                    <div className="space-y-2">
                      <div className="h-3 w-32 rounded bg-[var(--surface-2)]" />
                      <div className="h-3 w-28 rounded bg-[var(--surface-2)]" />
                    </div>
                  </div>
                  <div className="hidden h-7 w-14 rounded-full bg-[var(--surface-2)] sm:block" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full rounded bg-[var(--surface-2)]" />
                  <div className="h-4 w-11/12 rounded bg-[var(--surface-2)]" />
                  <div className="h-4 w-2/3 rounded bg-[var(--surface-2)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export function ReviewsPageUnavailable({
  title = "Reviews not available",
  message = "Could not fetch reviews for this title.",
  backHref,
}: ReviewsPageStateProps) {
  return (
    <main className="min-h-screen bg-[var(--surface-0)] text-[var(--ink)]">
      <div className="ui-shell pb-12 pt-[calc(2rem+var(--mobile-nav-safe))] lg:pt-28">
        <div className="ui-panel mx-auto max-w-2xl rounded-xl px-6 py-16 text-center sm:mt-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--brand-coral)]/10 text-[var(--brand-coral)]">
            <MessageCircle size={22} aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-3xl font-bold leading-none sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--ink-muted)]">
            {message}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {backHref && (
              <Link
                href={backHref}
                className="ui-secondary-action leading-none"
              >
                Back <ArrowLeft size={16} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
