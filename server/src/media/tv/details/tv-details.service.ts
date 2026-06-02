import { Injectable, Logger } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import { TvTmdbClientService } from '../client/tv-tmdb-client.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MediaCacheService } from 'src/external-apis/services/media-cache.service';

const DETAIL_REDIS_TTL = 6 * 60 * 60; // 6h hot L1
const DETAIL_STALE_DAYS = 30; // permanent L2 refresh window
const SEASONS_REDIS_TTL = 6 * 60 * 60; // 6h hot L1
const SEASONS_STALE_DAYS = 7; // refresh weekly so airing shows pick up new episodes

@Injectable()
export class TvDetailsService {
    private readonly logger = new Logger(TvDetailsService.name);

    constructor(
        private readonly client: TvTmdbClientService,
        private readonly prisma: PrismaService,
        private readonly mediaCache: MediaCacheService,
    ) { }

    // Read-through: Redis -> Supabase (media_details) -> TMDB.
    async tvDetails(id: number) {
        return this.mediaCache.readThrough({
            redisKey: `detail:tv:${id}`,
            redisTtlSeconds: DETAIL_REDIS_TTL,
            find: async () => {
                const row = await this.prisma.mediaDetail.findUnique({
                    where: { tmdbId_mediaType: { tmdbId: id, mediaType: MediaType.TV } },
                });
                return row ? { payload: row.payload as any, fetchedAt: row.fetchedAt } : null;
            },
            isStale: (fetchedAt) => MediaCacheService.isOlderThanDays(fetchedAt, DETAIL_STALE_DAYS),
            upsert: async (payload: any) => {
                const data = {
                    tmdbId: id,
                    mediaType: MediaType.TV,
                    title: payload?.info?.title ?? 'Untitled',
                    popularity: payload?.info?.popularity ?? null,
                    payload,
                };
                await this.prisma.mediaDetail.upsert({
                    where: { tmdbId_mediaType: { tmdbId: id, mediaType: MediaType.TV } },
                    create: data,
                    update: { ...data, fetchedAt: new Date() },
                });
            },
            fetchFresh: () => this.assembleTvDetails(id),
        });
    }

    // Bundles aggregate_credits, videos and content_ratings into the single
    // /tv/{id} request via append_to_response. similar + reviews are
    // intentionally NOT appended: the detail page sources "Something Similar"
    // from the recommendations endpoint and reviews from the DB, so caching
    // TMDB's copies just bloats Redis. watch/providers stays separate (its slash
    // would be percent-encoded inside append_to_response).
    private async fetchInfo(id: number) {
        return this.client.tmdb(
            `tv/${id}?language=en-US&append_to_response=aggregate_credits,videos,content_ratings`,
        );
    }

    private async fetchProviders(id: number) {
        return this.client.tmdb(`tv/${id}/watch/providers`);
    }

    private async fetchNextEpisode(id: number, infoRaw: any) {
        if (
            infoRaw?.status !== 'Returning Series' &&
            infoRaw?.status !== 'In Production'
        ) {
            return null;
        }

        try {
            if (infoRaw?.next_episode_to_air) {
                return {
                    episode_number: infoRaw.next_episode_to_air.episode_number,
                    season_number: infoRaw.next_episode_to_air.season_number,
                    name: infoRaw.next_episode_to_air.name,
                    overview: infoRaw.next_episode_to_air.overview,
                    air_date: infoRaw.next_episode_to_air.air_date,
                    runtime: infoRaw.next_episode_to_air.runtime,
                    still_path: infoRaw.next_episode_to_air.still_path,
                };
            }
            return null;
        } catch (err) {
            this.logger.warn(`Failed to fetch next episode for TV ${id}`, err);
            return null;
        }
    }

    private getContentRating(
        ratingsData: any,
        fallbackCountries: string[] = ['GB', 'CA', 'AU', 'FR', 'DE', 'IN', 'JP'],
    ): string {
        if (!ratingsData) return 'NR';

        const results = ratingsData?.results ?? [];

        const findRatingForCountry = (countryCode: string) => {
            const countryObj = results.find((r: any) => r.iso_3166_1 === countryCode);
            if (!countryObj || !countryObj.rating) return null;
            const rating = String(countryObj.rating).trim();
            return rating === '' ? null : rating;
        };

        const normalizeTvRating = (rating: string | null | undefined): string => {
            if (!rating) return 'NR';
            const r = String(rating).toUpperCase();
            if (r.includes('MA') || r === 'TV-MA') return 'TV-MA';
            if (r.includes('14') || r === 'TV-14') return 'TV-14';
            if (r.includes('PG') || r === 'TV-PG') return 'TV-PG';
            if (r.includes('G') || r === 'TV-G') return 'TV-G';
            if (r.includes('Y7') || r === 'TV-Y7') return 'TV-Y7';
            if (r === 'Y' || r === 'TV-Y') return 'TV-Y';
            return rating;
        };

        const us = findRatingForCountry('US');
        if (us) return normalizeTvRating(us);

        for (const country of fallbackCountries) {
            const r = findRatingForCountry(country);
            if (r) return normalizeTvRating(r);
        }

        for (const obj of results) {
            const r = obj?.rating;
            if (r && String(r).trim() !== '') return normalizeTvRating(r);
        }

        return 'NR';
    }

    private async assembleTvDetails(id: number) {
        const [infoRaw, providersRaw] = await Promise.all([
            this.fetchInfo(id),
            this.fetchProviders(id),
        ]);

        // Sub-resources arrive nested on the main payload via append_to_response.
        const creditsRaw = infoRaw?.aggregate_credits;
        const videosRaw = infoRaw?.videos;
        const contentRatingsRaw = infoRaw?.content_ratings;

        const videos = videosRaw?.results ?? videosRaw ?? [];
        const trailer =
            (videos || []).find((v: any) => v.type === 'Trailer' && v.site === 'YouTube') ?? null;

        const production_countries =
            infoRaw?.production_countries ??
            (infoRaw?.origin_country
                ? (infoRaw.origin_country as string[]).map((c) => ({ iso_3166_1: c }))
                : []);

        const director =
            (creditsRaw?.crew ?? []).find((c: any) => c.job === 'Director')?.name ??
            (infoRaw?.created_by && infoRaw.created_by[0]?.name) ??
            undefined;

        const nextEpisode = await this.fetchNextEpisode(id, infoRaw);
        const contentRating = this.getContentRating(contentRatingsRaw);

        const info = {
            id: infoRaw?.id,
            title: infoRaw?.title ?? infoRaw?.name ?? 'Untitled',
            original_title: infoRaw?.original_title ?? infoRaw?.original_name ?? null,
            overview: infoRaw?.overview ?? '',
            release_date: infoRaw?.release_date ?? infoRaw?.first_air_date ?? '',
            runtime: infoRaw?.last_episode_to_air?.runtime,
            budget: infoRaw?.budget ?? 0,
            revenue: infoRaw?.revenue ?? 0,
            vote_average: infoRaw?.vote_average ?? 0,
            vote_count: infoRaw?.vote_count ?? 0,
            genres: infoRaw?.genres ?? [],
            production_companies: infoRaw?.production_companies ?? [],
            production_countries,
            spoken_languages: infoRaw?.spoken_languages ?? [],
            status: infoRaw?.status ?? (infoRaw?.in_production ? 'In Production' : 'Released'),
            tagline: infoRaw?.tagline ?? null,
            homepage: infoRaw?.homepage ?? null,
            poster_path: infoRaw?.poster_path ?? null,
            backdrop_path: infoRaw?.backdrop_path ?? null,
            adult: infoRaw?.adult ?? false,
            created_by: infoRaw?.created_by ?? null,
            content_type: 'tv',
            director,
            content_rating: contentRating,
            number_of_seasons: infoRaw?.number_of_seasons ?? null,
            number_of_episodes: infoRaw?.number_of_episodes ?? null,
            episode_run_time: infoRaw?.episode_run_time ?? [],
            first_air_date: infoRaw?.first_air_date ?? null,
            last_air_date: infoRaw?.last_air_date ?? null,
            networks: infoRaw?.networks ?? [],
            seasons: infoRaw?.seasons ?? [],
            next_episode_to_air: nextEpisode,
            last_episode_to_air: infoRaw?.last_episode_to_air || null,
        };

        const credits = {
            cast: (creditsRaw?.cast ?? []).sort(
                (a: any, b: any) => (a.order ?? 999) - (b.order ?? 999),
            ),
            crew: creditsRaw?.crew ?? [],
        };

        return {
            info,
            credits,
            trailer,
            providers: providersRaw ?? {},
        };
    }

    // Read-through: Redis -> Supabase (tv_season_bundles) -> TMDB. Only the full
    // (with-episodes) variant is cached in the bundle table — the lightweight
    // variant bypasses it since the table is keyed by tmdbId only.
    async fetchSeasonsWithEpisodes(
        id: number,
        options: { includeEpisodeDetails?: boolean } = { includeEpisodeDetails: true },
    ) {
        if (!options.includeEpisodeDetails) {
            return this.assembleSeasonsWithEpisodes(id, options);
        }
        return this.mediaCache.readThrough<any>({
            redisKey: `seasons:tv:${id}`,
            redisTtlSeconds: SEASONS_REDIS_TTL,
            find: async () => {
                const row = await this.prisma.tvSeasonBundle.findUnique({ where: { tmdbId: id } });
                return row ? { payload: row.payload as any, fetchedAt: row.fetchedAt } : null;
            },
            isStale: (fetchedAt) => MediaCacheService.isOlderThanDays(fetchedAt, SEASONS_STALE_DAYS),
            upsert: async (payload) => {
                await this.prisma.tvSeasonBundle.upsert({
                    where: { tmdbId: id },
                    create: { tmdbId: id, payload },
                    update: { payload, fetchedAt: new Date() },
                });
            },
            shouldCache: (seasons) => Array.isArray(seasons) && seasons.length > 0,
            fetchFresh: () => this.assembleSeasonsWithEpisodes(id, options),
        });
    }

    private async assembleSeasonsWithEpisodes(
        id: number,
        options: { includeEpisodeDetails?: boolean } = { includeEpisodeDetails: true },
    ) {
        const infoRaw = await this.client.tmdb(`tv/${id}?language=en-US`);
        if (!infoRaw) return null;

        const seasons = infoRaw.seasons ?? [];

        if (!options.includeEpisodeDetails) {
            return seasons.map((s: any) => ({
                season_number: s.season_number,
                name: s.name,
                overview: s.overview,
                air_date: s.air_date,
                episode_count: s.episode_count,
                poster_path: s.poster_path,
            }));
        }

        const promises = seasons.map((s: any) =>
            this.client.tmdb(`tv/${id}/season/${s.season_number}?language=en-US`),
        );
        const results = await Promise.allSettled(promises);

        return results.map((r, idx) => {
            const basic = seasons[idx] ?? {};
            if (r.status === 'fulfilled' && r.value) {
                const s: any = r.value;
                return {
                    season_number: s.season_number,
                    name: s.name,
                    overview: s.overview,
                    air_date: s.air_date,
                    poster_path: s.poster_path,
                    episode_count: s.episodes?.length ?? basic.episode_count ?? 0,
                    episodes: (s.episodes ?? []).map((e: any) => ({
                        episode_number: e.episode_number,
                        name: e.name,
                        overview: e.overview,
                        air_date: e.air_date,
                        runtime: e.runtime ?? null,
                        still_path: e.still_path ?? null,
                        vote_average: e.vote_average ?? null,
                    })),
                };
            }

            return {
                season_number: basic.season_number,
                name: basic.name,
                overview: basic.overview,
                air_date: basic.air_date,
                poster_path: basic.poster_path,
                episode_count: basic.episode_count ?? 0,
                episodes: [],
            };
        });
    }
}