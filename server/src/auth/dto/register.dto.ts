import {
  IsString,
  IsEmail,
  IsOptional,
  IsUrl,
  IsInt,
  Min,
  Max,
  IsArray,
  ArrayNotEmpty,
  ArrayMinSize,
  ArrayMaxSize,
  IsDate,
  IsUUID, // REMAIN!!! will use later developments
  Length,
  IsNotEmpty,
} from 'class-validator';

import { Type } from 'class-transformer';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 20, {
    message:
      'Username must be between 3 and 20 characters',
  })
  username: string;

  @IsEmail(
    {},
    { message: 'Invalid email address' },
  )
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 100, {
    message:
      'Password must be at least 8 characters long',
  })
  password: string;

  @IsOptional()
  @IsUrl({}, { message: 'Invalid URL' })
  avatarUrl?: string;

  @IsOptional()
  @IsInt({ message: 'Age must be an number' })
  age?: number;

  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  @ArrayNotEmpty({
    message: 'Preferred genres cannot be empty',
  })
  @ArrayMinSize(1, {
    message: 'Select at least 1 genre',
  })
  @ArrayMaxSize(3, {
    message: 'Select at most 3 genres',
  })
  preferredGenres: string[];

  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  @ArrayNotEmpty({
    message:
      'Preferred languages cannot be empty',
  })
  @ArrayMinSize(1, {
    message: 'Select at least 1 language',
  })
  @ArrayMaxSize(3, {
    message: 'Select at most 3 languages',
  })
  preferredLanguages: string[];

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  createdAt: Date;
}
