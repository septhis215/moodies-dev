import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LogMoodDto {
  @ApiProperty({
    description: 'ID of the mood being logged',
    example: 'clx1234abcd',
  })
  @IsString()
  moodId: string;

  @ApiPropertyOptional({
    description: 'User ID — defaults to "anonymous" if omitted',
    example: 'user_456',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Subjective intensity of the mood from 1 (mild) to 10 (extreme)',
    minimum: 1,
    maximum: 10,
    default: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  intensity?: number = 5;

  @ApiPropertyOptional({
    description: 'Freeform tags describing the context (e.g. ["evening", "alone"])',
    type: [String],
    example: ['evening', 'alone'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Optional freeform note about what triggered this mood',
    example: 'After a long day at work',
  })
  @IsOptional()
  @IsString()
  context?: string;
}