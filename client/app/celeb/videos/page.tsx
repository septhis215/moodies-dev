import type { Metadata } from "next";
import CelebrityHubHeader from "@/components/celeb/CelebrityHubHeader";
import CelebrityVideoBrowser from "@/components/celeb/CelebrityVideoBrowser";

export const metadata: Metadata = {
  title: "Celebrity videos",
  description:
    "Explore recent celebrity interviews, trailers and public appearances, with original video sources.",
};
export default function CelebrityVideosPage() {
  return (
    <div className="min-h-screen bg-[var(--surface-0)] pb-12 text-[var(--ink)]">
      <CelebrityHubHeader
        active="/celeb/videos"
        title="Their world, in motion"
        description="Recent interviews, trailers and appearances from the last 90 days. Choose someone to explore their screen moments."
      />
      <section className="ui-shell py-8 sm:py-10" aria-label="Celebrity videos">
        <CelebrityVideoBrowser />
      </section>
    </div>
  );
}
