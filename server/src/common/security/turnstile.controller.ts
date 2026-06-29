import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TurnstileService } from './turnstile.service';

type TurnstileVerifyBody = {
  token?: string;
};

@Controller('security/turnstile')
export class TurnstileController {
  constructor(private readonly turnstile: TurnstileService) {}

  @Get('status')
  status(@Req() req: Request) {
    return { verified: this.turnstile.isVerifiedRequest(req) };
  }

  @Post('verify')
  async verify(
    @Body() body: TurnstileVerifyBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.turnstile.verifyToken(body.token, this.clientIp(req));
    this.turnstile.setVerifiedCookie(res);
    return { success: true, verified: true };
  }

  private clientIp(req: Request): string | undefined {
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    if (typeof cfConnectingIp === 'string') return cfConnectingIp;
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') return forwardedFor.split(',')[0]?.trim();
    if (Array.isArray(forwardedFor)) return forwardedFor[0]?.split(',')[0]?.trim();
    return req.ip;
  }
}
