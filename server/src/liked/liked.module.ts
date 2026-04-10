import { Module } from '@nestjs/common';
import { LikedController } from './liked.controller';
import { LikedService } from './liked.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [LikedController],
  providers: [LikedService, PrismaService],
  exports: [LikedService],
})
export class LikedModule {}
