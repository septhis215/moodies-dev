/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import { ReviewService } from './review.service';

function buildService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    review: {
      findUnique: jest.fn(),
    },
    mediaDetail: {
      findUnique: jest.fn(),
    },
    ...prismaOverrides,
  };

  const service = new ReviewService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { tmdb: jest.fn() } as any,
    {} as any,
  );

  return { service, prisma };
}

const cachedMovieDetail = {
  title: 'Arrival',
  payload: {
    info: {
      id: 329865,
      title: 'Arrival',
      release_date: '2016-11-10',
      poster_path: '/poster.jpg',
      backdrop_path: '/backdrop.jpg',
      runtime: 116,
      vote_average: 7.6,
      popularity: 55.2,
      genres: [{ id: 878, name: 'Science Fiction' }],
      director: 'Denis Villeneuve',
    },
    credits: {
      crew: [
        { job: 'Director', name: 'Denis Villeneuve' },
        { job: 'Director', name: 'Second Director' },
      ],
    },
  },
};

describe('ReviewService snapshot creation', () => {
  it('creates a content snapshot without requiring a review', async () => {
    const { service, prisma } = buildService();
    prisma.mediaDetail.findUnique.mockResolvedValue(cachedMovieDetail);

    const result = await service.createContentSnapshot('MOVIE', 329865);

    expect(result.snapshotType).toBe('content');
    expect(result.width).toBe(1080);
    expect(result.height).toBe(1080);
    expect(result.content.title).toBe('Arrival');
    expect(result.content.directors).toEqual([
      'Denis Villeneuve',
      'Second Director',
    ]);
    expect(result.review).toBeUndefined();
    expect(prisma.review.findUnique).not.toHaveBeenCalled();
  });

  it('creates a review snapshot for the review owner', async () => {
    const { service, prisma } = buildService();
    prisma.review.findUnique.mockResolvedValue({
      id: 'review-1',
      userId: 'user-1',
      tmdbId: 329865,
      mediaType: MediaType.MOVIE,
      rating: 9,
      content: 'Beautiful and thoughtful.',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      user: {
        name: 'Ava',
        username: 'ava',
      },
    });
    prisma.mediaDetail.findUnique.mockResolvedValue(cachedMovieDetail);

    const result = await service.createReviewSnapshot('user-1', 'review-1');

    expect(result.snapshotType).toBe('review');
    expect(result.review?.content).toBe('Beautiful and thoughtful.');
    expect(result.review?.username).toBe('ava');
  });

  it('rejects a review snapshot when the user does not own the review', async () => {
    const { service, prisma } = buildService();
    prisma.review.findUnique.mockResolvedValue({
      id: 'review-1',
      userId: 'other-user',
      tmdbId: 329865,
      mediaType: MediaType.MOVIE,
      rating: 9,
      content: 'Beautiful and thoughtful.',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      user: {
        name: 'Ava',
        username: 'ava',
      },
    });

    await expect(
      service.createReviewSnapshot('user-1', 'review-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.mediaDetail.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when the review is missing', async () => {
    const { service, prisma } = buildService();
    prisma.review.findUnique.mockResolvedValue(null);

    await expect(
      service.createReviewSnapshot('user-1', 'missing-review'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
