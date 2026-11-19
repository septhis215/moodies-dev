import type { MoodReview } from '@/components/selected-content/types';

type ReactionCount = { count: number };
type Candidate = MoodReview & {
  moodEmojis?: string[];
  createdAt?: string;
  reactionCounts?: ReactionCount[];
  replies?: Array<{ reactionCounts?: ReactionCount[] }>;
};
type ReviewResponse = {
  reviews: Candidate[];
  featuredReviews?: Candidate[];
  topMoods?: Array<{ emoji: string; count: number }>;
  moodReview?: MoodReview | null;
  pagination?: { page: number; totalPages: number };
};

function activity(review: Candidate) {
  const reactions = (counts: ReactionCount[] = []) => counts.reduce((sum, reaction) => sum + Math.max(0, reaction.count), 0);
  return reactions(review.reactionCounts) + (review.replies?.length ?? 0)
    + (review.replies ?? []).reduce((sum, reply) => sum + reactions(reply.reactionCounts), 0);
}

// Support the hosted API while its dedicated moodReview field rolls out.
export async function withMoodReview<T extends ReviewResponse>(data: T, requestUrl: string): Promise<T & { moodReview: MoodReview | null }> {
  if (data.moodReview !== undefined) return { ...data, moodReview: data.moodReview };
  const mood = [...(data.topMoods ?? [])].sort((a, b) => b.count - a.count)[0]?.emoji;
  if (!mood) return { ...data, moodReview: null };

  const candidates = [...data.reviews, ...(data.featuredReviews ?? [])];
  try {
    for (let page = 2; page <= (data.pagination?.totalPages ?? 1); page++) {
      const url = new URL(requestUrl);
      url.searchParams.set('page', String(page));
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return { ...data, moodReview: null };
      const next: ReviewResponse = await response.json();
      candidates.push(...next.reviews);
    }
  } catch {
    return { ...data, moodReview: null };
  }

  const matching = [...new Map(candidates.map(review => [review.id, review])).values()]
    .filter(review => review.content.trim() && review.moodEmojis?.includes(mood))
    .sort((a, b) => activity(b) - activity(a)
      || (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0)
      || a.id.localeCompare(b.id));
  return { ...data, moodReview: matching[0] ?? null };
}
