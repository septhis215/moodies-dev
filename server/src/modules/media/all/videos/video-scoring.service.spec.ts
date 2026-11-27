import { VideoScoringService } from './video-scoring.service';

describe('promotional video relevance', () => {
  const service = new VideoScoringService();
  const trailer = { site: 'YouTube', key: 'abcdefghijk', official: true, name: 'Official Trailer', type: 'Trailer', size: 1080, published_at: '2020-01-01' };
  it('prefers the official trailer to a fresh high-resolution clip', () => {
    expect(service.calculateVideoScore(trailer)).toBeGreaterThan(service.calculateVideoScore({ ...trailer, type: 'Clip', name: 'Official Clip', size: 2160, published_at: new Date().toISOString() }));
  });
  it('deduplicates video keys and rejects fan concepts and malformed keys', () => {
    expect(service.filterVideos([trailer, trailer, { ...trailer, key: 'lmnopqrstuv', name: 'Fan-made concept trailer' }, { ...trailer, key: 'invalid' }], ['US'])).toEqual([trailer]);
  });
});
