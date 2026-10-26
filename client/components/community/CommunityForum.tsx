"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MessageCircle, PenLine } from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import { TmdbImage } from "@/components/ui/TmdbImage";
import { useCommunityPage } from "@/hooks/useCommunityPage";
import type { CommunityPostsPage } from "@/lib/api/community";
import { CommunityComposer } from "./CommunityComposer";
import { CommunityThread } from "./CommunityThread";

export default function CommunityForum() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [composing, setComposing] = useState(false);
  const [notice, setNotice] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const composeRef = useRef<HTMLDivElement>(null);
  const { data, setData, loading, error, reload } =
    useCommunityPage<CommunityPostsPage>(
      `posts?page=${page}&limit=10`,
      user?.id,
    );

  function posted() {
    setComposing(false);
    setNotice(
      "Your feedback has been posted. Thank you for helping shape Moodies.",
    );
    setPage(1);
    reload();
    headingRef.current?.focus();
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }

  return (
    <div className="min-h-screen bg-[var(--surface-0)] pb-12 text-[var(--ink)]">
      <header className="border-b border-[var(--surface-border)] bg-[var(--surface-1)] lg:pt-24">
        <div className="ui-shell flex items-center justify-between gap-6 py-8 sm:py-10">
          <div className="max-w-3xl">
            <p className="ui-kicker">A space for your voice</p>
            <h1 className="mt-2 text-balance text-[2.1rem] font-bold leading-[0.98] tracking-normal text-[var(--ink)] min-[390px]:text-[2.45rem] sm:text-[clamp(2.45rem,4.6vw,4rem)] sm:leading-[0.96] xl:text-[clamp(2.45rem,4.2vw,4.8rem)]">
              The Moodies community
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
              Help shape your next visit. Share feedback about Moodies, suggest
              an idea, or join a conversation with people who love finding their
              next watch.
            </p>
            <button
              type="button"
              onClick={() => {
                setComposing(true);
                composeRef.current?.scrollIntoView({
                  block: "start",
                  behavior: "instant",
                });
              }}
              className="ui-primary-action mt-5"
            >
              <PenLine className="h-4 w-4" aria-hidden="true" />
              Share feedback
            </button>
          </div>
          <TmdbImage
            src="/images/moods/happy.png"
            alt="Happy mood mascot"
            width={180}
            height={180}
            loading="eager"
            className="hidden h-40 w-40 shrink-0 object-contain sm:block lg:h-44 lg:w-44"
          />
        </div>
      </header>

      <section
        className="ui-shell scroll-mt-24 py-8 sm:py-10"
        aria-labelledby="community-heading"
      >
        <div className="mb-5 flex items-end justify-between gap-5">
          <div>
            <h2
              ref={headingRef}
              tabIndex={-1}
              id="community-heading"
              className="scroll-mt-24 text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl"
            >
              Community conversations
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
              Your experiences and ideas, with the newest feedback first.
            </p>
          </div>
        </div>
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div ref={composeRef} className="min-w-0 scroll-mt-24 space-y-5">
            {composing && (
              <section
                className="ui-panel p-5 sm:p-6"
                aria-labelledby="compose-heading"
              >
                <h2
                  id="compose-heading"
                  className="mb-4 text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl"
                >
                  Share your feedback
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
                    onPosted={posted}
                    onCancel={() => setComposing(false)}
                  />
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm leading-6 text-[var(--ink-muted)]">
                      Sign in to share your feedback and join the conversation.
                      Everyone can read the community.
                    </p>
                    <Link href="/auth/login" className="ui-primary-action">
                      Sign in to post
                    </Link>
                  </div>
                )}
              </section>
            )}
            {notice && (
              <p
                role="status"
                className="text-sm leading-6 text-[var(--ink-muted)]"
              >
                {notice}
              </p>
            )}
            {loading && (
              <div
                role="status"
                aria-label="Loading community conversations"
                className="space-y-5"
              >
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="ui-panel h-52 motion-safe:animate-pulse"
                  >
                    <span className="sr-only">Loading feedback...</span>
                  </div>
                ))}
              </div>
            )}
            {error && (
              <div role="alert" className="ui-panel space-y-3 p-6">
                <h3 className="text-xl font-bold leading-tight text-[var(--ink)]">
                  Couldn&apos;t load the community
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
              <div className="ui-panel py-10 px-6 text-center">
                <MessageCircle
                  className="mx-auto h-9 w-9 text-[var(--brand-coral-strong)]"
                  aria-hidden="true"
                />
                <h3 className="mt-4 text-xl font-bold leading-tight text-[var(--ink)]">
                  {page === 1
                    ? "Start the first conversation"
                    : "No conversations on this page"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                  {page === 1
                    ? "Have an idea or something to share about the website? Your feedback can help make Moodies better for everyone."
                    : "Go back to the latest feedback to see what people are sharing."}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    page === 1 ? setComposing(true) : changePage(1)
                  }
                  className="ui-secondary-action mt-4"
                >
                  {page === 1
                    ? "Write the first post"
                    : "Back to latest feedback"}
                </button>
              </div>
            )}
            {data?.posts.map((post) => (
              <CommunityThread
                key={`${user?.id ?? "guest"}-${post.id}`}
                post={post}
                onReactionChange={(summary) =>
                  setData(
                    (current) =>
                      current && {
                        ...current,
                        posts: current.posts.map((item) =>
                          item.id === post.id ? { ...item, ...summary } : item,
                        ),
                      },
                  )
                }
                onReplyPosted={() =>
                  setData(
                    (current) =>
                      current && {
                        ...current,
                        posts: current.posts.map((item) =>
                          item.id === post.id
                            ? { ...item, replyCount: item.replyCount + 1 }
                            : item,
                        ),
                      },
                  )
                }
              />
            ))}
            {data && data.pagination.totalPages > 1 && (
              <nav
                aria-label="Community pages"
                className="flex flex-wrap items-center justify-between gap-3 pt-3"
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
          <aside
            className="ui-panel min-w-0 p-5 sm:p-6"
            aria-labelledby="community-guide-heading"
          >
            <p className="ui-kicker">Everyone is welcome</p>
            <h2
              id="community-guide-heading"
              className="mt-2 text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl"
            >
              Make yourself at home
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
              This is your space to talk about using Moodies. Tell us about a
              feature you enjoy, an issue you noticed, or an idea for what comes
              next.
            </p>
            <ul className="mt-4 list-disc space-y-3 pl-4 text-sm leading-6 text-[var(--ink-muted)]">
              <li>Be kind to the people behind each post.</li>
              <li>
                Share useful details so others can understand your feedback.
              </li>
              <li>Keep passwords and personal information private.</li>
            </ul>
            <p className="mt-5 border-t border-[var(--surface-border)] pt-4 text-sm leading-6 text-[var(--ink-muted)]">
              Want to share thoughts on a film or series? Leave a review on its
              title page.
            </p>
            <Link
              href="/movies"
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--brand-coral-strong)] hover:underline"
            >
              Explore movies
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </section>
    </div>
  );
}
