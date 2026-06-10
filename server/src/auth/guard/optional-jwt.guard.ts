import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT auth: attaches `req.user` when a valid Bearer token is present,
 * but lets unauthenticated (anonymous) requests through instead of rejecting
 * them. Use on endpoints that work for both signed-in and anonymous callers,
 * where the server derives identity from the token rather than trusting a
 * client-supplied userId.
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  // Never throw on a missing/invalid token — normalise passport's `false`
  // failure value to `undefined` so the request proceeds as anonymous.
  handleRequest(err: any, user: any) {
    return user || undefined;
  }
}
