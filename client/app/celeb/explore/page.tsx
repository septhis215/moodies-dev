import type { Metadata } from "next";
import { Suspense } from "react";
import CelebritiesPageClient from "../CelebritiesPageClient";
import CelebrityHubHeader from "@/components/celeb/CelebrityHubHeader";
import PageSkeleton from "@/components/loading/PageSkeleton";

export const metadata: Metadata = {
  title: "Explore celebrities",
  description:
    "Find actors, directors, writers and the people behind your favorite films and series.",
};
export default function ExploreCelebrities() {
  return (
    <div className="bg-[var(--surface-0)] text-[var(--ink)]">
      <CelebrityHubHeader
        active="/celeb/explore"
        title="Find your favorite people"
        description="Search by name or explore the people behind your next watch."
      />
      <Suspense fallback={<PageSkeleton variant="people" />}>
        <CelebritiesPageClient />
      </Suspense>
    </div>
  );
}
