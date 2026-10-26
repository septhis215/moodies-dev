"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  MessageCircle,
  MessagesSquare,
  Plus,
  Search,
  UserRound,
  MessageCircleQuestion,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import { useCommunityPage } from "@/hooks/useCommunityPage";
import type { CommunityPostsPage } from "@/lib/api/community";
import { CommunityComposer } from "./CommunityComposer";
import { CommunityAvatar, communityDate } from "./CommunityAuthor";

const views = [
  { key: "all", label: "All discussions", icon: MessagesSquare },
  { key: "unanswered", label: "Awaiting replies", icon: MessageCircleQuestion },
  { key: "mine", label: "Your discussions", icon: UserRound },
] as const;

export default function CommunityForum() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const search = (params.get("search") ?? "").slice(0, 100);
  const filter =
    views.find((view) => view.key === params.get("filter"))?.key ?? "all";
  const sort =
    params.get("sort") === "most-replies" ? "most-replies" : "newest";
  const requestedPage = Number(params.get("page") ?? 1);
  const page =
    Number.isInteger(requestedPage) &&
    requestedPage > 0 &&
    requestedPage <= 10000
      ? requestedPage
      : 1;
  const [composing, setComposing] = useState(false);
  const startButton = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const query = new URLSearchParams({
    page: String(page),
    limit: "10",
    sort,
    filter,
    ...(search && { search }),
  });
  const needsSignIn = filter === "mine" && !isAuthenticated;
  const { data, loading, error, reload } = useCommunityPage<CommunityPostsPage>(
    needsSignIn ? null : `posts?${query}`,
    user?.id,
  );
  const activeView = views.find((view) => view.key === filter)!;

  function destination(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    for (const [key, value] of Object.entries(values)) {
      if (
        !value ||
        (key === "filter" && value === "all") ||
        (key === "sort" && value === "newest") ||
        (key === "page" && value === "1")
      )
        next.delete(key);
      else next.set(key, value);
    }
    return `/community${next.size ? `?${next}` : ""}`;
  }

  function findTopics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(
      new FormData(event.currentTarget).get("search") ?? "",
    ).trim();
    router.push(destination({ search: value }), { scroll: false });
  }

  function changePage(next: number) {
    router.push(destination({ page: String(next) }), { scroll: false });
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }

  return (
    <div className="min-h-screen bg-[var(--surface-0)] pb-12 text-[var(--ink)] lg:pt-24">
      <header className="border-b border-[var(--surface-border)]">
        <div className="ui-shell py-8 sm:py-10">
          <nav
            aria-label="Breadcrumb"
            className="mb-5 flex items-center gap-2 text-sm text-[var(--ink-muted)]"
          >
            <Link href="/" className="hover:text-[var(--ink)]">
              Home
            </Link>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            <span aria-current="page">Community</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="ui-kicker">Moodies forum</p>
              <h1 className="mt-2 text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">
                Community
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
                A place to talk about Moodies, exchange ideas, and help each
                other.
              </p>
            </div>
            <button
              ref={startButton}
              type="button"
              onClick={() => setComposing((value) => !value)}
              aria-expanded={composing}
              aria-controls="new-topic"
              className="ui-primary-action"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Start a topic
            </button>
          </div>
        </div>
      </header>
      <div className="ui-shell grid items-start gap-6 py-8 sm:py-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
        <aside className="min-w-0 lg:border-r lg:border-[var(--surface-border)] lg:pr-6">
          <nav
            aria-label="Discussion views"
            className="flex flex-wrap gap-2 lg:flex-col"
          >
            {views.map(({ key, label, icon: Icon }) => (
              <Link
                key={key}
                href={destination({ filter: key })}
                scroll={false}
                aria-current={filter === key ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)] ${filter === key ? "bg-[var(--brand-coral)]/10 text-[var(--brand-coral-strong)]" : "text-[var(--ink-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--ink)]"}`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
          <section
            aria-labelledby="forum-guide-heading"
            className="mt-8 hidden border-t border-[var(--surface-border)] pt-6 lg:block"
          >
            <h2
              id="forum-guide-heading"
              className="text-xl font-bold leading-tight text-[var(--ink)]"
            >
              A little forum etiquette
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
              Everyone has a voice here. Be kind, stay on topic, and give people
              room to disagree.
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
              Found a problem? Include what happened and what you expected. Keep
              personal details private.
            </p>
            <p className="mt-5 text-sm leading-6 text-[var(--ink-muted)]">
              For thoughts on a film or series, leave a review on its title
              page.
            </p>
          </section>
        </aside>
        <div className="min-w-0 space-y-5">
          {composing && (
            <section
              id="new-topic"
              aria-labelledby="new-topic-heading"
              className="ui-panel scroll-mt-24 p-5 sm:p-6"
            >
              <h2
                id="new-topic-heading"
                className="mb-4 text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl"
              >
                Start a discussion
              </h2>
              {authLoading ? (
                <p
                  role="status"
                  className="text-sm leading-6 text-[var(--ink-muted)]"
                >
                  Checking your sign-in...
                </p>
              ) : isAuthenticated ? (
                <CommunityComposer
                  onPosted={(post) =>
                    router.push(`/community/${encodeURIComponent(post.id)}`)
                  }
                  onCancel={() => {
                    setComposing(false);
                    startButton.current?.focus();
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-[var(--ink-muted)]">
                    Sign in to start a topic. Everyone can read the forum.
                  </p>
                  <Link href="/auth/login" className="ui-primary-action">
                    Sign in to post
                  </Link>
                </div>
              )}
            </section>
          )}
          <section
            aria-labelledby="community-heading"
            className="min-w-0 overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-1)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--surface-border)] p-5">
              <div>
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  id="community-heading"
                  className="scroll-mt-24 text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl"
                >
                  {activeView.label}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                  {data
                    ? `${data.pagination.total.toLocaleString()} ${data.pagination.total === 1 ? "topic" : "topics"}${search ? ` matching "${search}"` : ""}`
                    : "Conversations about the site, started by you."}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
                Sort by
                <select
                  aria-label="Sort discussions"
                  value={sort}
                  onChange={(event) =>
                    router.push(destination({ sort: event.target.value }), {
                      scroll: false,
                    })
                  }
                  className="min-h-11 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-0)] px-3 text-sm font-semibold text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
                >
                  <option value="newest">Newest topics</option>
                  <option value="most-replies">Most replies</option>
                </select>
              </label>
            </div>
            <form
              onSubmit={findTopics}
              role="search"
              aria-label="Search community discussions"
              className="flex items-center gap-3 border-b border-[var(--surface-border)] px-5 py-3"
            >
              <Search
                className="h-4 w-4 shrink-0 text-[var(--ink-muted)]"
                aria-hidden="true"
              />
              <label htmlFor="forum-search" className="sr-only">
                Search discussions
              </label>
              <input
                key={search}
                id="forum-search"
                name="search"
                type="search"
                defaultValue={search}
                maxLength={100}
                placeholder="Search discussions..."
                className="min-h-11 w-full min-w-0 bg-transparent text-base text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
              />
              <button type="submit" className="ui-secondary-action">
                Search
              </button>
            </form>
            {needsSignIn ? (
              <div className="space-y-4 p-6">
                <p className="text-sm leading-6 text-[var(--ink-muted)]">
                  Sign in to see the discussions you have started.
                </p>
                <Link href="/auth/login" className="ui-primary-action">
                  Sign in
                </Link>
              </div>
            ) : (
              <>
                {loading && (
                  <div
                    role="status"
                    aria-label="Loading discussions"
                    className="divide-y divide-[var(--surface-border)]"
                  >
                    {[0, 1, 2, 3].map((item) => (
                      <div
                        key={item}
                        className="h-24 bg-[var(--surface-2)]/30 motion-safe:animate-pulse"
                      />
                    ))}
                    <span className="sr-only">Loading discussions...</span>
                  </div>
                )}
                {error && (
                  <div role="alert" className="space-y-3 p-6">
                    <h3 className="text-base font-bold text-[var(--ink)]">
                      Couldn&apos;t load discussions
                    </h3>
                    <p className="text-sm leading-6 text-[var(--ink-muted)]">
                      {error}
                    </p>
                    <button
                      type="button"
                      onClick={reload}
                      className="ui-secondary-action"
                    >
                      Try again
                    </button>
                  </div>
                )}
                {data?.posts.length === 0 && (
                  <div className="px-6 py-10 text-center">
                    <MessagesSquare
                      className="mx-auto h-8 w-8 text-[var(--brand-coral-strong)]"
                      aria-hidden="true"
                    />
                    <h3 className="mt-4 text-xl font-bold leading-tight text-[var(--ink)]">
                      {search
                        ? "No discussions match your search"
                        : filter === "unanswered"
                          ? "Every topic has a reply"
                          : filter === "mine"
                            ? "You haven't started a discussion yet"
                            : page > 1
                              ? "No topics on this page"
                              : "The first topic could be yours"}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                      {search
                        ? "Try another search or browse all discussions."
                        : "Share something on your mind about Moodies."}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        search || page > 1
                          ? router.push("/community")
                          : setComposing(true)
                      }
                      className="ui-secondary-action mt-4"
                    >
                      {search || page > 1
                        ? "Browse all discussions"
                        : "Start a discussion"}
                    </button>
                  </div>
                )}
                {data && data.posts.length > 0 && (
                  <table
                    className="w-full table-fixed text-left"
                    aria-label="Community topics"
                  >
                    <thead className="sr-only md:not-sr-only">
                      <tr className="border-b border-[var(--surface-border)] text-xs font-semibold text-[var(--ink-muted)]">
                        <th scope="col" className="px-5 py-3">
                          Topic
                        </th>
                        <th
                          scope="col"
                          className="hidden w-20 px-3 py-3 text-center md:table-cell"
                        >
                          Replies
                        </th>
                        <th
                          scope="col"
                          className="hidden w-44 px-5 py-3 lg:table-cell"
                        >
                          Last activity
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--surface-border)]">
                      {data.posts.map((post) => {
                        const activity = post.latestReply ?? post;
                        return (
                          <tr
                            key={post.id}
                            className="group transition-colors hover:bg-[var(--surface-2)]/60"
                          >
                            <td className="px-4 py-4 sm:px-5">
                              <div className="flex min-w-0 items-start gap-3">
                                <CommunityAvatar user={post.user} />
                                <div className="min-w-0 flex-1">
                                  <Link
                                    href={`/community/${post.id}`}
                                    className="inline-flex min-h-11 items-center text-base font-semibold leading-6 text-[var(--ink)] group-hover:text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)] [overflow-wrap:anywhere]"
                                  >
                                    {post.title}
                                  </Link>
                                  <p className="flex flex-wrap items-center gap-x-2 text-xs leading-5 text-[var(--ink-muted)]">
                                    <span className="[overflow-wrap:anywhere]">
                                      Started by {post.user.username}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <time dateTime={post.createdAt}>
                                      {communityDate(post.createdAt)}
                                    </time>
                                  </p>
                                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs leading-5 text-[var(--ink-muted)] md:hidden">
                                    <span className="inline-flex items-center gap-1">
                                      <MessageCircle
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                      />
                                      {post.replyCount}{" "}
                                      {post.replyCount === 1
                                        ? "reply"
                                        : "replies"}
                                    </span>
                                    <span>
                                      Last activity{" "}
                                      {communityDate(activity.createdAt)}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="hidden px-3 py-4 text-center align-middle md:table-cell">
                              <span className="text-base font-semibold tabular-nums text-[var(--ink)]">
                                {post.replyCount}
                              </span>
                            </td>
                            <td className="hidden px-5 py-4 align-middle lg:table-cell">
                              <p className="truncate text-sm font-semibold text-[var(--ink)]">
                                {activity.user.username}
                              </p>
                              <time
                                dateTime={activity.createdAt}
                                className="text-xs leading-5 text-[var(--ink-muted)]"
                              >
                                {communityDate(activity.createdAt)}
                              </time>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </section>
          {data && data.pagination.totalPages > 1 && (
            <nav
              aria-label="Discussion pages"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
                className="ui-secondary-action disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </button>
              <span className="text-sm text-[var(--ink-muted)]">
                Page {page} of {data.pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= data.pagination.totalPages}
                onClick={() => changePage(page + 1)}
                className="ui-secondary-action disabled:opacity-40"
              >
                Next
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
