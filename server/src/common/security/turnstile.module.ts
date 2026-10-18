import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TurnstileController } from './turnstile.controller';
import { TurnstileVerifiedGuard } from './turnstile-verified.guard';
import { TurnstileService } from './turnstile.service';
import { ClientIpService } from './client-ip.service';
import { ProtectionMetricsService } from './protection-metrics.service';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [TurnstileController],
  providers: [TurnstileService, TurnstileVerifiedGuard, ClientIpService, ProtectionMetricsService],
  exports: [TurnstileService, TurnstileVerifiedGuard, ClientIpService, ProtectionMetricsService],
})
export class TurnstileModule {}
