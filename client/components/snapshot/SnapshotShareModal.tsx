"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Copy,
  Download,
  ImageIcon,
  Loader2,
  X,
} from "lucide-react";
import { appToast } from "@/lib/toast";
import {
  SNAPSHOT_SHARE_PLATFORMS,
  type SnapshotSharePlatform,
} from "@/lib/snapshot/share-options";
import {
  requestContentSnapshot,
  requestReviewSnapshot,
} from "@/lib/snapshot/snapshot-api";
import { renderSnapshotToDataUrl } from "@/lib/snapshot/render-snapshot";
import type { SnapshotPayload, SnapshotSource } from "@/lib/snapshot/snapshot-types";

type SnapshotShareModalProps = {
  open: boolean;
  onClose: () => void;
  source: SnapshotSource | null;
};

export function SnapshotShareModal({
  open,
  onClose,
  source,
}: SnapshotShareModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<SnapshotPayload | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !source) return;

    let cancelled = false;
    setLoading(true);
    setPayload(null);
    setDataUrl(null);
    setError(null);

    const request =
      source.type === "content"
        ? requestContentSnapshot({
            mediaType: source.mediaType,
            tmdbId: source.tmdbId,
          })
        : requestReviewSnapshot(source.reviewId);

    request
      .then(async (nextPayload) => {
        const nextDataUrl = await renderSnapshotToDataUrl(nextPayload);
        if (cancelled) return;
        setPayload(nextPayload);
        setDataUrl(nextDataUrl);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Snapshot failed.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, source]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!mounted || !open) return null;

  const title =
    payload?.snapshotType === "review"
      ? "Review Snapshot"
      : "Content Snapshot";
  const contentHref = payload
    ? `/${payload.content.mediaType === "TV" ? "tv" : "movies"}/${encodeURIComponent(
        String(payload.content.tmdbId),
      )}`
    : null;

  const handleDownload = () => {
    if (!dataUrl || !payload) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${slugify(payload.content.title)}-${payload.snapshotType}-snapshot.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    appToast.success("Snapshot download started.", { title: "Snapshot ready" });
  };

  const handleCopy = async () => {
    if (!dataUrl) return;
    try {
      const blob = await dataUrlToBlob(dataUrl);
      const clipboard = navigator.clipboard as Clipboard & {
        write?: (items: ClipboardItem[]) => Promise<void>;
      };

      if (typeof ClipboardItem !== "undefined" && clipboard.write) {
        await clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        appToast.success("Snapshot copied to clipboard.", { title: "Copied" });
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
      appToast.info("Copied the page link instead.", { title: "Copied" });
    } catch {
      appToast.error("Could not copy this snapshot.", { title: "Copy failed" });
    }
  };

  const handlePlatform = (platform: SnapshotSharePlatform) => {
    if (platform.kind === "download") return void handleDownload();
    if (platform.kind === "copy") return void handleCopy();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/85 p-3 backdrop-blur-xl sm:p-6">
      <div className="relative flex max-h-[calc(100svh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-white/[0.12] bg-[#0b0b0d] shadow-[0_30px_100px_rgba(0,0,0,0.72)] sm:max-h-[calc(100svh-3rem)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(233,79,55,0.18),transparent_30%),radial-gradient(circle_at_92%_24%,rgba(255,255,255,0.07),transparent_26%)]" />

        <div className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.025] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ff8a78]">
              Snapshot Export
            </p>
            <p className="mt-1 text-base font-black leading-none text-white">
              {title}
            </p>
            <p className="mt-1 truncate text-xs font-medium text-white/45">
              {payload?.content.title ?? "Generating your share image"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.045] text-white/60 transition hover:bg-white/[0.09] hover:text-white"
            aria-label="Close snapshot modal"
          >
            <X size={17} />
          </button>
        </div>

        <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-h-[360px] items-center justify-center bg-black/45 p-4 sm:p-7">
            {loading && (
              <div className="flex flex-col items-center gap-3 text-white/60">
                <Loader2 className="h-7 w-7 animate-spin text-[#ff8a78]" />
                <p className="text-sm font-semibold">Creating snapshot...</p>
              </div>
            )}

            {!loading && error && (
              <div className="max-w-sm text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-red-400/20 bg-red-500/10 text-red-300">
                  <ImageIcon size={20} />
                </div>
                <p className="text-sm font-bold text-white">Snapshot failed</p>
                <p className="mt-1 text-sm leading-6 text-white/50">{error}</p>
              </div>
            )}

            {!loading && !error && !dataUrl && (
              <div className="max-w-sm text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.045] text-[#ff8a78]">
                  <ImageIcon size={20} />
                </div>
                <p className="text-sm font-bold text-white">Verify to create</p>
                <p className="mt-1 text-sm leading-6 text-white/50">
                  Complete the verification to generate this snapshot.
                </p>
              </div>
            )}

            {!loading && dataUrl && contentHref && (
              <Link
                href={contentHref}
                className="group block aspect-square max-h-[70svh] w-full max-w-[590px] rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a78]"
                aria-label={`Open ${payload?.content.title ?? "content"} page`}
              >
                <img
                  src={dataUrl}
                  alt={`${title} preview`}
                  className="h-full w-full rounded-lg object-contain shadow-[0_24px_80px_rgba(0,0,0,0.58)] ring-1 ring-white/10 transition group-hover:scale-[1.01] group-hover:ring-[#ff8a78]/40"
                />
              </Link>
            )}
          </div>

          <aside className="min-h-0 overflow-y-auto border-t border-white/10 bg-[#111114]/95 p-4 lg:border-l lg:border-t-0 sm:p-5">
            {payload?.review?.isPrivate && (
              <div className="mb-3 rounded-md border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100/80">
                This snapshot may include content from a private review. Sharing it will make the image visible to others.
              </div>
            )}

            <div className="rounded-xl border border-white/[0.08] bg-black/25 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">Ready to save</p>
                  <p className="mt-1 text-xs leading-5 text-white/45">
                    Export the generated poster as a social-ready PNG.
                  </p>
                </div>
                <span
                  className={`mt-0.5 h-2.5 w-2.5 rounded-full ${
                    dataUrl ? "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.7)]" : "bg-white/20"
                  }`}
                  aria-hidden
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/[0.045] px-2 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">
                    Format
                  </p>
                  <p className="mt-1 text-sm font-black text-white">PNG</p>
                </div>
                <div className="rounded-lg bg-white/[0.045] px-2 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">
                    Size
                  </p>
                  <p className="mt-1 text-sm font-black text-white">1080</p>
                </div>
                <div className="rounded-lg bg-white/[0.045] px-2 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">
                    Type
                  </p>
                  <p className="mt-1 text-sm font-black text-white">
                    {payload?.snapshotType === "review" ? "Review" : "Title"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {SNAPSHOT_SHARE_PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  disabled={!dataUrl}
                  onClick={() => handlePlatform(platform)}
                  title={platform.helper}
                  className="group flex min-h-[72px] w-full items-center gap-4 rounded-xl border border-white/[0.09] bg-white/[0.045] px-4 text-left transition hover:border-[#e94f37]/45 hover:bg-[#e94f37]/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-black/30 text-[#ff8a78] ring-1 ring-white/10 transition group-hover:bg-[#e94f37]/15 group-hover:text-[#ffb3a7]">
                    {platform.kind === "download" ? (
                      <Download size={18} />
                    ) : (
                      <Copy size={18} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-white">
                      {platform.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-white/45">
                      {platform.helper}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-5 text-xs leading-5 text-white/35">
              Social platform shortcuts are paused for now. Download or copy the image, then post it wherever you like.
            </p>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "moodies";
}
