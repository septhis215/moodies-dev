import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { QuizAnswer } from 'src/quiz/quiz-ranking';
export class AchievementActivityDto {
  @IsIn(['visit', 'detail', 'mood']) kind: 'visit' | 'detail' | 'mood';
  @IsOptional() @IsString() @MaxLength(80) timezone?: string;
  @IsOptional() @IsInt() @Min(1) @Max(2147483647) tmdbId?: number;
  @IsOptional() @IsIn(['movie', 'tv']) type?: 'movie' | 'tv';
  @IsOptional() @IsString() @MaxLength(100) moodId?: string;
}
export class WatchedStatusDto {
  @IsBoolean() active: boolean;
}
export class AchievementNotificationAckDto {
  @IsUUID() token: string;
}
export class AchievementQuizCompletionDto {
  @IsArray() @ArrayMinSize(5) @ArrayMaxSize(5) answers: QuizAnswer[];
  @IsUUID() attemptId: string;
  @IsString() @MaxLength(50) version: string;
  @IsString() @MaxLength(2048) receipt: string;
  @IsOptional() @IsString() @MaxLength(80) timezone?: string;
}
