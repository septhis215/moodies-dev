import { sessionFetch } from "@/lib/auth/session";
import type {
  SnapshotFormat,
  SnapshotMediaType,
  SnapshotPayload,
} from "./snapshot-types";

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://dev.api.moodies.tech/api";

async function postSnapshot<T>(
  path: string,
  body: { format: SnapshotFormat },
  credentials: RequestCredentials = "include",
  signal?: AbortSignal,
): Promise<T> {
  const response = await sessionFetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let message = "Could not create snapshot.";
    try {
      const payload = await response.json();
      if (typeof payload?.message === "string") message = payload.message;
      if (Array.isArray(payload?.message)) message = payload.message.join(" ");
    } catch {
      // Keep the fallback message.
    }
    throw new Error(message);
  }

  return response.json();
}

export function requestContentSnapshot({
  mediaType,
  tmdbId,
  format = "square",
  signal,
}: {
  mediaType: SnapshotMediaType | "movie" | "tv" | "movies";
  tmdbId: string | number;
  format?: SnapshotFormat;
  signal?: AbortSignal;
}) {
  return postSnapshot<SnapshotPayload>(
    `/content/${mediaType}/${tmdbId}/snapshot`,
    { format },
    "include",
    signal,
  );
}

export function requestReviewSnapshot(
  reviewId: string,
  signal?: AbortSignal,
) {
  return postSnapshot<SnapshotPayload>(
    `/reviews/${reviewId}/snapshot`,
    { format: "square" },
    "include",
    signal,
  );
}
