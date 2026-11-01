import type { Metadata } from "next";
import CelebrityHubHeader from "@/components/celeb/CelebrityHubHeader";
import CelebrityNewsFeed from "@/components/celeb/CelebrityNewsFeed";

export const metadata: Metadata = {
  title: "Celebrity happenings",
  description:
    "Recent coverage of film festivals, premieres, awards and celebrity appearances.",
};
export default function CelebrityHappeningsPage() {
  return (
    <div className="min-h-screen bg-[var(--surface-0)] pb-12 text-[var(--ink)]">
      <CelebrityHubHeader
        active="/celeb/happenings"
        title="Around their world"
        description="Festival moments, premieres and awards making the news. Dates below are publication dates; open the original story for event details."
      />
      <section
        className="ui-shell py-8 sm:py-10"
        aria-label="Recent coverage of events"
      >
        <CelebrityNewsFeed topic="happenings" />
      </section>
    </div>
  );
}
