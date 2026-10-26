import { sessionFetch } from "@/lib/auth/session";
import { normalizeApiError, normalizeResponseError } from "@/lib/errors";

const API = (
  process.env.NEXT_PUBLIC_API_URL || "https://dev.api.moodies.tech/api"
).replace(/\/$/, "");

export type ReactionType = "LIKE" | "LOVE" | "HAHA" | "WOW" | "SAD" | "ANGRY";
export type ReactionSummary = {
  reactionCounts: { type: ReactionType; count: number }[];
  myReaction: ReactionType | null;
};
export type CommunityAuthor = {
  id: string;
  username: string;
  avatarUrl: string | null;
};
export type CommunityReply = ReactionSummary & {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  user: CommunityAuthor;
};
export type CommunityPost = ReactionSummary & {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  replyCount: number;
  user: CommunityAuthor;
  latestReply?: { id: string; createdAt: string; user: CommunityAuthor } | null;
};
export type CommunityPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
export type CommunityPostsPage = {
  posts: CommunityPost[];
  pagination: CommunityPagination;
};
export type CommunityRepliesPage = {
  replies: CommunityReply[];
  pagination: CommunityPagination;
};

export async function communityFetch<T>(
  path: string,
  init: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const url = `${API}/community/${path}`;
  const response = authenticated
    ? await sessionFetch(url, init)
    : await fetch(url, { ...init, credentials: "omit", cache: "no-store" });
  if (!response.ok) throw await normalizeResponseError(response);
  return response.json() as Promise<T>;
}

export function communityError(error: unknown): string {
  return normalizeApiError(error).userMessage;
}
