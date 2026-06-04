import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';

export class ProfileDisclosureDto {
  @IsOptional()
  @IsBoolean()
  profileInfo?: boolean;

  @IsOptional()
  @IsBoolean()
  watchlist?: boolean;

  @IsOptional()
  @IsBoolean()
  reviews?: boolean;

  @IsOptional()
  @IsBoolean()
  liked?: boolean;

  @IsOptional()
  @IsBoolean()
  badges?: boolean;

  @IsOptional()
  @IsBoolean()
  recentActivity?: boolean;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 50, {
    message: 'Display name must be between 2 and 50 characters',
  })
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message:
      'Username must be 3-20 characters and contain only letters, numbers, or underscores',
  })
  username?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileDisclosureDto)
  disclosure?: ProfileDisclosureDto;
}
