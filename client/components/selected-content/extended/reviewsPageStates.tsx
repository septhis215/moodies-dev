import { ArrowLeft, Search, Star } from "lucide-react";
import Link from "next/link";

type ReviewsPageStateProps = {
  title?: string;
  message?: string;
  backHref?: string;
};

export function ReviewsPageLoading() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="h-28 w-20 animate-pulse rounded-xl bg-white/[0.08]" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-3 w-28 animate-pulse rounded-full bg-white/[0.10]" />
              <div className="h-8 w-2/3 animate-pulse rounded-full bg-white/[0.12]" />
              <div className="flex gap-2">
                <div className="h-6 w-20 animate-pulse rounded-full bg-white/[0.08]" />
                <div className="h-6 w-24 animate-pulse rounded-full bg-white/[0.08]" />
              </div>
            </div>
          </div>
          <div className="mt-8 space-y-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-white/[0.10]" />
                    <div className="space-y-2">
                      <div className="h-3 w-32 animate-pulse rounded-full bg-white/[0.10]" />
                      <div className="h-2.5 w-44 animate-pulse rounded-full bg-white/[0.07]" />
                    </div>
                  </div>
                  <div className="h-7 w-14 animate-pulse rounded-full bg-white/[0.08]" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full animate-pulse rounded-full bg-white/[0.08]" />
                  <div className="h-3 w-11/12 animate-pulse rounded-full bg-white/[0.08]" />
                  <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/[0.08]" />
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
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 text-center shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10 text-red-200">
            <Search size={22} />
          </div>
          <h2 className="mt-5 text-2xl font-black text-white">{title}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/58">
            {message}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white/72 transition-all hover:border-white/[0.18] hover:bg-white/[0.08] hover:text-white"
              >
                <ArrowLeft size={14} />
                Back to title
              </Link>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#e94f37]/30 bg-[#e94f37]/10 px-4 py-2 text-xs font-semibold text-[#ff8a78]">
              <Star size={13} />
              Try again shortly
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
