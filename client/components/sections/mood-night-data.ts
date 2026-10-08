export type MoodNightItem = {
  id: number;
  type: "movie" | "tv";
  title: string;
  poster: string | null;
  backdrop: string | null;
};

export const moodNightChoices = [
  { id: "easy", label: "Easy", color: "#FFDEAD", mascot: "cozy", mascotName: "Cozy", note: "Low-stakes, comforting watches for a quiet night." },
  { id: "tense", label: "Tense", color: "#FF6B35", mascot: "thrilling", mascotName: "Thrilling", note: "Pressure, suspense, and stories that keep moving." },
  { id: "tender", label: "Tender", color: "#FF69B4", mascot: "romantic", mascotName: "Romantic", note: "Warm, intimate stories with something human at the center." },
  { id: "strange", label: "Strange", color: "#BA55D3", mascot: "mind-bending", mascotName: "Mind-Bending", note: "Unfamiliar worlds, odd turns, and singular ideas." },
  { id: "electric", label: "Electric", color: "#8A2BE2", mascot: "epic", mascotName: "Epic", note: "Fast, loud, kinetic picks for a high-energy watch." },
] as const;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function findNightMoodId(payload: unknown, name: string): string | null {
  if (!Array.isArray(payload)) return null;
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const mood = payload.map(record).find(item => typeof item.name === "string" && normalize(item.name) === normalize(name));
  return typeof mood?.id === "string" ? mood.id : null;
}

export function normalizeNightItems(payload: unknown): MoodNightItem[] {
  const root = record(payload);
  const entries = Array.isArray(payload) ? payload : root.items ?? root.recommendations ?? root.results;
  if (!Array.isArray(entries)) return [];
  const items = new Map<string, MoodNightItem>();
  for (const value of entries) {
    const item = record(value);
    // Recommendation IDs are database UUIDs; title links must use the TMDB ID.
    const id = Number(item.tmdbId ?? item.id);
    const media = String(item.mediaType ?? item.type ?? "").toLowerCase();
    if (!Number.isSafeInteger(id) || id <= 0 || !["movie", "tv", "series"].includes(media)) continue;
    const type = media === "movie" ? "movie" : "tv";
    const text = (value: unknown) => typeof value === "string" && value ? value : null;
    items.set(`${type}-${id}`, {
      id, type, title: text(item.title) ?? text(item.name) ?? "Untitled",
      poster: text(item.poster ?? item.posterPath ?? item.poster_path),
      backdrop: text(item.backdrop ?? item.backdropPath ?? item.backdrop_path),
    });
  }
  return [...items.values()].slice(0, 4);
}

export function findNightTrailer(payload: unknown, items: MoodNightItem[]) {
  const keys = record(payload);
  for (const item of items) {
    const key = keys[`${item.type}-${item.id}`];
    if (typeof key === "string" && /^[a-zA-Z0-9_-]{11}$/.test(key)) return { item, key };
  }
  return null;
}

export function parseNightPreview(payload: unknown) {
  const items = normalizeNightItems(payload);
  const root = record(payload);
  // Existing database snapshots remain usable while the API upgrades them.
  const entries = Array.isArray(root.trailers) ? root.trailers : [root.trailer];
  const trailers = entries.flatMap(value => {
    const trailer = record(value);
    const trailerItem = record(trailer.item);
    const item = items.find(item => item.id === trailerItem.id && item.type === trailerItem.type);
    const key = trailer.key;
    return item && typeof key === "string" && /^[a-zA-Z0-9_-]{11}$/.test(key) ? [{ item, key }] : [];
  });
  return {
    items,
    trailer: trailers[0] ?? null,
    trailers,
  };
}

export function selectNightPreview(preview: ReturnType<typeof parseNightPreview> | null, selectedKey: string | null) {
  const item = preview?.items.find(item => `${item.type}-${item.id}` === selectedKey)
    ?? preview?.trailer?.item ?? preview?.items[0] ?? null;
  const trailer = preview?.trailers.find(trailer => trailer.item.id === item?.id && trailer.item.type === item?.type) ?? null;
  return { item, trailer };
}
