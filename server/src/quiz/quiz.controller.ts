import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { QuizRecommendationService } from './quiz.service';
import type { QuizAnswer } from './quiz-ranking';
import { AchievementsService } from 'src/achievements/achievements.service';
export type QuizAnswerDto = QuizAnswer;

export interface QuizRequestDto {
  answers: QuizAnswerDto[];
  attemptId?: string;
  version?: string;
  timezone?: string;
}

@Controller('quiz')
export class QuizRecommendationController {
  constructor(
    private readonly quizRecommendationService: QuizRecommendationService,
    @Optional() private readonly achievements?: AchievementsService,
  ) {}

  @Post('recommendations')
  async getRecommendations(@Body() quizRequest: QuizRequestDto) {
    const receipt = this.achievements?.enabled && quizRequest?.attemptId ? this.achievements.createQuizReceipt(quizRequest.answers, quizRequest.attemptId, quizRequest.version || '') : null;
    const result = await this.quizRecommendationService.getRecommendations(
      quizRequest?.answers,
    );
    return { ...result, ...(receipt ? { completionReceipt: receipt } : {}) };
  }

  @Get('recommendations')
  async getRecommendationsByQuery(
    @Query('genres') genres: string,
    @Query('mediaType') mediaType?: string,
    @Query('limit') limit?: string,
  ) {
    // Parse genres from query string (comma-separated)
    const genreArray = genres ? genres.split(',') : [];

    // Create mock answers from query params
    const answers: QuizAnswerDto[] = [
      {
        genres: genreArray,
        mood: 'any',
        mediaType: mediaType,
      },
    ];

    const results =
      await this.quizRecommendationService.getRecommendations(answers);

    // Limit results if specified
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!/^\d+$/.test(limit) || limitNum < 1 || limitNum > 25)
        throw new BadRequestException('Limit must be between 1 and 25.');
      return {
        ...results,
        results: results.results.slice(0, limitNum),
      };
    }

    return results;
  }
}
