"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
import { communitySignInHref } from "@/lib/community-navigation";
import {
  communityError,
  communityFetch,
  type ReactionSummary,
  type ReactionType,
} from "@/lib/api/community";
import styles from "./Community.module.css";

const reactions = [
  { type: "LIKE", label: "Like", icon: ThumbsUp, mascot: "happy" },
  { type: "LOVE", label: "Love", icon: Heart, mascot: "romantic" },
  { type: "HAHA", label: "Haha", icon: Laugh, mascot: "funny" },
  { type: "WOW", label: "Wow", icon: CircleAlert, mascot: "epic" },
  { type: "SAD", label: "Sad", icon: Frown, mascot: "sad" },
  { type: "ANGRY", label: "Angry", icon: Angry, mascot: "gritty" },
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
  const [mode, setMode] = useState<"hover" | "explicit" | null>(null);
  const open = mode !== null;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickerId = useId();
  useEffect(() => {
    if (!open) return;
    if (mode === "explicit")
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
        setMode(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open, mode]);
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );
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
      setMode(null);
    } catch (cause) {
      setError(communityError(cause));
    } finally {
      restoreFocus.current = true;
      setPending(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className={`${styles.reactionRoot} ${open ? styles.reactionOpen : ""}`}
      onPointerEnter={(event) => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        if (
          event.pointerType === "mouse" &&
          window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
          !pending
        ) {
          setMode((current) => current ?? "hover");
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        closeTimer.current = setTimeout(() => {
          if (!rootRef.current?.contains(document.activeElement))
            setMode((current) => (current === "hover" ? null : current));
        }, 160);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setMode(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setMode(null);
          trigger.current?.focus();
        }
        if (event.key === "ArrowDown" && event.target === trigger.current) {
          event.preventDefault();
          setMode("explicit");
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          ref={trigger}
          type="button"
          onClick={() =>
            setMode((current) => (current === "explicit" ? null : "explicit"))
          }
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
          <div className={styles.pickerFrame}>
            <div
              ref={pickerRef}
              id={pickerId}
              role="group"
              aria-label="Choose a reaction"
              aria-busy={pending}
              className={styles.reactionPicker}
              onKeyDown={(event) => {
                const buttons = Array.from(
                  event.currentTarget.querySelectorAll<HTMLButtonElement>(
                    "button",
                  ),
                );
                const index = buttons.indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                const offset =
                  event.key === "ArrowRight"
                    ? 1
                    : event.key === "ArrowLeft"
                      ? -1
                      : 0;
                if (offset || event.key === "Home" || event.key === "End") {
                  event.preventDefault();
                  buttons[
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? buttons.length - 1
                        : (index + offset + buttons.length) % buttons.length
                  ]?.focus();
                }
              }}
            >
              {reactions.map(({ type, label, mascot }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => void react(type)}
                  disabled={pending}
                  aria-pressed={summary.myReaction === type}
                  data-reaction={type}
                  className={`${styles.reactionOption} ${summary.myReaction === type ? styles.reactionSelected : ""}`}
                >
                  <span className={styles.reactionFace}>
                    <Image
                      src={`/images/moods/${mascot}.png`}
                      alt=""
                      width={40}
                      height={40}
                      sizes="40px"
                      className="h-10 w-10 object-contain"
                    />
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            <span id={pickerId}>
              <Link
                href={communitySignInHref(
                  typeof window === "undefined"
                    ? "/community"
                    : `${window.location.pathname}${window.location.search}${window.location.hash}`,
                )}
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
