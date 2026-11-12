"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Award, Check, RefreshCw } from "lucide-react";
import { BadgeMascot } from "@/components/ui/BadgeMascot";
import CustomSelect from "@/components/ui/custom-select";
import { resolveBadgeMascot } from "@/lib/badge-mascots";
import type { AchievementRow } from "@/types/achievements";
import type useAchievements from "@/hooks/useAchievements";

type State = ReturnType<typeof useAchievements>;
function nextAction(target: string) {
  if (target.includes("mood") || target === "full_identity")
    return { href: "/moods", label: "Choose a mood" };
  if (target.includes("quiz")) return { href: "/quiz", label: "Take the quiz" };
  if (target.startsWith("community") || target === "reviews")
    return { href: "/community", label: "Join the conversation" };
  if (target.startsWith("profile"))
    return { href: "/profile", label: "Edit your profile" };
  if (target === "watched_series")
    return { href: "/tv", label: "Explore series" };
  return { href: "/movies", label: "Explore movies" };
}
function AchievementCard({ row }: { row: AchievementRow }) {
  const mascot = resolveBadgeMascot(row.badge?.badgeName);
  const { unlocked, revoked } = row.progress;
  const percent = Math.max(0, Math.min(100, row.progress.completionPercentage));
  const action = nextAction(row.achievement.requirementTarget);
  return (
    <article
      className={`ui-panel flex min-w-0 flex-col p-5 ${unlocked ? "border-[var(--brand-coral)]/40" : ""}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        {mascot ? (
          <BadgeMascot
            name={mascot}
            className={`h-20 w-20 shrink-0 ${unlocked ? "" : "opacity-65 grayscale"}`}
            sizes="80px"
          />
        ) : (
          <span className="grid h-20 w-20 place-items-center rounded-xl bg-[var(--surface-2)]">
            <Award
              className="h-8 w-8 text-[var(--brand-gold)]"
              aria-hidden="true"
            />
          </span>
        )}
        <span className="ui-label">
          {unlocked ? (
            <span className="inline-flex items-center gap-1 text-[var(--brand-coral-strong)]">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Earned
            </span>
          ) : revoked ? (
            "Withdrawn"
          ) : (
            row.badge?.rarity || "Milestone"
          )}
        </span>
      </div>
      <p className="mb-1 text-xs font-semibold text-[var(--ink-muted)]">
        {row.achievement.category}
      </p>
      <h3 className="text-lg font-bold leading-tight text-[var(--ink)]">
        {row.badge?.badgeName || row.achievement.title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
        {row.achievement.description}
      </p>
      <div className="mt-auto pt-5">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold">
          <span>{unlocked ? "Complete" : "Progress"}</span>
          <span className="tabular-nums text-[var(--ink-muted)]">
            {Math.min(
              row.progress.currentProgress,
              row.achievement.requiredCount,
            )}{" "}
            / {row.achievement.requiredCount}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={row.achievement.title}
          aria-valuemin={0}
          aria-valuemax={row.achievement.requiredCount}
          aria-valuenow={Math.min(
            row.progress.currentProgress,
            row.achievement.requiredCount,
          )}
          className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"
        >
          <div
            style={{ width: `${percent}%` }}
            className="h-full rounded-full bg-[var(--brand-coral)]"
          />
        </div>
        {unlocked ? (
          <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">
            {row.progress.unlockedAt
              ? `Earned ${new Date(row.progress.unlockedAt).toLocaleDateString("en", { dateStyle: "medium" })}`
              : "Earned"}
          </p>
        ) : revoked ? (
          <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">
            This award was withdrawn after a review.
          </p>
        ) : (
          <>
            <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">
              {row.achievement.lockedHint}
            </p>
            <Link
              href={action.href}
              className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--brand-coral-strong)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--brand-coral)]"
            >
              {action.label}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </>
        )}
      </div>
    </article>
  );
}
export default function AchievementCollection({
  state,
  compact = false,
}: {
  state: State;
  compact?: boolean;
}) {
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const rows = useMemo(() => state.data?.achievements || [], [state.data]);
  const categories = [...new Set(rows.map((row) => row.achievement.category))];
  const shown = rows
    .filter(
      (row) =>
        (category === "all" || row.achievement.category === category) &&
        (filter === "all" ||
          (filter === "earned"
            ? row.progress.unlocked
            : !row.progress.unlocked &&
              !row.progress.revoked &&
              row.progress.currentProgress > 0)),
    )
    .sort((a, b) =>
      compact || filter === "near"
        ? Number(a.progress.unlocked) - Number(b.progress.unlocked) ||
          b.progress.completionPercentage - a.progress.completionPercentage ||
          (a.badge?.displayOrder || 0) - (b.badge?.displayOrder || 0)
        : (a.badge?.displayOrder || 0) - (b.badge?.displayOrder || 0),
    );
  return (
    <section aria-label="Your achievements" className="min-w-0">
      {compact && (
        <header className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold leading-none">Your milestones</h2>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">
              {state.data?.status === "ready"
                ? `${state.data.unlockedCount} earned · ${state.data.totalCount} goals`
                : "Discover what comes next."}
            </p>
          </div>
          <Link
            href="/achievements"
            className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-[var(--brand-coral-strong)]"
          >
            View all
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </header>
      )}
      {!state.authenticated ? (
        <div className="ui-panel p-7">
          <h2 className="text-3xl font-bold">Make your discoveries count</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">
            Sign in to track your progress and earn Moodies badges.
          </p>
          <Link href="/auth/login" className="ui-primary-action mt-5">
            Sign in
          </Link>
        </div>
      ) : state.loading && !state.data ? (
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          role="status"
          aria-label="Loading achievements"
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="moodies-skeleton h-72 rounded-xl motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : state.error ? (
        <div className="ui-panel p-7" role="status">
          <h3 className="text-lg font-bold">Progress couldn’t load</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            Your earned badges are saved. Try loading them again.
          </p>
          <button
            type="button"
            className="ui-secondary-action mt-4"
            onClick={state.refresh}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : state.data?.status === "disabled" ? (
        <div className="ui-panel p-7" role="status">
          <h3 className="text-lg font-bold">Achievements are getting ready</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            Your collection and reviews are available as usual.
          </p>
        </div>
      ) : (
        <>
          {!compact && (
            <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
              <div
                className="flex max-w-full gap-2"
                role="group"
                aria-label="Achievement views"
              >
                {[
                  { value: "all", label: "All goals" },
                  { value: "near", label: "Nearly there" },
                  { value: "earned", label: "Earned" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={filter === option.value}
                    onClick={() => setFilter(option.value)}
                    className="ui-filter-chip"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <CustomSelect
                label="Achievement category"
                value={category}
                onChange={setCategory}
                options={[
                  { value: "all", label: "All categories" },
                  ...categories.map((label) => ({ value: label, label })),
                ]}
                widthClass="w-60 max-w-full"
              />
            </div>
          )}
          {(state.data?.pending || state.data?.delayed) && (
            <p
              className="mb-4 text-xs leading-5 text-[var(--ink-muted)]"
              role="status"
            >
              {state.data?.delayed
                ? "Some progress is delayed. Your activity is saved."
                : "Recent activity is being processed."}
            </p>
          )}
          {shown.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(compact ? shown.slice(0, 3) : shown).map((row) => (
                <AchievementCard key={row.achievement.key} row={row} />
              ))}
            </div>
          ) : (
            <div className="ui-panel p-7" role="status">
              <h3 className="text-lg font-bold">
                {filter === "earned"
                  ? "Your first badge is waiting"
                  : "No goals in this view"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                {filter === "earned"
                  ? "Choose a mood, save a title or share a review to get started."
                  : "Choose another category to keep exploring."}
              </p>
            </div>
          )}
          {compact && rows.some((row) => row.progress.unlocked) && (
            <div className="mt-7 border-t border-[var(--surface-border)] pt-5">
              <h3 className="mb-4 text-base font-bold">Recently earned</h3>
              <div className="flex flex-wrap gap-5">
                {rows
                  .filter((row) => row.progress.unlocked)
                  .sort(
                    (a, b) =>
                      Date.parse(b.progress.unlockedAt || "") -
                      Date.parse(a.progress.unlockedAt || ""),
                  )
                  .slice(0, 4)
                  .map((row) => {
                    const mascot = resolveBadgeMascot(row.badge?.badgeName);
                    return (
                      <Link
                        href="/achievements"
                        key={row.achievement.key}
                        className="flex max-w-full items-center gap-2 rounded-lg text-sm font-semibold hover:text-[var(--brand-coral-strong)]"
                      >
                        {mascot && (
                          <BadgeMascot
                            name={mascot}
                            className="h-14 w-14 shrink-0"
                            sizes="56px"
                          />
                        )}
                        <span>
                          {row.badge?.badgeName || row.achievement.title}
                        </span>
                      </Link>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
