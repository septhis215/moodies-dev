import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { QuizRecommendationService } from './quiz.service';
export interface QuizAnswerDto {
  genres: string[];
  mood: string;
  mediaType?: string;
}

export interface QuizRequestDto {
  answers: QuizAnswerDto[];
}

@Controller('quiz')
export class QuizRecommendationController {
  constructor(
    private readonly quizRecommendationService: QuizRecommendationService,
  ) { }

  @Post('recommendations')
  async getRecommendations(@Body() quizRequest: QuizRequestDto) {
    return this.quizRecommendationService.getRecommendations(
      quizRequest.answers,
    );
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

    const results = await this.quizRecommendationService.getRecommendations(
      answers,
    );

    // Limit results if specified
    if (limit) {
      const limitNum = parseInt(limit, 10);
      return {
        ...results,
        results: results.results.slice(0, limitNum),
      };
    }

    return results;
  }
}