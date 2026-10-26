"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { communityError, communityFetch } from "@/lib/api/community";

const fieldClass =
  "w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-0)] px-4 py-3 text-base leading-6 text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)] disabled:opacity-60";

export function CommunityComposer({
  postId,
  onPosted,
  onCancel,
}: {
  postId?: string;
  onPosted: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const prefix = postId ? `reply-${postId}` : "community-post";
  const minLength = postId ? 3 : 10;
  const maxLength = postId ? 500 : 3000;

  useEffect(() => {
    (postId ? contentRef.current : titleRef.current)?.focus();
  }, [postId]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (
      (!postId && title.trim().length < 3) ||
      content.trim().length < minLength
    ) {
      setError(
        `Add ${postId ? "a reply of at least 3 characters" : "a title of at least 3 characters and feedback of at least 10 characters"}. Spaces alone do not count.`,
      );
      return;
    }
    setPending(true);
    setError("");
    try {
      await communityFetch(postId ? `posts/${postId}/replies` : "posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(!postId && { title: title.trim() }),
          content: content.trim(),
        }),
      });
      onPosted();
    } catch (cause) {
      setError(communityError(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-label={postId ? "Write a reply" : "Share website feedback"}
      aria-busy={pending}
      className="space-y-4"
    >
      {!postId && (
        <div>
          <label
            htmlFor={`${prefix}-title`}
            className="mb-2 block text-sm font-semibold text-[var(--ink)]"
          >
            Title
          </label>
          <input
            ref={titleRef}
            id={`${prefix}-title`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            minLength={3}
            maxLength={120}
            disabled={pending}
            className={fieldClass}
            placeholder="What would you like to share?"
            aria-describedby={`${prefix}-title-hint`}
          />
          <p
            id={`${prefix}-title-hint`}
            className="mt-1 text-xs leading-4 text-[var(--ink-muted)]"
          >
            3 to 120 characters.
          </p>
        </div>
      )}
      <div>
        <label
          htmlFor={`${prefix}-content`}
          className="mb-2 block text-sm font-semibold text-[var(--ink)]"
        >
          {postId ? "Your reply" : "Your feedback"}
        </label>
        <textarea
          ref={contentRef}
          id={`${prefix}-content`}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
          minLength={minLength}
          maxLength={maxLength}
          rows={postId ? 3 : 5}
          disabled={pending}
          className={`${fieldClass} resize-y`}
          aria-describedby={`${prefix}-hint${error ? ` ${prefix}-error` : ""}`}
          placeholder={
            postId
              ? "Add your thoughts to the conversation."
              : "Tell us what works, what could be better, or an idea you would love to see on Moodies."
          }
        />
        <p
          id={`${prefix}-hint`}
          className="mt-1 text-xs leading-4 text-[var(--ink-muted)]"
        >
          {minLength} characters minimum. {content.length}/{maxLength}{" "}
          characters.
        </p>
      </div>
      {error && (
        <p
          ref={errorRef}
          id={`${prefix}-error`}
          role="alert"
          tabIndex={-1}
          className="rounded-xl border border-[var(--brand-coral)]/40 bg-[var(--brand-coral)]/10 p-3 text-sm leading-6 text-[var(--ink)]"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="ui-secondary-action disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="ui-primary-action disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          {pending ? "Posting..." : postId ? "Post reply" : "Post feedback"}
        </button>
      </div>
    </form>
  );
}
