import { IsUUID, IsOptional, IsInt, Min, Max, IsString, IsArray } from 'class-validator';

export class LogMoodDto {
  @IsUUID()
  moodId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  intensity?: number = 5;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  context?: string;
}