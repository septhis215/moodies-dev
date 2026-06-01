// search/search.service.ts
import { HttpException, HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TMDBService } from 'src/external-apis/services/tmdb.service';

export interface SearchFilters {
    query: string;
    page?: number;
    type?: 'all' | 'movie' | 'tv' | 'person';
    sort?: 'relevance' | 'rating' | 'date' | 'popularity';
    year_min?: number;
    year_max?: number;
    rating_min?: number;
    rating_max?: number;
    genres?: string;
    countries?: string;
    include_adult?: boolean;
    regex_search?: boolean;
}

@Injectable()
export class SearchService implements OnModuleInit {
    private readonly logger = new Logger(SearchService.name);
    private readonly token: string;
    private genreMap: Record<number, string> = {};
    private genreIdMap: Record<string, number> = {};
    private countryMap: Record<string, string> = {};

    private readonly countryList = [
        { code: 'US', name: 'United States' },
        { code: 'GB', name: 'United Kingdom' },
        { code: 'CA', name: 'Canada' },
        { code: 'AU', name: 'Australia' },
        { code: 'FR', name: 'France' },
        { code: 'DE', name: 'Germany' },
        { code: 'IT', name: 'Italy' },
        { code: 'ES', name: 'Spain' },
        { code: 'JP', name: 'Japan' },
        { code: 'KR', name: 'South Korea' },
        { code: 'CN', name: 'China' },
        { code: 'IN', name: 'India' },
        { code: 'BR', name: 'Brazil' },
        { code: 'MX', name: 'Mexico' },
        { code: 'RU', name: 'Russia' },
        { code: 'NL', name: 'Netherlands' },
        { code: 'SE', name: 'Sweden' },
        { code: 'NO', name: 'Norway' },
        { code: 'DK', name: 'Denmark' },
        { code: 'FI', name: 'Finland' },
        { code: 'BE', name: 'Belgium' },
        { code: 'AT', name: 'Austria' },
        { code: 'CH', name: 'Switzerland' },
        { code: 'PL', name: 'Poland' },
        { code: 'CZ', name: 'Czech Republic' },
        { code: 'HU', name: 'Hungary' },
        { code: 'GR', name: 'Greece' },
        { code: 'PT', name: 'Portugal' },
        { code: 'IE', name: 'Ireland' },
        { code: 'NZ', name: 'New Zealand' },
        { code: 'ZA', name: 'South Africa' },
        { code: 'AR', name: 'Argentina' },
        { code: 'CL', name: 'Chile' },
        { code: 'CO', name: 'Colombia' },
        { code: 'PE', name: 'Peru' },
        { code: 'VE', name: 'Venezuela' },
        { code: 'TH', name: 'Thailand' },
        { code: 'MY', name: 'Malaysia' },
        { code: 'SG', name: 'Singapore' },
        { code: 'ID', name: 'Indonesia' },
        { code: 'PH', name: 'Philippines' },
        { code: 'VN', name: 'Vietnam' },
        { code: 'TW', name: 'Taiwan' },
        { code: 'HK', name: 'Hong Kong' },
        { code: 'TR', name: 'Turkey' },
        { code: 'EG', name: 'Egypt' },
        { code: 'IL', name: 'Israel' },
        { code: 'AE', name: 'UAE' },
        { code: 'SA', name: 'Saudi Arabia' }
    ];

    constructor(
        private readonly tmdbService: TMDBService,
        private readonly configService: ConfigService,
    ) {
        // Kept only as a "is TMDB configured?" guard for internal checks.
        this.token = this.configService.get<string>('TMDB_API_KEY') ?? '';
    }

    private async tmdb(endpoint: string, params?: any) {
        return this.tmdbService.request(endpoint, { params });
    }

    private normalizeResult(m: any, type?: 'movie' | 'tv' | 'person') {
        // Use media_type from result if type not provided
        const mediaType = type || m.media_type;

        if (mediaType === 'person') {
            return {
                id: m.id,
                name: m.name ?? 'Unknown',
                title: m.name ?? 'Unknown',
                profile_path: m.profile_path ?? null,
                known_for_department: m.known_for_department ?? 'Acting',
                popularity: m.popularity || 0,
                known_for: m.known_for?.slice(0, 3).map((item: any) => ({
                    id: item.id,
                    title: item.title ?? item.name ?? 'Untitled',
                    media_type: item.media_type,
                    poster_path: item.poster_path,
                })) ?? [],
                type: 'person',
                media_type: 'person',
                adult: m.adult || false,
            };
        }

        return {
            id: m.id,
            title: m.title ?? m.name ?? 'Untitled',
            overview: m.overview ?? '',
            poster_path: m.poster_path ?? null,
            backdrop_path: m.backdrop_path ?? null,
            release_date: m.release_date ?? m.first_air_date ?? null,
            first_air_date: m.first_air_date ?? null,
            vote_average: m.vote_average || 0,
            vote_count: m.vote_count || 0,
            popularity: m.popularity || 0,
            origin_country:
                m.origin_country ??
                m.production_countries?.map((c: any) => c.iso_3166_1) ??
                [],
            genres:
                m.genre_ids?.map((id: number) => this.genreMap[id]).filter(Boolean) ??
                m.genres?.map((g: any) => g.name) ?? [],
            genre_ids: m.genre_ids ?? m.genres?.map((g: any) => g.id) ?? [],
            type: mediaType === 'tv' ? 'tv' : 'movie',
            media_type: mediaType === 'tv' ? 'tv' : 'movie',
            adult: m.adult || false,
            video: m.video || false,
            recommendations: [],
        };
    }

    private createSearchRegex(query: string, isRegexSearch: boolean): RegExp | null {
        if (!isRegexSearch) {
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(escapedQuery, 'i');
        }

        try {
            return new RegExp(query, 'i');
        } catch (error) {
            this.logger.warn(`Invalid regex pattern: ${query}, falling back to literal search`);
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(escapedQuery, 'i');
        }
    }

    private matchesSearchPattern(text: string, searchRegex: RegExp): boolean {
        if (!text || !searchRegex) return false;
        return searchRegex.test(text);
    }

    async loadGenres() {
        if (!this.token) {
            this.logger.warn('TMDB token not set; skipping loadGenres');
            return;
        }

        try {
            const endpoints = ['/genre/movie/list', '/genre/tv/list'];
            for (const ep of endpoints) {
                const data = await this.tmdb(ep);
                const genres = data?.genres ?? [];
                for (const g of genres) {
                    this.genreMap[g.id] = g.name;
                    this.genreIdMap[g.name] = g.id;
                }
            }
            this.logger.log(`Loaded genres: ${Object.keys(this.genreMap).length}`);
        } catch (err) {
            this.logger.error('Failed to load genres', err as any);
        }
    }

    async loadCountries() {
        try {
            for (const country of this.countryList) {
                this.countryMap[country.code] = country.name;
            }
            this.logger.log(`Loaded countries: ${Object.keys(this.countryMap).length}`);
        } catch (err) {
            this.logger.error('Failed to load countries', err as any);
        }
    }

    async onModuleInit() {
        await Promise.all([
            this.loadGenres(),
            this.loadCountries()
        ]);
    }

    private buildTMDBParams(filters: SearchFilters, mediaType: 'movie' | 'tv' | 'person') {
        const params: any = {
            language: 'en-US',
            include_adult: filters.include_adult || false,
            page: filters.page || 1,
        };

        if (!filters.regex_search) {
            params.query = filters.query;
        }

        if (mediaType === 'person') {
            return params;
        }

        if (filters.year_min || filters.year_max) {
            if (mediaType === 'movie') {
                if (filters.year_min) params['primary_release_date.gte'] = `${filters.year_min}-01-01`;
                if (filters.year_max) params['primary_release_date.lte'] = `${filters.year_max}-12-31`;
            } else {
                if (filters.year_min) params['first_air_date.gte'] = `${filters.year_min}-01-01`;
                if (filters.year_max) params['first_air_date.lte'] = `${filters.year_max}-12-31`;
            }
        }

        if (filters.genres) {
            const genreNames = filters.genres.split(',');
            const genreIds = genreNames
                .map(name => this.genreIdMap[name.trim()])
                .filter(id => id !== undefined);

            if (genreIds.length > 0) {
                params.with_genres = genreIds.join(',');
            }
        }

        if (filters.countries) {
            const countryCodes = filters.countries.split(',').map(c => c.trim());
            if (countryCodes.length > 0) {
                params.with_origin_country = countryCodes.join('|');
            }
        }

        if (filters.rating_min !== undefined) {
            params['vote_average.gte'] = filters.rating_min;
        }
        if (filters.rating_max !== undefined) {
            params['vote_average.lte'] = filters.rating_max;
        }

        return params;
    }

    private findBestMatch(results: any[], query: string, searchRegex: RegExp | null): any | null {
        if (results.length === 0) return null;

        const scoredResults = results.map(item => {
            let score = 0;
            const title = item.title || item.name || '';
            const overview = item.overview || '';

            if (title.toLowerCase() === query.toLowerCase()) {
                score += 100;
            } else if (title.toLowerCase().startsWith(query.toLowerCase())) {
                score += 80;
            } else if (searchRegex && this.matchesSearchPattern(title, searchRegex)) {
                score += 60;
            } else if (searchRegex && this.matchesSearchPattern(overview, searchRegex)) {
                score += 30;
            }

            score += (item.popularity || 0) * 0.1;

            if (item.type === 'person' || item.media_type === 'person') {
                score += (item.popularity || 0) * 0.5;
            } else {
                score += (item.vote_average || 0) * 2;
                score += Math.log((item.vote_count || 1) + 1) * 5;

                const releaseDate = item.release_date || item.first_air_date;
                if (releaseDate) {
                    const releaseYear = new Date(releaseDate).getFullYear();
                    const currentYear = new Date().getFullYear();
                    const yearDiff = currentYear - releaseYear;
                    if (yearDiff <= 5) {
                        score += (5 - yearDiff) * 2;
                    }
                }
            }

            return { ...item, searchScore: score };
        });

        return scoredResults.sort((a, b) => b.searchScore - a.searchScore)[0];
    }

    async search(filters: SearchFilters) {
        const { query, page = 1, type = 'all', regex_search = false } = filters;
        const safePage = Math.min(page, 25);

        if (page > 25) {
            return {
                page: 25,
                total_results: 500,
                total_pages: 25,
                results: [],
                best_match: null,
                applied_filters: filters,
            };
        }

        if (!query?.trim()) {
            throw new HttpException('Query cannot be empty', HttpStatus.BAD_REQUEST);
        }

        try {
            let results: any[] = [];
            let totalResults = 0;
            const totalPages = 25;

            const searchRegex = this.createSearchRegex(query, regex_search);
            const searchQuery = regex_search ? '' : query;

            // Use /search/multi for 'all' type to get movies, TV shows, and people in one request
            if (type === 'all') {
                const multiParams = {
                    query: searchQuery || query,
                    language: 'en-US',
                    include_adult: filters.include_adult || false,
                    page: safePage,
                };

                const multiRes = await this.tmdb('/search/multi', multiParams);

                totalResults = Math.min(multiRes.total_results || 0, 500);

                // Normalize all results based on their media_type
                results = multiRes.results
                    .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv' || item.media_type === 'person')
                    .map((item: any) => this.normalizeResult(item));

                if (regex_search && searchRegex) {
                    results = results.filter((item: any) => {
                        const text = item.title || item.name || '';
                        const overview = item.overview || '';
                        return this.matchesSearchPattern(text, searchRegex) ||
                            this.matchesSearchPattern(overview, searchRegex);
                    });
                }
            }
            // Specific type searches
            else if (type === 'movie') {
                const movieParams = this.buildTMDBParams(filters, 'movie');
                const movieEndpoint = filters.year_min || filters.year_max || filters.rating_min ||
                    filters.rating_max || filters.genres || filters.countries
                    ? '/discover/movie'
                    : '/search/movie';

                const finalMovieParams = movieEndpoint === '/search/movie' ? {
                    query: searchQuery || query,
                    language: 'en-US',
                    include_adult: filters.include_adult || false,
                    page: safePage,
                } : movieParams;

                const movieRes = await this.tmdb(movieEndpoint, finalMovieParams);

                totalResults = Math.min(movieRes.total_results || 0, 500);
                results = movieRes.results.map((m: any) => this.normalizeResult(m, 'movie'));

                if (regex_search && searchRegex) {
                    results = results.filter((movie: any) =>
                        this.matchesSearchPattern(movie.title, searchRegex) ||
                        this.matchesSearchPattern(movie.overview, searchRegex)
                    );
                }
            }
            else if (type === 'tv') {
                const tvParams = this.buildTMDBParams(filters, 'tv');
                const tvEndpoint = filters.year_min || filters.year_max || filters.rating_min ||
                    filters.rating_max || filters.genres || filters.countries
                    ? '/discover/tv'
                    : '/search/tv';

                const finalTvParams = tvEndpoint === '/search/tv' ? {
                    query: searchQuery || query,
                    language: 'en-US',
                    include_adult: filters.include_adult || false,
                    page: safePage,
                } : tvParams;

                const tvRes = await this.tmdb(tvEndpoint, finalTvParams);

                totalResults = Math.min(tvRes.total_results || 0, 500);
                results = tvRes.results.map((t: any) => this.normalizeResult(t, 'tv'));

                if (regex_search && searchRegex) {
                    results = results.filter((show: any) =>
                        this.matchesSearchPattern(show.title, searchRegex) ||
                        this.matchesSearchPattern(show.overview, searchRegex)
                    );
                }
            }
            else if (type === 'person') {
                const personParams = {
                    query: searchQuery || query,
                    language: 'en-US',
                    include_adult: filters.include_adult || false,
                    page: safePage,
                };

                const personRes = await this.tmdb('/search/person', personParams);

                totalResults = Math.min(personRes.total_results || 0, 500);
                results = personRes.results.map((p: any) => this.normalizeResult(p, 'person'));

                if (regex_search && searchRegex) {
                    results = results.filter((person: any) =>
                        this.matchesSearchPattern(person.name, searchRegex)
                    );
                }
            }

            results = this.applyClientSideFilters(results, filters, searchRegex);

            let bestMatch = this.findBestMatch(results, query, searchRegex);

            if (bestMatch && bestMatch.type !== 'person' && bestMatch.media_type !== 'person') {
                const trailerKey = await this.fetchTrailer(bestMatch.id, bestMatch.type);
                bestMatch.trailer_key = trailerKey;
            }

            results = this.sortResults(results, filters.sort || 'relevance');

            return {
                page,
                total_results: totalResults,
                total_pages: totalPages,
                results: results.slice(0, 20),
                best_match: bestMatch,
                applied_filters: {
                    type: filters.type,
                    sort: filters.sort,
                    year_range: filters.year_min || filters.year_max ? {
                        min: filters.year_min,
                        max: filters.year_max
                    } : null,
                    rating_range: filters.rating_min || filters.rating_max ? {
                        min: filters.rating_min,
                        max: filters.rating_max
                    } : null,
                    genres: filters.genres ? filters.genres.split(',') : null,
                    countries: filters.countries ? filters.countries.split(',') : null,
                    regex_search: filters.regex_search,
                },
            };
        } catch (error) {
            this.logger.error('TMDB search error:', error.response?.data || error.message);
            throw new HttpException(
                'Failed to fetch data from TMDB',
                HttpStatus.BAD_GATEWAY,
            );
        }
    }

    private async fetchTrailer(id: number, type: 'movie' | 'tv'): Promise<string | null> {
        try {
            const res = await this.tmdb(`/${type}/${id}/videos`, { language: 'en-US' });

            if (res?.results?.length > 0) {
                const trailer = res.results.find(
                    (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
                );
                return trailer ? trailer.key : null;
            }
            return null;
        } catch (err) {
            this.logger.warn(`No trailer found for ${type} ${id}`);
            return null;
        }
    }

    private applyClientSideFilters(results: any[], filters: SearchFilters, searchRegex: RegExp | null) {
        return results.filter(item => {
            if (filters.regex_search && searchRegex) {
                const matchesTitle = this.matchesSearchPattern(item.title || item.name, searchRegex);
                const matchesOverview = this.matchesSearchPattern(item.overview, searchRegex);
                if (!matchesTitle && !matchesOverview) return false;
            }

            if (item.type === 'person' || item.media_type === 'person') return true;

            if (filters.year_min || filters.year_max) {
                const releaseDate = item.release_date || item.first_air_date;
                if (releaseDate) {
                    const year = new Date(releaseDate).getFullYear();
                    if (filters.year_min && year < filters.year_min) return false;
                    if (filters.year_max && year > filters.year_max) return false;
                }
            }

            if (filters.rating_min !== undefined && item.vote_average < filters.rating_min) return false;
            if (filters.rating_max !== undefined && item.vote_average > filters.rating_max) return false;

            if (filters.genres) {
                const requiredGenres = filters.genres.split(',').map(g => g.trim());
                const itemGenres = item.genres || [];
                const hasRequiredGenre = requiredGenres.some(genre =>
                    itemGenres.includes(genre)
                );
                if (!hasRequiredGenre) return false;
            }

            if (filters.countries) {
                const requiredCountries = filters.countries.split(',').map(c => c.trim());
                const itemCountries = item.origin_country || [];
                const hasRequiredCountry = requiredCountries.some(country =>
                    itemCountries.includes(country)
                );
                if (!hasRequiredCountry) return false;
            }

            return true;
        });
    }

    private sortResults(results: any[], sortBy: string) {
        return results.sort((a, b) => {
            const isAPerson = a.type === 'person' || a.media_type === 'person';
            const isBPerson = b.type === 'person' || b.media_type === 'person';

            switch (sortBy) {
                case 'rating':
                    if (isAPerson || isBPerson) {
                        return b.popularity - a.popularity;
                    }
                    if (b.vote_average !== a.vote_average) {
                        return b.vote_average - a.vote_average;
                    }
                    return b.vote_count - a.vote_count;

                case 'date':
                    if (isAPerson && !isBPerson) return 1;
                    if (isBPerson && !isAPerson) return -1;
                    if (isAPerson && isBPerson) return b.popularity - a.popularity;

                    const dateA = new Date(a.release_date || a.first_air_date || 0);
                    const dateB = new Date(b.release_date || b.first_air_date || 0);
                    return dateB.getTime() - dateA.getTime();

                case 'popularity':
                    return b.popularity - a.popularity;

                case 'relevance':
                default:
                    if (a.searchScore !== undefined && b.searchScore !== undefined) {
                        return b.searchScore - a.searchScore;
                    }
                    const scoreA = isAPerson
                        ? a.popularity
                        : (a.popularity * 0.7) + (a.vote_count * 0.3);
                    const scoreB = isBPerson
                        ? b.popularity
                        : (b.popularity * 0.7) + (b.vote_count * 0.3);
                    return scoreB - scoreA;
            }
        });
    }

    async getPersonSuggestions(
        query: string,
        limit: number = 5,
        regexSearch: boolean = false
    ) {
        if (!query?.trim()) return [];

        try {
            const searchRegex = regexSearch
                ? this.createSearchRegex(query, true)
                : null;

            const response = await this.tmdb('/search/person', {
                query,
                language: 'en-US',
                include_adult: false,
            });

            let suggestions = (response?.results ?? [])
                .slice(0, limit * 2)
                .map((item: any) => ({
                    id: item.id,
                    title: item.name,
                    name: item.name,
                    type: 'person',
                    poster_path: item.profile_path || null,
                    profile_path: item.profile_path || null,
                    known_for_department: item.known_for_department,
                    popularity: item.popularity,
                }));

            if (regexSearch && searchRegex) {
                suggestions = suggestions.filter(s =>
                    this.matchesSearchPattern(s.name, searchRegex)
                );
            }

            return suggestions
                .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
                .slice(0, limit);

        } catch (error) {
            this.logger.error('Person suggestions failed', error);
            return [];
        }
    }

    async getContentSuggestions(
        query: string,
        limit: number = 5,
        regexSearch: boolean = false
    ) {
        if (!query?.trim()) return [];

        try {
            const searchRegex = regexSearch
                ? this.createSearchRegex(query, true)
                : null;

            const response = await this.tmdb('/search/multi', {
                query,
                language: 'en-US',
                include_adult: false,
            });

            let suggestions = (response?.results ?? [])
                .filter(
                    (item: any) =>
                        item.media_type === 'movie' || item.media_type === 'tv'
                )
                .slice(0, limit * 2)
                .map((item: any) => ({
                    id: item.id,
                    title: item.media_type === 'tv' ? item.name : item.title,
                    type: item.media_type,
                    year:
                        item.media_type === 'tv'
                            ? item.first_air_date
                                ? new Date(item.first_air_date).getFullYear()
                                : null
                            : item.release_date
                                ? new Date(item.release_date).getFullYear()
                                : null,
                    poster_path: item.poster_path || null,
                    vote_average: item.vote_average,
                    popularity: item.popularity,
                }));

            if (regexSearch && searchRegex) {
                suggestions = suggestions.filter(s =>
                    this.matchesSearchPattern(s.title, searchRegex)
                );
            }

            return suggestions
                .sort(
                    (a, b) =>
                        ((b.popularity || 0) * 0.7 + (b.vote_average || 0) * 0.3) -
                        ((a.popularity || 0) * 0.7 + (a.vote_average || 0) * 0.3)
                )
                .slice(0, limit);

        } catch (error) {
            this.logger.error('Content suggestions failed', error);
            return [];
        }
    }

    getAvailableGenres() {
        return Object.values(this.genreMap).sort();
    }

    getAvailableCountries() {
        return this.countryList.sort((a, b) => a.name.localeCompare(b.name));
    }
}