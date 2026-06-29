import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { ReviewService } from './review.service';
import { TurnstileService } from 'src/common/security/turnstile.service';
import type { Request as ExpressRequest } from 'express';

@Controller('content')
export class ContentSnapshotController {
  constructor(
    private readonly reviewsService: ReviewService,
    private readonly turnstile: TurnstileService,
  ) {}

  @Post(':mediaType/:tmdbId/snapshot')
  async createContentSnapshot(
    @Req() req: ExpressRequest,
    @Param('mediaType') mediaType: string,
    @Param('tmdbId') tmdbId: string,
    @Body() dto: CreateSnapshotDto,
  ) {
    await this.turnstile.verifyToken(dto.captchaToken, this.clientIp(req));
    return this.reviewsService.createContentSnapshot(
      mediaType,
      Number(tmdbId),
      dto.format ?? 'square',
    );
  }

  private clientIp(req: ExpressRequest): string | undefined {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') return forwardedFor.split(',')[0]?.trim();
    if (Array.isArray(forwardedFor)) return forwardedFor[0]?.split(',')[0]?.trim();
    return req.ip;
  }
}
