import { Injectable, Logger } from '@nestjs/common';
import { TmdbClientService } from '../client/tmdb-client.service';
import { TrendingTerm } from '../types/tmdb.types';

@Injectable()
export class SearchService {
    private readonly logger = new Logger(SearchService.name);

    constructor(private readonly client: TmdbClientService) { }

    async getSearchSuggestions(query: string, limit: number = 6) {
        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty suggestions');
            return [];
        }

        try {
            const [moviesData, tvData] = await Promise.all([
                this.client.tmdb(`${this.client.baseUrl}/search/movie?language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`),
                this.client.tmdb(`${this.client.baseUrl}/search/tv?language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`)
            ]);

            const movies = moviesData?.results ?? [];
            const tvShows = tvData?.results ?? [];

            const combined = [
                ...movies.map(item => ({
                    id: item.id,
                    title: item.title ?? 'Untitled',
                    type: 'movie' as const,
                    year: item.release_date ? new Date(item.release_date).getFullYear() : null,
                    poster_path: item.poster_path ?? null,
                    popularity: item.popularity ?? 0,
                    vote_average: item.vote_average ?? 0,
                })),
                ...tvShows.map(item => ({
                    id: item.id,
                    title: item.name ?? 'Untitled',
                    type: 'tv' as const,
                    year: item.first_air_date ? new Date(item.first_air_date).getFullYear() : null,
                    poster_path: item.poster_path ?? null,
                    popularity: item.popularity ?? 0,
                    vote_average: item.vote_average ?? 0,
                })),
            ];

            return combined
                .filter(item => item.poster_path)
                .sort((a, b) => {
                    const popDiff = b.popularity - a.popularity;
                    if (Math.abs(popDiff) > 10) return popDiff;
                    return b.vote_average - a.vote_average;
                })
                .slice(0, limit);
        } catch (err) {
            this.logger.error(`Failed to fetch search suggestions for "${query}"`, err as any);
            return [];
        }
    }

    async getTrendingSearchTerms(): Promise<TrendingTerm[]> {
        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning fallback search terms');
            return this.getFallbackSearchTerms();
        }

        try {
            const trendingData = await this.client.tmdb(`${this.client.baseUrl}/trending/all/week?language=en-US&page=1`);
            const results = Array.isArray(trendingData?.results) ? trendingData.results : [];

            const seen = new Set<number>();
            const terms: TrendingTerm[] = results
                .map((item: any) => {
                    const id = Number(item?.id) || 0;
                    const title = item?.title ?? item?.name ?? null;
                    const media_type = item?.media_type ?? (item?.title ? 'movies' : item?.name ? 'tv' : 'unknown');
                    if (!id || !title) return null;
                    return { id, title: String(title), media_type };
                })
                .filter(Boolean)
                .filter((t: TrendingTerm) => {
                    if (seen.has(t.id)) return false;
                    seen.add(t.id);
                    return true;
                })
                .slice(0, 9);

            return terms.length === 0 ? this.getFallbackSearchTerms() : terms;
        } catch (err) {
            this.logger.error('Failed to fetch trending search terms', err as any);
            return this.getFallbackSearchTerms();
        }
    }

    private getFallbackSearchTerms(): TrendingTerm[] {
        return [
            { id: 0, title: 'Avengers', media_type: 'movie' },
            { id: 0, title: 'Stranger Things', media_type: 'tv' },
            { id: 0, title: 'Batman', media_type: 'movie' },
        ];
    }
}