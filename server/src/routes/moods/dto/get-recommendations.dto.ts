import { IsOptional, IsString, IsNumber, IsEnum, IsBoolean, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetRecommendationsDto {
  @ApiProperty({
    description: 'Mood ID to get recommendations for',
    example: 'mood_123'
  })
  @IsString()
  moodId: string;

  @ApiPropertyOptional({
    description: 'User ID for personalized recommendations',
    example: 'user_456'
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Type of media to recommend',
    enum: ['movie', 'tv', 'both'],
    default: 'both'
  })
  @IsOptional()
  @IsEnum(['movie', 'tv', 'both'])
  mediaType?: 'movie' | 'tv' | 'both' = 'both';

  @ApiPropertyOptional({
    description: 'Number of recommendations to return',
    minimum: 1,
    maximum: 50,
    default: 12
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 12;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Minimum rating for recommendations (1-10)',
    minimum: 0,
    maximum: 10
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  minRating?: number;

  @ApiPropertyOptional({
    description: 'Force refresh of recommendations (bypass cache)',
    default: false
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsBoolean()
  forceRefresh?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include adult content in recommendations',
    default: false
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsBoolean()
  includeAdult?: boolean = false;

  @ApiPropertyOptional({
    description: 'Preferred languages (ISO 639-1 codes)',
    example: ['en', 'es', 'fr'],
    type: [String]
  })
  @IsOptional()
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional({
    description: 'Exclude previously viewed content',
    default: false
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsBoolean()
  excludeViewed?: boolean = false;
}