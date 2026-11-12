"use client";

import { useRef, useState } from "react";
import type { CelebrityVideoFeed } from "@/types/celebrityMedia";
import useCelebrityResource from "./useCelebrityResource";
import CelebrityVideoHero from "./CelebrityVideoHero";
import CelebrityVideoCard from "./CelebrityVideoCard";

const categories = [
  { value: "all", label: "All videos" },
  { value: "interview", label: "Interviews" },
  { value: "trailer", label: "Trailers" },
  { value: "behind-scenes", label: "Behind the scenes" },
  { value: "clip", label: "Clips" },
  { value: "event", label: "On the carpet" },
];
export default function CelebrityVideoBrowser({
  heroOnly = false,
}: {
  heroOnly?: boolean;
}) {
  const { data, error, loading, retry } =
    useCelebrityResource<CelebrityVideoFeed>("/people/hub/videos");
  const [active, setActive] = useState(0);
  const [category, setCategory] = useState("all");
  const root = useRef<HTMLDivElement>(null);
  const videos = Array.isArray(data?.videos) ? data.videos.slice(0, 10) : [];
  if (loading)
    return (
      <div
        className="moodies-skeleton aspect-video max-h-[640px] rounded-xl motion-reduce:animate-none"
        role="status"
        aria-label="Loading featured videos"
      />
    );
  if (error || !videos.length)
    return (
      <div
        className="ui-panel flex flex-wrap items-center justify-between gap-4 p-7"
        role="status"
      >
        <div>
          <h2 className="text-3xl font-bold">The next moment is on its way</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            {error || data?.status === "unavailable"
              ? "Videos couldn’t load right now."
              : "No recent videos are available from the current trending titles."}
          </p>
        </div>
        <button type="button" className="ui-secondary-action" onClick={retry}>
          Try again
        </button>
      </div>
    );
  const shown = videos.filter(
    (video) => category === "all" || video.category === category,
  );
  return (
    <div ref={root} className="min-w-0 scroll-mt-24">
      {data?.status === "stale" && (
        <p className="mb-3 text-xs text-[var(--ink-muted)]" role="status">
          Showing saved videos while sources refresh.
        </p>
      )}
      <CelebrityVideoHero
        videos={videos}
        active={active}
        onSelect={setActive}
      />
      {!heroOnly && (
        <section className="mt-10" aria-labelledby="browse-videos-heading">
          <h2
            id="browse-videos-heading"
            className="mb-5 text-3xl font-bold leading-none sm:text-4xl"
          >
            More to watch
          </h2>
          <div
            role="group"
            aria-label="Video categories"
            className="mobile-native-scroll mb-6 flex gap-2 overflow-x-auto pb-1"
          >
            {categories
              .filter(
                (option) =>
                  option.value === "all" ||
                  videos.some((video) => video.category === option.value),
              )
              .map((option) => (
                <button
                  type="button"
                  key={option.value}
                  aria-pressed={category === option.value}
                  className="ui-filter-chip shrink-0"
                  onClick={() => setCategory(option.value)}
                >
                  {option.label}
                </button>
              ))}
          </div>
          <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((video) => (
              <CelebrityVideoCard
                key={video.id}
                video={video}
                onPlay={() => {
                  setActive(videos.indexOf(video));
                  root.current?.scrollIntoView({
                    behavior: window.matchMedia(
                      "(prefers-reduced-motion: reduce)",
                    ).matches
                      ? "instant"
                      : "smooth",
                    block: "start",
                  });
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
