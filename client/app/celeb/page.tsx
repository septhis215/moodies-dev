import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageSkeleton from "@/components/loading/PageSkeleton";
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
    <Suspense fallback={<PageSkeleton variant="people" />}>
      <CelebritiesPageClient />
    </Suspense>
  );
}
