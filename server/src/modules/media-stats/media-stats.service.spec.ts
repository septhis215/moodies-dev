import { ServiceUnavailableException } from '@nestjs/common';
import { MediaStatsService } from './media-stats.service';

describe('Community pulse first-load recovery', () => {
  const row = { tmdbId: 42, likeCount: 2, reviewCount: 1, savedCount: 3 };
  const setup = () => {
    const findMany = jest.fn().mockResolvedValue([row]);
    const request = jest.fn().mockResolvedValue({ title: 'A community pick', release_date: '2026-01-01' });
    const service = new MediaStatsService(
      { mediaStat: { findMany } } as unknown as ConstructorParameters<typeof MediaStatsService>[0],
      { request } as unknown as ConstructorParameters<typeof MediaStatsService>[1],
    );
    return { service, findMany, request };
  };

  it('returns genuine empty activity without fetching TMDB', async () => {
    const { service, findMany, request } = setup();
    findMany.mockResolvedValue([]);
    await expect(service.getCommunityPulse('tv', 5)).resolves.toEqual({ mostLiked: [], mostReviewed: [], mostSaved: [] });
    expect(request).not.toHaveBeenCalled();
  });

  it('deduplicates metadata across metrics and retains the engagement counts', async () => {
    const { service, request } = setup();
    const pulse = await service.getCommunityPulse('movie', 5);
    expect(request).toHaveBeenCalledTimes(1);
    expect(pulse.mostLiked[0]).toMatchObject({ id: 42, title: 'A community pick', savedCount: 3 });
    expect(pulse.mostSaved).toEqual(pulse.mostReviewed);
  });

  it('exposes an upstream outage as retryable instead of a successful empty response', async () => {
    const { service, request } = setup();
    request.mockRejectedValueOnce(new Error('TMDB timeout'));
    await expect(service.getCommunityPulse('movie', 5)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.getCommunityPulse('movie', 5)).resolves.toMatchObject({ mostLiked: [{ id: 42 }] });
  });

  it('keeps usable titles when only some metadata is unavailable', async () => {
    const { service, findMany, request } = setup();
    findMany.mockResolvedValue([row, { ...row, tmdbId: 43 }]);
    request.mockRejectedValueOnce(new Error('Missing metadata'));
    const pulse = await service.getCommunityPulse('tv', 5);
    expect(pulse.mostLiked.map(item => item.id)).toEqual([43]);
  });
});
