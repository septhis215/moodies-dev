import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { TurnstileService } from './turnstile.service';

@Injectable()
export class TurnstileVerifiedGuard implements CanActivate {
  constructor(private readonly turnstile: TurnstileService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (this.turnstile.isVerifiedRequest(request)) return true;
    throw new ForbiddenException('Human verification required.');
  }
}
