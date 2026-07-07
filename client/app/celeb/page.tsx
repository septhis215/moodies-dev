import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import CelebritiesPageClient from "./CelebritiesPageClient";

export const metadata: Metadata = {
  title: "Celebrities",
  description:
    "Browse actors, actresses, directors, writers, movie stars, TV stars, and rising talent on Moodies.",
};

export default function CelebritiesPage() {
  if (
    process.env.APP_ENV === "staging" ||
    process.env.NEXT_PUBLIC_APP_ENV === "staging"
  ) {
    notFound();
  }

  return (
    <Suspense fallback={<CelebritiesPageFallback />}>
      <CelebritiesPageClient />
    </Suspense>
  );
}

function CelebritiesPageFallback() {
  return (
    <main className="min-h-screen bg-black px-4 pb-16 pt-24 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="h-64 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]" />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={index}
              className="aspect-[2/3] animate-pulse rounded-lg bg-white/[0.05]"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
