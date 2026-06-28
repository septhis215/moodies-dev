"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RouteError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center text-center">
        <p className="mb-3 text-sm uppercase tracking-[0.28em] text-white/45">
          Moodies
        </p>
        <h1 className="text-4xl font-semibold tracking-normal sm:text-5xl">
          Something went wrong.
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-white/60 sm:text-base">
          We could not finish loading this view. Try again, or head back home.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/85"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-md border border-white/15 px-5 py-3 text-sm font-medium text-white transition hover:border-white/35 hover:bg-white/10"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
