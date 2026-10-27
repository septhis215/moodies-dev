"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, MessageCircle, Reply } from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
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
import styles from "./Community.module.css";

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
}) {
  return (
    <article
      id={`post-${id}`}
      aria-label={
        number === 1
          ? `Original post by ${user.username}`
          : `Reply by ${user.username}`
      }
      className={`${styles.threadPost} ${number === 1 ? styles.originalPost : ""} min-w-0 scroll-mt-24 p-5 sm:p-6`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <CommunityAvatar user={user} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/profile/${encodeURIComponent(user.id)}`}
            className="text-sm font-semibold text-[var(--ink)] hover:text-[var(--brand-coral-strong)] [overflow-wrap:anywhere]"
          >
            {user.username}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs leading-5 text-[var(--ink-muted)]">
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
          className="inline-flex min-h-11 items-center rounded-sm px-2 text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
        >
          #{number}
        </Link>
      </div>
      <div className="mt-5 min-w-0">
        <p className="max-w-3xl whitespace-pre-wrap text-base leading-7 text-[var(--ink)] [overflow-wrap:anywhere]">
          {content}
        </p>
        <div className="mt-5 border-t border-[var(--surface-border)] pt-4">
          <CommunityReactions
            target={number === 1 ? `posts/${id}` : `replies/${id}`}
            summary={summary}
            onChange={onReact}
          />
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
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const topic = useCommunityPage<CommunityPost>(`posts/${postId}`, user?.id);
  const replies = useCommunityPage<CommunityRepliesPage>(
    `posts/${postId}/replies?page=${page}&limit=10`,
    user?.id,
  );
  const [composing, setComposing] = useState(false);
  const [notice, setNotice] = useState("");
  const composerRef = useRef<HTMLElement>(null);
  const replyTrigger = useRef<HTMLButtonElement>(null);
  const repliesHeading = useRef<HTMLHeadingElement>(null);
  const post = topic.data;
  const replyCount = replies.data?.pagination.total ?? post?.replyCount ?? 0;

  function openReply() {
    setComposing(true);
    composerRef.current?.scrollIntoView({
      block: "start",
      behavior: "instant",
    });
  }

  function posted(reply: CommunityPost | CommunityReply) {
    const lastPage = Math.max(1, Math.ceil((replyCount + 1) / 10));
    setComposing(false);
    setNotice("Your reply has been posted.");
    topic.setData(
      (current) => current && { ...current, replyCount: replyCount + 1 },
    );
    replies.reload();
    router.replace(`/community/${postId}?page=${lastPage}#post-${reply.id}`, {
      scroll: false,
    });
    repliesHeading.current?.focus();
  }

  return (
    <main className="min-h-screen bg-[var(--surface-0)] pb-12 text-[var(--ink)] lg:pt-24">
      <div className="ui-shell max-w-5xl py-6 sm:py-8">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex flex-wrap items-center gap-2 text-sm text-[var(--ink-muted)]"
        >
          <Link href="/" className="hover:text-[var(--ink)]">
            Home
          </Link>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          <Link href="/community" className="hover:text-[var(--ink)]">
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
              <Link href="/community" className="ui-secondary-action">
                Back to discussions
              </Link>
            </div>
          </div>
        )}
        {post && (
          <>
            <header className={`${styles.hero} mb-6 p-5 sm:p-6`}>
              <p className="ui-kicker">Community discussion</p>
              <h1 className="mt-2 max-w-4xl text-3xl font-bold leading-tight text-[var(--ink)] sm:text-4xl [overflow-wrap:anywhere]">
                {post.title}
              </h1>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <p className="flex flex-wrap items-center gap-x-3 text-sm leading-6 text-[var(--ink-muted)]">
                  <span>
                    Started by{" "}
                    <Link
                      href={`/profile/${encodeURIComponent(post.user.id)}`}
                      className="font-semibold text-[var(--ink)] hover:text-[var(--brand-coral-strong)] [overflow-wrap:anywhere]"
                    >
                      {post.user.username}
                    </Link>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    {replyCount} {replyCount === 1 ? "reply" : "replies"}
                  </span>
                </p>
                <button
                  ref={replyTrigger}
                  type="button"
                  onClick={openReply}
                  className="ui-primary-action"
                >
                  <Reply className="h-4 w-4" aria-hidden="true" />
                  Reply to topic
                </button>
              </div>
            </header>
            <div className="space-y-6">
              <DiscussionPost
                id={post.id}
                user={post.user}
                content={post.content}
                createdAt={post.createdAt}
                number={1}
                starter
                summary={post}
                href={`/community/${postId}#post-${post.id}`}
                onReact={(summary) =>
                  topic.setData(
                    (current) => current && { ...current, ...summary },
                  )
                }
              />
              <section
                aria-labelledby="discussion-replies-heading"
                className="space-y-4"
              >
                <h2
                  ref={repliesHeading}
                  tabIndex={-1}
                  id="discussion-replies-heading"
                  className="scroll-mt-24 flex items-center gap-3 text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl"
                >
                  Replies
                  <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-1)] px-2.5 py-1 font-sans text-sm font-semibold text-[var(--ink-muted)]">
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
                    href={`/community/${postId}?page=${page}#post-${reply.id}`}
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
                  href={`/community/${postId}?page=${Math.max(1, page - 1)}#discussion-replies-heading`}
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
                  href={`/community/${postId}?page=${Math.min(replies.data.pagination.totalPages, page + 1)}#discussion-replies-heading`}
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
              id="join-discussion"
              aria-labelledby="reply-composer-heading"
              className="mt-6 scroll-mt-24 border-t border-[var(--surface-border)] pt-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <BadgeMascot
                  name="community-star"
                  sizes="64px"
                  className="h-16 w-16"
                />
                <div>
                  <h2
                    id="reply-composer-heading"
                    className="text-xl font-bold leading-tight text-[var(--ink)] sm:text-2xl"
                  >
                    Join the conversation
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                    What do you think?
                  </p>
                </div>
              </div>
              {isAuthenticated ? (
                composing ? (
                  <div>
                    <CommunityComposer
                      postId={postId}
                      onPosted={posted}
                      onCancel={() => {
                        setComposing(false);
                        replyTrigger.current?.focus();
                      }}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openReply}
                    className="ui-secondary-action"
                  >
                    <Reply className="h-4 w-4" aria-hidden="true" />
                    Write a reply
                  </button>
                )
              ) : (
                <p className="text-sm leading-6 text-[var(--ink-muted)]">
                  <Link
                    href="/auth/login"
                    className="font-semibold text-[var(--brand-coral-strong)] underline underline-offset-4"
                  >
                    Sign in
                  </Link>{" "}
                  to add your reply. Everyone can follow the discussion.
                </p>
              )}
            </section>
            <Link
              href="/community"
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
