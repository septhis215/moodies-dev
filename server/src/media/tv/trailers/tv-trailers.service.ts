import { Injectable, Logger } from '@nestjs/common';
import { TvTmdbClientService } from '../client/tv-tmdb-client.service';
import { TvRecommendationsService } from '../recommendations/tv-recommendations.service';
import { TmdbTv, ContentType } from '../types/tv.types';
import { shuffleArray } from '../utils/helpers';

const MIN_REQUIRED_ITEMS = 30;

@Injectable()
export class TvTrailersService {
    private readonly logger = new Logger(TvTrailersService.name);

    constructor(
        private readonly client: TvTmdbClientService,
        private readonly recommendationsService: TvRecommendationsService,
    ) { }

    async getTrailers(limit = 30): Promise<TmdbTv[]> {
        const minReq = Math.max(MIN_REQUIRED_ITEMS, limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
            return [];
        }

        try {
            const recentDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0];

            const sources = [
                `discover/tv?with_original_language=ko&sort_by=popularity.desc&page=1`,
                `tv/popular?language=en-US&page=1`,
                `tv/top_rated?language=en-US&page=1`,
                `discover/tv?sort_by=release_date.desc&first_air_date.gte=${recentDate}&page=1`,
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
                .slice(0, minReq * 2)
                .map((m: any) => async (): Promise<TmdbTv | null> => {
                    try {
                        const [videosData, details] = await Promise.all([
                            this.client.tmdb(`tv/${m.id}/videos?language=en-US`),
                            this.client.tmdb(`tv/${m.id}?language=en-US`).catch(() => null),
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
                            release_date: m.release_date ?? m.first_air_date ?? null,
                            vote_average: m.vote_average,
                            vote_count: m.vote_count,
                            popularity: m.popularity,
                            trailer_key: trailer.key,
                            recommendations: [],
                            genres: details?.genres ? details.genres.map((g: any) => g.name) : [],
                            origin_country: details?.origin_country ?? m.origin_country ?? [],
                            type: 'tv',
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
                .filter((item): item is TmdbTv => item !== null)
                .slice(0, minReq);

            this.recommendationsService.populateRecommendationsBackground(withTrailers);
            return shuffleArray(withTrailers);
        } catch (err) {
            this.logger.error('Failed to fetch trailers', err as any);
            return [];
        }
    }

    async getUpcomingTrailers(limit?: number): Promise<TmdbTv[]> {
        const requestedLimit =
            typeof limit === 'number' && Number.isFinite(limit)
                ? Math.max(MIN_REQUIRED_ITEMS, limit)
                : null;

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
            return [];
        }

        try {
            const items: TmdbTv[] = [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const currentYear = today.getFullYear();
            const todayStr = `${currentYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const yearEndStr = `${currentYear}-12-31`;
            let totalPages = 1;

            for (let page = 1; page <= totalPages; page++) {
                const data = await this.client.tmdb(
                    `/discover/tv?language=en-US&sort_by=popularity.desc&include_adult=false&first_air_date.gte=${todayStr}&first_air_date.lte=${yearEndStr}&page=${page}`,
                );
                totalPages = data?.total_pages ?? page;
                const results = data?.results ?? [];

                const trailerTasks = results.map((m: any) => async () => {
                    const rd = m.release_date ?? m.first_air_date;
                    if (!rd || rd < todayStr || rd > yearEndStr) return null;

                    try {
                        const [videosResult, detailsResult] = await Promise.allSettled([
                            this.client.tmdb(`tv/${m.id}/videos?language=en-US`),
                            this.client.tmdb(`tv/${m.id}?language=en-US`),
                        ]);
                        const videosData = videosResult.status === 'fulfilled' ? videosResult.value : null;
                        const details = detailsResult.status === 'fulfilled' ? detailsResult.value : null;

                        const trailerTypes = ['Trailer', 'Teaser', 'Clip'];
                        const trailer = trailerTypes
                            .map((trailerType) =>
                                (videosData?.results ?? []).find(
                                    (v: any) => v.type === trailerType && v.site === 'YouTube',
                                ),
                            )
                            .find(Boolean);

                        return {
                            id: m.id,
                            title: m.title ?? m.name ?? 'Untitled',
                            overview: m.overview ?? '',
                            poster_path: m.poster_path ?? null,
                            backdrop_path: m.backdrop_path ?? null,
                            release_date: rd,
                            vote_average: m.vote_average,
                            vote_count: m.vote_count,
                            popularity: m.popularity,
                            trailer_key: trailer?.key ?? null,
                            type: 'tv' as ContentType,
                            recommendations: [],
                            number_of_episodes: details?.number_of_episodes ?? null,
                            number_of_seasons: details?.number_of_seasons ?? null,
                            genres: details?.genres ? details.genres.map((g: any) => g.name) : [],
                            genre_ids: details?.genres
                                ? details.genres.map((g: any) => g.id)
                                : (m.genre_ids ?? []),
                            first_air_date: m.first_air_date ?? null,
                            last_air_date: details?.last_air_date ?? null,
                            status: details?.status ?? undefined,
                        } as TmdbTv;
                    } catch {
                        return null;
                    }
                });

                const pageResults = (await this.client.withConcurrencyLimit(trailerTasks))
                    .filter((item): item is TmdbTv => item !== null);
                items.push(...pageResults);

                const uniqueWithPosters = new Map(
                    items
                        .filter((item) => item.poster_path !== null)
                        .map((item) => [item.id, item]),
                );
                if (requestedLimit && uniqueWithPosters.size >= requestedLimit) break;
            }

            const withImages = items.filter((item) => item.poster_path !== null);
            const uniqueItems = Array.from(new Map(withImages.map((item) => [item.id, item])).values());

            const sorted = uniqueItems
                .sort(
                    (a, b) =>
                        (a.release_date ? new Date(a.release_date).getTime() : Infinity) -
                        (b.release_date ? new Date(b.release_date).getTime() : Infinity),
                );

            const result = requestedLimit ? sorted.slice(0, requestedLimit) : sorted;

            void this.recommendationsService.populateRecommendationsBackground(result);

            return result;
        } catch (err) {
            this.logger.error('Failed to fetch upcoming trailers', err as any);
            return [];
        }
    }

    async getTrailersForItems(items: { id: number }[]): Promise<Record<string, string | null>> {
        const tasks = items.map((item) => async () => {
            try {
                const videosData = await this.client.tmdb(`tv/${item.id}/videos?language=en-US`);
                const trailer = (videosData?.results ?? []).find(
                    (v: any) => v.type === 'Trailer' && v.site === 'YouTube',
                );
                return [`TV-${item.id}`, trailer?.key ?? null];
            } catch {
                return [`TV-${item.id}`, null];
            }
        });

        const results = await this.client.withConcurrencyLimit(tasks);
        return Object.fromEntries(results);
    }
}
