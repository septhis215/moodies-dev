export const RULE_TARGETS = [
  'mood_selections',
  'distinct_moods',
  'all_moods',
  'watched_movies',
  'watched_series',
  'reviews',
  'liked_titles',
  'watchlist_titles',
  'community_posts',
  'community_posts_comments',
  'community_likes_received',
  'quizzes',
  'all_quiz_types',
  'visit_days',
  'profile_basic',
  'profile_stylist',
  'full_identity',
  'hidden_gems',
  'k_drama_romance',
  'horror_titles',
  'romance_titles',
  'action_adventure_titles',
  'cozy_titles',
  'late_night_sessions',
  'trending_titles',
  'detail_views',
  'badges_earned',
] as const;
export type RuleTarget = (typeof RULE_TARGETS)[number];
export const ACHIEVEMENT_RULE_VERSION = 1;
export const QUIZ_TYPES = ['signal-reel'] as const;
export const QUIZ_VERSION = 'signal-reel-v2';
export const DISCOVERY_POLICY = {
  version: 1,
  minimumVotes: 200,
  minimumRating: 7.5,
  maximumPopularity: 20,
} as const;

export function evaluateProgress(
  value: number,
  required: number,
  alreadyUnlocked: boolean,
) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    !Number.isSafeInteger(required) ||
    required < 1
  )
    throw new Error('Invalid achievement progress');
  const unlocked = alreadyUnlocked || value >= required;
  return {
    currentProgress: unlocked ? Math.max(required, value) : value,
    completionPercentage: unlocked
      ? 100
      : Math.min(99.99, Math.round((value / required) * 10000) / 100),
    unlocked,
  };
}

function dateNumber(key: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key))
    throw new Error('Invalid activity date');
  const time = Date.parse(`${key}T00:00:00Z`);
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== key
  )
    throw new Error('Invalid activity date');
  return time / 86400000;
}
export function longestStreak(dates: string[]) {
  let longest = 0;
  let run = 0;
  let previous = -Infinity;
  for (const day of [...new Set(dates.map(dateNumber))].sort((a, b) => a - b)) {
    run = day === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return longest;
}
export function validTimezone(value: string) {
  if (typeof value !== 'string' || value.length > 80)
    throw new Error('Invalid timezone');
  return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions()
    .timeZone;
}
export function calendarKeys(at: Date, timezone: string) {
  const zone = validTimezone(timezone);
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const part = (key: string) => parts.find((item) => item.type === key)!.value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  const hour = Number(part('hour'));
  const night =
    hour >= 22
      ? date
      : hour < 4
        ? new Date((dateNumber(date) - 1) * 86400000).toISOString().slice(0, 10)
        : undefined;
  return { date, ...(night ? { night } : {}) };
}
export interface TitleEvidence {
  genreIds: number[];
  countries: string[];
  rating: number;
  votes: number;
  popularity: number;
  adult: boolean;
}
export function classifyTitle(
  title: TitleEvidence,
  trending: boolean,
): RuleTarget[] {
  if (title.adult) return [];
  const genres = new Set(title.genreIds);
  const result: RuleTarget[] = [];
  if (genres.has(27)) result.push('horror_titles');
  if (genres.has(10749)) result.push('romance_titles');
  if ([28, 12, 10759].some((genre) => genres.has(genre)))
    result.push('action_adventure_titles');
  if ([10751, 16, 35].some((genre) => genres.has(genre)))
    result.push('cozy_titles');
  if (title.countries.includes('KR') && (genres.has(18) || genres.has(10749)))
    result.push('k_drama_romance');
  if (
    title.votes >= DISCOVERY_POLICY.minimumVotes &&
    title.rating >= DISCOVERY_POLICY.minimumRating &&
    title.popularity <= DISCOVERY_POLICY.maximumPopularity
  )
    result.push('hidden_gems');
  if (trending) result.push('trending_titles');
  return result;
}
