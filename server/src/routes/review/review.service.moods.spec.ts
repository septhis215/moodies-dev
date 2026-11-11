import { ReviewService } from './review.service';

describe('Title audience mood totals', () => {
  it('uses all grouped votes, including moods outside the top three, even on an empty review page', async () => {
    const groupBy = jest.fn().mockResolvedValue([
      { moodEmojis: ['amazing'], _count: { _all: 30 } },
      { moodEmojis: ['loved'], _count: { _all: 10 } },
      { moodEmojis: ['enjoyed'], _count: { _all: 8 } },
      { moodEmojis: ['okay'], _count: { _all: 2 } },
      { moodEmojis: ['amazing', 'loved'], _count: { _all: 2 } },
    ]);
    const prisma = { review: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(52), groupBy } };
    const service = new ReviewService(...[prisma, {}, {}, {}, {}, {}, {}] as unknown as ConstructorParameters<typeof ReviewService>);
    const result = await service.getMediaReviews(42, 'TV', 99, 10);
    expect(result.totalMoodVotes).toBe(54);
    expect(result.allMoods).toEqual([{ emoji: 'amazing', count: 32 }, { emoji: 'loved', count: 12 }, { emoji: 'enjoyed', count: 8 }, { emoji: 'okay', count: 2 }]);
    expect(result.topMoods).toEqual([{ emoji: 'amazing', count: 32 }, { emoji: 'loved', count: 12 }, { emoji: 'enjoyed', count: 8 }]);
    expect(groupBy).toHaveBeenCalledWith({ by: ['moodEmojis'], where: { tmdbId: 42, mediaType: 'TV', status: { in: ['PUBLISHED', 'FLAGGED'] } }, _count: { _all: true } });
  });
});

describe('Featured title reviews', () => {
  it('caps the shortlist at three, breaks activity ties by recency, and reuses loaded reviews', async () => {
    const records = [
      { id: 'older', createdAt: new Date('2026-01-01'), reactions: Array.from({ length: 4 }, () => ({ type: 'LIKE', userId: 'viewer' })), replies: [] },
      { id: 'newer', createdAt: new Date('2026-11-11'), reactions: Array.from({ length: 4 }, () => ({ type: 'LIKE', userId: 'viewer' })), replies: [] },
      { id: 'third', createdAt: new Date('2026-01-01'), reactions: [{ type: 'LOVE', userId: 'viewer' }, { type: 'LIKE', userId: 'other' }], replies: [] },
      { id: 'fourth', createdAt: new Date('2026-01-01'), reactions: [{ type: 'LIKE', userId: 'viewer' }], replies: [] },
      { id: 'quiet', createdAt: new Date('2026-11-11'), reactions: [], replies: [] },
    ];
    const findMany = jest.fn().mockImplementation(args => Promise.resolve(args.select
      ? records.map(review => ({ id: review.id, createdAt: review.createdAt, _count: { reactions: review.reactions.length, replies: 0 }, replies: [] }))
      : records));
    const prisma = { review: { findMany, count: jest.fn().mockResolvedValue(5), groupBy: jest.fn().mockResolvedValue([]) } };
    const service = new ReviewService(...[prisma, {}, {}, {}, {}, {}, {}] as unknown as ConstructorParameters<typeof ReviewService>);
    const result = await service.getMediaReviews(42, 'TV');
    expect(result.featuredReviews.map(review => review.id)).toEqual(['newer', 'older', 'third']);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('ranks activity across the title, fetches older winners beyond the page, and sanitizes them', async () => {
    const recent = { id: 'recent', createdAt: new Date('2026-11-11'), rating: 10, content: 'A long review', replies: [], reactions: [] };
    const older = { id: 'older', createdAt: new Date('2026-01-01'), rating: 2, content: 'A discussion', replies: [], reactions: [{ type: 'LIKE', userId: 'viewer' }], userId: 'author', toxicityScore: 0.1, profanityHit: false, flaggedReason: null };
    const findMany = jest.fn().mockImplementation((args) => {
      if (args.select) return Promise.resolve([
        { id: 'recent', createdAt: recent.createdAt, _count: { reactions: 0, replies: 0 }, replies: [] },
        { id: 'older', createdAt: older.createdAt, _count: { reactions: 3, replies: 1 }, replies: [{ _count: { reactions: 4 } }] },
      ]);
      return Promise.resolve(args.where.id ? [older] : [recent]);
    });
    const prisma = { review: { findMany, count: jest.fn().mockResolvedValue(101), groupBy: jest.fn().mockResolvedValue([]) } };
    const service = new ReviewService(...[prisma, {}, {}, {}, {}, {}, {}] as unknown as ConstructorParameters<typeof ReviewService>);
    const result = await service.getMediaReviews(42, 'MOVIE', 1, 1, 'viewer');
    expect(result.reviews.map(review => review.id)).toEqual(['recent']);
    expect(result.featuredReviews.map(review => review.id)).toEqual(['older']);
    expect(result.featuredReviews[0].myReaction).toBe('LIKE');
    expect(result.featuredReviews[0]).not.toHaveProperty('toxicityScore');
    expect(result.featuredReviews[0]).not.toHaveProperty('userId');
    const aggregate = findMany.mock.calls.find(([args]) => args.select)?.[0];
    expect(aggregate).not.toHaveProperty('take');
    expect(aggregate.where).toEqual({ tmdbId: 42, mediaType: 'MOVIE', status: { in: ['PUBLISHED', 'FLAGGED'] } });
    expect(result.pagination.total).toBe(101);
  });
});
