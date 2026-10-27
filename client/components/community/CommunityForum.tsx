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
  Heart,
  X,
} from "lucide-react";
import { BadgeMascot } from "@/components/ui/BadgeMascot";
import { useAuth } from "@/app/context/AuthProvider";
import { useCommunityPage } from "@/hooks/useCommunityPage";
import type { CommunityPostsPage } from "@/lib/api/community";
import { CommunityComposer } from "./CommunityComposer";
import { CommunityAvatar, communityDate } from "./CommunityAuthor";
import styles from "./Community.module.css";

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
    <main className="min-h-screen bg-[var(--surface-0)] pb-12 text-[var(--ink)] lg:pt-24">
      <header className="ui-shell pt-6 sm:pt-8">
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
        <div
          className={`${styles.hero} flex items-center justify-between gap-4 p-5 sm:p-8`}
        >
          <div className="relative z-10 max-w-xl">
            <p className="ui-kicker pr-20 sm:pr-0">A shared love of stories</p>
            <h1 className="mt-2 pr-20 text-3xl font-bold leading-none text-[var(--ink)] sm:pr-0 sm:text-4xl">
              Community
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
              Make yourself at home. Share an idea, ask a question, or help
              shape what comes next on Moodies.
            </p>
            <button
              ref={startButton}
              type="button"
              onClick={() => setComposing((value) => !value)}
              aria-expanded={composing}
              aria-controls="new-topic"
              className="ui-primary-action mt-5"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Start a topic
            </button>
          </div>
          <div className={styles.artwork} aria-hidden="true">
            <BadgeMascot
              name="conversation-starter"
              sizes="(min-width: 1024px) 256px, (min-width: 640px) 192px, 80px"
              className="relative h-full w-full"
            />
          </div>
        </div>
      </header>
      <div className="ui-shell grid items-start gap-6 py-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-8">
        <div className="min-w-0 space-y-5">
          <nav aria-label="Discussion views" className="flex flex-wrap gap-2">
            {views.map(({ key, label, icon: Icon }) => (
              <Link
                key={key}
                href={destination({ filter: key })}
                scroll={false}
                aria-current={filter === key ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)] ${filter === key ? "border-[var(--brand-coral)]/40 bg-[var(--brand-coral)]/10 text-[var(--brand-coral-strong)]" : "border-transparent text-[var(--ink-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--ink)]"}`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
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
            className="min-w-0 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
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
              className="flex items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-3 sm:px-4"
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
            {search && (
              <Link
                href={destination({ search: "" })}
                scroll={false}
                className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-[var(--surface-border)] px-3 text-sm text-[var(--ink-muted)]"
              >
                <span className="min-w-0 break-words">
                  Clear search: {search}
                </span>
                <X className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            )}
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
                    className="space-y-3"
                  >
                    {[0, 1, 2, 3].map((item) => (
                      <div
                        key={item}
                        className="h-60 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-1)] motion-safe:animate-pulse"
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
                    <BadgeMascot
                      name={search ? "deep-diver" : "first-post"}
                      sizes="112px"
                      className="h-28 w-28"
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
                        : filter === "unanswered"
                          ? "You're all caught up. Find another conversation to join."
                          : "Share something on your mind about Moodies."}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        search || page > 1 || filter === "unanswered"
                          ? router.push("/community")
                          : setComposing(true)
                      }
                      className="ui-secondary-action mt-4"
                    >
                      {search || page > 1 || filter === "unanswered"
                        ? "Browse all discussions"
                        : "Start a discussion"}
                    </button>
                  </div>
                )}
                {data && data.posts.length > 0 && (
                  <ul className="space-y-3" aria-label="Community topics">
                    {data.posts.map((post) => {
                      const activity = post.latestReply ?? post;
                      return (
                        <li
                          key={post.id}
                          className={`${styles.topic} group p-4 sm:p-5`}
                        >
                          <div className="mb-3 flex min-w-0 items-center gap-3">
                            <CommunityAvatar user={post.user} />
                            <div className="min-w-0 flex-1 text-xs leading-5 text-[var(--ink-muted)]">
                              <Link
                                href={`/profile/${encodeURIComponent(post.user.id)}`}
                                className="block w-fit max-w-full text-sm font-semibold text-[var(--ink)] hover:text-[var(--brand-coral-strong)] [overflow-wrap:anywhere]"
                              >
                                {post.user.username}
                              </Link>
                              <time dateTime={post.createdAt}>
                                {communityDate(post.createdAt)}
                              </time>
                            </div>
                            <span
                              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${post.replyCount === 0 ? "bg-[var(--brand-gold)]/10 text-[var(--brand-gold)]" : "bg-[var(--surface-0)] text-[var(--ink-muted)]"}`}
                            >
                              <MessageCircle
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              {post.replyCount === 0
                                ? "No replies yet"
                                : `${post.replyCount} ${post.replyCount === 1 ? "reply" : "replies"}`}
                            </span>
                          </div>
                          <h3>
                            <Link
                              href={`/community/${post.id}`}
                              className="inline-flex min-h-11 items-center text-lg font-semibold leading-6 text-[var(--ink)] group-hover:text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)] [overflow-wrap:anywhere]"
                            >
                              {post.title}
                            </Link>
                          </h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--ink-muted)] [overflow-wrap:anywhere]">
                            {post.content}
                          </p>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[var(--surface-border)] pt-3 text-xs leading-5 text-[var(--ink-muted)]">
                            <span className="min-w-0 [overflow-wrap:anywhere]">
                              {post.latestReply
                                ? `Latest reply by ${activity.user.username} · ${communityDate(activity.createdAt)}`
                                : post.replyCount === 0
                                  ? "Be the first to join in"
                                  : "Join the conversation"}
                            </span>
                            <Link
                              href={`/community/${post.id}`}
                              aria-label={`Read discussion: ${post.title}`}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-sm font-semibold text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)]"
                            >
                              Read discussion
                              <ArrowRight
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
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
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-28">
          <section
            aria-labelledby="forum-guide-heading"
            className="ui-panel p-5"
          >
            <BadgeMascot
              name="community-star"
              alt="Community star mascot"
              sizes="80px"
              className="mb-3 h-20 w-20"
            />
            <p className="ui-kicker mb-2">You belong here</p>
            <h2
              id="forum-guide-heading"
              className="text-xl font-bold leading-tight text-[var(--ink)]"
            >
              Good conversations start with kindness
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
              Every perspective is welcome. Stay curious, be thoughtful, and
              give each other room to disagree.
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
              Found a problem? Include what happened and what you expected. Keep
              personal details private.
            </p>
            <div className="mt-5 flex items-start gap-2 border-t border-[var(--surface-border)] pt-4 text-xs leading-5 text-[var(--ink-muted)]">
              <Heart
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-coral-strong)]"
                aria-hidden="true"
              />
              A helpful reply can make someone&apos;s day.
            </div>
          </section>
          <section
            aria-labelledby="forum-stories-heading"
            className="rounded-2xl border border-[var(--surface-border)] p-5"
          >
            <h2
              id="forum-stories-heading"
              className="text-xl font-bold leading-tight"
            >
              Looking for your next watch?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              Find a story for your mood. For thoughts on a film or series,
              leave a review on its title page.
            </p>
            <Link
              href="/moods"
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--brand-coral-strong)]"
            >
              Explore by mood
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
