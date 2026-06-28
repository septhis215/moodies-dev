import { Body, Controller, Param, Post } from '@nestjs/common';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { ReviewService } from './review.service';

@Controller('content')
export class ContentSnapshotController {
  constructor(private readonly reviewsService: ReviewService) {}

  @Post(':mediaType/:tmdbId/snapshot')
  createContentSnapshot(
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
