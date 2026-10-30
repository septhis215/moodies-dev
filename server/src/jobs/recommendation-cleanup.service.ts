import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Purge stale cache-only rows while retaining viewed/rated/saved feedback.
 * Refreshed rows use updatedAt so a reused title is not immediately purged.
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
        where: { updatedAt: { lt: cutoff }, viewed: false, liked: false, saved: false, rating: null },
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
