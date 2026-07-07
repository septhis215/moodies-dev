import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import { readCookie } from 'src/auth/auth.cookies';

type TurnstileVerifyResponse = {
  success?: boolean;
  'error-codes'?: string[];
};

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly cookieName = 'moodies_turnstile_verified';
  private readonly ttlMs = 24 * 60 * 60 * 1000;

  constructor(private readonly config: ConfigService) {}

  async verifyToken(token?: string, remoteIp?: string): Promise<boolean> {
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

    const verifyUrl =
      this.config.get<string>('TURNSTILE_VERIFY_URL') ??
      'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    let payload: TurnstileVerifyResponse;
    try {
      const response = await fetch(verifyUrl, {
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

    return true;
  }

  setVerifiedCookie(res: Response): void {
    const issuedAt = Date.now();
    res.cookie(this.cookieName, this.sign(issuedAt), {
      httpOnly: true,
      secure: this.secureCookie(),
      sameSite: this.sameSite(),
      domain: this.cookieDomain(),
      path: '/',
      maxAge: this.ttlMs,
    });
  }

  isVerifiedRequest(req: Request): boolean {
    const value = readCookie(req, this.cookieName);
    if (!value) return false;

    const [issuedAtRaw, signature] = value.split('.');
    const issuedAt = Number(issuedAtRaw);
    if (!Number.isFinite(issuedAt) || !signature) return false;
    if (Date.now() - issuedAt > this.ttlMs) return false;

    const expected = this.signature(issuedAt);
    return this.safeEqual(signature, expected);
  }

  private sign(issuedAt: number): string {
    return `${issuedAt}.${this.signature(issuedAt)}`;
  }

  private signature(issuedAt: number): string {
    return createHmac('sha256', this.cookieSecret())
      .update(String(issuedAt))
      .digest('base64url');
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private cookieSecret(): string {
    return (
      this.config.get<string>('TURNSTILE_COOKIE_SECRET') ??
      this.config.get<string>('JWT_SECRET') ??
      this.config.get<string>('TURNSTILE_SECRET_KEY') ??
      'development-turnstile-cookie-secret'
    );
  }

  private sameSite(): 'lax' | 'strict' | 'none' {
    const value = (this.config.get<string>('COOKIE_SAMESITE') ?? 'lax').toLowerCase();
    return value === 'none' || value === 'strict' ? value : 'lax';
  }

  private secureCookie(): boolean {
    if (this.sameSite() === 'none') return true;
    if (this.config.get<string>('COOKIE_SECURE') != null) {
      return this.config.get<string>('COOKIE_SECURE') === 'true';
    }
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private cookieDomain(): string | undefined {
    return this.config.get<string>('COOKIE_DOMAIN') || undefined;
  }
}
