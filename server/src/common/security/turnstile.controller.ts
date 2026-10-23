import { Controller, Get, GoneException, Header, Post } from '@nestjs/common';

/** Compatibility endpoints: old clients must reload, not receive a reusable bypass. */
@Controller('security/turnstile')
export class TurnstileController {
  @Get('status')
  @Header('Cache-Control', 'no-store')
  status() {
    return { verified: false, mode: 'action' };
  }

  @Post('verify')
  verify(): never {
    throw new GoneException({
      code: 'CAPTCHA_CLIENT_OUTDATED',
      message: 'Please reload Moodies to use the updated security check.',
    });
  }
}
