import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async applyReviewWarning(userId: string) {
    const WARNING_THRESHOLD = 3;
    const BAN_DURATION_HOURS = 3;

    // Atomic increment — the returned value is authoritative under concurrency,
    // so simultaneous warnings can't both read the same score and lose a bump.
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { reviewWarningScore: { increment: 1 } },
      select: { reviewWarningScore: true },
    });

    if (updated.reviewWarningScore >= WARNING_THRESHOLD) {
      // Threshold reached — apply ban and reset score.
      const banUntil = new Date();
      banUntil.setHours(banUntil.getHours() + BAN_DURATION_HOURS);

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          reviewWarningScore: 0,
          reviewBannedUntil: banUntil,
        },
      });

      return { banned: true, until: banUntil };
    }

    return { banned: false, warningScore: updated.reviewWarningScore };
  }

  async getUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }
}
