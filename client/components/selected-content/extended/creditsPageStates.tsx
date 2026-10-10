import Link from "next/link";
import { ArrowLeft, Users2 } from "lucide-react";

export function CreditsPageLoading() {
  return (
    <div className="min-h-screen bg-[var(--surface-0)] text-[var(--ink)]" aria-busy="true">
      <div className="ui-shell pb-12 pt-[calc(2rem+var(--mobile-nav-safe))] lg:pt-28">
        <p role="status" className="sr-only">Loading credits</p>
        <div aria-hidden="true" className="motion-safe:animate-pulse">
          <div className="mb-8 h-11 w-40 rounded-xl bg-[var(--surface-2)]" />
          <div className="flex items-center gap-5 sm:gap-8">
            <div className="aspect-[2/3] w-24 shrink-0 rounded-xl bg-[var(--surface-2)] sm:w-40" />
            <div className="flex-1 space-y-4">
              <div className="h-3 w-24 rounded bg-[var(--surface-2)]" />
              <div className="h-12 w-3/4 rounded bg-[var(--surface-2)]" />
              <div className="h-4 w-28 rounded bg-[var(--surface-2)]" />
            </div>
          </div>
          <div className="mb-8 mt-10 h-24 rounded-xl bg-[var(--surface-1)]" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }, (_, index) => <div key={index}>
              <div className="aspect-[2/3] rounded-xl bg-[var(--surface-2)]" />
              <div className="mt-3 h-4 w-3/4 rounded bg-[var(--surface-2)]" />
              <div className="mt-2 h-4 w-1/2 rounded bg-[var(--surface-2)]" />
            </div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CreditsPageUnavailable({ backHref }: { backHref: string }) {
  return (
    <div className="min-h-screen bg-[var(--surface-0)] text-[var(--ink)]">
      <div className="ui-shell pb-12 pt-[calc(2rem+var(--mobile-nav-safe))] lg:pt-28">
        <div className="ui-panel mx-auto max-w-2xl rounded-xl px-6 py-16 text-center sm:mt-10">
          <Users2 size={28} className="mx-auto text-[var(--brand-coral)]" aria-hidden="true" />
          <h1 className="mt-5 text-3xl font-bold leading-none sm:text-4xl">Credits unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">We couldn’t load the people behind this title. Please try again later.</p>
          <Link href={backHref} className="ui-secondary-action mt-6 leading-none">Back <ArrowLeft size={16} aria-hidden="true" /></Link>
        </div>
      </div>
    </div>
  );
}
