import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { MoodNightPreviewService } from './mood-night-preview.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MoodsService } from './moods.service';
import { AllService } from 'src/media/all/all.service';

describe('database-backed mood night previews', () => {
  const item = { id: 7, type: 'movie', title: 'A film', poster: '/poster.jpg', backdrop: '/backdrop.jpg' };
  const trailer = { item, key: 'abcdefghijk' };
  const payload = { items: [item], trailer, trailers: [trailer] };
  let row: { payload: typeof payload; expiresAt: Date } | null;
  let prisma: { moodNightPreview: { findUnique: jest.Mock; upsert: jest.Mock }; mood: { findFirst: jest.Mock } };
  let moods: { getRecommendations: jest.Mock };
  let all: { getTrailersForItems: jest.Mock };
  let service: MoodNightPreviewService;
  const createService = () => new MoodNightPreviewService(prisma as unknown as PrismaService, moods as unknown as MoodsService, all as unknown as AllService);
  beforeEach(() => {
    row = null;
    prisma = { moodNightPreview: {
      findUnique: jest.fn(() => Promise.resolve(row)),
      upsert: jest.fn(({ create }: { create: NonNullable<typeof row> }) => { row = create; return Promise.resolve(create); }),
    }, mood: { findFirst: jest.fn().mockResolvedValue({ id: 'cozy-id' }) } };
    moods = { getRecommendations: jest.fn().mockResolvedValue({ recommendations: [{ tmdbId: 7, mediaType: 'MOVIE', title: 'A film', posterPath: '/poster.jpg', backdropPath: '/backdrop.jpg' }] }) };
    all = { getTrailersForItems: jest.fn().mockResolvedValue({ 'movie-7': 'abcdefghijk' }) };
    service = createService();
  });

  it('persists metadata and trailer together and reuses the database after restart', async () => {
    expect(await service.getPreview('easy')).toEqual(payload);
    expect(prisma.moodNightPreview.upsert).toHaveBeenCalledTimes(1);
    expect(await createService().getPreview('easy')).toEqual(payload);
    expect(moods.getRecommendations).toHaveBeenCalledTimes(1);
    expect(all.getTrailersForItems).toHaveBeenCalledTimes(1);
    expect(moods.getRecommendations).toHaveBeenCalledWith(expect.objectContaining({ userId: 'anonymous', limit: 4 }));
    expect(row!.expiresAt.getTime() - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);
  });

  it('shares concurrent cold builds', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => service.getPreview('easy')));
    expect(results).toHaveLength(8);
    expect(moods.getRecommendations).toHaveBeenCalledTimes(1);
    expect(prisma.moodNightPreview.upsert).toHaveBeenCalledTimes(1);
  });

  it('stores all available trailer keys without additional batch lookups', async () => {
    moods.getRecommendations.mockResolvedValue({ recommendations: [
      { tmdbId: 7, mediaType: 'MOVIE', title: 'A film', posterPath: null, backdropPath: null },
      { tmdbId: 7, mediaType: 'TV', title: 'A series', posterPath: null, backdropPath: null },
    ] });
    all.getTrailersForItems.mockResolvedValue({ 'movie-7': 'abcdefghijk', 'tv-7': 'lmnopqrstuv' });
    const result = await service.getPreview('easy');
    expect(result.trailers?.map(trailer => [trailer.item.type, trailer.key])).toEqual([['movie', 'abcdefghijk'], ['tv', 'lmnopqrstuv']]);
    expect(all.getTrailersForItems).toHaveBeenCalledTimes(1);
    expect(await createService().getPreview('easy')).toEqual(result);
    expect(all.getTrailersForItems).toHaveBeenCalledTimes(1);
  });

  it('serves older snapshots while upgrading their trailer selection', async () => {
    row = { payload: { ...payload, trailers: undefined } as unknown as typeof payload, expiresAt: new Date(Date.now() + 86400000) };
    const result = await service.getPreview('easy');
    expect(result.trailer).toEqual(trailer);
    await new Promise(setImmediate);
    expect(row.payload.trailers).toEqual([trailer]);
    expect(all.getTrailersForItems).toHaveBeenCalledTimes(1);
  });

  it('returns stale data before a slow refresh finishes', async () => {
    row = { payload, expiresAt: new Date(0) };
    let release!: (value: { recommendations: [] }) => void;
    moods.getRecommendations.mockReturnValue(new Promise(resolve => { release = resolve; }));
    expect(await service.getPreview('easy')).toEqual(payload);
    expect(prisma.moodNightPreview.upsert).not.toHaveBeenCalled();
    release({ recommendations: [] });
    await new Promise(setImmediate);
  });

  it('keeps the last good snapshot on upstream failure and backs off', async () => {
    row = { payload, expiresAt: new Date(0) };
    moods.getRecommendations.mockRejectedValue(new Error('TMDB unavailable'));
    expect(await service.getPreview('easy')).toEqual(payload);
    await new Promise(setImmediate);
    expect(await service.getPreview('easy')).toEqual(payload);
    expect(moods.getRecommendations).toHaveBeenCalledTimes(1);
    expect(prisma.moodNightPreview.upsert).not.toHaveBeenCalled();
  });

  it('does not replace a working trailer when trailer hydration fails', async () => {
    row = { payload, expiresAt: new Date(0) };
    all.getTrailersForItems.mockResolvedValue({ 'movie-7': null });
    expect(await service.getPreview('easy')).toEqual(payload);
    await new Promise(setImmediate);
    expect(prisma.moodNightPreview.upsert).not.toHaveBeenCalled();
  });

  it('stores still artwork with a shorter retry interval when no trailer exists', async () => {
    all.getTrailersForItems.mockResolvedValue({ 'movie-7': null });
    expect((await service.getPreview('easy')).trailer).toBeNull();
    expect(row!.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it('does not persist an empty generation and throttles repeated cold failures', async () => {
    moods.getRecommendations.mockResolvedValue({ recommendations: [] });
    await expect(service.getPreview('easy')).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.getPreview('easy')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.moodNightPreview.upsert).not.toHaveBeenCalled();
    expect(moods.getRecommendations).toHaveBeenCalledTimes(1);
  });

  it('rejects arbitrary choices before touching the database', async () => {
    await expect(service.getPreview('__proto__')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.moodNightPreview.findUnique).not.toHaveBeenCalled();
  });

  it('warms all five fixed choices', async () => {
    await service.warmPreviews();
    expect(prisma.moodNightPreview.upsert.mock.calls.map(([args]: [{ where: { choice: string } }]) => args.where.choice)).toEqual(['easy', 'tense', 'tender', 'strange', 'electric']);
  });
});
