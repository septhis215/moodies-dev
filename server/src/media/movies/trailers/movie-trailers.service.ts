import { Injectable, Logger } from '@nestjs/common';
import { MovieTmdbClientService } from '../client/movie-tmdb-client.service';
import { MovieContentFilterService } from '../filters/movie-content-filter.service';
import { MovieRecommendationsService } from '../recommendations/movie-recommendations.service';
import { TmdbMovie } from '../types/movie.types';
import { shuffleArray } from '../utils/helpers';
import { runWithTmdbPriority, TMDB_PRIORITY } from 'src/external-apis/services/tmdb-priority.context';

const MIN_REQUIRED_ITEMS = 25;

@Injectable()
export class MovieTrailersService {
    private readonly logger = new Logger(MovieTrailersService.name);

    constructor(
        private readonly client: MovieTmdbClientService,
        private readonly filterService: MovieContentFilterService,
        private readonly recommendationsService: MovieRecommendationsService,
    ) { }

    async getTrailers(limit = 30): Promise<TmdbMovie[]> {
        const min = Math.max(MIN_REQUIRED_ITEMS, limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
            return [];
        }

        try {
            const recentDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0];

            const sources = [
                `discover/movie?with_original_language=ko&sort_by=popularity.desc&page=1`,
                `movie/popular?language=en-US&page=1`,
                `movie/top_rated?language=en-US&page=1`,
                `discover/movie?sort_by=release_date.desc&first_air_date.gte=${recentDate}&page=1`,
            ];

            const allResults: any[] = [];
            for (const url of sources) {
                try {
                    const data = await this.client.tmdb(url);
                    if (data?.results?.length) allResults.push(...data.results);
                } catch (err) {
                    this.logger.warn(`Failed to fetch from source: ${url}`, err);
                }
            }

            const uniqueItems: any[] = [];
            const seenIds = new Set<number>();
            for (const item of allResults) {
                if (!seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    uniqueItems.push(item);
                }
            }

            const trailerTasks = uniqueItems
                .slice(0, min * 2)
                .map((m: any) => async (): Promise<TmdbMovie | null> => {
                    try {
                        const [videosData, details] = await Promise.all([
                            this.client.tmdb(`movie/${m.id}/videos?language=en-US`),
                            this.client.tmdb(`movie/${m.id}?language=en-US`).catch(() => null),
                        ]);

                        const trailerTypes = ['Trailer', 'Teaser', 'Clip'];
                        let trailer: any = null;
                        for (const trailerType of trailerTypes) {
                            trailer = (videosData?.results ?? []).find(
                                (v: any) => v.type === trailerType && v.site === 'YouTube',
                            );
                            if (trailer) break;
                        }

                        if (!trailer) return null;

                        return {
                            id: m.id,
                            title: m.title ?? m.name ?? 'Untitled',
                            overview: m.overview ?? '',
                            poster_path: m.poster_path ?? null,
                            backdrop_path: m.backdrop_path ?? null,
                            release_date: m.release_date ?? null,
                            vote_average: m.vote_average,
                            vote_count: m.vote_count,
                            popularity: m.popularity,
                            trailer_key: trailer.key,
                            recommendations: [],
                            genres: details?.genres ? details.genres.map((g: any) => g.name) : [],
                            origin_country: details?.origin_country ?? m.origin_country ?? [],
                            type: 'movie',
                            genre_ids: details?.genres
                                ? details.genres.map((g: any) => g.id)
                                : (m.genre_ids ?? []),
                        };
                    } catch (err) {
                        this.logger.warn(`Failed to process trailer for ${m.id}`, err);
                        return null;
                    }
                });

            const withTrailers = (await this.client.withConcurrencyLimit(trailerTasks, 3))
                .filter((item): item is TmdbMovie => item !== null)
                .slice(0, min);

            this.recommendationsService.populateRecommendationsBackground(withTrailers);
            return shuffleArray(withTrailers);
        } catch (err) {
            this.logger.error('Failed to fetch trailers', err as any);
            return [];
        }
    }

    async getUpcomingTrailers(limit = 30): Promise<TmdbMovie[]> {
        const min = Math.max(MIN_REQUIRED_ITEMS, limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
            return [];
        }

        try {
            const items: TmdbMovie[] = [];
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];

            for (let page = 1; page <= 20 && items.length < min; page++) {
                const data = await this.client.tmdb(
                    `discover/movie?language=en-US&sort_by=popularity.desc&primary_release_date.gte=${todayStr}&page=${page}`,
                );
                const results = data?.results ?? [];

                const trailerTasks = results.map((m: any) => async () => {
                    const rd = m.release_date;
                    if (!rd || new Date(rd) < today) return null;

                    try {
                        const [videosData, details] = await Promise.all([
                            this.client.tmdb(`movie/${m.id}/videos?language=en-US`),
                            this.client.tmdb(`movie/${m.id}?language=en-US`),
                        ]);

                        const trailer = (videosData?.results ?? []).find(
                            (v: any) => v.type === 'Trailer' && v.site === 'YouTube',
                        );
                        if (!trailer) return null;

                        return {
                            id: m.id,
                            title: m.title ?? 'Untitled',
                            overview: m.overview ?? '',
                            poster_path: m.poster_path ?? null,
                            backdrop_path: m.backdrop_path ?? null,
                            release_date: rd,
                            vote_average: m.vote_average,
                            trailer_key: trailer.key,
                            type: 'movie' as const,
                            recommendations: [],
                            runtime: details.runtime ?? null,
                            genres: details.genres ? details.genres.map((g: any) => g.name) : [],
                        } as TmdbMovie;
                    } catch {
                        return null;
                    }
                });

                const pageResults = (await this.client.withConcurrencyLimit(trailerTasks))
                    .filter((item): item is TmdbMovie => item !== null);

                items.push(...pageResults);
                if (items.length >= min) break;
            }

            const withImages = items.filter(
                (item) => item.backdrop_path !== null && item.poster_path !== null,
            );

            const uniqueItems = Array.from(
                new Map(withImages.map((item) => [item.id, item])).values(),
            );

            const sorted = uniqueItems
                .sort(
                    (a, b) =>
                        (a.release_date ? new Date(a.release_date).getTime() : Infinity) -
                        (b.release_date ? new Date(b.release_date).getTime() : Infinity),
                )
                .slice(0, min);

            setTimeout(() => {
                void runWithTmdbPriority(TMDB_PRIORITY.BACKGROUND, async () => {
                    const tasks = sorted.map((item) => async () => {
                        try {
                            item.recommendations = await this.recommendationsService.getSmartRecommendationsMovie(item.id, 3);
                            return item;
                        } catch (err) {
                            this.logger.error(`Failed to populate recommendations for ${item.id}`, err);
                            return item;
                        }
                    });
                    await this.client.withConcurrencyLimit(tasks, 3);
                });
            }, 100);

            return sorted;
        } catch (err) {
            this.logger.error('Failed to fetch upcoming trailers', err as any);
            return [];
        }
    }

    async getTrailersForItems(
        items: { type: 'movie'; id: number }[],
    ): Promise<Record<string, string | null>> {
        const tasks = items.map((item) => async () => {
            try {
                const videosData = await this.client.tmdb(`movie/${item.id}/videos?language=en-US`);
                const trailer = (videosData?.results ?? []).find(
                    (v: any) => v.type === 'Trailer' && v.site === 'YouTube',
                );
                return [`movie-${item.id}`, trailer?.key ?? null];
            } catch {
                return [`movie-${item.id}`, null];
            }
        });

        const results = await this.client.withConcurrencyLimit(tasks);
        return Object.fromEntries(results);
    }
}