import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export type SnapshotFormat = 'square';

export class CreateSnapshotDto {
  @IsOptional()
  @IsIn(['square'])
  format?: SnapshotFormat;

  @IsString()
  @IsNotEmpty()
  captchaToken: string;
}
