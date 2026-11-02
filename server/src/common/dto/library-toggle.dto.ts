import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class LibraryToggleDto {
  @IsString()
  @Matches(/^[1-9]\d*$/)
  @MaxLength(10)
  tmdbId!: string;

  @IsIn(['movie', 'series'])
  type!: 'movie' | 'series';

  // Existing clients may omit this to toggle; new clients send their intended state.
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
