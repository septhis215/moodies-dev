"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Newspaper, RefreshCw } from "lucide-react";
import type { CelebrityNews, NewsTopic } from "@/types/celebrityNews";
import useCelebrityResource from "./useCelebrityResource";

const topicLabels: Record<NewsTopic, string> = {
  news: "In the news",
  happenings: "Happenings",
  projects: "Projects",
};
function dateLabel(value: string) {
  return (
    new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(value)) + " UTC"
  );
}
export default function CelebrityNewsFeed({
  personId,
  limit = 36,
  topic,
  compact = false,
}: {
  personId?: number;
  limit?: number;
  topic?: NewsTopic;
  compact?: boolean;
}) {
  const { data, error, loading, retry } = useCelebrityResource<CelebrityNews>(
    personId ? `/people/${personId}/news` : "/people/news",
  );
  const [source, setSource] = useState("all");
  const [selectedTopic, setSelectedTopic] = useState<NewsTopic | "all">("all");
  const valid =
    data && Array.isArray(data.articles) && Array.isArray(data.sources);
  const articles = valid
    ? data.articles
        .filter(
          (article) =>
            (source === "all" || article.source === source) &&
            (!(topic || selectedTopic !== "all") ||
              article.topic === (topic || selectedTopic)),
        )
        .slice(0, limit)
    : [];
  const unavailable =
    valid && data.sources.every((item) => item.status === "unavailable");
  const hasOutage =
    valid && data.sources.some((item) => item.status !== "ready");
  return (
    <div className="min-w-0 space-y-5">
      {!compact && valid && (
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-2 text-sm text-[var(--ink-muted)]">
            <label htmlFor={`news-publisher-${personId || "hub"}`}>
              Publisher
            </label>
            <select
              id={`news-publisher-${personId || "hub"}`}
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className="min-h-11 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-1)] px-3 text-base text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
            >
              <option value="all">All publishers</option>
              {data.sources.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          {!topic && (
            <div className="grid gap-2 text-sm text-[var(--ink-muted)]">
              <label htmlFor={`news-topic-${personId || "hub"}`}>Topic</label>
              <select
                id={`news-topic-${personId || "hub"}`}
                value={selectedTopic}
                onChange={(event) =>
                  setSelectedTopic(event.target.value as NewsTopic | "all")
                }
                className="min-h-11 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-1)] px-3 text-base text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]"
              >
                <option value="all">All stories</option>
                {Object.entries(topicLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
      {loading ? (
        <div
          role="status"
          aria-label="Loading celebrity news"
          className="grid gap-4 md:grid-cols-2"
        >
          {[0, 1, 2, 3].map((key) => (
            <div
              key={key}
              className="ui-panel moodies-skeleton h-44 motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : error || !valid || unavailable ? (
        <div className="ui-panel p-6" role="status">
          <Newspaper
            className="mb-3 h-6 w-6 text-[var(--brand-coral-strong)]"
            aria-hidden="true"
          />
          <h3 className="text-lg font-semibold">News is taking a moment</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ink-muted)]">
            We couldn’t reach the publishers. You can still explore celebrity
            profiles and their work.
          </p>
          <button
            type="button"
            className="ui-secondary-action mt-4"
            onClick={retry}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : articles.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {articles.map((article) => (
            <article
              key={article.id}
              className="group ui-panel flex min-w-0 flex-col p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5">
                <span className="font-semibold text-[var(--brand-coral-strong)]">
                  {article.publisher}
                </span>
                <span className="text-[var(--ink-muted)]">
                  {topicLabels[article.topic]}
                </span>
              </div>
              <h3 className="my-3 text-lg font-semibold leading-7 text-[var(--ink)]">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm hover:text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral-strong)]"
                >
                  {article.title}
                  <span className="sr-only">
                    {" "}
                    (opens at {article.publisher})
                  </span>
                </a>
              </h3>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3 text-xs leading-5 text-[var(--ink-muted)]">
                <time dateTime={article.publishedAt}>
                  {dateLabel(article.publishedAt)}
                </time>
                <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="ui-panel p-6" role="status">
          <h3 className="text-lg font-semibold">
            No recent stories in this view
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            {personId
              ? "No headlines confidently match this person in the last 30 days."
              : "No stories match these filters in the last 30 days."}{" "}
            Try another publisher or explore their work.
          </p>
          <Link
            href={personId ? `/celeb/${personId}` : "/celeb/explore"}
            className="ui-secondary-action mt-4"
          >
            {personId ? "View profile" : "Explore people"}
          </Link>
        </div>
      )}
      {valid && (
        <div className="space-y-3 border-t border-[var(--surface-border)] pt-4 text-xs leading-5 text-[var(--ink-muted)]">
          {hasOutage && (
            <p role="status">
              Some publishers are unavailable. Saved headlines are marked below.
            </p>
          )}
          <details>
            <summary className="min-h-11 cursor-pointer py-3 font-semibold text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]">
              Sources and freshness
            </summary>
            <ul className="space-y-2 pb-3">
              {data.sources.map((item) => (
                <li key={item.id} className="flex flex-wrap gap-x-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4"
                  >
                    {item.name}
                  </a>
                  <span>
                    {item.status === "stale"
                      ? "Saved snapshot"
                      : item.status === "ready"
                        ? "Available"
                        : "Unavailable"}
                    {item.fetchedAt
                      ? ` · Fetched ${dateLabel(item.fetchedAt)}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p>
              Headlines link to the publishers’ reporting. Moodies does not
              independently verify each claim. These publications share a parent
              company. Stories cover the last 30 days; topic labels describe
              headline subjects, not event dates.
            </p>
          </details>
          <p>
            Publisher reporting · Refreshed every 10 minutes when visited
            {personId ? " · Headlines matched to this person" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
