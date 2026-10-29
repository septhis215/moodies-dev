"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Link2,
  MessageCircle,
  Reply,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import { usePageLoadingVisible } from "@/components/loading/LoadingScreenProvider";
import { useCommunityPage } from "@/hooks/useCommunityPage";
import type {
  CommunityAuthor,
  CommunityPost,
  CommunityReply,
  CommunityRepliesPage,
  ReactionSummary,
} from "@/lib/api/community";
import { CommunityAvatar, communityDate } from "./CommunityAuthor";
import { CommunityComposer } from "./CommunityComposer";
import { CommunityReactions } from "./CommunityReactions";
import { BadgeMascot } from "@/components/ui/BadgeMascot";
import {
  communityReturnHref,
  communitySignInHref,
} from "@/lib/community-navigation";
import styles from "./CommunityThread.module.css";

function DiscussionPost({
  id,
  user,
  content,
  createdAt,
  number,
  starter,
  summary,
  href,
  onReact,
  title,
  replyAction,
}: {
  id: string;
  user: CommunityAuthor;
  content: string;
  createdAt: string;
  number: number;
  starter: boolean;
  summary: ReactionSummary;
  href: string;
  onReact: (summary: ReactionSummary) => void;
  title?: string;
  replyAction?: ReactNode;
}) {
  return (
    <article
      id={`post-${id}`}
      tabIndex={-1}
      aria-label={
        number === 1
          ? `Original post by ${user.username}`
          : `Reply by ${user.username}`
      }
      className={`${number === 1 ? styles.originalPost : styles.threadPost} min-w-0 scroll-mt-24`}
    >
      {title && (
        <header className="mb-5 sm:mb-6">
          <h1 className="text-3xl font-bold leading-tight text-[var(--ink)] sm:text-4xl [overflow-wrap:anywhere]">
            {title}
          </h1>
        </header>
      )}
      <div className={number === 1 ? "" : styles.replyLayout}>
        {number !== 1 && <CommunityAvatar user={user} />}
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            {number === 1 && <CommunityAvatar user={user} />}
            <div className="min-w-0 flex-1">
              <Link
                href={`/profile/${encodeURIComponent(user.id)}`}
                className="text-sm font-semibold text-[var(--ink)] hover:text-[var(--brand-coral-strong)] [overflow-wrap:anywhere]"
              >
                {user.username}
              </Link>
              <div className="flex flex-wrap items-center gap-x-2 text-xs leading-5 text-[var(--ink-muted)]">
                {starter && (
                  <span className="font-semibold text-[var(--brand-coral-strong)]">
                    Topic starter
                  </span>
                )}
                <time dateTime={createdAt}>{communityDate(createdAt)}</time>
              </div>
            </div>
            <Link
              href={href}
              aria-label={`Link to post ${number}`}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-xs font-semibold text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
              title="Link to this post"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className={`${number === 1 ? "mt-5" : "mt-2"} min-w-0`}>
            <p className="max-w-3xl whitespace-pre-wrap text-base leading-7 text-[var(--ink)] [overflow-wrap:anywhere]">
              {content}
            </p>
            <div
              className={`${number === 1 ? "mt-6" : "mt-3"} flex flex-wrap items-start justify-between gap-3`}
            >
              <CommunityReactions
                target={number === 1 ? `posts/${id}` : `replies/${id}`}
                summary={summary}
                onChange={onReact}
              />
              {replyAction}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function CommunityThread({
  postId,
  page = 1,
}: {
  postId: string;
  page?: number;
}) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const pageLoading = usePageLoadingVisible();
  const router = useRouter();
  const params = useSearchParams();
  const returnHref = communityReturnHref(params.get("from"));
  const topic = useCommunityPage<CommunityPost>(`posts/${postId}`, user?.id);
  const replies = useCommunityPage<CommunityRepliesPage>(
    `posts/${postId}/replies?page=${page}&limit=10`,
    user?.id,
  );
  const [focusSignal, setFocusSignal] = useState(0);
  const [notice, setNotice] = useState("");
  const composerRef = useRef<HTMLElement>(null);
  const replyTrigger = useRef<HTMLButtonElement>(null);
  const repliesHeading = useRef<HTMLHeadingElement>(null);
  const signInRef = useRef<HTMLAnchorElement>(null);
  const pendingReply = useRef<string | null>(null);
  const restoredReplyFocus = useRef(false);
  const post = topic.data;
  const replyCount = replies.data?.pagination.total ?? post?.replyCount ?? 0;

  function threadHref(nextPage = page, hash = "") {
    const query = new URLSearchParams();
    if (nextPage > 1) query.set("page", String(nextPage));
    if (params.has("from")) query.set("from", returnHref);
    return `/community/${postId}${query.size ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
  }

  useEffect(() => {
    if (
      authLoading ||
      pageLoading ||
      topic.loading ||
      !post ||
      restoredReplyFocus.current ||
      window.location.hash !== "#join-discussion"
    )
      return;
    const target =
      composerRef.current?.querySelector<HTMLElement>("textarea, a");
    target?.focus();
    restoredReplyFocus.current = document.activeElement === target;
  }, [authLoading, pageLoading, topic.loading, post, isAuthenticated]);

  useEffect(() => {
    const id = pendingReply.current;
    if (
      !id ||
      replies.loading ||
      !replies.data?.replies.some((reply) => reply.id === id)
    )
      return;
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(`post-${id}`);
      if (!element) return;
      element.focus({ preventScroll: true });
      element.scrollIntoView({ block: "center", behavior: "instant" });
      pendingReply.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [replies.data, replies.loading]);

  function openReply() {
    setFocusSignal((value) => value + 1);
    composerRef.current?.scrollIntoView({
      block: "start",
      behavior: "instant",
    });
    if (!isAuthenticated) signInRef.current?.focus({ preventScroll: true });
  }

  function posted(reply: CommunityPost | CommunityReply) {
    const lastPage = Math.max(1, Math.ceil((replyCount + 1) / 10));
    pendingReply.current = reply.id;
    setNotice("Your reply has been posted.");
    topic.setData(
      (current) => current && { ...current, replyCount: replyCount + 1 },
    );
    replies.reload();
    router.replace(threadHref(lastPage, `post-${reply.id}`), {
      scroll: false,
    });
  }

  return (
    <main
      className={`${styles.threadPage} min-h-screen bg-[var(--surface-0)] pb-12 text-[var(--ink)] lg:pt-24`}
    >
      <div className="ui-shell max-w-4xl py-6 sm:py-8">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex flex-wrap items-center gap-2 text-sm text-[var(--ink-muted)]"
        >
          <Link href="/" className="hover:text-[var(--ink)]">
            Home
          </Link>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          <Link
            href={returnHref}
            className="inline-flex min-h-11 items-center hover:text-[var(--ink)]"
          >
            Community
          </Link>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          <span aria-current="page">Discussion</span>
        </nav>
        {topic.loading && (
          <div
            role="status"
            aria-label="Loading discussion"
            className="h-64 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-6"
          >
            <h1 className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">
              Opening discussion...
            </h1>
          </div>
        )}
        {topic.error && (
          <div role="alert" className="ui-panel space-y-4 p-6">
            <h1 className="text-3xl font-bold leading-none text-[var(--ink)] sm:text-4xl">
              Discussion unavailable
            </h1>
            <p className="text-sm leading-6 text-[var(--ink-muted)]">
              {topic.error}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="ui-secondary-action"
                onClick={topic.reload}
              >
                Try again
              </button>
              <Link href={returnHref} className="ui-secondary-action">
                Back to discussions
              </Link>
            </div>
          </div>
        )}
        {post && (
          <>
            <div className="space-y-6">
              <DiscussionPost
                title={post.title}
                replyAction={
                  <button
                    ref={replyTrigger}
                    type="button"
                    onClick={openReply}
                    className="ui-secondary-action"
                  >
                    <Reply className="h-4 w-4" aria-hidden="true" />
                    Reply to topic
                  </button>
                }
                id={post.id}
                user={post.user}
                content={post.content}
                createdAt={post.createdAt}
                number={1}
                starter
                summary={post}
                href={threadHref(1, `post-${post.id}`)}
                onReact={(summary) =>
                  topic.setData(
                    (current) => current && { ...current, ...summary },
                  )
                }
              />
              <section
                aria-labelledby="discussion-replies-heading"
                className={styles.conversation}
              >
                <h2
                  ref={repliesHeading}
                  tabIndex={-1}
                  id="discussion-replies-heading"
                  className="scroll-mt-24 mb-1 flex items-center gap-3 border-b border-[var(--surface-border)] pb-4 text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl"
                >
                  <MessageCircle
                    className="h-5 w-5 text-[var(--brand-coral-strong)]"
                    aria-hidden="true"
                  />
                  Replies
                  <span className="text-sm font-medium text-[var(--ink-muted)]">
                    {replyCount}
                  </span>
                </h2>
                {replies.loading && (
                  <p
                    role="status"
                    className="p-6 text-sm leading-6 text-[var(--ink-muted)]"
                  >
                    Loading replies...
                  </p>
                )}
                {replies.error && (
                  <div role="alert" className="space-y-3 p-6">
                    <p className="text-sm leading-6 text-[var(--ink-muted)]">
                      {replies.error}
                    </p>
                    <button
                      type="button"
                      className="ui-secondary-action"
                      onClick={replies.reload}
                    >
                      Try loading replies again
                    </button>
                  </div>
                )}
                {replies.data?.replies.length === 0 && (
                  <div className="flex items-center gap-4 rounded-2xl border border-dashed border-[var(--surface-border)] p-5">
                    <BadgeMascot
                      name="review-voice"
                      sizes="64px"
                      className="h-16 w-16"
                    />
                    <p className="text-sm leading-6 text-[var(--ink-muted)]">
                      {page === 1
                        ? "Be the first to join this discussion."
                        : "No replies on this page."}
                    </p>
                  </div>
                )}
                {replies.data?.replies.map((reply, index) => (
                  <DiscussionPost
                    key={reply.id}
                    id={reply.id}
                    user={reply.user}
                    content={reply.content}
                    createdAt={reply.createdAt}
                    number={(page - 1) * 10 + index + 2}
                    starter={reply.user.id === post.user.id}
                    summary={reply}
                    href={threadHref(page, `post-${reply.id}`)}
                    onReact={(summary) =>
                      replies.setData(
                        (current) =>
                          current && {
                            ...current,
                            replies: current.replies.map((item) =>
                              item.id === reply.id
                                ? { ...item, ...summary }
                                : item,
                            ),
                          },
                      )
                    }
                  />
                ))}
              </section>
            </div>
            {replies.data && replies.data.pagination.totalPages > 1 && (
              <nav
                aria-label="Reply pages"
                className="mt-5 flex flex-wrap items-center justify-between gap-3"
              >
                <Link
                  href={threadHref(
                    Math.max(1, page - 1),
                    "discussion-replies-heading",
                  )}
                  aria-disabled={page <= 1}
                  tabIndex={page <= 1 ? -1 : undefined}
                  className={`ui-secondary-action ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
                >
                  Previous replies
                </Link>
                <span className="text-sm text-[var(--ink-muted)]">
                  Page {page} of {replies.data.pagination.totalPages}
                </span>
                <Link
                  href={threadHref(
                    Math.min(replies.data.pagination.totalPages, page + 1),
                    "discussion-replies-heading",
                  )}
                  aria-disabled={page >= replies.data.pagination.totalPages}
                  tabIndex={
                    page >= replies.data.pagination.totalPages ? -1 : undefined
                  }
                  className={`ui-secondary-action ${page >= replies.data.pagination.totalPages ? "pointer-events-none opacity-40" : ""}`}
                >
                  Next replies
                </Link>
              </nav>
            )}
            <p
              role="status"
              className="mt-4 text-sm leading-6 text-[var(--ink-muted)]"
            >
              {notice}
            </p>
            <section
              ref={composerRef}
              id={isAuthenticated ? undefined : "join-discussion"}
              aria-labelledby="reply-composer-heading"
              className={`${styles.composer} mt-6 scroll-mt-24`}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2
                  id="reply-composer-heading"
                  className="text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl"
                >
                  Add a reply
                </h2>
                <Image
                  src="/images/moods/cozy.png"
                  alt=""
                  width={48}
                  height={48}
                  sizes="48px"
                  className="h-12 w-12 shrink-0 object-contain"
                />
              </div>
              {authLoading ? (
                <p
                  role="status"
                  className="text-sm leading-6 text-[var(--ink-muted)]"
                >
                  Checking your sign-in...
                </p>
              ) : isAuthenticated ? (
                <CommunityComposer
                  key={user?.id}
                  postId={postId}
                  focusSignal={focusSignal}
                  onPosted={posted}
                  onCancel={() => replyTrigger.current?.focus()}
                />
              ) : (
                <div className="space-y-3">
                  <p className="text-sm leading-6 text-[var(--ink-muted)]">
                    Sign in to add your reply. Everyone can follow the
                    discussion.
                  </p>
                  <Link
                    ref={signInRef}
                    href={communitySignInHref(
                      threadHref(page, "join-discussion"),
                    )}
                    className="ui-primary-action"
                  >
                    Sign in to reply
                  </Link>
                </div>
              )}
            </section>
            <Link
              href={returnHref}
              className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--brand-coral-strong)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to discussions
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
