import { Injectable, Logger } from '@nestjs/common';
import { TvTmdbClientService } from '../client/tv-tmdb-client.service';
import { TmdbTv, ContentType, TvListResult } from '../types/tv.types';
import { paginateItems } from '../utils/helpers';
import { RedisService } from 'src/redis/redis.service';

const MIN_REQUIRED_ITEMS = 30;
const LIST_CACHE_TTL = 60 * 60 * 6;

@Injectable()
export class TvNewReleasesService {
    private readonly logger = new Logger(TvNewReleasesService.name);

    constructor(
        private readonly client: TvTmdbClientService,
        private readonly redisService: RedisService,
    ) { }

    async getNewReleases(limit = 30, page?: number, skipCache = false): Promise<TvListResult> {
        if (!page && !skipCache) {
            try {
                return await this.redisService.getOrSet(
                    `tv:newReleases:${limit}`,
                    LIST_CACHE_TTL,
                    () => this.getNewReleases(limit, page, true),
                    (value) => Array.isArray(value) ? value.length > 0 : true,
                );
            } catch (err) {
                this.logger.warn(`List cache bypassed for tv:newReleases:${limit}: ${(err as Error).message}`);
            }
        }

        const minReq = Math.max(MIN_REQUIRED_ITEMS, limit);

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty new releases');
            return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
        }

        try {
            const items: TmdbTv[] = [];
            const today = new Date();

            const lastWeek = new Date();
            lastWeek.setDate(today.getDate() - 7);
            const lastWeekStr = lastWeek.toISOString().split('T')[0];

            const nextWeek = new Date();
            nextWeek.setDate(today.getDate() + 7);
            const nextWeekStr = nextWeek.toISOString().split('T')[0];

            for (
                let currentPage = 1;
                currentPage <= 20 && items.length < minReq * 2;
                currentPage++
            ) {
                const data = await this.client.tmdb(
                    `discover/tv?language=en-US&sort_by=popularity.desc&first_air_date.gte=${lastWeekStr}&first_air_date.lte=${nextWeekStr}&page=${currentPage}`,
                );
                const results = data?.results ?? [];

                const pageItems = results
                    .filter((m: any) => m.id && (m.title || m.name) && m.poster_path && m.backdrop_path && m.first_air_date)
                    .map((m: any) => {
                    const rd = m.first_air_date;

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
                            trailer_key: null,
                            type: 'tv' as ContentType,
                            recommendations: [],
                            genres: m.genre_ids
                                ? m.genre_ids.map((id: number) => this.client.genreMap[id] || 'Unknown')
                                : [],
                            genre_ids: m.genre_ids ?? [],
                            first_air_date: rd,
                        } as TmdbTv;
                });

                items.push(...pageItems);
            }

            const withImages = items.filter(
                (item) => item.backdrop_path !== null && item.poster_path !== null,
            );
            const uniqueItems = Array.from(
                new Map(withImages.map((item) => [item.id, item])).values(),
            );

            // Priority-date ordering: yesterday → today → tomorrow → day+2 first
            const todayStr = today.toISOString().split('T')[0];
            const makeDateStr = (offset: number) => {
                const d = new Date(today);
                d.setDate(today.getDate() + offset);
                return d.toISOString().split('T')[0];
            };

            const priorityDates = new Set([
                makeDateStr(-1),
                todayStr,
                makeDateStr(1),
                makeDateStr(2),
            ]);

            const [priority, others] = uniqueItems.reduce<[TmdbTv[], TmdbTv[]]>(
                (acc, item) => {
                    if (priorityDates.has(item.release_date)) acc[0].push(item);
                    else acc[1].push(item);
                    return acc;
                },
                [[], []],
            );

            const byDate = (a: TmdbTv, b: TmdbTv) =>
                new Date(a.release_date).getTime() - new Date(b.release_date).getTime();

            const sorted = [...priority.sort(byDate), ...others.sort(byDate)];

            if (!page) return sorted.slice(0, minReq);
            return paginateItems(sorted, page, limit);
        } catch (err) {
            this.logger.error('Failed to fetch new releases', err as any);
            return page ? { data: [], page: 1, totalPages: 0, total: 0 } : [];
        }
    }
}
