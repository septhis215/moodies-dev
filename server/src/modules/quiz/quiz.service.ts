import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TMDBService } from 'src/external-apis/services/tmdb.service';
import {
  analyzeAnswers,
  GENRES,
  genreIds,
  rankCandidates,
  type QuizAnswer,
} from './quiz-ranking';
export type { QuizAnswer } from './quiz-ranking';

export interface TMDBMovie {
  id: number;
  title?: string;
  name?: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  vote_count: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  overview: string;
  genre_ids: number[];
  original_language: string;
  popularity: number;
  adult?: boolean;
}
type DiscoverResponse = { results: TMDBMovie[] };
export interface RecommendationResult {
  results: ReturnType<typeof rankCandidates<TMDBMovie>>;
  analysis: ReturnType<typeof analyzeAnswers>;
  totalResults: number;
  partialResults: boolean;
}

@Injectable()
export class QuizRecommendationService {
  private readonly logger = new Logger(QuizRecommendationService.name);
  constructor(private readonly tmdbService: TMDBService) {}

  async getRecommendations(
    answers: QuizAnswer[],
  ): Promise<RecommendationResult> {
    if (
      !Array.isArray(answers) ||
      !answers.length ||
      answers.length > 35 ||
      answers.some(
        (answer) =>
          !answer ||
          !Array.isArray(answer.genres) ||
          answer.genres.length > 20 ||
          answer.genres.some((g) => typeof g !== 'string') ||
          typeof answer.mood !== 'string' ||
          (answer.mediaType !== undefined &&
            !['movie', 'tv', 'mixed'].includes(answer.mediaType)) ||
          (answer.pace !== undefined &&
            !['slow', 'balanced', 'fast'].includes(answer.pace)) ||
          (answer.commitment !== undefined &&
            !['short', 'standard', 'open'].includes(answer.commitment)),
      )
    )
      throw new BadRequestException('Please provide valid quiz answers.');

    const analysis = analyzeAnswers(answers);
    const types: ('movie' | 'tv')[] = analysis.preferredMediaType
      ? [analysis.preferredMediaType]
      : ['movie', 'tv'];
    let successes = 0;
    let failures = 0;
    const candidates: TMDBMovie[] = [];
    const discover = async (
      type: 'movie' | 'tv',
      page: number,
      broad = false,
    ) => {
      const ids = genreIds(analysis.discoveryGenres, type);
      const params: Record<string, string | number | boolean> = {
        page,
        include_adult: false,
        sort_by: 'popularity.desc',
        'vote_count.gte': 20,
      };
      if (!broad && ids.length) params.with_genres = ids.join('|');
      const runtimeLimit =
        analysis.commitment === 'short'
          ? type === 'movie'
            ? 100
            : 30
          : analysis.commitment === 'standard'
            ? type === 'movie'
              ? 140
              : 60
            : null;
      if (runtimeLimit) {
        params['with_runtime.gte'] = 1;
        params['with_runtime.lte'] = runtimeLimit;
      }
      try {
        // Keep upstream caching, request deduplication and rate limiting in TMDBService.
        const data = await this.tmdbService.request<DiscoverResponse>(
          `/discover/${type}`,
          { params },
        );
        if (!Array.isArray(data.results))
          throw new Error('Invalid discover response');
        successes++;
        candidates.push(
          ...data.results
            .filter((item) => !item.adult)
            .map((item) => ({ ...item, media_type: type })),
        );
      } catch (error) {
        failures++;
        this.logger.warn(
          `Quiz ${type} candidates unavailable: ${error instanceof Error ? error.message : 'upstream error'}`,
        );
      }
    };
    // Fixed pools and stable tie-breakers: never shuffle the reward after scoring.
    await Promise.all(
      types.flatMap((type) => [1, 2, 3].map((page) => discover(type, page))),
    );
    if (candidates.length < 12)
      await Promise.all(types.map((type) => discover(type, 1, true)));
    if (!successes || (!candidates.length && failures)) {
      throw new ServiceUnavailableException(
        'Quiz recommendations are temporarily unavailable. Please retry.',
      );
    }
    const results = rankCandidates(candidates, analysis).slice(0, 25);
    return {
      results,
      analysis,
      totalResults: results.length,
      partialResults: failures > 0,
    };
  }

  async getRecommendationsByGenres(
    genreNames: string[],
    mediaType?: string,
    limit = 25,
  ): Promise<TMDBMovie[]> {
    const result = await this.getRecommendations([
      { genres: genreNames, mood: '', mediaType },
    ]);
    return result.results.slice(0, Math.max(0, limit));
  }

  getAvailableGenres(): string[] {
    return Object.keys(GENRES);
  }
}
