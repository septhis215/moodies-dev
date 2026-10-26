"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, MessageCircle, Reply } from "lucide-react";
import { TmdbImage } from "@/components/ui/TmdbImage";
import { useAuth } from "@/app/context/AuthProvider";
import { useCommunityPage } from "@/hooks/useCommunityPage";
import type {
  CommunityAuthor,
  CommunityPost,
  CommunityRepliesPage,
  ReactionSummary,
} from "@/lib/api/community";
import { CommunityComposer } from "./CommunityComposer";
import { CommunityReactions } from "./CommunityReactions";

function Author({
  user,
  createdAt,
}: {
  user: CommunityAuthor;
  createdAt: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link
        href={`/profile/${encodeURIComponent(user.id)}`}
        aria-label={`View ${user.username}'s profile`}
        className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--surface-border)] bg-[var(--surface-2)] text-sm font-bold text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)]"
      >
        {user.avatarUrl ? (
          <TmdbImage
            src={user.avatarUrl}
            alt=""
            width={44}
            height={44}
            unoptimized
            className="h-11 w-11 object-cover"
          />
        ) : (
          user.username.charAt(0).toUpperCase()
        )}
      </Link>
      <div className="min-w-0">
        <Link
          href={`/profile/${encodeURIComponent(user.id)}`}
          className="block break-words text-sm font-semibold leading-5 text-[var(--ink)] hover:text-[var(--brand-coral-strong)] [overflow-wrap:anywhere]"
        >
          {user.username}
        </Link>
        <time
          dateTime={createdAt}
          className="text-xs leading-4 text-[var(--ink-muted)]"
        >
          {new Date(createdAt).toLocaleDateString("en", {
            dateStyle: "medium",
          })}
        </time>
      </div>
    </div>
  );
}

export function CommunityThread({
  post,
  onReactionChange,
  onReplyPosted,
}: {
  post: CommunityPost;
  onReactionChange: (summary: ReactionSummary) => void;
  onReplyPosted: () => void;
}) {
  const { user, isAuthenticated } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [composing, setComposing] = useState(false);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const repliesHeading = useRef<HTMLHeadingElement>(null);
  const { data, setData, loading, error, reload } =
    useCommunityPage<CommunityRepliesPage>(
      expanded ? `posts/${post.id}/replies?page=${page}&limit=10` : null,
      user?.id,
    );
  const replyCount = data?.pagination.total ?? post.replyCount;

  function posted() {
    const total = (data?.pagination.total ?? post.replyCount) + 1;
    setComposing(false);
    setNotice("Your reply has been posted.");
    onReplyPosted();
    setPage(Math.max(1, Math.ceil(total / 10)));
    reload();
    repliesHeading.current?.focus();
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    repliesHeading.current?.focus();
  }

  return (
    <article
      id={`post-${post.id}`}
      aria-labelledby={`post-${post.id}-title`}
      className="ui-panel min-w-0 scroll-mt-24 p-5 sm:p-6"
    >
      <Author user={post.user} createdAt={post.createdAt} />
      <h3
        id={`post-${post.id}-title`}
        className="mt-4 break-words text-xl font-bold leading-tight text-[var(--ink)] [overflow-wrap:anywhere]"
      >
        {post.title}
      </h3>
      <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-[var(--ink-muted)] [overflow-wrap:anywhere]">
        {post.content}
      </p>
      <div className="mt-5 border-t border-[var(--surface-border)] pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CommunityReactions
            target={`posts/${post.id}`}
            summary={post}
            onChange={onReactionChange}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              aria-controls={`replies-${post.id}`}
              className="ui-secondary-action text-sm font-semibold"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              {replyCount} {replyCount === 1 ? "reply" : "replies"}
              {expanded ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(true);
                setComposing(true);
              }}
              className="ui-secondary-action text-sm font-semibold"
            >
              <Reply className="h-4 w-4" aria-hidden="true" />
              Reply
            </button>
          </div>
        </div>
        {notice && (
          <p
            role="status"
            className="mt-2 text-sm leading-6 text-[var(--ink-muted)]"
          >
            {notice}
          </p>
        )}
      </div>
      {expanded && (
        <div
          id={`replies-${post.id}`}
          className="mt-4 space-y-5 border-t border-[var(--surface-border)] pt-5"
          aria-label={`Replies to ${post.title}`}
        >
          <h4
            ref={repliesHeading}
            tabIndex={-1}
            className="text-sm font-semibold leading-5 text-[var(--ink)]"
          >
            Replies
          </h4>
          {loading && (
            <p
              role="status"
              className="text-sm leading-6 text-[var(--ink-muted)]"
            >
              Loading replies...
            </p>
          )}
          {error && (
            <div
              role="alert"
              className="space-y-2 text-sm leading-6 text-[var(--ink-muted)]"
            >
              <p>{error}</p>
              <button
                type="button"
                className="ui-secondary-action"
                onClick={reload}
              >
                Try again
              </button>
            </div>
          )}
          {data?.replies.length === 0 && (
            <p className="text-sm leading-6 text-[var(--ink-muted)]">
              No replies yet. Add your thoughts below.
            </p>
          )}
          {data?.replies.map((reply) => (
            <article
              key={reply.id}
              aria-label={`Reply by ${reply.user.username}`}
              className="min-w-0 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-0)] p-4"
            >
              <Author user={reply.user} createdAt={reply.createdAt} />
              <p className="my-3 whitespace-pre-wrap text-base leading-7 text-[var(--ink-muted)] [overflow-wrap:anywhere]">
                {reply.content}
              </p>
              <CommunityReactions
                target={`replies/${reply.id}`}
                summary={reply}
                onChange={(summary) =>
                  setData(
                    (current) =>
                      current && {
                        ...current,
                        replies: current.replies.map((item) =>
                          item.id === reply.id ? { ...item, ...summary } : item,
                        ),
                      },
                  )
                }
              />
            </article>
          ))}
          {data && data.pagination.totalPages > 1 && (
            <nav
              aria-label={`Reply pages for ${post.title}`}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
                className="ui-secondary-action disabled:opacity-40"
              >
                Previous replies
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
                Next replies
              </button>
            </nav>
          )}
          {isAuthenticated ? (
            composing ? (
              <CommunityComposer
                postId={post.id}
                onPosted={posted}
                onCancel={() => setComposing(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setComposing(true)}
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
              to add your reply.
            </p>
          )}
        </div>
      )}
    </article>
  );
}
