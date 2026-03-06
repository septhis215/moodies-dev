import { Injectable, OnModuleInit } from '@nestjs/common';
import { TvTmdbClientService } from './client/tv-tmdb-client.service';
import { TvCatalogService } from './catalog/tv-catalog.service';
import { TvTrailersService } from './trailers/tv-trailers.service';
import { TvDetailsService } from './details/tv-details.service';
import { TvRecommendationsService } from './recommendations/tv-recommendations.service';
import { TvMediaService } from './media/tv-media.service';
import { TvNewReleasesService } from './new-releases/tv-new-releases.service';
import { TmdbTv, TvListResult } from './types/tv.types';

export type { TmdbTv, TvListResult };

@Injectable()
export class TvService implements OnModuleInit {
  constructor(
    private readonly tmdbClient: TvTmdbClientService,
    private readonly catalogService: TvCatalogService,
    private readonly trailersService: TvTrailersService,
    private readonly detailsService: TvDetailsService,
    private readonly recommendationsService: TvRecommendationsService,
    private readonly mediaService: TvMediaService,
    private readonly newReleasesService: TvNewReleasesService,
  ) { }

  async onModuleInit() {
    await this.tmdbClient.loadGenres();
  }

  // ─── Details ─────────────────────────────────────────────────────────────────
  tvDetails(id: number, _p0?: any) {
    return this.detailsService.tvDetails(id);
  }

  fetchSeasonsWithEpisodes(
    id: number,
    options?: { includeEpisodeDetails?: boolean },
  ) {
    return this.detailsService.fetchSeasonsWithEpisodes(id, options);
  }

  // ─── Catalog ─────────────────────────────────────────────────────────────────
  getFeatured(limit = 30) {
    return this.catalogService.getFeatured(limit);
  }

  getTrending(limit = 30, page?: number) {
    return this.catalogService.getTrending(limit, page);
  }

  airingToday(limit = 30, page?: number) {
    return this.catalogService.airingToday(limit, page);
  }

  airingThisWeek(limit = 30, page?: number) {
    return this.catalogService.airingThisWeek(limit, page);
  }

  getFavorites(limit = 30, page?: number) {
    return this.catalogService.getFavorites(limit, page);
  }

  getKoreaTrending(limit = 30, page?: number) {
    return this.catalogService.getKoreaTrending(limit, page);
  }

  getRevenue(limit = 30) {
    return this.catalogService.getRevenue(limit);
  }

  tvByGenres(ids: string, useAnd = false, limit = 30) {
    return this.catalogService.tvByGenres(ids, useAnd, limit);
  }

  // ─── New Releases ────────────────────────────────────────────────────────────
  getNewReleases(limit = 30, page?: number) {
    return this.newReleasesService.getNewReleases(limit, page);
  }

  // ─── Trailers ────────────────────────────────────────────────────────────────
  getTrailers(limit = 30) {
    return this.trailersService.getTrailers(limit);
  }

  getUpcomingTrailers(limit = 60) {
    return this.trailersService.getUpcomingTrailers(limit);
  }

  getTrailersForItems(items: { id: number }[]) {
    return this.trailersService.getTrailersForItems(items);
  }

  // ─── Recommendations ─────────────────────────────────────────────────────────
  getSmartRecommendationsTv(id: number, limit = 10, minRequired = 3) {
    return this.recommendationsService.getSmartRecommendationsTv(id, limit, minRequired);
  }

  // ─── Media ───────────────────────────────────────────────────────────────────
  images(id: number, type: string) {
    return this.mediaService.images(id, type);
  }

  videos(id: number, type: string) {
    return this.mediaService.videos(id, type);
  }

  getTrendingReviews(limit = 40) {
    return this.mediaService.getTrendingReviews(limit);
  }
}