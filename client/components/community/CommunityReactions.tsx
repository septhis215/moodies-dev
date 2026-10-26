"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Angry,
  CircleAlert,
  Frown,
  Heart,
  Laugh,
  ThumbsUp,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import {
  communityError,
  communityFetch,
  type ReactionSummary,
  type ReactionType,
} from "@/lib/api/community";

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
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) trigger.current?.focus();
    wasOpen.current = open;
  }, [open]);
  const selected = reactions.find(
    (reaction) => reaction.type === summary.myReaction,
  );
  const SelectedIcon = selected?.icon ?? ThumbsUp;
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
      setOpen(false);
    } catch (cause) {
      setError(communityError(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="min-w-0"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          ref={trigger}
          type="button"
          onClick={() => setOpen((value) => !value)}
          disabled={pending}
          aria-expanded={open}
          className={`ui-secondary-action min-h-11 text-sm font-semibold disabled:opacity-50 ${selected ? "text-[var(--brand-coral-strong)]" : ""}`}
        >
          <SelectedIcon className="h-4 w-4" aria-hidden="true" />
          {pending ? "Saving..." : (selected?.label ?? "React")}
        </button>
        {total > 0 && (
          <span
            className="text-xs text-[var(--ink-muted)]"
            title={summary.reactionCounts
              .map(
                (row) =>
                  `${reactions.find((reaction) => reaction.type === row.type)?.label}: ${row.count}`,
              )
              .join(", ")}
          >
            {total} {total === 1 ? "reaction" : "reactions"}
          </span>
        )}
      </div>
      {open &&
        (isAuthenticated ? (
          <div
            role="group"
            aria-label="Choose a reaction"
            className="mt-2 flex flex-wrap gap-2"
          >
            {reactions.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => void react(type)}
                disabled={pending}
                aria-pressed={summary.myReaction === type}
                className={`ui-secondary-action min-h-11 gap-1.5 px-3 text-sm font-semibold disabled:opacity-50 ${summary.myReaction === type ? "border-[var(--brand-coral)] text-[var(--brand-coral-strong)]" : ""}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            <Link
              href="/auth/login"
              className="font-semibold text-[var(--brand-coral-strong)] underline underline-offset-4"
            >
              Sign in
            </Link>{" "}
            to react to the conversation.
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
