'use client';

import { useEffect } from "react";
import Link from "next/link";

export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SearchError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="text-center">
        <h2 className="mb-3 text-2xl font-bold">Search is unavailable.</h2>
        <p className="mx-auto mb-6 max-w-md text-sm text-white/60">
          We could not load search results. Try again or return home.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mr-3 rounded-md bg-white px-4 py-2 text-black transition hover:bg-gray-200"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="rounded-md border border-white/20 px-4 py-2 text-white transition hover:bg-white/10"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
