import { IsUUID, IsBoolean, IsOptional, IsInt, Min, Max } from 'class-validator';

export class RecommendationFeedbackDto {
  @IsUUID()
  recommendationId: string;

  @IsOptional()
  @IsBoolean()
  liked?: boolean;

  @IsOptional()
  @IsBoolean()
  viewed?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rating?: number;
}