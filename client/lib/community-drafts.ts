const PREFIX = "moodies:community-draft:";
export type CommunityDraft = { title: string; content: string };

export function communityDraftKey(userId: string, postId?: string): string {
  return `${PREFIX}${encodeURIComponent(userId)}:${postId ?? "new"}`;
}

export function readCommunityDraft(key: string): CommunityDraft | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    return typeof draft.title === "string" &&
      draft.title.length <= 120 &&
      typeof draft.content === "string" &&
      draft.content.length <= 3000
      ? { title: draft.title, content: draft.content }
      : null;
  } catch {
    return null;
  }
}

export function saveCommunityDraft(
  key: string,
  draft: CommunityDraft,
): boolean {
  try {
    if (draft.title || draft.content)
      sessionStorage.setItem(key, JSON.stringify(draft));
    else sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function clearCommunityDrafts(): void {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {
    /* Draft storage is optional. */
  }
}
