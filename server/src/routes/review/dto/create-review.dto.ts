import { MediaType } from "@prisma/client";
import { IsInt, Min, Max, IsString, MinLength, MaxLength, IsArray, ArrayMinSize, ArrayMaxSize, IsEnum, IsNotEmpty } from "class-validator";

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(10)
  rating: number;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  content: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  moodEmojis: string[];

  @IsInt()
  tmdbId: number;

  @IsEnum(MediaType)
  mediaType: MediaType;

  @IsString()
  @IsNotEmpty()
  captchaToken: string;
}
