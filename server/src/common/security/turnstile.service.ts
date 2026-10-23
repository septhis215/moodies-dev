import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ProtectionMetricsService } from './protection-metrics.service';

type VerifyResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  'error-codes'?: string[];
};
const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_TOKEN_LENGTH = 2048;
const VERIFY_ATTEMPTS = 2;

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private nextFailureLog = 0;
  private inFlight = 0;
  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly metrics?: ProtectionMetricsService,
  ) {}

  async verifyToken(
    token?: unknown,
    remoteIp?: string,
    expectedAction = 'app_entry',
  ): Promise<boolean> {
    const started = Date.now();
    if (
      typeof token !== 'string' ||
      !token.trim() ||
      token.length > MAX_TOKEN_LENGTH
    ) {
      this.metrics?.record('captcha', 'rejected', Date.now() - started);
      throw new BadRequestException({
        code: 'CAPTCHA_REQUIRED',
        message: 'Please complete the security check and try again.',
      });
    }
    if (
      this.inFlight >= Number(this.config.get('TURNSTILE_MAX_CONCURRENT') ?? 64)
    ) {
      this.metrics?.record('captcha', 'unavailable', Date.now() - started);
      throw this.unavailable('capacity');
    }
    this.inFlight++;
    try {
      const accepted = await this.validate(token, remoteIp, expectedAction);
      this.metrics?.record('captcha', 'allowed', Date.now() - started);
      return accepted;
    } catch (error) {
      this.metrics?.record(
        'captcha',
        error instanceof ForbiddenException ? 'rejected' : 'unavailable',
        Date.now() - started,
      );
      throw error;
    } finally {
      this.inFlight--;
    }
  }

  private async validate(
    token: string,
    remoteIp: string | undefined,
    expectedAction: string,
  ): Promise<boolean> {
    const secret = this.config.get<string>('TURNSTILE_SECRET_KEY');
    if (
      this.config.get<string>('NODE_ENV') !== 'development' &&
      /^[123]x0+AA$/.test(secret ?? '')
    )
      throw this.unavailable('configuration');
    const configuredHosts = this.config.get<string>(
      'TURNSTILE_ALLOWED_HOSTNAMES',
    );
    const hosts =
      configuredHosts !== undefined
        ? configuredHosts
            .split(',')
            .map((host) => host.trim().toLowerCase())
            .filter(Boolean)
        : (
            this.config.get<string>('CORS_ORIGINS') ??
            this.config.get<string>('CLIENT_URL') ??
            ''
          )
            .split(',')
            .flatMap((origin) => {
              try {
                return [new URL(origin.trim()).hostname.toLowerCase()];
              } catch {
                return [];
              }
            });
    if (this.config.get<string>('NODE_ENV') === 'development')
      hosts.push('localhost', '127.0.0.1');
    if (!secret || hosts.length === 0) throw this.unavailable('configuration');
    // The provider's dummy-token metadata is synthetic and may change independently
    // of widget actions. Only explicitly configured development fixtures may omit it.
    const developmentFixture =
      this.config.get<string>('NODE_ENV') === 'development' &&
      /^[123]x0+AA$/.test(secret) &&
      token === 'XXXX.DUMMY.TOKEN.XXXX';
    const body = new URLSearchParams({
      secret,
      response: token,
      idempotency_key: randomUUID(),
    });
    if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp);
    const timeout = Number(
      this.config.get('TURNSTILE_VERIFY_TIMEOUT_MS') ?? 4000,
    );
    const verifyUrl =
      this.config.get<string>('TURNSTILE_VERIFY_URL') || SITEVERIFY_URL;
    if (
      verifyUrl !== SITEVERIFY_URL &&
      this.config.get<string>('NODE_ENV') !== 'development'
    )
      throw this.unavailable('configuration');
    for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt++) {
      let payload: VerifyResponse;
      try {
        const response = await fetch(verifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: AbortSignal.timeout(timeout),
          redirect: 'error',
        });
        if (!response.ok) throw new Error('Siteverify unavailable');
        payload = (await response.json()) as VerifyResponse;
        if (!payload || typeof payload.success !== 'boolean')
          throw new Error('Invalid Siteverify response');
        if (
          payload.success &&
          !developmentFixture &&
          (typeof payload.hostname !== 'string' ||
            typeof payload.action !== 'string')
        )
          throw new Error('Invalid Siteverify response');
        if (
          payload['error-codes'] !== undefined &&
          (!Array.isArray(payload['error-codes']) ||
            !payload['error-codes'].every((code) => typeof code === 'string'))
        )
          throw new Error('Invalid Siteverify response');
      } catch {
        if (attempt + 1 < VERIFY_ATTEMPTS) continue;
        throw this.unavailable('provider');
      }
      if (
        payload['error-codes']?.includes('invalid-input-secret') ||
        payload['error-codes']?.includes('missing-input-secret')
      )
        throw this.unavailable('configuration');
      if (payload['error-codes']?.includes('internal-error')) {
        if (attempt + 1 < VERIFY_ATTEMPTS) continue;
        throw this.unavailable('provider');
      }
      if (
        !payload.success ||
        (!developmentFixture &&
          (payload.action !== expectedAction ||
            !hosts.includes(payload.hostname?.toLowerCase() ?? '')))
      )
        throw new ForbiddenException({
          code: 'CAPTCHA_REJECTED',
          message:
            'The security check expired or was not accepted. Please try again.',
        });
      return true;
    }
    throw this.unavailable('provider');
  }

  private unavailable(reason: 'configuration' | 'provider' | 'capacity') {
    if (Date.now() >= this.nextFailureLog) {
      this.nextFailureLog = Date.now() + 60_000;
      this.logger.warn(
        `Turnstile unavailable (${reason}); protected actions remain blocked. Check configuration/provider health.`,
      );
    }
    return new ServiceUnavailableException({
      code: 'CAPTCHA_UNAVAILABLE',
      message:
        'Security verification is temporarily unavailable. Please try again shortly.',
    });
  }
}
