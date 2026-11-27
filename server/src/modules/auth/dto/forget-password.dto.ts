import { IsString, IsEmail, IsNotEmpty, Length } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 100, {
    message: 'New password must be at least 8 characters long',
  })
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 100, {
    message: 'Confirm password must be at least 8 characters long',
  })
  confirmPassword: string;
}
