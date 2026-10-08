// Only known artwork can be resolved from API badge names; new badges keep their icon fallback.
export const badgeMascots = [
  "action-chaser", "binge-legend", "cinema-addict", "comfort-watcher", "community-star",
  "conversation-starter", "critic-mode", "daily-visitor", "deep-diver", "first-episode",
  "first-like", "first-post", "first-review", "first-save", "first-watch", "hidden-gem-hunter",
  "horror-survivor", "identity-unlocked", "kdrama-soul", "mood-explorer", "mood-master",
  "mood-starter", "moodies-identity", "moodies-legend", "moodies-loyalist", "movie-buff",
  "night-owl", "personality-seeker", "profile-starter", "profile-stylist", "quiz-starter",
  "review-voice", "romance-dreamer", "series-tracker", "super-fan", "taste-maker",
  "trend-builder", "watchlist-builder", "watchlist-collector", "weekly-explorer",
] as const;

export type BadgeMascotName = typeof badgeMascots[number];

export function resolveBadgeMascot(name?: string | null): BadgeMascotName | null {
  const key = name?.trim().toLowerCase().replace(/\s+/g, "-");
  return badgeMascots.find(mascot => mascot === key) ?? null;
}
