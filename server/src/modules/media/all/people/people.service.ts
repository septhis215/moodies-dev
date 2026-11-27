import { Injectable, Logger } from '@nestjs/common';
import { TmdbClientService } from '../client/tmdb-client.service';
import { ContentFilterService } from '../filters/content-filter.service';
import { TmdbPerson } from '../types/tmdb.types';
import { shuffleArray } from '../utils/helpers';

@Injectable()
export class PeopleService {
    private readonly logger = new Logger(PeopleService.name);

    constructor(
        private readonly client: TmdbClientService,
        private readonly filterService: ContentFilterService,
    ) { }

    async getPeople(limit = 30): Promise<TmdbPerson[]> {
        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty people');
            return [];
        }

        try {
            const perPage = 20;
            const approximatePagesNeeded = Math.ceil(limit / perPage);
            const MAX_PAGES = Math.min(10, Math.max(10, approximatePagesNeeded + 1));

            const collectedRaw: any[] = [];
            const seenIds = new Set<number>();

            for (let page = 1; page <= MAX_PAGES && collectedRaw.length < limit; page++) {
                const url = `${this.client.baseUrl}/person/popular?include_adult=false&page=${page}`;
                const data = await this.client.tmdb(url);
                const results = data?.results ?? [];

                if (!results.length) break;

                const cleanPage = this.filterService.filterPeopleList(results);

                for (const p of cleanPage) {
                    if (!p || typeof p.id !== 'number') continue;
                    if (seenIds.has(p.id)) continue;
                    seenIds.add(p.id);
                    collectedRaw.push(p);
                    if (collectedRaw.length >= limit) break;
                }

                const totalPages = data?.total_pages ?? 0;
                if (totalPages && page >= totalPages) break;
            }

            const people: TmdbPerson[] = collectedRaw.map((m: any) => ({
                id: m.id,
                name: m.name ?? 'Unknown',
                known_for_department: m.known_for_department,
                profile_path: m.profile_path ?? null,
                popularity: m.popularity ?? 0,
                known_for: (m.known_for ?? []).map((kf: any) => ({
                    id: kf.id,
                    title: kf.title,
                    name: kf.name,
                    media_type: kf.media_type,
                    poster_path: kf.poster_path ?? null,
                    overview: kf.overview,
                })),
            }));

            return shuffleArray(people.slice(0, Math.max(0, limit)));
        } catch (err) {
            this.logger.error('Failed to fetch people', err as any);
            return [];
        }
    }
}