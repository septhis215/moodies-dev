import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

const SESSION_AUDIT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthSessionCleanupService {
  private readonly logger = new Logger(AuthSessionCleanupService.name);
  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpired() {
    try {
      await this.prisma.authSession.deleteMany({
        where: { expiresAt: { lt: new Date(Date.now() - SESSION_AUDIT_RETENTION_MS) } },
      });
    } catch {
      this.logger.error('session_cleanup_unavailable');
    }
  }
}
