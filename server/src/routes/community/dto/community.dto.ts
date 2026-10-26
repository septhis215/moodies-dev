import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CommunityPageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 10;
}

export class CommunityTopicsQueryDto extends CommunityPageDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['newest', 'most-replies'])
  sort?: 'newest' | 'most-replies';

  @IsOptional()
  @IsIn(['all', 'unanswered', 'mine'])
  filter?: 'all' | 'unanswered' | 'mine';
}

export class CreateCommunityPostDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  content!: string;
}

export class CreateCommunityReplyDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  content!: string;
}
