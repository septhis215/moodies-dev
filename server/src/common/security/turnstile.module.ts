import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TurnstileController } from './turnstile.controller';
import { TurnstileVerifiedGuard } from './turnstile-verified.guard';
import { TurnstileService } from './turnstile.service';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [TurnstileController],
  providers: [TurnstileService, TurnstileVerifiedGuard],
  exports: [TurnstileService, TurnstileVerifiedGuard],
})
export class TurnstileModule {}
