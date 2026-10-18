import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { TurnstileService } from './turnstile.service';
import { Reflector } from '@nestjs/core';
import { ClientIpService } from './client-ip.service';
import { TURNSTILE_ACTION } from './turnstile-action.decorator';

@Injectable()
export class TurnstileVerifiedGuard implements CanActivate {
  constructor(
    private readonly turnstile: TurnstileService,
    private readonly reflector: Reflector,
    private readonly clientIp: ClientIpService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const action = this.reflector.getAllAndOverride<string>(TURNSTILE_ACTION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action)
      throw new ForbiddenException(
        'Security verification is not configured for this action.',
      );
    return this.turnstile.verifyToken(
      request.headers['x-turnstile-token'],
      this.clientIp.get(request),
      action,
    );
  }
}
