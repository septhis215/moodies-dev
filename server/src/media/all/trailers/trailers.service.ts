import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { TmdbClientService } from '../client/tmdb-client.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { VideoScoringService } from '../videos/video-scoring.service';
import { TmdbAll } from '../types/tmdb.types';
import { CACHE_TTL, shuffleArray, getSeededRandom, seededShuffleArray } from '../utils/helpers';

const ALLOWED_REGIONS = ['US', 'GB', 'CA', 'AU'];

@Injectable()
export class TrailersService {
    private readonly logger = new Logger(TrailersService.name);

    constructor(
        private readonly client: TmdbClientService,
        private readonly redisService: RedisService,
        private readonly recommendationsService: RecommendationsService,
        private readonly videoScoring: VideoScoringService,
    ) { }

    async getTrailers(limit = 30): Promise<TmdbAll[]> {
        const cacheKey = `trailers-enhanced-${limit}`;

        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached) as TmdbAll[];
            } catch { }
        }

        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
            return [];
        }

        try {
            const data = await this.client.tmdb(`${this.client.baseUrl}/trending/all/week?language=en-US&page=1`);
            const results = Array.isArray(data?.results) ? data.results : [];
            if (!results.length) return [];

            const uniqueItems: any[] = [];
            const seenIds = new Set<number>();
            for (const item of results) {
                if (!seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    uniqueItems.push(item);
                }
            }

            const trailerTasks = uniqueItems.slice(0, limit * 2).map((m: any) => async (): Promise<TmdbAll | null> => {
                try {
                    const type = m.media_type;
                    const [videosData, details] = await Promise.all([
                        this.client.tmdb(`${this.client.baseUrl}/${type}/${m.id}/videos?language=en-US`),
                        this.client.tmdb(`${this.client.baseUrl}/${type}/${m.id}?language=en-US`).catch(() => null)
                    ]);

                    const videos = videosData?.results || [];
                    const filteredVideos = this.videoScoring.filterVideos(videos, ALLOWED_REGIONS);
                    if (filteredVideos.length === 0) return null;

                    const availableVideos = await this.videoScoring.getAvailableVideos(filteredVideos);
                    if (availableVideos.length === 0) return null;

                    const scoredVideos = this.videoScoring.sortByScore(
                        availableVideos.filter(v => !/red\s*band/i.test(v.name))
                    );

                    scoredVideos.forEach(v => console.log(v.name, v.score));
                    const bestVideo = scoredVideos[0];

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
                        trailer_key: bestVideo.key,
                        recommendations: [],
                        runtime: undefined,
                        genres: details?.genres ? details.genres.map((g: any) => g.name) : [],
                        origin_country: details?.origin_country ?? m.origin_country ?? [],
                        type,
                        genre_ids: details?.genres ? details.genres.map((g: any) => g.id) : m.genre_ids ?? [],
                    };
                } catch (err) {
                    this.logger.warn(`Failed to process trailer for ${m.id}`, err);
                    return null;
                }
            });

            const withTrailers = (await this.client.withConcurrencyLimit(trailerTasks, 5))
                .filter((item): item is TmdbAll => item !== null)
                .slice(0, limit);

            this.recommendationsService.populateRecommendationsBackground(withTrailers, cacheKey);

            return shuffleArray(withTrailers);
        } catch (err) {
            this.logger.error('Failed to fetch trailers', err as any);
            return [];
        }
    }

    async getUpcomingTrailers(limit = 30): Promise<TmdbAll[]> {
        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty trailers');
            return [];
        }

        try {
            const items: TmdbAll[] = [];
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const maxPages = 20;

            const fetchTrailers = async (mediaType: 'movie' | 'tv') => {
                for (let page = 1; page <= maxPages; page++) {
                    const url = mediaType === 'movie'
                        ? `${this.client.baseUrl}/discover/movie?language=en-US&sort_by=popularity.desc&primary_release_date.gte=${todayStr}&page=${page}`
                        : `${this.client.baseUrl}/discover/tv?language=en-US&sort_by=popularity.desc&first_air_date.gte=${todayStr}&page=${page}`;

                    const data = await this.client.tmdb(url);
                    const results = data?.results ?? [];

                    const trailerTasks = results.map((m: any) => async () => {
                        const rd = m.release_date ?? m.first_air_date;
                        if (!rd || new Date(rd) < today) return null;

                        try {
                            const [videosData, details] = await Promise.all([
                                this.client.tmdb(`${this.client.baseUrl}/${mediaType}/${m.id}/videos?language=en-US`),
                                this.client.tmdb(`${this.client.baseUrl}/${mediaType}/${m.id}?language=en-US`)
                            ]);

                            const videos = videosData?.results || [];
                            const filteredVideos = this.videoScoring.filterVideos(videos, ALLOWED_REGIONS);
                            if (filteredVideos.length === 0) return null;

                            const availableVideos = await this.videoScoring.getAvailableVideos(filteredVideos);
                            if (availableVideos.length === 0) return null;

                            const bestVideo = this.videoScoring.sortByScore(availableVideos)[0];

                            return {
                                id: m.id,
                                title: m.title ?? m.name ?? 'Untitled',
                                overview: m.overview ?? '',
                                poster_path: m.poster_path ?? null,
                                backdrop_path: m.backdrop_path ?? null,
                                release_date: rd,
                                vote_average: m.vote_average,
                                trailer_key: bestVideo.key,
                                type: mediaType,
                                recommendations: [],
                                runtime: mediaType === 'movie' ? details.runtime ?? null : null,
                                number_of_episodes: mediaType === 'tv' ? details.number_of_episodes ?? null : null,
                                genres: details.genres ? details.genres.map((g: any) => g.name) : [],
                            } as TmdbAll;
                        } catch {
                            return null;
                        }
                    });

                    const pageResults = (await this.client.withConcurrencyLimit(trailerTasks))
                        .filter((item): item is TmdbAll => item !== null);

                    items.push(...pageResults);
                    if (items.length >= limit) break;
                }
            };

            await Promise.all([fetchTrailers('movie'), fetchTrailers('tv')]);

            const sorted = items
                .sort((a, b) =>
                    (a.release_date ? new Date(a.release_date).getTime() : Infinity) -
                    (b.release_date ? new Date(b.release_date).getTime() : Infinity)
                )
                .slice(0, limit);

            setTimeout(async () => {
                const tasks = sorted.map(item => async () => {
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

            return sorted;
        } catch (err) {
            this.logger.error('Failed to fetch upcoming trailers', err as any);
            return [];
        }
    }

    async getTrailersForItems(items: { type: 'movie' | 'tv', id: number }[]): Promise<Record<string, string | null>> {
        const tasks = items.map(item => async () => {
            try {
                const videosData = await this.client.tmdb(
                    `${this.client.baseUrl}/${item.type}/${item.id}/videos?language=en-US`
                );
                const trailer = (videosData?.results ?? []).find(
                    (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
                );
                return [`${item.type}-${item.id}`, trailer?.key ?? null];
            } catch {
                return [`${item.type}-${item.id}`, null];
            }
        });

        const results = await this.client.withConcurrencyLimit(tasks);
        return Object.fromEntries(results);
    }

    async getMovieVideos(id: number) {
        return this.client.tmdb(`movie/${id}/videos`);
    }

    async getTvVideos(id: number) {
        return this.client.tmdb(`tv/${id}/videos`);
    }
}