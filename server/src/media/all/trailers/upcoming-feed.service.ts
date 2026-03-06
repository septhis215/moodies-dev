import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { TmdbClientService } from '../client/tmdb-client.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { VideoScoringService } from '../videos/video-scoring.service';
import { TmdbAll } from '../types/tmdb.types';
import { CACHE_TTL, getSeededRandom, seededShuffleArray } from '../utils/helpers';

@Injectable()
export class UpcomingFeedService {
    private readonly logger = new Logger(UpcomingFeedService.name);

    constructor(
        private readonly client: TmdbClientService,
        private readonly redisService: RedisService,
        private readonly recommendationsService: RecommendationsService,
        private readonly videoScoring: VideoScoringService,
    ) { }

    async getUpcomingFeeds(page: number = 1, limit: number = 35): Promise<{
        results: any[];
        page: number;
        total_pages: number;
        hasMore: boolean;
    }> {
        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
            return { results: [], page, total_pages: 0, hasMore: false };
        }

        try {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const futureDate = new Date();
            futureDate.setMonth(futureDate.getMonth() + 6);
            const futureDateStr = futureDate.toISOString().split('T')[0];

            const tmdbPagesPerRequest = 3;
            const startTmdbPage = ((page - 1) * tmdbPagesPerRequest) + 1;
            const endTmdbPage = startTmdbPage + tmdbPagesPerRequest;

            this.logger.log(`Page ${page}: Fetching TMDB pages ${startTmdbPage}-${endTmdbPage - 1}`);

            const items: TmdbAll[] = [];
            const seenIds = new Set<number>();

            const fetchTrailers = async (mediaType: 'movie' | 'tv') => {
                const fetchedItems: TmdbAll[] = [];

                for (let tmdbPage = startTmdbPage; tmdbPage < endTmdbPage; tmdbPage++) {
                    try {
                        const url = mediaType === 'movie'
                            ? `discover/movie?language=en-US&sort_by=popularity.desc&primary_release_date.gte=${todayStr}&primary_release_date.lte=${futureDateStr}&page=${tmdbPage}`
                            : `discover/tv?language=en-US&sort_by=popularity.desc&first_air_date.gte=${todayStr}&first_air_date.lte=${futureDateStr}&page=${tmdbPage}`;

                        const data = await this.client.tmdb(url);
                        const results = data?.results ?? [];

                        const trailerTasks = results.map((m: any) => async () => {
                            if (seenIds.has(m.id)) return null;

                            const rd = m.release_date ?? m.first_air_date;
                            if (!rd || new Date(rd) < today) return null;
                            if (!m.poster_path || !m.overview || m.overview.length < 10) return null;

                            try {
                                const [videosData, details] = await Promise.all([
                                    this.client.tmdb(`${mediaType}/${m.id}/videos?language=en-US`),
                                    this.client.tmdb(`${mediaType}/${m.id}?language=en-US`)
                                ]);

                                const allVideos = videosData?.results ?? [];
                                seenIds.add(m.id);

                                return {
                                    id: m.id,
                                    title: m.title ?? m.name ?? 'Untitled',
                                    overview: m.overview ?? '',
                                    poster_path: m.poster_path ?? null,
                                    backdrop_path: m.backdrop_path ?? null,
                                    release_date: rd,
                                    vote_average: m.vote_average || 0,
                                    vote_count: m.vote_count || 0,
                                    type: mediaType,
                                    recommendations: [],
                                    runtime: mediaType === 'movie' ? details.runtime ?? null : null,
                                    number_of_episodes: mediaType === 'tv' ? details.number_of_episodes ?? null : null,
                                    genres: details.genres ? details.genres.map((g: any) => g.name) : [],
                                    popularity: m.popularity || 0,
                                    original_language: m.original_language || 'en',
                                    videos: allVideos,
                                } as TmdbAll;
                            } catch (err) {
                                this.logger.error(`Failed to fetch details for ${mediaType} ${m.id}`, err);
                                return null;
                            }
                        });

                        const pageResults = (await this.client.withConcurrencyLimit(trailerTasks, 10))
                            .filter((item): item is TmdbAll => item !== null);

                        fetchedItems.push(...pageResults);
                    } catch (err) {
                        this.logger.error(`Failed to fetch ${mediaType} page ${tmdbPage}`, err);
                    }
                }

                return fetchedItems;
            };

            const [movieItems, tvItems] = await Promise.all([
                fetchTrailers('movie'),
                fetchTrailers('tv')
            ]);

            items.push(...movieItems, ...tvItems);

            const uniqueItems = Array.from(
                new Map(items.map(item => [item.id, item])).values()
            );

            this.logger.log(`Page ${page}: Fetched ${uniqueItems.length} unique items before video enrichment`);

            const pageSeed = page * 12345;
            const shuffled = this.shuffleUpcomingTrailers(uniqueItems, pageSeed);
            const itemsToEnrich = shuffled.slice(0, Math.min(shuffled.length, limit * 2));
            const enrichedItems = await this.enrichWithVideos(itemsToEnrich, pageSeed);

            this.logger.log(`Page ${page}: ${enrichedItems.length} items with verified videos`);

            const paginatedResults = enrichedItems.slice(0, limit);
            const hasMore = enrichedItems.length >= Math.floor(limit * 0.8) && uniqueItems.length >= limit;

            this.logger.log(`Page ${page}: Returning ${paginatedResults.length} results, hasMore: ${hasMore}`);

            const response = { results: paginatedResults, page, total_pages: 100, hasMore };

            if (paginatedResults.length > 0) {
                setTimeout(async () => {
                    const tasks = paginatedResults.map(item => async () => {
                        try {
                            item.recommendations = await this.recommendationsService.getSmartRecommendations(item.type!, item.id, 3);
                            return item;
                        } catch (err) {
                            this.logger.error(`Failed to populate recommendations for ${item.id}`, err);
                            return item;
                        }
                    });
                    await this.client.withConcurrencyLimit(tasks, 3);
                }, 100);
            }

            return response;
        } catch (err) {
            this.logger.error('Failed to fetch upcoming trailers feed', err as any);
            return { results: [], page, total_pages: 0, hasMore: false };
        }
    }

    private async enrichWithVideos(items: any[], seed: number) {
        const enriched: any[] = [];
        const allowedRegions = [
            'MY', 'SG', 'ID', 'TH', 'PH', 'VN', 'BN', 'KH', 'LA',
            'HK', 'TW', 'IN', 'AU', 'NZ', 'US', 'GB', 'KR', 'JP'
        ];

        const targetCount = Math.min(items.length, 30);
        const batchSize = 8;

        this.logger.log(`Starting enrichment of ${items.length} items, target: ${targetCount}`);

        for (let i = 0; i < items.length && enriched.length < targetCount; i += batchSize) {
            const batch = items.slice(i, i + batchSize);

            const batchResults = await Promise.allSettled(
                batch.map(item => this.processItemWithVideos(item, allowedRegions, seed))
            );

            for (const result of batchResults) {
                if (result.status === 'fulfilled' && result.value) {
                    enriched.push(result.value);
                    if (enriched.length >= targetCount) break;
                } else if (result.status === 'rejected') {
                    this.logger.error('Failed to process item:', result.reason);
                }
            }

            if (i + batchSize < items.length && enriched.length < targetCount) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        this.logger.log(`Enrichment complete: ${enriched.length} items`);
        return enriched;
    }

    private async processItemWithVideos(item: any, allowedRegions: string[], seed: number) {
        try {
            const mediaType = item.title ? 'movie' : 'tv';
            let videos = item.videos || [];

            if (videos.length === 0) {
                const videosResponse = await this.client.tmdb(`${mediaType}/${item.id}/videos`);
                videos = videosResponse.results || [];
            }

            const filteredVideos = this.videoScoring.filterVideos(videos, allowedRegions);
            if (filteredVideos.length === 0) return null;

            const availableVideos = await this.videoScoring.getAvailableVideos(filteredVideos);
            if (availableVideos.length === 0) return null;

            const scoredVideos = this.videoScoring.sortByScore(availableVideos);
            const topVideos = scoredVideos.slice(0, 8);

            const primaryCandidates = topVideos.slice(0, Math.min(4, topVideos.length));
            const primaryIndex = getSeededRandom(item.id + seed, primaryCandidates.length);
            const primaryVideo = primaryCandidates[primaryIndex];

            if (!primaryVideo || !primaryVideo.key) return null;

            return { ...item, media_type: mediaType, videos: topVideos, primary_video: primaryVideo };
        } catch (err) {
            this.logger.error(`Error processing item ${item.id}:`, err);
            return null;
        }
    }

    private shuffleUpcomingTrailers(items: TmdbAll[], seed: number): TmdbAll[] {
        if (items.length === 0) return items;

        const seededRandomForId = (id: number) => {
            const x = Math.sin(seed * 9301 + id * 49297) * 43758.5453123;
            return Math.abs(x - Math.floor(x));
        };

        const jitter = 2.5;
        const scoredItems = items.map(item => ({
            item,
            qualityScore: this.calculateUpcomingQualityScore(item),
            releaseDateScore: this.getReleaseDateProximityScore(item),
        }));

        scoredItems.sort((a, b) => {
            const scoreDiff = (b.qualityScore + b.releaseDateScore) - (a.qualityScore + a.releaseDateScore);
            const randA = seededRandomForId(a.item.id);
            const randB = seededRandomForId(b.item.id);
            return scoreDiff + (randB - randA) * jitter;
        });

        const tiers = { premium: [] as TmdbAll[], high: [] as TmdbAll[], medium: [] as TmdbAll[] };
        scoredItems.forEach(scored => {
            const totalScore = scored.qualityScore + scored.releaseDateScore;
            if (totalScore >= 45) tiers.premium.push(scored.item);
            else if (totalScore >= 30) tiers.high.push(scored.item);
            else tiers.medium.push(scored.item);
        });

        const result: TmdbAll[] = [];
        let pIdx = 0, hIdx = 0, mIdx = 0;

        while (pIdx < tiers.premium.length || hIdx < tiers.high.length || mIdx < tiers.medium.length) {
            for (let i = 0; i < 3 && pIdx < tiers.premium.length; i++) result.push(tiers.premium[pIdx++]);
            for (let i = 0; i < 2 && hIdx < tiers.high.length; i++) result.push(tiers.high[hIdx++]);
            if (mIdx < tiers.medium.length) result.push(tiers.medium[mIdx++]);
        }

        return result;
    }

    private calculateUpcomingQualityScore(item: TmdbAll): number {
        let score = 0;
        score += Math.log10((item.popularity || 1) + 1) * 10;
        if (item.vote_average && item.vote_average > 0) score += item.vote_average * 3;
        score += Math.log10((item.vote_count || 1) + 1) * 5;
        if (item.backdrop_path) score += 3;
        if (item.overview && item.overview.length > 100) score += 2;
        if (item.genres && item.genres.length > 0) score += 2;
        if (item.type === 'movie') score += 2;
        if (item.original_language === 'en') score += 3;
        else if (['ko', 'ja', 'es', 'fr'].includes(item.original_language || '')) score += 4;
        return score;
    }

    private getReleaseDateProximityScore(item: TmdbAll): number {
        if (!item.release_date) return 0;
        const releaseDate = new Date(item.release_date);
        const daysUntilRelease = Math.floor((releaseDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysUntilRelease <= 14) return 12;
        if (daysUntilRelease <= 30) return 10;
        if (daysUntilRelease <= 60) return 8;
        if (daysUntilRelease <= 90) return 4;
        if (daysUntilRelease <= 180) return 2;
        return 0;
    }
}