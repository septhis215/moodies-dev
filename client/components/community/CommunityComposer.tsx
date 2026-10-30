"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import {
  communityDraftKey,
  readCommunityDraft,
  saveCommunityDraft,
} from "@/lib/community-drafts";
import {
  communityError,
  communityFetch,
  type CommunityPost,
  type CommunityReply,
} from "@/lib/api/community";

const fieldClass =
  "min-h-14 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-0)] px-5 py-4 text-base leading-6 text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-coral-strong)] disabled:opacity-60";

export function CommunityComposer({
  postId,
  onPosted,
  onCancel,
  initialTitle = "",
  initialContent = "",
  focusSignal = 0,
}: {
  postId?: string;
  onPosted: (post: CommunityPost | CommunityReply) => void;
  onCancel: () => void;
  initialTitle?: string;
  initialContent?: string;
  focusSignal?: number;
}) {
  const { user } = useAuth();
  const storageKey = user?.id ? communityDraftKey(user.id, postId) : "";
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [draftStatus, setDraftStatus] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const [validated, setValidated] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const prefix = postId ? `reply-${postId}` : "community-post";
  const contentId = postId ? "join-discussion" : `${prefix}-content`;
  const minLength = postId ? 3 : 10;
  const maxLength = postId ? 500 : 3000;
  const titleInvalid =
    !postId &&
    validated &&
    (title.trim().length < 3 || title.trim().length > 120);
  const contentInvalid =
    validated &&
    (content.trim().length < minLength || content.trim().length > maxLength);

  useEffect(() => {
    const saved = storageKey ? readCommunityDraft(storageKey) : null;
    setTitle(saved?.title ?? initialTitle);
    setContent(saved?.content.slice(0, maxLength) ?? initialContent);
    setDraftStatus(saved ? "Your draft was restored in this tab." : "");
  }, [storageKey, initialTitle, initialContent, maxLength]);
  useEffect(() => {
    if (!postId || focusSignal > 0)
      (postId ? contentRef.current : titleRef.current)?.focus();
  }, [postId, focusSignal]);
  useEffect(() => {
    const field = contentRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [content]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function updateDraft(nextTitle: string, nextContent: string) {
    setTitle(nextTitle);
    setContent(nextContent);
    setDiscarding(false);
    const saved =
      storageKey &&
      saveCommunityDraft(storageKey, {
        title: nextTitle,
        content: nextContent,
      });
    setDraftStatus(
      saved
        ? "Draft saved in this tab."
        : "Draft could not be saved. Keep this page open while you write.",
    );
  }

  function discardDraft() {
    if (pending) return;
    updateDraft("", "");
    setError("");
    setValidated(false);
    setDraftStatus("Draft discarded.");
    (postId ? contentRef.current : titleRef.current)?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setValidated(true);
    if (
      (!postId && (title.trim().length < 3 || title.trim().length > 120)) ||
      content.trim().length < minLength ||
      content.trim().length > maxLength
    ) {
      setError(
        `Use ${postId ? "3 to 500 characters for your reply" : "3 to 120 characters for the title and 10 to 3,000 for your thoughts"}. Spaces alone do not count.`,
      );
      return;
    }
    setPending(true);
    setError("");
    try {
      const posted = await communityFetch<CommunityPost | CommunityReply>(
        postId ? `posts/${postId}/replies` : "posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(!postId && { title: title.trim() }),
            content: content.trim(),
          }),
        },
      );
      if (storageKey)
        saveCommunityDraft(storageKey, { title: "", content: "" });
      setTitle("");
      setContent("");
      setValidated(false);
      setDraftStatus("");
      onPosted(posted);
    } catch (cause) {
      setError(communityError(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-label={postId ? "Write a reply" : "Start a discussion"}
      aria-busy={pending}
      className="space-y-4"
    >
      {!postId && (
        <div>
          <label
            htmlFor={`${prefix}-title`}
            className="mb-2 block text-sm font-semibold text-[var(--ink)]"
          >
            Discussion title
          </label>
          <input
            ref={titleRef}
            id={`${prefix}-title`}
            value={title}
            onChange={(event) => updateDraft(event.target.value, content)}
            required
            minLength={3}
            maxLength={120}
            disabled={pending}
            className={fieldClass}
            placeholder="What would you like to share?"
            aria-invalid={titleInvalid || undefined}
            aria-describedby={`${prefix}-title-hint${titleInvalid ? ` ${prefix}-error` : ""}`}
          />
          <p
            id={`${prefix}-title-hint`}
            className="mt-1 text-xs leading-4 text-[var(--ink-muted)]"
          >
            A clear, specific title helps people find your discussion. 3 to 120
            characters.
          </p>
        </div>
      )}
      <div>
        <label
          htmlFor={contentId}
          className="mb-2 block text-sm font-semibold text-[var(--ink)]"
        >
          {postId ? "Your reply" : "Your thoughts"}
        </label>
        <textarea
          ref={contentRef}
          id={contentId}
          value={content}
          onChange={(event) => updateDraft(title, event.target.value)}
          required
          minLength={minLength}
          maxLength={maxLength}
          rows={postId ? 3 : 5}
          disabled={pending}
          className={`${fieldClass} resize-none overflow-auto`}
          aria-invalid={contentInvalid || undefined}
          aria-describedby={`${prefix}-hint${error ? ` ${prefix}-error` : ""}`}
          placeholder={
            postId
              ? "Add your thoughts to the conversation."
              : "Share a take, ask for a recommendation, or tell us how a story made you feel."
          }
        />
        <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs leading-5 text-[var(--ink-muted)]">
          <p id={`${prefix}-hint`}>
            Everyone can read this. Keep personal details private. {minLength}{" "}
            characters minimum.
          </p>
          <span>
            {content.length}/{maxLength} characters
          </span>
        </div>
      </div>
      <p className="text-xs leading-5 text-[var(--ink-muted)]">
        {draftStatus ||
          "Your draft stays in this tab until you post, discard it, or sign out."}
      </p>
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
      <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--surface-border)] pt-4">
        {discarding ? (
          <div
            className="flex w-full flex-wrap items-center justify-end gap-2"
            role="group"
            aria-label="Discard draft?"
          >
            <p className="mr-auto text-sm text-[var(--ink)]">
              Discard this draft?
            </p>
            <button
              type="button"
              disabled={pending}
              className="ui-secondary-action"
              onClick={() => setDiscarding(false)}
            >
              Keep writing
            </button>
            <button
              type="button"
              disabled={pending}
              className="ui-secondary-action"
              onClick={discardDraft}
            >
              Discard draft
            </button>
          </div>
        ) : (
          (title || content) && (
            <button
              type="button"
              onClick={() => setDiscarding(true)}
              disabled={pending}
              className="mr-auto inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
            >
              Discard draft
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => {
            if (
              storageKey &&
              saveCommunityDraft(storageKey, { title, content })
            )
              onCancel();
            else
              setError(
                "Your draft could not be saved in this browser. Keep this page open or copy your text before leaving.",
              );
          }}
          disabled={pending}
          className="ui-secondary-action disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save for later
        </button>
        <button
          type="submit"
          disabled={pending}
          className="ui-primary-action disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          {pending ? "Posting..." : postId ? "Post reply" : "Post discussion"}
        </button>
      </div>
    </form>
  );
}
