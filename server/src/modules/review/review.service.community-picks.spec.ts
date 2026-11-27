import { ReviewService } from './review.service';

function setup(count: number) {
  const records = Array.from({ length: count }, (_, i) => ({
    id: `review-${i}`, tmdbId: i + 1, mediaType: 'MOVIE', content: `Review ${i}`,
    rating: 8, status: 'PUBLISHED', createdAt: new Date(), userId: `user-${i}`,
    toxicityScore: 0.1, profanityHit: false, flaggedReason: null,
    user: { id: `user-${i}`, username: `member${i}`, avatarUrl: null },
  }));
  const findMany = jest.fn().mockResolvedValue(records);
  const prisma = { review: { findMany }, mediaDetail: { findMany: jest.fn().mockResolvedValue([]) } };
  const redis = { getOrSet: jest.fn(async (_key, _ttl, fetcher) => fetcher()) };
  const service = new ReviewService(...[prisma, {}, {}, {}, {}, {}, redis] as unknown as ConstructorParameters<typeof ReviewService>);
  return { service, findMany, redis };
}

describe('20 community featured reviews', () => {
  it('returns 20 real reviews by default without changing eligibility or public serialization', async () => {
    const { service, findMany, redis } = setup(30);
    const reviews = await service.getCommunityPicks();
    expect(reviews).toHaveLength(20);
    expect(new Set(reviews.map(review => review.id)).size).toBe(20);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ['PUBLISHED', 'FLAGGED'] }, content: { not: '' } },
      take: 80, orderBy: { createdAt: 'desc' },
    }));
    expect(redis.getOrSet.mock.calls[0][0]).toBe('reviews:community-picks:20');
    for (const review of reviews) {
      expect(review).not.toHaveProperty('userId');
      expect(review).not.toHaveProperty('toxicityScore');
      expect(review).not.toHaveProperty('flaggedReason');
    }
  });

  it('returns only available reviews rather than padding the section', async () => {
    expect(await setup(3).service.getCommunityPicks()).toHaveLength(3);
  });
});
