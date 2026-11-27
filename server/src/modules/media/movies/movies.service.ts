import { Injectable, OnModuleInit } from '@nestjs/common';
import { MovieTmdbClientService } from './client/movie-tmdb-client.service';
import { MovieCatalogService } from './catalog/movie-catalog.service';
import { MovieTrailersService, UpcomingMovieOptions } from './trailers/movie-trailers.service';
import { MovieDetailsService } from './details/movie-details.service';
import { MovieRecommendationsService } from './recommendations/movie-recommendations.service';
import { MovieMediaService } from './media/movie-media.service';
import { TmdbMovie, MovieListResult } from './types/movie.types';

export type { TmdbMovie, MovieListResult };

@Injectable()
export class MoviesService implements OnModuleInit {
    constructor(
        private readonly tmdbClient: MovieTmdbClientService,
        private readonly catalogService: MovieCatalogService,
        private readonly trailersService: MovieTrailersService,
        private readonly detailsService: MovieDetailsService,
        private readonly recommendationsService: MovieRecommendationsService,
        private readonly mediaService: MovieMediaService,
    ) {}

    async onModuleInit() {
        await this.tmdbClient.loadGenres();
    }

    // ─── Details ─────────────────────────────────────────────────────────────────
    movieDetails(id: number) {
        return this.detailsService.movieDetails(id);
    }

    // ─── Catalog ─────────────────────────────────────────────────────────────────
    getFeatured(limit = 30, page?: number) {
        return this.catalogService.getFeatured(limit, page);
    }

    getTrending(limit = 30, page?: number) {
        return this.catalogService.getTrending(limit, page);
    }

    getKoreaTrending(limit = 30, page?: number) {
        return this.catalogService.getKoreaTrending(limit, page);
    }

    getFavorites(limit = 30) {
        return this.catalogService.getFavorites(limit);
    }

    getNewReleases(limit = 30, page?: number) {
        return this.catalogService.getNewReleases(limit, page);
    }

    getActionMovies(limit = 30, page?: number) {
        return this.catalogService.getActionMovies(limit, page);
    }

    getAnimatedMovies(limit = 30, page?: number) {
        return this.catalogService.getAnimatedMovies(limit, page);
    }

    getDocumentaryMovies(limit = 25) {
        return this.catalogService.getDocumentaryMovies(limit);
    }

    getAwardWinners(limit = 30, page?: number) {
        return this.catalogService.getAwardWinners(limit, page);
    }

    getIndieMovies(limit = 30, page?: number) {
        return this.catalogService.getIndieMovies(limit, page);
    }

    // ─── Trailers ────────────────────────────────────────────────────────────────
    getTrailers(limit = 30) {
        return this.trailersService.getTrailers(limit);
    }

    getUpcomingTrailers(limit?: number, options?: UpcomingMovieOptions) {
        return this.trailersService.getUpcomingTrailers(limit, options);
    }

    getTrailersForItems(items: { type: 'movie'; id: number }[]) {
        return this.trailersService.getTrailersForItems(items);
    }

    // ─── Recommendations ─────────────────────────────────────────────────────────
    getSmartRecommendationsMovie(id: number, limit = 10, minRequired = 3) {
        return this.recommendationsService.getSmartRecommendationsMovie(id, limit, minRequired);
    }

    getRecommendations(id: number, limit = 10) {
        return this.recommendationsService.getRecommendations(id, limit);
    }

    getItemRecommendations(type: 'movie' | 'tv', id: number, limit: number) {
        return this.recommendationsService.getItemRecommendations(id, limit);
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
