import { Body, Controller, Post } from '@nestjs/common';
import { PasswordService } from './password.service';

@Controller('auth')
export class PasswordController {
  constructor(private readonly passwordService: PasswordService) {}

  @Post('check-email')
  async checkEmail(@Body('email') email: string) {
    return this.passwordService.checkEmail(email);
  }

  @Post('change-password')
  async changePassword(
    @Body('email') email: string,
    @Body('newPassword') newPassword: string,
    @Body('confirmPassword') confirmPassword: string,
  ) {
    return this.passwordService.changePassword(email, newPassword, confirmPassword);
  }
}
