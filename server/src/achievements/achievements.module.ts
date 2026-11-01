import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RedisModule } from 'src/redis/redis.module';
import { ExternalApisModule } from 'src/external-apis/external-apis.module';
import { CookieOriginGuard } from 'src/auth/cookie-origin.guard';
import { AchievementCatalogService } from './achievement-catalog.service';
import { AchievementEvidenceService } from './achievement-evidence.service';
import { AchievementProcessorService } from './achievement-processor.service';
import { AchievementWorkerService } from './achievement-worker.service';
import { AchievementsService } from './achievements.service';
import { AchievementsController } from './achievements.controller';
import { AchievementOperationsService } from './achievement-operations.service';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, ExternalApisModule],
  providers: [
    AchievementCatalogService,
    AchievementEvidenceService,
    AchievementProcessorService,
    AchievementWorkerService,
    AchievementOperationsService,
    AchievementsService,
    CookieOriginGuard,
  ],
  controllers: [AchievementsController],
  exports: [AchievementsService],
})
export class AchievementsModule {}
