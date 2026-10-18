import { ConfigService } from '@nestjs/config';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { CookieOriginGuard } from './cookie-origin.guard';

describe('cookie mutation origin validation', () => {
  const context = (origin?: string) => ({
    switchToHttp: () => ({ getRequest: () => ({ headers: { origin } }) }),
  }) as unknown as ExecutionContext;
  const guard = (env = 'production') => new CookieOriginGuard(new ConfigService({
    NODE_ENV: env, CORS_ORIGINS: 'https://app.example.test, https://staging.example.test',
  }));
  it('accepts configured frontend origins', () => {
    expect(guard().canActivate(context('https://app.example.test'))).toBe(true);
  });
  it('rejects cross-site cookie mutations before rotation/logout', () => {
    expect(() => guard().canActivate(context('https://attacker.example'))).toThrow(ForbiddenException);
  });
  it('keeps the existing localhost development allowlist', () => {
    expect(guard('development').canActivate(context('http://localhost:3002'))).toBe(true);
    expect(() => guard().canActivate(context('http://localhost:3002'))).toThrow(ForbiddenException);
  });
  it('permits non-browser clients without an Origin header', () => {
    expect(guard().canActivate(context())).toBe(true);
  });
});
