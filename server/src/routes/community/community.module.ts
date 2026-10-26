import { Module } from '@nestjs/common';
import { ReviewModule } from '../review/review.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [ReviewModule],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
