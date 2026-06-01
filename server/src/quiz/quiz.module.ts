import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { QuizRecommendationService } from './quiz.service';
import { QuizRecommendationController } from './quiz.controller';

@Module({
  imports: [ConfigModule],
  providers: [QuizRecommendationService],
  controllers: [QuizRecommendationController],
  exports: [QuizRecommendationService]
})
export class QuizModule {}
