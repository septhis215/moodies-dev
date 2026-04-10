import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecommendationFeedbackDto {
  @ApiProperty({
    description: 'ID of the recommendation being rated',
    example: 'clx5678efgh',
  })
  @IsString()
  recommendationId: string;

  @ApiPropertyOptional({
    description: 'Whether the user liked this recommendation',
  })
  @IsOptional()
  @IsBoolean()
  liked?: boolean;

  @ApiPropertyOptional({
    description: 'Mark this recommendation as viewed',
  })
  @IsOptional()
  @IsBoolean()
  viewed?: boolean;

  @ApiPropertyOptional({
    description: 'User rating from 1 to 10',
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rating?: number;
}