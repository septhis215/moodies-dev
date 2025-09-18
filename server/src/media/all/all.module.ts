import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import { AllService } from './all.service';
import { AllController } from './all.controller';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [AllService],
  controllers: [AllController],
  exports: [AllService]
})
export class AllModule {}
