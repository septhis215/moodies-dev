import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/** CORS alone does not prevent a cross-site form from reaching cookie mutations. */
@Injectable()
export class CookieOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const origin = context.switchToHttp().getRequest<Request>().headers.origin;
    if (!origin) return true; // Non-browser clients and same-origin requests may omit Origin.
    const allowed = (this.config.get<string>('CORS_ORIGINS') ?? this.config.get<string>('CLIENT_URL') ?? 'http://localhost:3000')
      .split(',').map((value) => value.trim());
    if (allowed.includes(origin)) return true;
    if (this.config.get<string>('NODE_ENV') === 'development') {
      try {
        const url = new URL(origin);
        if (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && Number(url.port) >= 3000 && Number(url.port) <= 3999) return true;
      } catch { /* Invalid origins are rejected below. */ }
    }
    throw new ForbiddenException('Untrusted request origin');
  }
}
