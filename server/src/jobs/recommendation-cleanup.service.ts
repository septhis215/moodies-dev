import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Recommendation rows are effectively a 30-minute cache — the read path only
 * selects rows with createdAt >= now - REC_CACHE_WINDOW_MINUTES (see
 * moods.service). They were never deleted, so the table grew unbounded with rows
 * that can never be read again. Purge anything well past the read window daily.
 * `createdAt` is indexed, so the delete is cheap.
 */
@Injectable()
export class RecommendationCleanupService {
  private readonly logger = new Logger('RecommendationCleanup');

  // Far beyond the 30-minute read window, with generous buffer for any late
  // feedback writes (viewed/liked/saved) against a recommendation.
  private readonly RETENTION_HOURS = 24;

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeStale() {
    const cutoff = new Date(Date.now() - this.RETENTION_HOURS * 60 * 60 * 1000);
    try {
      const { count } = await this.prisma.recommendation.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      if (count > 0) {
        this.logger.log(
          `Purged ${count} stale recommendations (older than ${this.RETENTION_HOURS}h)`,
        );
      }
    } catch (err) {
      this.logger.error('Failed to purge stale recommendations', err);
    }
  }
}
