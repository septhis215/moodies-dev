import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsArray,
  Min,
  Max,
  ArrayMaxSize,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Reusable transform for query-string booleans.
 * "true" / "1" → true, everything else → false.
 */
const BooleanTransform = () =>
  Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
    return false;
  });

export class GetRecommendationsDto {
  @ApiProperty({
    description: 'Mood ID to get recommendations for',
    example: 'clx1234abcd',
  })
  @IsString()
  moodId: string;

  @ApiPropertyOptional({
    description: 'User ID for personalised recommendations',
    example: 'user_456',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Type of media to recommend',
    enum: ['movie', 'tv', 'both'],
    default: 'both',
  })
  @IsOptional()
  @IsEnum(['movie', 'tv', 'both'])
  mediaType?: 'movie' | 'tv' | 'both' = 'both';

  @ApiPropertyOptional({
    description: 'Number of recommendations to return (1–50)',
    minimum: 1,
    maximum: 50,
    default: 12,
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
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Only return items with a TMDB vote average ≥ this value (0–10)',
    minimum: 0,
    maximum: 10,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  minRating?: number = 0;

  @ApiPropertyOptional({
    description: 'Force a fresh fetch from TMDB, bypassing the cache',
    default: false,
  })
  @IsOptional()
  @BooleanTransform()
  @IsBoolean()
  forceRefresh?: boolean = false;

  @ApiPropertyOptional({
    description: 'Include adult-rated content in recommendations',
    default: false,
  })
  @IsOptional()
  @BooleanTransform()
  @IsBoolean()
  includeAdult?: boolean = false;

  @ApiPropertyOptional({
    description: 'ISO 639-1 language codes to restrict results to (e.g. ["en","fr"])',
    example: ['en', 'es'],
    type: [String],
    maxItems: 10,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(/^[a-z]{2}$/, { each: true, message: 'Each language must be a 2-letter ISO 639-1 code' })
  languages?: string[];

  @ApiPropertyOptional({
    description: 'Skip content the user has already viewed',
    default: false,
  })
  @IsOptional()
  @BooleanTransform()
  @IsBoolean()
  excludeViewed?: boolean = false;

  @ApiPropertyOptional({
    description: 'Shuffle high-quality matches within the cached recommendation pool',
    default: true,
  })
  @IsOptional()
  @BooleanTransform()
  @IsBoolean()
  shuffle?: boolean = true;
}
