import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type TurnstileVerifyResponse = {
  success?: boolean;
  'error-codes'?: string[];
};

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly verifyUrl =
    'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  constructor(private readonly config: ConfigService) {}

  async verifyToken(token?: string, remoteIp?: string): Promise<void> {
    if (!token?.trim()) {
      throw new BadRequestException('Please complete the verification.');
    }

    const secret = this.config.get<string>('TURNSTILE_SECRET_KEY');
    if (!secret) {
      this.logger.error('TURNSTILE_SECRET_KEY is not configured.');
      throw new BadRequestException('Captcha verification failed. Please try again.');
    }

    const body = new URLSearchParams({
      secret,
      response: token,
    });

    if (remoteIp) body.set('remoteip', remoteIp);

    let payload: TurnstileVerifyResponse;
    try {
      const response = await fetch(this.verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      payload = (await response.json()) as TurnstileVerifyResponse;
    } catch (error) {
      this.logger.error('Cloudflare Turnstile verification request failed.', error);
      throw new BadRequestException('Captcha verification failed. Please try again.');
    }

    if (!payload.success) {
      this.logger.warn(
        `Cloudflare Turnstile rejected token: ${(payload['error-codes'] ?? []).join(', ') || 'unknown'}`,
      );
      throw new BadRequestException('Captcha verification failed. Please try again.');
    }
  }
}
