"use client";

import { useEffect, useRef, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
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
  X,
} from "lucide-react";
import { BadgeMascot } from "@/components/ui/BadgeMascot";
import CustomSelect from "@/components/ui/custom-select";
import { useAuth } from "@/app/context/AuthProvider";
import { usePageLoadingVisible } from "@/components/loading/LoadingScreenProvider";
import { useCommunityPage } from "@/hooks/useCommunityPage";
import type { CommunityPostsPage } from "@/lib/api/community";
import { communitySignInHref } from "@/lib/community-navigation";
import { CommunityComposer } from "./CommunityComposer";
import { CommunityAvatar, communityDate } from "./CommunityAuthor";
import styles from "./CommunityForum.module.css";

const views = [
  {
    key: "all",
    label: "All discussions",
    mobileLabel: "All",
    icon: MessagesSquare,
  },
  {
    key: "unanswered",
    label: "Awaiting replies",
    mobileLabel: "Unanswered",
    icon: MessageCircleQuestion,
  },
  {
    key: "mine",
    label: "Your discussions",
    mobileLabel: "Yours",
    icon: UserRound,
  },
] as const;

const prompts = [
  {
    key: "comfort",
    title: "What's your comfort rewatch?",
  },
  {
    key: "discovery",
    title: "What did you watch that stayed with you?",
  },
  {
    key: "next-watch",
    title: "Help me find my next watch",
  },
] as const;

export default function CommunityForum() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const pageLoading = usePageLoadingVisible();
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
  const composing = params.get("compose") === "1";
  const prompt = prompts.find((item) => item.key === params.get("prompt"));
  const startButton = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const query = new URLSearchParams({
    page: String(page),
    limit: "10",
    sort,
    filter,
    ...(search && { search }),
  });
  const checkingPersonal = filter === "mine" && authLoading;
  const needsSignIn = filter === "mine" && !isAuthenticated && !authLoading;
  const { data, loading, error, reload } = useCommunityPage<CommunityPostsPage>(
    needsSignIn || checkingPersonal ? null : `posts?${query}`,
    user?.id,
  );
  const activeView = views.find((view) => view.key === filter)!;
  const listParams = new URLSearchParams(params.toString());
  listParams.delete("compose");
  listParams.delete("prompt");
  const listHref = `/community${listParams.size ? `?${listParams}` : ""}`;
  const restoredHash = useRef("");
  useEffect(() => {
    const hash = window.location.hash;
    if (
      loading ||
      pageLoading ||
      !data ||
      !/^#topic-[0-9a-f-]{36}$/i.test(hash) ||
      restoredHash.current === hash
    )
      return;
    const element = document.getElementById(hash.slice(1));
    if (!element) return;
    const frame = requestAnimationFrame(() => {
      element.scrollIntoView({ block: "center", behavior: "instant" });
      restoredHash.current = hash;
    });
    return () => cancelAnimationFrame(frame);
  }, [data, loading, pageLoading]);

  function destination(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    if (["filter", "sort", "search"].some((key) => key in values))
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

  function startDiscussion(promptKey = "") {
    router.replace(destination({ compose: "1", prompt: promptKey }), {
      scroll: false,
    });
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
        <div className={styles.hero}>
          <div className="flex min-w-0 max-w-xl items-center gap-4">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">
                Community
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
                Talk about what you watched. Find something for tonight.
              </p>
            </div>
            <Image
              src="/images/moods/funny.png"
              alt="Funny mood mascot"
              width={64}
              height={64}
              sizes="64px"
              className="h-16 w-16 shrink-0 object-contain"
            />
          </div>
          <button
            ref={startButton}
            type="button"
            onClick={() =>
              composing
                ? router.replace(listHref, { scroll: false })
                : startDiscussion()
            }
            aria-expanded={composing}
            aria-controls="new-topic"
            className="ui-primary-action shrink-0"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Start a discussion
          </button>
        </div>
      </header>
      <div className="ui-shell grid items-start gap-6 py-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-8">
        <div className="min-w-0 space-y-5">
          <nav aria-label="Discussion views" className={styles.views}>
            {views.map(({ key, label, mobileLabel, icon: Icon }) => (
              <Link
                key={key}
                href={destination({ filter: key })}
                scroll={false}
                aria-current={filter === key ? "page" : undefined}
                className={styles.view}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="sm:hidden">{mobileLabel}</span>
                <span className="hidden sm:inline">{label}</span>
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
                  key={`${user?.id}:${prompt?.key ?? "new"}`}
                  initialTitle={prompt?.title}
                  onPosted={(post) =>
                    router.push(`/community/${encodeURIComponent(post.id)}`)
                  }
                  onCancel={() => {
                    router.replace(listHref, { scroll: false });
                    startButton.current?.focus();
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-[var(--ink-muted)]">
                    Sign in to start a discussion. Everyone can read along.
                  </p>
                  <Link
                    href={communitySignInHref(destination({ compose: "1" }))}
                    className="ui-primary-action"
                  >
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
                    : "What's happening around Moodies."}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm text-[var(--ink-muted)]">
                <span>Sort by</span>
                <CustomSelect
                  label="Sort discussions"
                  widthClass="w-44 max-w-full"
                  value={sort}
                  onChange={(value) =>
                    router.push(destination({ sort: value }), {
                      scroll: false,
                    })
                  }
                  options={[
                    { value: "newest", label: "Newest topics" },
                    { value: "most-replies", label: "Most replies" },
                  ]}
                />
              </div>
            </div>
            <form
              onSubmit={findTopics}
              role="search"
              aria-label="Search community discussions"
              className="flex items-center gap-2 border-b border-[var(--surface-border)] px-3 py-2 sm:px-4"
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
                className="min-h-12 w-full min-w-0 bg-transparent px-2 py-3 text-base text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
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
            {checkingPersonal ? (
              <p
                role="status"
                className="p-6 text-sm leading-6 text-[var(--ink-muted)]"
              >
                Checking your sign-in...
              </p>
            ) : needsSignIn ? (
              <div className="space-y-4 p-6">
                <p className="text-sm leading-6 text-[var(--ink-muted)]">
                  Sign in to see the discussions you have started.
                </p>
                <Link
                  href={communitySignInHref(listHref)}
                  className="ui-primary-action"
                >
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
                        className="h-44 bg-[var(--surface-1)]/40 motion-safe:animate-pulse"
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
                          : "Ask for a recommendation or share something you watched."}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        search || page > 1 || filter === "unanswered"
                          ? router.push("/community")
                          : startDiscussion()
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
                  <ul aria-label="Community topics" className={styles.topics}>
                    {data.posts.map((post) => {
                      const activity = post.latestReply ?? post;
                      return (
                        <li
                          key={post.id}
                          id={`topic-${post.id}`}
                          className={`${styles.topic} group scroll-mt-28`}
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
                            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-[var(--ink-muted)]">
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
                              href={`/community/${post.id}?from=${encodeURIComponent(`${listHref}#topic-${post.id}`)}`}
                              className="inline-flex min-h-11 items-center text-lg font-semibold leading-6 text-[var(--ink)] group-hover:text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)] [overflow-wrap:anywhere]"
                            >
                              {post.title}
                            </Link>
                          </h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--ink-muted)] [overflow-wrap:anywhere]">
                            {post.content}
                          </p>
                          <div className={styles.topicFooter}>
                            <span className="min-w-0 [overflow-wrap:anywhere]">
                              {post.latestReply
                                ? `Latest reply by ${activity.user.username} · ${communityDate(activity.createdAt)}`
                                : post.replyCount === 0
                                  ? "Be the first to join in"
                                  : "Join the conversation"}
                            </span>
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
        <aside className="min-w-0 space-y-6">
          {!composing && !search && filter === "all" && page === 1 && (
            <section
              aria-labelledby="conversation-starters-heading"
              className={styles.starters}
            >
              <h2
                id="conversation-starters-heading"
                className="text-xl font-bold leading-tight text-[var(--ink)]"
              >
                Start with a question
              </h2>
              <div className={styles.promptList}>
                {prompts.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => startDiscussion(item.key)}
                    className={styles.prompt}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section
            aria-labelledby="forum-stories-heading"
            className="border-b border-[var(--surface-border)] pb-6"
          >
            <h2
              id="forum-stories-heading"
              className="text-xl font-bold leading-tight"
            >
              Looking for a film?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              Find a film or series by mood.
            </p>
            <Link
              href="/moods"
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)]"
            >
              Explore moods
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
          <section
            aria-labelledby="forum-guide-heading"
            className="text-sm leading-6 text-[var(--ink-muted)]"
          >
            <h2
              id="forum-guide-heading"
              className="text-xl font-bold leading-tight text-[var(--ink)]"
            >
              Before you post
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
              Discuss the film, not the person. Different tastes are welcome.
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
              Keep spoilers out of titles and previews. Keep personal details
              private.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
