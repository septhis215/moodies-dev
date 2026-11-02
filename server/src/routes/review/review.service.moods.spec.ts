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
    expect(result.topMoods).toEqual([{ emoji: 'amazing', count: 32 }, { emoji: 'loved', count: 12 }, { emoji: 'enjoyed', count: 8 }]);
    expect(groupBy).toHaveBeenCalledWith({ by: ['moodEmojis'], where: { tmdbId: 42, mediaType: 'TV', status: { in: ['PUBLISHED', 'FLAGGED'] } }, _count: { _all: true } });
  });
});
