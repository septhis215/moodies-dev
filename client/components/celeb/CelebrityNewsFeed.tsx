"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Newspaper, RefreshCw } from "lucide-react";
import CustomSelect from "@/components/ui/custom-select";
import type {
  CelebrityArticle,
  CelebrityNews,
  NewsTopic,
} from "@/types/celebrityNews";
import useCelebrityResource from "./useCelebrityResource";
import styles from "./celebrity-hub.module.css";

const topicLabels: Record<NewsTopic, string> = {
  news: "Interviews & stories",
  happenings: "Events & awards",
  projects: "Film & TV",
};
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(date)
    : "";
}
function StoryImage({
  article,
  priority,
}: {
  article: CelebrityArticle;
  priority: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.storyImage}>
      {article.imageUrl && !failed ? (
        <Image
          src={article.imageUrl}
          alt=""
          fill
          unoptimized
          priority={priority}
          sizes={
            priority
              ? "(max-width: 767px) 92vw, 65vw"
              : "(max-width: 767px) 44vw, 30vw"
          }
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-[var(--ink-muted)]">
          <Newspaper className="h-8 w-8 opacity-50" aria-hidden="true" />
          <span className="text-center text-sm font-semibold">
            {article.publisher}
          </span>
        </div>
      )}
    </div>
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
  return (
    <div className="min-w-0 space-y-7">
      {!compact && valid && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div
            className="mobile-native-scroll flex max-w-full gap-2 overflow-x-auto pb-1"
            role="group"
            aria-label="News topics"
          >
            {(
              ["all", ...Object.keys(topicLabels)] as Array<NewsTopic | "all">
            ).map((value) => (
              <button
                key={value}
                type="button"
                className={styles.chip}
                aria-pressed={selectedTopic === value}
                onClick={() => setSelectedTopic(value)}
              >
                {value === "all" ? "All news" : topicLabels[value]}
              </button>
            ))}
          </div>
          <CustomSelect
            label="Publisher"
            value={source}
            onChange={setSource}
            widthClass="w-60 max-w-full"
            options={[
              { value: "all", label: "All publishers" },
              ...data.sources.map((item) => ({
                value: item.id,
                label: item.name,
              })),
            ]}
          />
        </div>
      )}
      {loading ? (
        <div
          className="grid grid-cols-2 gap-5 md:grid-cols-3"
          role="status"
          aria-label="Loading celebrity news"
        >
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="moodies-skeleton aspect-video rounded-xl motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : error || !valid || unavailable ? (
        <div className="ui-panel p-6 sm:p-8" role="status">
          <Newspaper
            className="mb-4 h-7 w-7 text-[var(--brand-coral-strong)]"
            aria-hidden="true"
          />
          <h3 className="text-xl font-bold">News is taking a moment</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            The publishers couldn’t be reached. Try again in a moment.
          </p>
          <button
            type="button"
            className="ui-secondary-action mt-5"
            onClick={retry}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : articles.length ? (
        <div className={styles.newsGrid}>
          {articles.map((article, index) => (
            <article key={article.id} className={styles.story}>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl"
                aria-label={article.title}
                tabIndex={-1}
              >
                <StoryImage
                  article={article}
                  priority={!compact && index === 0}
                />
              </a>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5">
                <span className="font-semibold text-[var(--brand-coral-strong)]">
                  {article.publisher}
                </span>
                <time
                  dateTime={article.publishedAt}
                  className="text-[var(--ink-muted)]"
                >
                  {dateLabel(article.publishedAt)}
                </time>
              </div>
              <h3 className="mt-2 text-lg font-bold leading-snug text-[var(--ink)]">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm transition-colors hover:text-[var(--brand-coral-strong)] motion-reduce:transition-none"
                >
                  {article.title}
                  <ArrowUpRight
                    className="ml-1 inline h-4 w-4"
                    aria-hidden="true"
                  />
                  <span className="sr-only">
                    {" "}
                    (opens at {article.publisher})
                  </span>
                </a>
              </h3>
            </article>
          ))}
        </div>
      ) : (
        <div className="ui-panel p-7" role="status">
          <h3 className="text-xl font-bold">No recent stories in this view</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            {personId
              ? "No headlines confidently match this person in the last 30 days."
              : "Try another topic or publisher."}
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
        <details className="border-t border-[var(--surface-border)] pt-3 text-xs leading-5 text-[var(--ink-muted)]">
          <summary className="min-h-11 w-fit cursor-pointer py-3 focus-visible:outline-2 focus-visible:outline-[var(--brand-coral-strong)]">
            Sources & freshness
            {data.sources.some((item) => item.status !== "ready")
              ? " · Some sources delayed"
              : ""}
          </summary>
          <ul className="mb-3 space-y-2">
            {data.sources.map((item) => (
              <li key={item.id}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline underline-offset-4"
                >
                  {item.name}
                </a>{" "}
                ·{" "}
                {item.status === "stale"
                  ? "Saved snapshot"
                  : item.status === "ready"
                    ? "Available"
                    : "Unavailable"}
                {item.fetchedAt
                  ? ` · Fetched ${dateLabel(item.fetchedAt)}`
                  : ""}
              </li>
            ))}
          </ul>
          <p className="max-w-2xl pb-3">
            Headlines and photographs link to publisher reporting. These
            publications share a parent company. Moodies does not independently
            verify each claim. Stories cover the last 30 days and refresh every
            10 minutes.
          </p>
        </details>
      )}
    </div>
  );
}
