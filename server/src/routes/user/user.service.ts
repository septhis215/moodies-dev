import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async applyReviewWarning(userId: string) {
    const WARNING_THRESHOLD = 3;
    const BAN_DURATION_HOURS = 3;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { reviewWarningScore: true },
    });

    const newScore = (user?.reviewWarningScore || 0) + 1;

    if (newScore >= WARNING_THRESHOLD) {
      // Apply ban and reset score
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
    } else {
      // Increment warning score
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          reviewWarningScore: newScore,
        },
      });

      return { banned: false, warningScore: newScore };
    }
  }

  async getUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }
}
