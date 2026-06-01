import { Injectable, Logger } from '@nestjs/common';
import { TvTmdbClientService } from '../client/tv-tmdb-client.service';
import { TmdbTv } from '../types/tv.types';
import { runWithTmdbPriority, TMDB_PRIORITY } from 'src/external-apis/services/tmdb-priority.context';

@Injectable()
export class TvRecommendationsService {
    private readonly logger = new Logger(TvRecommendationsService.name);

    constructor(private readonly client: TvTmdbClientService) { }

    private scoreCandidates(
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

    async getSmartRecommendationsTv(id: number, limit = 10, minRequired = 3): Promise<TmdbTv[]> {
        try {
            const baseItem = await this.client.tmdb(`tv/${id}?language=en-US`);
            if (!baseItem) return [];

            const baseLang = baseItem.original_language;
            const baseGenreIds: number[] = (baseItem.genres ?? []).map((g: any) => g.id);
            const baseCountries: string[] = baseItem.origin_country ?? [];

            const allCandidates: any[] = [];
            const seenIds = new Set<number>([id]);

            // Source 1: Recommendations + similar (parallel)
            const [recData, simData] = await Promise.allSettled([
                this.client.tmdb(`tv/${id}/recommendations?language=en-US&page=1`),
                this.client.tmdb(`tv/${id}/similar?language=en-US&page=1`),
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

            // Source 2: Genre-based discovery
            if (allCandidates.length < limit * 2 && baseGenreIds.length > 0) {
                try {
                    const genreQuery = baseGenreIds.slice(0, 2).join(',');
                    const discoverUrl = `discover/tv?with_genres=${genreQuery}&sort_by=popularity.desc&page=1`;

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
                    this.logger.warn(`Genre discovery failed for tv/${id}`, err);
                }
            }

            // Source 3: Popular fallback
            if (allCandidates.length < minRequired * 2) {
                try {
                    const popularData = await this.client.tmdb(`tv/popular?language=en-US&page=1`);
                    if (popularData?.results) {
                        for (const item of popularData.results.slice(0, 20)) {
                            if (!seenIds.has(item.id)) {
                                allCandidates.push({ ...item, source: 'popular', priority: 6 });
                                seenIds.add(item.id);
                            }
                        }
                    }
                } catch (err) {
                    this.logger.warn(`Popular fallback failed for tv/${id}`, err);
                }
            }

            const scored = this.scoreCandidates(allCandidates, baseLang, baseGenreIds, baseCountries);
            const finalCandidates = scored.slice(0, limit);

            if (finalCandidates.length < minRequired) {
                this.logger.warn(`Only found ${finalCandidates.length} tv recommendations for ${id}`);
            }

            return finalCandidates.map((item: any) => ({
                id: item.id,
                title: item.title || item.name || 'Untitled',
                overview: item.overview || '',
                poster_path: item.poster_path || null,
                backdrop_path: item.backdrop_path || null,
                release_date: item.first_air_date || item.release_date || null,
                vote_average: item.vote_average,
                vote_count: item.vote_count,
                popularity: item.popularity,
                origin_country: item.origin_country || [],
                genres: (item.genre_ids || []).map((gid: number) => this.client.genreMap[gid] || 'Unknown'),
                trailer_key: item.trailer_key ?? null,
                type: 'tv' as const,
            }));
        } catch (err) {
            this.logger.error(`getSmartRecommendationsTv failed for tv/${id}`, err);
            return [];
        }
    }

    async populateRecommendationsBackground(items: TmdbTv[]) {
        setTimeout(() => {
            void runWithTmdbPriority(TMDB_PRIORITY.BACKGROUND, async () => {
                const tasks = items.map((item) => async () => {
                    try {
                        const recs = await this.getSmartRecommendationsTv(item.id, 3);
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
}