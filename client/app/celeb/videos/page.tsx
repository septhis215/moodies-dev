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
        description="Fresh trailers, interviews and a little closer to the action. Press play and stay a while."
      />
      <section className="ui-shell py-8 sm:py-10" aria-label="Celebrity videos">
        <CelebrityVideoBrowser />
      </section>
    </div>
  );
}
