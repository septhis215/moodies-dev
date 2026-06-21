import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Password-reset codes are short-lived but were never deleted, so the
 * EmailVerification table grew unbounded. Purge expired rows hourly. Expiry
 * covers every stale state: unverified-expired, and verified rows (the reset flow
 * flips `verified` back to false and they expire within minutes).
 */
@Injectable()
export class EmailVerificationCleanupService {
  private readonly logger = new Logger('EmailVerificationCleanup');

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpired() {
    try {
      const { count } = await this.prisma.emailVerification.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (count > 0) {
        this.logger.log(`Purged ${count} expired email verification codes`);
      }
    } catch (err) {
      this.logger.error('Failed to purge expired email verification codes', err);
    }
  }
}
