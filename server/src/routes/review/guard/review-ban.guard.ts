import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";

@Injectable()
export class ReviewBanGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (user.reviewBannedUntil && user.reviewBannedUntil > new Date()) {
      throw new ForbiddenException(
        'You are temporarily banned from writing reviews.',
      );
    }
    return true;
  }
}
