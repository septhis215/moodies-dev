"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Play } from "lucide-react";
import type { CelebrityVideo } from "@/types/celebrityMedia";

export function videoDuration(value: string | null) {
  const match = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  return hours
    ? `${hours}:${(minutes || "0").padStart(2, "0")}:${(seconds || "0").padStart(2, "0")}`
    : `${minutes || "0"}:${(seconds || "0").padStart(2, "0")}`;
}
export default function CelebrityVideoCard({
  video,
  onPlay,
}: {
  video: CelebrityVideo;
  onPlay: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const duration = videoDuration(video.duration);
  return (
    <article className="group min-w-0">
      <button
        type="button"
        onClick={onPlay}
        aria-label={`Play ${video.title}`}
        className="ui-media-artwork block aspect-video w-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand-coral)]"
      >
        <Image
          src={broken ? "/placeholder-backdrop.svg" : video.thumbnail}
          alt=""
          fill
          unoptimized
          sizes="(max-width: 639px) 92vw, (max-width: 1023px) 44vw, 30vw"
          className="object-cover"
          onError={() => setBroken(true)}
        />
        <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition-opacity duration-150 group-hover:bg-black/20 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-black/70 text-white">
            <Play className="h-5 w-5 fill-current" aria-hidden="true" />
          </span>
        </span>
        {duration && (
          <span className="ui-label absolute bottom-2 right-2 bg-black/85 text-white tabular-nums">
            {duration}
          </span>
        )}
      </button>
      <h3 className="mt-3 line-clamp-2 text-base font-bold leading-snug">
        <button
          type="button"
          onClick={onPlay}
          className="text-left hover:text-[var(--brand-coral-strong)] focus-visible:outline-2 focus-visible:outline-[var(--brand-coral)]"
        >
          {video.title}
        </button>
      </h3>
      <p className="mt-1.5 text-xs leading-5 text-[var(--ink-muted)]">
        {video.channel}
        {video.publishedAt &&
          ` · ${new Date(video.publishedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`}
      </p>
      {video.content && (
        <Link
          href={`/${video.content.mediaType === "tv" ? "tv" : "movies"}/${video.content.id}`}
          className="mt-1 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-[var(--brand-coral-strong)] hover:underline"
        >
          {video.content.title}
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}
    </article>
  );
}
