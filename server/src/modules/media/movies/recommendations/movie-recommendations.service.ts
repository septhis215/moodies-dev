import { Injectable, Logger } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import { MovieTmdbClientService } from '../client/movie-tmdb-client.service';
import { TmdbMovie } from '../types/movie.types';
import { runWithTmdbPriority, TMDB_PRIORITY } from 'src/external-apis/services/tmdb-priority.context';
import { PrismaService } from 'src/prisma/prisma.service';
import { MediaCacheService } from 'src/external-apis/services/media-cache.service';

const REC_REDIS_TTL = 6 * 60 * 60; // 6h hot L1
const REC_STALE_DAYS = 1; // refresh recommendation list daily

@Injectable()
export class MovieRecommendationsService {
    private readonly logger = new Logger(MovieRecommendationsService.name);

    constructor(
        private readonly client: MovieTmdbClientService,
        private readonly prisma: PrismaService,
        private readonly mediaCache: MediaCacheService,
    ) { }

    scoreCandidates(
        candidates: any[],
        baseLang?: string,
        baseGenreIds: number[] = [],
        baseCountries: string[] = [],
    ) {
        const scored = candidates.map((candidate) => {
            let score = 0;
            const priorityBonus = [0, 100, 80, 70, 60, 40, 20][candidate.priority] || 0;
            score += priorityBonus;

            if (baseLang && candidate.original_language === baseLang) score += 50;

            if (baseCountries.length > 0) {
                const candidateCountries =
                    candidate.origin_country ||
                    candidate.production_countries?.map((c: any) => c.iso_3166_1) ||
                    [];
                if (candidateCountries.some((c: string) => baseCountries.includes(c))) score += 40;
            }

            const candidateGenres = candidate.genre_ids || [];
            if (baseGenreIds.length > 0 && candidateGenres.length > 0) {
                const overlap = baseGenreIds.filter((g) => candidateGenres.includes(g)).length;
                score += overlap * 15;
            }

            score += Math.min(15, (candidate.popularity || 0) / 20);
            score += Math.min(10, (candidate.vote_average || 0) * 1.2);

            const dateStr = candidate.release_date || candidate.first_air_date;
            if (dateStr) {
                const releaseDate = new Date(dateStr);
                const yearsDiff = (Date.now() - releaseDate.getTime()) / (365 * 24 * 60 * 60 * 1000);
                if (yearsDiff < 3) score += Math.max(0, 10 - yearsDiff * 3);
            }

            return { ...candidate, score };
        });

        scored.sort((a, b) => b.score - a.score);
        return scored;
    }

    // Read-through: Redis -> Supabase (recommendation_cache) -> compute. Empty
    // results are not cached (transient TMDB failures surface as []).
    async getSmartRecommendationsMovie(
        id: number,
        limit = 10,
        minRequired = 3,
    ): Promise<TmdbMovie[]> {
        return this.mediaCache.readThrough<TmdbMovie[]>({
            redisKey: `rec:movie:${id}:${limit}`,
            redisTtlSeconds: REC_REDIS_TTL,
            find: async () => {
                const row = await this.prisma.recommendationCache.findUnique({
                    where: { tmdbId_mediaType_limit: { tmdbId: id, mediaType: MediaType.MOVIE, limit } },
                });
                return row ? { payload: row.payload as any, fetchedAt: row.fetchedAt } : null;
            },
            isStale: (fetchedAt) => MediaCacheService.isOlderThanDays(fetchedAt, REC_STALE_DAYS),
            upsert: async (payload) => {
                const data = { tmdbId: id, mediaType: MediaType.MOVIE, limit, payload: payload as any };
                await this.prisma.recommendationCache.upsert({
                    where: { tmdbId_mediaType_limit: { tmdbId: id, mediaType: MediaType.MOVIE, limit } },
                    create: data,
                    update: { ...data, fetchedAt: new Date() },
                });
            },
            shouldCache: (list) => Array.isArray(list) && list.length > 0,
            fetchFresh: () => this.computeSmartRecommendationsMovie(id, limit, minRequired),
        });
    }

    private async computeSmartRecommendationsMovie(
        id: number,
        limit = 10,
        minRequired = 3,
    ): Promise<TmdbMovie[]> {
        try {
            const baseItem = await this.client.tmdb(`movie/${id}?language=en-US`);
            if (!baseItem) return [];

            const baseLang = baseItem.original_language;
            const baseGenreIds: number[] = (baseItem.genres ?? []).map((g: any) => g.id);
            const baseCountries: string[] =
                baseItem.production_countries?.map((c: any) => c.iso_3166_1) ?? [];

            const allCandidates: any[] = [];
            const seenIds = new Set<number>([id]);

            // Source 1: Collection
            if (baseItem.belongs_to_collection?.id) {
                try {
                    const collData = await this.client.tmdb(
                        `collection/${baseItem.belongs_to_collection.id}?language=en-US`,
                    );
                    for (const part of (collData?.parts ?? []).filter((p: any) => p.id !== id)) {
                        if (!seenIds.has(part.id)) {
                            allCandidates.push({ ...part, source: 'collection', priority: 1 });
                            seenIds.add(part.id);
                        }
                    }
                } catch (err) {
                    this.logger.warn(`Collection fetch failed for movie/${id}`, err);
                }
            }

            // Source 2: Recommendations + similar (parallel)
            const [recData, simData] = await Promise.allSettled([
                this.client.tmdb(`movie/${id}/recommendations?language=en-US&page=1`),
                this.client.tmdb(`movie/${id}/similar?language=en-US&page=1`),
            ]);

            if (recData.status === 'fulfilled' && recData.value?.results) {
                for (const item of recData.value.results) {
                    if (!seenIds.has(item.id)) {
                        allCandidates.push({ ...item, source: 'recommendations', priority: 2 });
                        seenIds.add(item.id);
                    }
                }
            }

            if (simData.status === 'fulfilled' && simData.value?.results) {
                for (const item of simData.value.results) {
                    if (!seenIds.has(item.id)) {
                        allCandidates.push({ ...item, source: 'similar', priority: 3 });
                        seenIds.add(item.id);
                    }
                }
            }

            // Source 3: Genre-based discovery
            if (allCandidates.length < limit * 2 && baseGenreIds.length > 0) {
                try {
                    const genreQuery = baseGenreIds.slice(0, 2).join(',');
                    const discoverUrl = `discover/movie?with_genres=${genreQuery}&sort_by=popularity.desc&page=1`;

                    if (baseLang && baseCountries.length > 0) {
                        const langCountryData = await this.client.tmdb(
                            `${discoverUrl}&with_original_language=${baseLang}&with_origin_country=${baseCountries[0]}`,
                        );
                        if (langCountryData?.results) {
                            for (const item of langCountryData.results.slice(0, 10)) {
                                if (!seenIds.has(item.id)) {
                                    allCandidates.push({ ...item, source: 'genre-lang-country', priority: 4 });
                                    seenIds.add(item.id);
                                }
                            }
                        }
                    }

                    if (allCandidates.length < limit * 1.5) {
                        const genreData = await this.client.tmdb(discoverUrl);
                        if (genreData?.results) {
                            for (const item of genreData.results.slice(0, 15)) {
                                if (!seenIds.has(item.id)) {
                                    allCandidates.push({ ...item, source: 'genre', priority: 5 });
                                    seenIds.add(item.id);
                                }
                            }
                        }
                    }
                } catch (err) {
                    this.logger.warn(`Genre discovery failed for movie/${id}`, err);
                }
            }

            // Source 4: Popular fallback
            if (allCandidates.length < minRequired * 2) {
                try {
                    const popularData = await this.client.tmdb(`movie/popular?language=en-US&page=1`);
                    if (popularData?.results) {
                        for (const item of popularData.results.slice(0, 20)) {
                            if (!seenIds.has(item.id)) {
                                allCandidates.push({ ...item, source: 'popular', priority: 6 });
                                seenIds.add(item.id);
                            }
                        }
                    }
                } catch (err) {
                    this.logger.warn(`Popular fallback failed for movie/${id}`, err);
                }
            }

            const scored = this.scoreCandidates(allCandidates, baseLang, baseGenreIds, baseCountries);
            const finalCandidates = scored.slice(0, limit);

            if (finalCandidates.length < minRequired) {
                this.logger.warn(`Only found ${finalCandidates.length} recommendations for movie/${id}`);
            }

            return finalCandidates.map((item: any) => ({
                id: item.id,
                title: item.title || item.name || 'Untitled',
                overview: item.overview || '',
                poster_path: item.poster_path || null,
                backdrop_path: item.backdrop_path || null,
                release_date: item.release_date || item.first_air_date || null,
                vote_average: item.vote_average,
                vote_count: item.vote_count,
                popularity: item.popularity,
                origin_country: item.origin_country || [],
                genres: (item.genre_ids || []).map((gid: number) => this.client.genreMap[gid] || 'Unknown'),
                trailer_key: item.trailer_key ?? null,
                type: 'movie' as const,
            }));
        } catch (err) {
            this.logger.error(`getSmartRecommendationsMovie failed for movie/${id}`, err);
            return [];
        }
    }

    async populateRecommendationsBackground(items: TmdbMovie[]) {
        setTimeout(() => {
            void runWithTmdbPriority(TMDB_PRIORITY.BACKGROUND, async () => {
                const tasks = items.map((item) => async () => {
                    try {
                        const recs = await this.getSmartRecommendationsMovie(item.id, 3);
                        item.recommendations = recs;
                        return item;
                    } catch (err) {
                        this.logger.error(`Failed to populate recommendations for ${item.id}`, err);
                        return item;
                    }
                });
                await this.client.withConcurrencyLimit(tasks, 3);
            });
        }, 100);
    }

    // Legacy alias
    async getRecommendations(id: number, limit = 10): Promise<TmdbMovie[]> {
        return this.getSmartRecommendationsMovie(id, limit);
    }

    async getItemRecommendations(id: number, limit: number): Promise<TmdbMovie[]> {
        return this.getSmartRecommendationsMovie(id, limit);
    }
}