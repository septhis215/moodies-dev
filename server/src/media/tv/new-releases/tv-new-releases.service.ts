import { Injectable, Logger } from '@nestjs/common';
import { TvTmdbClientService } from '../client/tv-tmdb-client.service';
import { TmdbTv, ContentType, TvListResult } from '../types/tv.types';
import { paginateItems } from '../utils/helpers';

const MIN_REQUIRED_ITEMS = 30;

@Injectable()
export class TvNewReleasesService {
    private readonly logger = new Logger(TvNewReleasesService.name);

    constructor(private readonly client: TvTmdbClientService) { }

    async getNewReleases(limit = 30, page?: number): Promise<TvListResult> {
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

                const trailerTasks = results.map((m: any) => async () => {
                    const rd = m.first_air_date;
                    try {
                        const [videosData, details] = await Promise.all([
                            this.client.tmdb(`tv/${m.id}/videos?language=en-US`),
                            this.client.tmdb(`tv/${m.id}?language=en-US`),
                        ]);

                        const trailer = (videosData?.results ?? []).find(
                            (v: any) => v.type === 'Trailer' && v.site === 'YouTube',
                        );
                        if (!trailer) return null;

                        return {
                            id: m.id,
                            title: m.title ?? m.name ?? 'Untitled',
                            overview: m.overview ?? '',
                            poster_path: m.poster_path ?? null,
                            backdrop_path: m.backdrop_path ?? null,
                            release_date: rd,
                            vote_average: m.vote_average,
                            trailer_key: trailer.key,
                            type: 'tv' as ContentType,
                            recommendations: [],
                            number_of_episodes: details.number_of_episodes ?? null,
                            genres: details.genres ? details.genres.map((g: any) => g.name) : [],
                        } as TmdbTv;
                    } catch {
                        return null;
                    }
                });

                const pageResults = (await this.client.withConcurrencyLimit(trailerTasks)).filter(
                    (item): item is TmdbTv => item !== null,
                );
                items.push(...pageResults);
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