import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { QuizRecommendationService } from './quiz.service';
import { TMDBService } from 'src/external-apis/services/tmdb.service';
import type { QuizAnswer } from './quiz-ranking';

describe('quiz recommendation retrieval', () => {
  const request = jest.fn();
  const service = new QuizRecommendationService({
    request,
  } as unknown as TMDBService);
  beforeEach(() => request.mockReset());

  it('filters runtime, uses type-specific genres, and scores rather than shuffling', async () => {
    request.mockResolvedValue({
      results: [
        { id: 1, genre_ids: [10759], vote_average: 8, vote_count: 100 },
      ],
    });
    const answers: QuizAnswer[] = [
      { genres: ['action'], mood: 'thrilling' },
      { category: 'format', genres: [], mood: '', mediaType: 'tv' },
      { category: 'commitment', genres: [], mood: '', commitment: 'short' },
    ];
    const result = await service.getRecommendations(answers);
    expect(request).toHaveBeenCalledWith('/discover/tv', {
      params: {
        page: 1,
        include_adult: false,
        sort_by: 'popularity.desc',
        'vote_count.gte': 20,
        with_genres: '10759|80',
        'with_runtime.gte': 1,
        'with_runtime.lte': 30,
      },
    });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].matchScore).toBeGreaterThan(0);
    expect(result.partialResults).toBe(false);
  });
  it('distinguishes total upstream failure from a genuine empty catalogue', async () => {
    request.mockRejectedValue(new Error('upstream down'));
    await expect(
      service.getRecommendations([{ genres: [], mood: '' }]),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    request.mockResolvedValue({ results: [] });
    await expect(
      service.getRecommendations([{ genres: [], mood: '' }]),
    ).resolves.toMatchObject({ results: [], partialResults: false });
  });
  it('reports partial retrieval without inventing matches', async () => {
    request
      .mockRejectedValueOnce(new Error('page unavailable'))
      .mockResolvedValue({
        results: [{ id: 1, genre_ids: [28], vote_average: 8, vote_count: 100 }],
      });
    expect(
      (
        await service.getRecommendations([
          { genres: ['action'], mood: '', mediaType: 'movie' },
        ])
      ).partialResults,
    ).toBe(true);
  });
  it('rejects malformed answers before calling upstream', async () => {
    await expect(
      service.getRecommendations(null as unknown as QuizAnswer[]),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.getRecommendations([
        { genres: [], mood: '', mediaType: 'person' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(request).not.toHaveBeenCalled();
  });
});
