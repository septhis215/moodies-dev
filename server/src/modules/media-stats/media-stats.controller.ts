import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { MediaStatsService } from './media-stats.service';

@Controller('media-stats')
export class MediaStatsController {
  constructor(private svc: MediaStatsService) {}

  // GET /media-stats/batch?items=123:movie,456:tv
  @Get('batch')
  batch(@Query('items') raw: string) {
    if (!raw?.trim()) return {};

    const parsed = raw
      .split(',')
      .slice(0, 50)
      .map((s) => s.trim().split(':'))
      .filter(
        (parts): parts is [string, 'movie' | 'tv'] =>
          parts.length === 2 &&
          !isNaN(Number(parts[0])) &&
          (parts[1] === 'movie' || parts[1] === 'tv'),
      )
      .map(([id, type]) => ({ tmdbId: Number(id), mediaType: type }));

    if (!parsed.length) throw new BadRequestException('No valid items in query');

    return this.svc.getBatch(parsed);
  }

  // GET /media-stats/community-pulse?mediaType=movie&limit=5
  @Get('community-pulse')
  communityPulse(
    @Query('mediaType') mediaType: string,
    @Query('limit') limit: string,
  ) {
    const type: 'movie' | 'tv' = mediaType === 'tv' ? 'tv' : 'movie';
    const n = Math.min(Math.max(Number(limit) || 5, 1), 20);
    return this.svc.getCommunityPulse(type, n);
  }
}
