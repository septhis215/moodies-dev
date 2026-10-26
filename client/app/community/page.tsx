import type { Metadata } from "next";
import { Suspense } from "react";
import CommunityForum from "@/components/community/CommunityForum";

export const metadata: Metadata = {
  title: "Community",
  description:
    "Share feedback about Moodies, suggest ideas, and join the community conversation.",
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
