import type { Metadata } from "next";
import CelebrityHubHeader from "@/components/celeb/CelebrityHubHeader";
import CelebrityNewsFeed from "@/components/celeb/CelebrityNewsFeed";

export const metadata: Metadata = {
  title: "Celebrity news",
  description:
    "Recent celebrity and entertainment headlines from Variety, Deadline and The Hollywood Reporter, with publication dates and original sources.",
};
export default function CelebrityNewsPage() {
  return (
    <div className="min-h-screen bg-[var(--surface-0)] pb-12 text-[var(--ink)]">
      <CelebrityHubHeader
        active="/celeb/news"
        title="The stories behind the screen"
        description="New projects, candid conversations and moments from the red carpet. Fresh from entertainment publishers."
      />
      <section
        className="ui-shell py-8 sm:py-10"
        aria-label="Recent entertainment news"
      >
        <CelebrityNewsFeed />
      </section>
    </div>
  );
}
