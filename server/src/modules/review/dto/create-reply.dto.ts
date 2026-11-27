import { IsString, MinLength, MaxLength } from "class-validator";

export class CreateReplyDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  content: string;
}
