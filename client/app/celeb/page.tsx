import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarDays, Play, Users } from "lucide-react";
import CelebrityHubHeader from "@/components/celeb/CelebrityHubHeader";
import CelebrityNewsFeed from "@/components/celeb/CelebrityNewsFeed";
import CelebrityTrending from "@/components/celeb/CelebrityTrending";

export const metadata: Metadata = {
  title: "Celebrity hub",
  description:
    "Catch up on celebrity news, film and TV happenings, interviews and trending talent. Explore their stories and work on Moodies.",
};

export default async function CelebritiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  // Preserve directory bookmarks from before the hub was introduced.
  if (["category", "q", "page"].some((key) => query[key])) {
    const params = new URLSearchParams();
    for (const key of ["category", "q", "page"])
      if (typeof query[key] === "string") params.set(key, query[key]);
    redirect(`/celeb/explore?${params.toString()}`);
  }
  return (
    <div className="min-h-screen bg-[var(--surface-0)] pb-12 text-[var(--ink)] sm:pb-16">
      <CelebrityHubHeader
        active="/celeb"
        title="Celebrity hub"
        description="Catch up with the people you love to watch. Discover their latest stories, screen moments and what comes next."
        hero
      />
      <section
        className="ui-shell py-8 sm:py-10"
        aria-labelledby="trending-faces-heading"
      >
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="ui-kicker mb-3">In the spotlight</p>
            <h2
              id="trending-faces-heading"
              className="text-3xl font-bold leading-none sm:text-4xl"
            >
              Faces from this week’s trending stories
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
              Meet the cast of films and series trending on TMDB. Each person is
              connected through their screen credits.
            </p>
          </div>
          <Link
            href="/celeb/explore?category=trending"
            className="ui-secondary-action"
          >
            Explore everyone
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <CelebrityTrending />
      </section>
      <section
        className="border-y border-[var(--surface-border)] bg-[var(--surface-1)]/40"
        aria-labelledby="hub-news-heading"
      >
        <div className="ui-shell py-8 sm:py-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="ui-kicker mb-3">Your news digest</p>
              <h2
                id="hub-news-heading"
                className="text-3xl font-bold leading-none sm:text-4xl"
              >
                The latest from their world
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
                New stories from entertainment publishers, with dates and a
                direct path to the original reporting.
              </p>
            </div>
            <Link href="/celeb/news" className="ui-secondary-action">
              All stories
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <CelebrityNewsFeed limit={6} compact />
        </div>
      </section>
      <section
        className="ui-shell py-8 sm:py-10"
        aria-labelledby="keep-exploring-heading"
      >
        <h2
          id="keep-exploring-heading"
          className="mb-5 text-3xl font-bold leading-none sm:text-4xl"
        >
          A little closer to the screen
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              href: "/celeb/videos",
              title: "Watch their world",
              text: "Recent interviews, trailers and appearances, one person at a time.",
              Icon: Play,
            },
            {
              href: "/celeb/happenings",
              title: "Around the industry",
              text: "Festival moments, premieres and awards in the news.",
              Icon: CalendarDays,
            },
            {
              href: "/celeb/explore",
              title: "Find your favorites",
              text: "Search the people behind the films and series you love.",
              Icon: Users,
            },
          ].map(({ href, title, text, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group ui-panel p-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral-strong)]"
            >
              <Icon
                className="mb-5 h-6 w-6 text-[var(--brand-gold)]"
                aria-hidden="true"
              />
              <h3 className="text-lg font-semibold group-hover:text-[var(--brand-coral-strong)]">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                {text}
              </p>
              <ArrowRight className="mt-5 h-5 w-5" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
