"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import useAchievements from "@/hooks/useAchievements";
import AchievementCollection from "./AchievementCollection";
export default function AchievementsPage() {
  const state = useAchievements();
  return (
    <div className="min-h-screen bg-[var(--surface-0)] pb-12 text-[var(--ink)]">
      <div className="ui-shell pt-6 lg:pt-24">
        <Link
          href="/profile"
          className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Your profile
        </Link>
        <header className="mb-8 border-b border-[var(--surface-border)] pb-7">
          <p className="ui-kicker mb-3">Your Moodies journey</p>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="text-4xl font-bold leading-none sm:text-5xl">
                Small discoveries. Big milestones.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">
                Track your progress across movies, moods and the community.
              </p>
            </div>
            {state.data?.status === "ready" && (
              <p className="text-sm font-semibold text-[var(--ink-muted)]">
                <span className="text-3xl font-bold tabular-nums text-[var(--brand-coral-strong)]">
                  {state.data.unlockedCount}
                </span>{" "}
                / {state.data.totalCount} earned
              </p>
            )}
          </div>
        </header>
        <AchievementCollection state={state} />
      </div>
    </div>
  );
}
