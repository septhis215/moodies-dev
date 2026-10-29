import type { Metadata } from "next";
import { Suspense } from "react";
import CommunityForum from "@/components/community/CommunityForum";

export const metadata: Metadata = {
  title: "Community",
  description:
    "Share what you watched, talk about how it made you feel, and find your next film or series with the Moodies community.",
};

export default function CommunityPage() {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="ui-shell py-8 text-sm text-[var(--ink-muted)] lg:pt-32"
        >
          Loading the forum...
        </div>
      }
    >
      <CommunityForum />
    </Suspense>
  );
}
