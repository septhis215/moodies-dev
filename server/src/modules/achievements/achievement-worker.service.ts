import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, Interval } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import type { AchievementEvent } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AchievementProcessorService } from './achievement-processor.service';
import { AchievementEvidenceService } from './achievement-evidence.service';
import {
  runWithTmdbPriority,
  TMDB_PRIORITY,
} from 'src/external-apis/services/tmdb-priority.context';

@Injectable()
export class AchievementWorkerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AchievementWorkerService.name);
  private busy = false;
  private nextSnapshot = 0;
  private nextHealth = 0;
  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: AchievementProcessorService,
    private readonly evidence: AchievementEvidenceService,
    private readonly config: ConfigService,
  ) {}

  get enabled() {
    return (
      this.config.get<string>('ACHIEVEMENTS_ENABLED') === 'true' &&
      this.config.get<string>('ACHIEVEMENTS_WORKER_ENABLED') !== 'false'
    );
  }
  onApplicationBootstrap() {
    if (this.enabled) void this.tick();
  }

  @Interval(2000)
  async tick() {
    if (!this.enabled || this.busy) return;
    this.busy = true;
    try {
      if (Date.now() >= this.nextSnapshot) {
        this.nextSnapshot = Date.now() + 3600000;
        void runWithTmdbPriority(TMDB_PRIORITY.BACKGROUND, () =>
          this.evidence.captureTrends(),
        ).catch(() => {
          this.nextSnapshot = Date.now() + 60000;
          this.logger.warn({ event: 'achievement_trend_snapshot_unavailable' });
        });
      }
      const started = Date.now();
      for (let batch = 0; batch < 10; batch++) {
        if (!(await this.runBatch()) || Date.now() - started > 1500) break;
      }
      if (Date.now() >= this.nextHealth) {
        this.nextHealth = Date.now() + 60000;
        const [backlog, failed, oldest] = await Promise.all([
          this.prisma.achievementEvent.count({
            where: { status: { in: ['pending', 'processing'] } },
          }),
          this.prisma.achievementEvent.count({ where: { status: 'dead' } }),
          this.prisma.achievementEvent.findFirst({
            where: { status: { in: ['pending', 'processing'] } },
            orderBy: { occurredAt: 'asc' },
            select: { occurredAt: true },
          }),
        ]);
        const health = {
          event: 'achievement_worker_health',
          backlog,
          failed,
          oldestAgeSeconds: oldest
            ? Math.floor((Date.now() - oldest.occurredAt.getTime()) / 1000)
            : 0,
        };
        if (failed || health.oldestAgeSeconds > 60) this.logger.warn(health);
        else this.logger.log(health);
      }
    } catch {
      this.logger.error({
        event: 'achievement_worker_unavailable',
        reason: 'database_or_catalogue',
      });
    } finally {
      this.busy = false;
    }
  }

  async runBatch(limit = 20) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 20)
      throw new Error('Invalid worker batch size');
    const token = randomUUID();
    const events = await this.prisma.$queryRaw<AchievementEvent[]>`
      WITH candidates AS (
        SELECT e.id FROM achievement_events e
        WHERE ((e.status='pending' AND e."availableAt"<=now()) OR (e.status='processing' AND e."leaseUntil"<now()))
          AND NOT EXISTS (SELECT 1 FROM achievement_events running WHERE running."userId"=e."userId" AND running.status='processing' AND running."leaseUntil">=now())
          AND NOT EXISTS (SELECT 1 FROM achievement_events older WHERE older."userId"=e."userId" AND older.sequence<e.sequence
            AND older.kind<>'classify' AND older.status IN ('pending','processing'))
          AND e.id=(SELECT head.id FROM achievement_events head WHERE head."userId"=e."userId"
            AND ((head.status='pending' AND head."availableAt"<=now()) OR (head.status='processing' AND head."leaseUntil"<now()))
            AND NOT EXISTS (SELECT 1 FROM achievement_events prior WHERE prior."userId"=head."userId" AND prior.sequence<head.sequence AND prior.kind<>'classify' AND prior.status IN ('pending','processing'))
            ORDER BY CASE WHEN head.kind='classify' THEN 1 ELSE 0 END,head.sequence LIMIT 1)
        ORDER BY CASE WHEN e.kind='classify' THEN 1 ELSE 0 END,e."occurredAt",e.sequence
        LIMIT ${limit} FOR UPDATE SKIP LOCKED
      ) UPDATE achievement_events e SET status='processing',attempts=attempts+1,"leaseToken"=${token},"leaseUntil"=now()+interval '2 minutes'
        FROM candidates c WHERE e.id=c.id RETURNING e.*`;
    // Each event has its own transaction; one failed provider cannot discard the batch.
    const process = async (event: AchievementEvent) => {
      try {
        await runWithTmdbPriority(TMDB_PRIORITY.BACKGROUND, () =>
          this.processor.process(event, token),
        );
      } catch (error) {
        const terminal = /Unsupported achievement|Invalid achievement/.test(
          error instanceof Error ? error.message : '',
        );
        const databaseCode =
          error &&
          typeof error === 'object' &&
          'code' in error &&
          typeof error.code === 'string' &&
          /^P\d{4}$/.test(error.code)
            ? error.code
            : null;
        const dead = terminal || event.attempts >= 8;
        await this.prisma.achievementEvent.updateMany({
          where: { id: event.id, status: 'processing', leaseToken: token },
          data: {
            status: dead ? 'dead' : 'pending',
            leaseToken: null,
            leaseUntil: null,
            availableAt: new Date(
              Date.now() + Math.min(3600, 2 ** event.attempts * 5) * 1000,
            ),
            errorCode: terminal
              ? 'invalid_contract'
              : databaseCode || 'processing_failed',
          },
        });
        this.logger.warn({
          event: 'achievement_event_failed',
          eventId: event.id,
          kind: event.kind,
          attempt: event.attempts,
          terminal: dead,
        });
      }
    };
    for (let offset = 0; offset < events.length; offset += 4)
      await Promise.all(events.slice(offset, offset + 4).map(process));
    return events.length;
  }

  @Cron('0 4 * * *')
  async cleanup() {
    if (!this.enabled) return;
    try {
      const removed = await this.prisma
        .$executeRaw`DELETE FROM achievement_events WHERE id IN (
        SELECT id FROM achievement_events WHERE status='completed' AND "processedAt"<now()-interval '30 days' ORDER BY "processedAt" LIMIT 5000)`;
      await this.prisma.achievementTrendSnapshot.deleteMany({
        where: { validUntil: { lt: new Date(Date.now() - 30 * 86400000) } },
      });
      this.logger.log({ event: 'achievement_retention_completed', removed });
    } catch {
      this.logger.warn({ event: 'achievement_retention_failed' });
    }
  }
}
