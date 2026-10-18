import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ClientIpService } from './client-ip.service';
import { TurnstileService } from './turnstile.service';
import { TurnstileVerifiedGuard } from './turnstile-verified.guard';

describe('action-specific CAPTCHA guard', () => {
  const setup = (action?: string, token?: string) => {
    const verifyToken = jest.fn().mockResolvedValue(true);
    const reflector = {
      getAllAndOverride: () => action,
    } as unknown as Reflector;
    const guard = new TurnstileVerifiedGuard(
      { verifyToken } as unknown as TurnstileService,
      reflector,
      new ClientIpService(new ConfigService()),
    );
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'x-turnstile-token': token,
            cookie: 'moodies_turnstile_verified=legacy-proof',
            'cf-connecting-ip': '1.1.1.1',
          },
          socket: { remoteAddress: '192.0.2.1' },
        }),
      }),
    } as unknown as ExecutionContext;
    return { guard, context, verifyToken };
  };
  it('uses only fresh request proof, route-owned action metadata and trusted client identity', async () => {
    const { guard, context, verifyToken } = setup('signup', 'fresh-token');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifyToken).toHaveBeenCalledWith(
      'fresh-token',
      '192.0.2.1',
      'signup',
    );
  });
  it('never substitutes the legacy cookie for a missing token', async () => {
    const { guard, context, verifyToken } = setup('signin');
    await guard.canActivate(context);
    expect(verifyToken).toHaveBeenCalledWith(undefined, '192.0.2.1', 'signin');
  });
  it('fails closed if a guarded handler has no action policy', async () => {
    const { guard, context, verifyToken } = setup();
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(verifyToken).not.toHaveBeenCalled();
  });
});
