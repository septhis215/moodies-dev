import { IsString, IsNotEmpty, Length } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @Length(8, 100, {
    message: 'Old password must be at least 8 characters long',
  })
  oldPassword: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 100, {
    message: 'New password must be at least 8 characters long',
  })
  newPassword: string;
}
