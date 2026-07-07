import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { ReviewService } from './review.service';
import { TurnstileVerifiedGuard } from 'src/common/security/turnstile-verified.guard';

@Controller('content')
export class ContentSnapshotController {
  constructor(private readonly reviewsService: ReviewService) {}

  @Post(':mediaType/:tmdbId/snapshot')
  @UseGuards(TurnstileVerifiedGuard)
  async createContentSnapshot(
    @Param('mediaType') mediaType: string,
    @Param('tmdbId') tmdbId: string,
    @Body() dto: CreateSnapshotDto,
  ) {
    return this.reviewsService.createContentSnapshot(
      mediaType,
      Number(tmdbId),
      dto.format ?? 'square',
    );
  }
}
