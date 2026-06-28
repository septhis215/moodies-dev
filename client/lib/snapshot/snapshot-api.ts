import type {
  SnapshotFormat,
  SnapshotMediaType,
  SnapshotPayload,
} from "./snapshot-types";

const API =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

async function postSnapshot<T>(
  path: string,
  body: { format: SnapshotFormat },
  credentials: RequestCredentials = "same-origin",
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials,
    body: JSON.stringify(body),
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
}: {
  mediaType: SnapshotMediaType | "movie" | "tv" | "movies";
  tmdbId: string | number;
  format?: SnapshotFormat;
}) {
  return postSnapshot<SnapshotPayload>(
    `/content/${mediaType}/${tmdbId}/snapshot`,
    { format },
  );
}

export function requestReviewSnapshot(reviewId: string, format: SnapshotFormat = "square") {
  return postSnapshot<SnapshotPayload>(
    `/reviews/${reviewId}/snapshot`,
    { format },
    "include",
  );
}
