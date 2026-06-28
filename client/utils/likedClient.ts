import {
  createAppError,
  normalizeApiError,
  normalizeResponseError,
} from "@/lib/errors";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export type LikeType = "movie" | "series";

// Auth rides on the HttpOnly cookie now — every call sends credentials and no
// Bearer header. A 401 means "not signed in", which callers treat as empty.
export async function fetchLikedList() {
  try {
    const r = await fetch(`${API_BASE}/liked`, {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (r.status === 401 || r.status === 498) return { movieId: [], seriesId: [] };
    if (!r.ok) {
      throw await normalizeResponseError(r, "Could not load your likes right now.");
    }
    return r.json();
  } catch (error) {
    throw normalizeApiError(error, "Could not load your likes right now.");
  }
}

export async function toggleLiked(tmdbId: string, type: LikeType) {
  try {
    const r = await fetch(`${API_BASE}/liked/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ tmdbId, type }),
    });
    if (r.status === 401 || r.status === 498) {
      throw createAppError({
        type: "UNAUTHORIZED",
        status: r.status,
        code: "AUTH_REQUIRED",
        message: "Like toggle requires an authenticated session",
        userMessage: "Please log in to use Likes.",
      });
    }
    if (!r.ok) {
      throw await normalizeResponseError(r, "Could not update your likes.");
    }
    return r.json() as Promise<{ liked: boolean }>;
  } catch (error) {
    throw normalizeApiError(error, "Could not update your likes.");
  }
}
