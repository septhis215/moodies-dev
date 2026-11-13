"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { CelebrityVideo } from "@/types/celebrityMedia";
import CelebrityVideoPlayer from "./CelebrityVideoPlayer";
import styles from "./celebrity-hub.module.css";

export default function CelebrityVideoHero({
  videos,
  active = 0,
  onSelect,
}: {
  videos: CelebrityVideo[];
  active?: number;
  onSelect: (index: number) => void;
}) {
  const [muted, setMuted] = useState(true);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const items = videos.slice(0, 10);
  const index = Math.min(active, items.length - 1);
  const video = items[index];
  if (!video) return null;
  function select(next: number) {
    const value = (next + items.length) % items.length;
    onSelect(value);
    const element = strip.current?.children[value] as HTMLElement | undefined;
    if (element && strip.current)
      strip.current.scrollTo({
        left: element.offsetLeft - strip.current.offsetLeft,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }
  return (
    <section
      className={styles.heroPlayer}
      aria-label="Featured videos"
      aria-roledescription="carousel"
      onTouchStart={(event) => {
        if ((event.target as Element).closest("[data-video-strip]")) return;
        const point = event.touches[0];
        touch.current = { x: point.clientX, y: point.clientY };
      }}
      onTouchEnd={(event) => {
        const point = event.changedTouches[0];
        const start = touch.current;
        touch.current = null;
        if (
          start &&
          Math.abs(point.clientX - start.x) > 70 &&
          Math.abs(point.clientX - start.x) >
            Math.abs(point.clientY - start.y) * 1.5
        )
          select(index + (point.clientX < start.x ? 1 : -1));
      }}
    >
      <div className={styles.heroFeature}>
        <CelebrityVideoPlayer
          key={video.id}
          video={video}
          autoplay
          initialMuted={muted}
          onMutedChange={setMuted}
          onEnded={() => {
            if (index < items.length - 1) select(index + 1);
          }}
        />
        <div className={styles.heroInfo}>
          <div className="min-w-0 max-w-3xl">
            <p className="mb-2 text-xs font-semibold text-[var(--brand-coral-strong)]">
              {video.person?.name || video.channel}
            </p>
            <h2 className="line-clamp-2 text-3xl font-bold leading-tight sm:text-4xl">
              {video.title}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs leading-5 text-[var(--ink-muted)]">
              {video.person && <span>{video.channel}</span>}
              {video.content && (
                <Link
                  className="inline-flex min-h-9 items-center gap-1 font-semibold text-[var(--brand-coral-strong)] hover:underline"
                  href={`/${video.content.mediaType === "tv" ? "tv" : "movies"}/${video.content.id}`}
                >
                  {video.content.title}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
          {items.length > 1 && (
            <div className="flex shrink-0 items-center gap-2">
              <span className="mr-1 hidden text-xs tabular-nums text-[var(--ink-muted)] sm:block">
                {String(index + 1).padStart(2, "0")} /{" "}
                {String(items.length).padStart(2, "0")}
              </span>
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Previous video"
                onClick={() => select(index - 1)}
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Next video"
                onClick={() => select(index + 1)}
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
      {items.length > 1 && (
        <div
          ref={strip}
          data-video-strip
          className={`${styles.videoStrip} mobile-native-scroll`}
          role="group"
          aria-label="Choose featured video"
        >
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => select(i)}
              aria-pressed={i === index}
              aria-label={`Show ${item.title}`}
            >
              <div className="relative aspect-video overflow-hidden rounded-md bg-[var(--surface-2)]">
                <Image
                  src={item.thumbnail}
                  alt=""
                  fill
                  unoptimized
                  sizes="180px"
                  className="object-cover"
                />
              </div>
              <p className="mt-2 line-clamp-2 px-1 text-xs font-semibold leading-4">
                {item.title}
              </p>
            </button>
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Featured video {index + 1} of {items.length}: {video.title}
      </p>
    </section>
  );
}
