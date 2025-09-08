import {
  IsString,
  IsEmail,
  Length,
  IsNotEmpty,
} from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 100, {
    message: 'Password must be at least 8 characters long',
  })
  password: string;
}
