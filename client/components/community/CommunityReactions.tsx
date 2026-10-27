"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  Angry,
  CircleAlert,
  Frown,
  Heart,
  Laugh,
  ThumbsUp,
  SmilePlus,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import {
  communityError,
  communityFetch,
  type ReactionSummary,
  type ReactionType,
} from "@/lib/api/community";
import styles from "./Community.module.css";

const reactions = [
  { type: "LIKE", label: "Like", icon: ThumbsUp },
  { type: "LOVE", label: "Love", icon: Heart },
  { type: "HAHA", label: "Haha", icon: Laugh },
  { type: "WOW", label: "Wow", icon: CircleAlert },
  { type: "SAD", label: "Sad", icon: Frown },
  { type: "ANGRY", label: "Angry", icon: Angry },
] as const;

export function CommunityReactions({
  target,
  summary,
  onChange,
}: {
  target: string;
  summary: ReactionSummary;
  onChange: (summary: ReactionSummary) => void;
}) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  const pickerId = useId();
  useEffect(() => {
    if (!open) return;
    (
      pickerRef.current?.querySelector<HTMLButtonElement>(
        '[aria-pressed="true"]',
      ) ?? pickerRef.current?.querySelector<HTMLButtonElement>("button")
    )?.focus();
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  useEffect(() => {
    if (!pending && restoreFocus.current) {
      restoreFocus.current = false;
      trigger.current?.focus();
    }
  }, [pending]);
  const selected = reactions.find(
    (reaction) => reaction.type === summary.myReaction,
  );
  const SelectedIcon = selected?.icon ?? SmilePlus;
  const total = summary.reactionCounts.reduce(
    (sum, reaction) => sum + reaction.count,
    0,
  );

  async function react(type: ReactionType) {
    if (pending || !isAuthenticated) return;
    setPending(true);
    setError("");
    try {
      const removing = summary.myReaction === type;
      const result = await communityFetch<ReactionSummary>(
        `${target}/reactions`,
        {
          method: removing ? "DELETE" : "POST",
          headers: removing
            ? undefined
            : { "Content-Type": "application/json" },
          body: removing ? undefined : JSON.stringify({ type }),
          signal: AbortSignal.timeout(15000),
        },
      );
      onChange(result);
      restoreFocus.current = true;
      setOpen(false);
    } catch (cause) {
      setError(communityError(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className="min-w-0 max-w-full"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          ref={trigger}
          type="button"
          onClick={() => setOpen((value) => !value)}
          disabled={pending}
          aria-expanded={open}
          aria-controls={open ? pickerId : undefined}
          className={`${styles.reactionTrigger} ${selected ? styles.reactionSelected : ""}`}
        >
          <SelectedIcon className="h-4 w-4" aria-hidden="true" />
          {pending ? "Saving..." : (selected?.label ?? "React")}
        </button>
        {total > 0 && (
          <div
            className="flex flex-wrap items-center gap-2"
            aria-label={`${total} ${total === 1 ? "reaction" : "reactions"}`}
          >
            {reactions.map(({ type, label, icon: Icon }) => {
              const count =
                summary.reactionCounts.find((row) => row.type === type)
                  ?.count ?? 0;
              return count > 0 ? (
                <span
                  key={type}
                  aria-label={`${label}: ${count}`}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 text-xs text-[var(--ink-muted)]"
                >
                  <Icon
                    className="h-3.5 w-3.5 text-[var(--brand-coral-strong)]"
                    aria-hidden="true"
                  />
                  {count}
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>
      {open &&
        (isAuthenticated ? (
          <div
            ref={pickerRef}
            id={pickerId}
            role="group"
            aria-label="Choose a reaction"
            aria-busy={pending}
            className={styles.reactionPicker}
          >
            {reactions.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => void react(type)}
                disabled={pending}
                aria-pressed={summary.myReaction === type}
                className={`${styles.reactionOption} ${summary.myReaction === type ? styles.reactionSelected : ""}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            <span id={pickerId}>
              <Link
                href="/auth/login"
                className="font-semibold text-[var(--brand-coral-strong)] underline underline-offset-4"
              >
                Sign in
              </Link>{" "}
              to react to the conversation.
            </span>
          </p>
        ))}
      {error && (
        <p role="alert" className="mt-2 text-sm leading-6 text-[var(--ink)]">
          {error}
        </p>
      )}
    </div>
  );
}
