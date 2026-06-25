import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReviewBanGuard implements CanActivate {
  private readonly logger = new Logger(ReviewBanGuard.name);

  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.id;

    if (!userId) {
      return true;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { reviewBannedUntil: true },
    });

    if (!user?.reviewBannedUntil) {
      return true;
    }

    const bannedUntil = new Date(user.reviewBannedUntil);
    const now = new Date();

    this.logger.debug(
      `Ban check for user ${userId}: bannedUntil=${bannedUntil.toISOString()}, now=${now.toISOString()}, isBanned=${bannedUntil > now}`,
    );

    if (bannedUntil > now) {
      throw new ForbiddenException(
        'You are temporarily banned from writing reviews.',
      );
    }

    return true;
  }
}
