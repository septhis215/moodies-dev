import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { TmdbClientService } from '../client/tmdb-client.service';
import { TmdbAll, Candidate, ScoredCandidate, TrailerCandidate } from '../types/tmdb.types';
import { CACHE_TTL } from '../utils/helpers';

@Injectable()
export class RecommendationsService {
    private readonly logger = new Logger(RecommendationsService.name);

    constructor(
        private readonly client: TmdbClientService,
        private readonly redisService: RedisService,
    ) { }

    async getSmartRecommendations(
        type: 'movie' | 'tv',
        id: number,
        limit = 10,
        minRequired = 3
    ): Promise<TmdbAll[]> {
        const cacheKey = `smart-rec-v2-${type}-${id}-${limit}`;

        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            try {
                const result = JSON.parse(cached) as TmdbAll[];
                if (result.length >= minRequired) return result;
            } catch { }
        }

        if (!this.client.token) return [];

        try {
            const baseItem = await this.client.tmdb(`${this.client.baseUrl}/${type}/${id}?language=en-US`);
            if (!baseItem) return [];

            const baseLang = baseItem.original_language;
            const baseGenreIds: number[] = (baseItem.genres ?? []).map((g: any) => g.id);
            const baseCountries: string[] = type === 'tv'
                ? (baseItem.origin_country ?? [])
                : (baseItem.production_countries?.map((c: any) => c.iso_3166_1) ?? []);

            const allCandidates: Candidate[] = [];
            const seenIds = new Set([id]);

            // Source 1: Collection (movies only)
            if (type === 'movie' && baseItem.belongs_to_collection?.id) {
                try {
                    const collData = await this.client.tmdb(
                        `${this.client.baseUrl}/collection/${baseItem.belongs_to_collection.id}?language=en-US`
                    );
                    const parts = (collData?.parts ?? []).filter((p: any) => p.id !== id);
                    for (const part of parts) {
                        if (!seenIds.has(part.id)) {
                            allCandidates.push({ ...part, source: 'collection', priority: 1 });
                            seenIds.add(part.id);
                        }
                    }
                } catch (err) {
                    this.logger.warn(`Collection fetch failed for ${id}`, err);
                }
            }

            // Source 2: Direct recommendations + similar (parallel)
            const [recData, simData] = await Promise.allSettled([
                this.client.tmdb(`${this.client.baseUrl}/${type}/${id}/recommendations?language=en-US&page=1`),
                this.client.tmdb(`${this.client.baseUrl}/${type}/${id}/similar?language=en-US&page=1`)
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
                    const discoverUrl = `${this.client.baseUrl}/discover/${type}?with_genres=${genreQuery}&sort_by=popularity.desc&page=1`;

                    if (baseLang && baseCountries.length > 0) {
                        const langCountryUrl = `${discoverUrl}&with_original_language=${baseLang}&with_origin_country=${baseCountries[0]}`;
                        const langCountryData = await this.client.tmdb(langCountryUrl);
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
                    this.logger.warn(`Genre discovery failed for ${id}`, err);
                }
            }

            // Source 4: Popular fallback
            if (allCandidates.length < minRequired * 2) {
                try {
                    const popularData = await this.client.tmdb(`${this.client.baseUrl}/${type}/popular?language=en-US&page=1`);
                    if (popularData?.results) {
                        for (const item of popularData.results.slice(0, 20)) {
                            if (!seenIds.has(item.id)) {
                                allCandidates.push({ ...item, source: 'popular', priority: 6 });
                                seenIds.add(item.id);
                            }
                        }
                    }
                } catch (err) {
                    this.logger.warn(`Popular fallback failed for ${id}`, err);
                }
            }

            // Scoring
            const scoredCandidates: ScoredCandidate[] = allCandidates.map(candidate => {
                let score = 0;
                const priorityBonus = [0, 100, 80, 70, 60, 40, 20][candidate.priority] || 0;
                score += priorityBonus;

                if (baseLang && candidate.original_language === baseLang) score += 50;

                if (baseCountries.length > 0) {
                    const candidateCountries = candidate.origin_country ||
                        (candidate.production_countries?.map((c: any) => c.iso_3166_1)) || [];
                    if (candidateCountries.some(c => baseCountries.includes(c))) score += 40;
                }

                const candidateGenres = candidate.genre_ids || [];
                if (baseGenreIds.length > 0 && candidateGenres.length > 0) {
                    const overlap = baseGenreIds.filter(g => candidateGenres.includes(g)).length;
                    score += overlap * 15;
                }

                score += Math.min(15, (candidate.popularity || 0) / 20);
                score += Math.min(10, (candidate.vote_average || 0) * 1.2);

                if (candidate.release_date || candidate.first_air_date) {
                    const releaseDate = new Date(candidate.release_date || candidate.first_air_date!);
                    const yearsDiff = (Date.now() - releaseDate.getTime()) / (365 * 24 * 60 * 60 * 1000);
                    if (yearsDiff < 3) score += Math.max(0, 10 - yearsDiff * 3);
                }

                return { ...candidate, score };
            });

            scoredCandidates.sort((a, b) => b.score - a.score);
            const topCandidates = scoredCandidates.slice(0, Math.max(limit * 3, minRequired * 5));

            // Trailer fetching
            const trailerTasks = topCandidates.map(candidate => async (): Promise<TrailerCandidate> => {
                try {
                    const videosData = await this.client.tmdb(
                        `${this.client.baseUrl}/${type}/${candidate.id}/videos?language=en-US`
                    );
                    const trailerTypes = ['Trailer', 'Teaser', 'Clip'];
                    let trailer: any = null;
                    for (const trailerType of trailerTypes) {
                        trailer = (videosData?.results ?? []).find(
                            (v: any) => v.type === trailerType && v.site === 'YouTube'
                        );
                        if (trailer) break;
                    }
                    return { ...candidate, trailer_key: trailer?.key || null, hasTrailer: !!trailer };
                } catch {
                    return { ...candidate, trailer_key: null, hasTrailer: false };
                }
            });

            const withTrailerInfo = await this.client.withConcurrencyLimit(trailerTasks, 6);

            const withTrailers = withTrailerInfo.filter(item => item.hasTrailer);
            const withoutTrailers = withTrailerInfo.filter(item => !item.hasTrailer);
            const finalCandidates = [...withTrailers, ...withoutTrailers];

            if (finalCandidates.length < minRequired) {
                this.logger.warn(`Only found ${finalCandidates.length} recommendations for ${type}/${id}`);
            }

            const final: TmdbAll[] = finalCandidates.slice(0, limit).map(item => ({
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
                trailer_key: item.trailer_key,
                type,
            }));

            await this.redisService.set(cacheKey, JSON.stringify(final), CACHE_TTL.RECOMMENDATIONS);
            return final;
        } catch (err) {
            this.logger.error(`getSmartRecommendations failed for ${type}/${id}`, err);
            return [];
        }
    }

    async getRecommendations(type: 'movie' | 'tv', id: number, limit = 10): Promise<TmdbAll[]> {
        return this.getSmartRecommendations(type, id, limit);
    }

    async getItemRecommendations(type: 'movie' | 'tv', id: number, limit: number): Promise<TmdbAll[]> {
        return this.getSmartRecommendations(type, id, limit);
    }

    async populateRecommendationsBackground(items: TmdbAll[], cacheKey: string) {
        setTimeout(async () => {
            const tasks = items.map(item => async () => {
                try {
                    const recs = await this.getSmartRecommendations(item.type!, item.id, 3);
                    item.recommendations = recs;
                    return item;
                } catch (err) {
                    this.logger.error(`Failed to populate recommendations for ${item.id}`, err);
                    return item;
                }
            });

            const updatedItems = await this.client.withConcurrencyLimit(tasks, 3);
            await this.redisService.set(cacheKey, JSON.stringify(updatedItems), CACHE_TTL.BASIC_DATA);
        }, 100);
    }
}