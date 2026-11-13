import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SectionHeader from "@/components/ui/SectionHeader";
import CelebrityHubHeader from "@/components/celeb/CelebrityHubHeader";
import CelebrityNewsFeed from "@/components/celeb/CelebrityNewsFeed";
import CelebrityTrending from "@/components/celeb/CelebrityTrending";
import CelebrityVideoBrowser from "@/components/celeb/CelebrityVideoBrowser";

export const metadata: Metadata = {
  title: "Celebrity hub",
  description:
    "Fresh interviews, trailers and entertainment news. Get closer to the people behind your favorite films and series on Moodies.",
};
export default async function CelebritiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  if (["category", "q", "page"].some((key) => query[key])) {
    const params = new URLSearchParams();
    for (const key of ["category", "q", "page"])
      if (typeof query[key] === "string") params.set(key, query[key]);
    redirect(`/celeb/explore?${params}`);
  }
  return (
    <div className="min-h-screen bg-[var(--surface-0)] pb-12 text-[var(--ink)] sm:pb-16">
      <CelebrityHubHeader
        active="/celeb"
        title="Celebrity hub"
        description="Interviews, trending people, and the latest from film and TV."
      />
      <section className="ui-shell pt-5 sm:pt-8" aria-labelledby="hub-videos-heading">
        <SectionHeader id="hub-videos-heading" title="In the spotlight" href="/celeb/videos" linkLabel="All videos" className="mb-4" />
        <CelebrityVideoBrowser heroOnly />
      </section>
      <section className="ui-shell pt-10 sm:pt-14" aria-labelledby="trending-faces-heading">
        <SectionHeader id="trending-faces-heading" title="Trending people" href="/celeb/explore" linkLabel="All people" className="mb-4" />
        <CelebrityTrending />
      </section>
      <section className="ui-shell pt-10 sm:pt-14" aria-labelledby="hub-news-heading">
        <SectionHeader id="hub-news-heading" title="Latest headlines" href="/celeb/news" linkLabel="All news" className="mb-4" />
        <CelebrityNewsFeed limit={5} compact />
      </section>
    </div>
  );
}
