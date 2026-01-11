import { ReviewStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsEnum } from "class-validator";

export class ReviewQueryDto {
  @IsInt()
  @Type(() => Number)
  page = 1;

  @IsInt()
  @Type(() => Number)
  limit = 10;

  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;
}
