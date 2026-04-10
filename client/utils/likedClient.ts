const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export type LikeType = "movie" | "series";

function getToken(): string | undefined {
  if (typeof window === "undefined") return;
  const raw =
    localStorage.getItem("authToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    undefined;
  if (!raw) return;
  return raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`;
}

function isExpired(jwt?: string) {
  if (!jwt) return true;
  const raw = jwt.replace(/^Bearer\s+/i, "");
  try {
    const [, payload] = raw.split(".");
    const { exp } = JSON.parse(atob(payload));
    return !exp || Date.now() >= exp * 1000;
  } catch {
    return false;
  }
}

export async function fetchLikedList() {
  const token = getToken();
  if (!token) throw new Error("NO_TOKEN");
  const r = await fetch(`${API_BASE}/liked`, {
    headers: { "Content-Type": "application/json", Authorization: token },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export async function toggleLiked(tmdbId: string, type: LikeType) {
  const token = getToken();
  if (!token || isExpired(token)) throw new Error("NO_TOKEN");
  const r = await fetch(`${API_BASE}/liked/toggle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ tmdbId, type }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<{ liked: boolean }>;
}
