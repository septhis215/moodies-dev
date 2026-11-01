import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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
        title="A little closer to the spotlight"
        description="The people. The stories. The moments between takes. Your next watch starts here."
        hero
      />
      <div className="ui-shell pt-6 sm:pt-8">
        <CelebrityVideoBrowser heroOnly />
      </div>
      <section
        className="ui-shell py-10 sm:py-12"
        aria-labelledby="hub-news-heading"
      >
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="ui-kicker mb-3">Fresh off the press</p>
            <h2
              id="hub-news-heading"
              className="text-3xl font-bold leading-none sm:text-4xl"
            >
              Stories worth catching up on
            </h2>
          </div>
          <Link
            href="/celeb/news"
            className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-[var(--brand-coral-strong)] hover:underline"
          >
            All news
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <CelebrityNewsFeed limit={6} compact />
      </section>
      <section
        className="ui-shell border-t border-[var(--surface-border)] pt-10 sm:pt-12"
        aria-labelledby="trending-faces-heading"
      >
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2
              id="trending-faces-heading"
              className="text-3xl font-bold leading-none sm:text-4xl"
            >
              People to know this week
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              From the cast of films and series trending on TMDB.
            </p>
          </div>
          <Link
            href="/celeb/explore"
            className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-[var(--brand-coral-strong)] hover:underline"
          >
            All people
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <CelebrityTrending />
      </section>
    </div>
  );
}
