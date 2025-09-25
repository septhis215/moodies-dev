// search/search.service.ts
import { HttpException, HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import axios from 'axios';

export interface SearchFilters {
    query: string;
    page?: number;
    type?: 'all' | 'movie' | 'tv';
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
    private readonly baseUrl: string;
    private readonly token: string;
    private genreMap: Record<number, string> = {};
    private genreIdMap: Record<string, number> = {}; // Reverse mapping
    private countryMap: Record<string, string> = {};
    private readonly tmdbBaseUrl = 'https://api.themoviedb.org/3';
    private readonly apiKey = process.env.TMDB_API_KEY;

    // Comprehensive country mapping
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
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.baseUrl =
            this.configService.get<string>('TMDB_BASE') ??
            'https://api.themoviedb.org/3';
        this.token = this.configService.get<string>('TMDB_API_KEY') ?? '';
    }

    // Generic helper: returns response.data (not only results)
    private async tmdb(endpoint: string, params?: any) {
        const normalizedEndpoint = endpoint.startsWith('http')
            ? endpoint
            : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

        const response = await firstValueFrom(
            this.httpService.get(normalizedEndpoint, {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    Accept: 'application/json',
                },
                params,
            }),
        );

        return response.data;
    }

    private normalizeResult(m: any, type: 'movie' | 'tv') {
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
            type,
            adult: m.adult || false,
            video: m.video || false,
            recommendations: [],
        };
    }

    // Enhanced regex and case-insensitive search
    private createSearchRegex(query: string, isRegexSearch: boolean): RegExp | null {
        if (!isRegexSearch) {
            // Case-insensitive search with word boundaries and partial matches
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(escapedQuery, 'i');
        }

        try {
            // If regex search is enabled, try to create a regex pattern
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
            // Initialize country mapping
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

    private buildTMDBParams(filters: SearchFilters, mediaType: 'movie' | 'tv') {
        const params: any = {
            language: 'en-US',
            include_adult: filters.include_adult || false,
            page: filters.page || 1,
        };

        // For regex/case-insensitive search, we'll handle filtering client-side
        if (!filters.regex_search) {
            params.query = filters.query;
        }

        // Year filtering
        if (filters.year_min || filters.year_max) {
            if (mediaType === 'movie') {
                if (filters.year_min) params['primary_release_date.gte'] = `${filters.year_min}-01-01`;
                if (filters.year_max) params['primary_release_date.lte'] = `${filters.year_max}-12-31`;
            } else {
                if (filters.year_min) params['first_air_date.gte'] = `${filters.year_min}-01-01`;
                if (filters.year_max) params['first_air_date.lte'] = `${filters.year_max}-12-31`;
            }
        }

        // Genre filtering
        if (filters.genres) {
            const genreNames = filters.genres.split(',');
            const genreIds = genreNames
                .map(name => this.genreIdMap[name.trim()])
                .filter(id => id !== undefined);

            if (genreIds.length > 0) {
                params.with_genres = genreIds.join(',');
            }
        }

        // Country filtering
        if (filters.countries) {
            const countryCodes = filters.countries.split(',').map(c => c.trim());
            if (countryCodes.length > 0) {
                params.with_origin_country = countryCodes.join('|');
            }
        }

        // Rating filtering
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

        // Score each result based on multiple factors
        const scoredResults = results.map(item => {
            let score = 0;
            const title = item.title || item.name || '';
            const overview = item.overview || '';

            // Exact title match gets highest score
            if (title.toLowerCase() === query.toLowerCase()) {
                score += 100;
            }
            // Title starts with query
            else if (title.toLowerCase().startsWith(query.toLowerCase())) {
                score += 80;
            }
            // Title contains query
            else if (searchRegex && this.matchesSearchPattern(title, searchRegex)) {
                score += 60;
            }
            // Overview contains query
            else if (searchRegex && this.matchesSearchPattern(overview, searchRegex)) {
                score += 30;
            }

            // Boost score based on popularity and rating
            score += (item.popularity || 0) * 0.1;
            score += (item.vote_average || 0) * 2;
            score += Math.log((item.vote_count || 1) + 1) * 5;

            // Boost for recent releases
            const releaseDate = item.release_date || item.first_air_date;
            if (releaseDate) {
                const releaseYear = new Date(releaseDate).getFullYear();
                const currentYear = new Date().getFullYear();
                const yearDiff = currentYear - releaseYear;
                if (yearDiff <= 5) {
                    score += (5 - yearDiff) * 2;
                }
            }

            return { ...item, searchScore: score };
        });

        // Return the highest scoring item
        return scoredResults.sort((a, b) => b.searchScore - a.searchScore)[0];
    }

    async search(filters: SearchFilters) {
        const { query, page = 1, type = 'all', regex_search = false } = filters;
        // clamp the requested page
        const safePage = Math.min(page, 25);

        // if user asks beyond page 25, just return an empty result set
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

            // Create search pattern for enhanced matching
            const searchRegex = this.createSearchRegex(query, regex_search);

            // For regex/case-insensitive search, we need to cast a wider net
            const searchQuery = regex_search ? '' : query;

            if (type === 'all' || type === 'movie') {
                const movieParams = this.buildTMDBParams(filters, 'movie');
                const movieEndpoint = filters.year_min || filters.year_max || filters.rating_min ||
                    filters.rating_max || filters.genres || filters.countries
                    ? '/discover/movie'
                    : '/search/movie';

                // Use different params based on endpoint
                const finalMovieParams = movieEndpoint === '/search/movie' ? {
                    query: searchQuery || query,
                    language: 'en-US',
                    include_adult: filters.include_adult || false,
                    page,
                } : movieParams;

                const movieRes = await axios.get(`${this.tmdbBaseUrl}${movieEndpoint}`, {
                    params: { ...finalMovieParams, page: safePage },
                    headers: { Authorization: `Bearer ${this.apiKey}` }
                });
                let movieTotalResults = Math.min(movieRes.data.total_results || 0, 500);
                let movieTotalPages = Math.min(movieRes.data.total_pages || 0, 25);
                let movies = movieRes.data.results.map((m: any) =>
                    this.normalizeResult(m, 'movie')
                );

                // Apply regex/case-insensitive filtering if needed
                if (regex_search && searchRegex) {
                    movies = movies.filter((movie: any) =>
                        this.matchesSearchPattern(movie.title, searchRegex) ||
                        this.matchesSearchPattern(movie.overview, searchRegex)
                    );
                }

                results.push(...movies);
                totalResults = Math.min(totalResults + movieTotalResults, 500);

            }

            if (type === 'all' || type === 'tv') {
                const tvParams = this.buildTMDBParams(filters, 'tv');
                const tvEndpoint = filters.year_min || filters.year_max || filters.rating_min ||
                    filters.rating_max || filters.genres || filters.countries
                    ? '/discover/tv'
                    : '/search/tv';

                const finalTvParams = tvEndpoint === '/search/tv' ? {
                    query: searchQuery || query,
                    language: 'en-US',
                    include_adult: filters.include_adult || false,
                    page,
                } : tvParams;

                const tvRes = await axios.get(`${this.tmdbBaseUrl}${tvEndpoint}`, {
                    params: { ...finalTvParams, page: safePage },
                    headers: { Authorization: `Bearer ${this.apiKey}` }
                });
                let tvTotalResults = Math.min(tvRes.data.total_results || 0, 500);
                let tvTotalPages = Math.min(tvRes.data.total_pages || 0, 25);
                let tvShows = tvRes.data.results.map((m: any) =>
                    this.normalizeResult(m, 'tv')
                );

                // Apply regex/case-insensitive filtering if needed
                if (regex_search && searchRegex) {
                    tvShows = tvShows.filter((show: any) =>
                        this.matchesSearchPattern(show.title, searchRegex) ||
                        this.matchesSearchPattern(show.overview, searchRegex)
                    );
                }

                results.push(...tvShows);
                totalResults = Math.min(totalResults + tvTotalResults, 500);

            }

            // Apply additional client-side filtering for more precise results
            results = this.applyClientSideFilters(results, filters, searchRegex);

            // Find best match before sorting
            let bestMatch = this.findBestMatch(results, query, searchRegex);

            // If bestMatch exists, fetch trailer
            if (bestMatch) {
                const trailerKey = await this.fetchTrailer(bestMatch.id, bestMatch.type);
                bestMatch.trailer_key = trailerKey; // Add trailer_key property
            }

            // Sort results based on the sort parameter
            results = this.sortResults(results, filters.sort || 'relevance');

            return {
                page,
                total_results: totalResults,
                total_pages: totalPages,
                results: results.slice(0, 20), // Limit to 20 results per page
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
            const res = await axios.get(`${this.tmdbBaseUrl}/${type}/${id}/videos`, {
                params: { language: 'en-US' },
                headers: { Authorization: `Bearer ${this.apiKey}` }
            });

            if (res.data?.results?.length > 0) {
                // Prefer YouTube trailers
                const trailer = res.data.results.find(
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
            // Enhanced text matching for regex/case-insensitive search
            if (filters.regex_search && searchRegex) {
                const matchesTitle = this.matchesSearchPattern(item.title, searchRegex);
                const matchesOverview = this.matchesSearchPattern(item.overview, searchRegex);
                if (!matchesTitle && !matchesOverview) return false;
            }

            // Year filtering (client-side refinement)
            if (filters.year_min || filters.year_max) {
                const releaseDate = item.release_date || item.first_air_date;
                if (releaseDate) {
                    const year = new Date(releaseDate).getFullYear();
                    if (filters.year_min && year < filters.year_min) return false;
                    if (filters.year_max && year > filters.year_max) return false;
                }
            }

            // Rating filtering (client-side refinement)
            if (filters.rating_min !== undefined && item.vote_average < filters.rating_min) return false;
            if (filters.rating_max !== undefined && item.vote_average > filters.rating_max) return false;

            // Genre filtering (client-side refinement)
            if (filters.genres) {
                const requiredGenres = filters.genres.split(',').map(g => g.trim());
                const itemGenres = item.genres || [];
                const hasRequiredGenre = requiredGenres.some(genre =>
                    itemGenres.includes(genre)
                );
                if (!hasRequiredGenre) return false;
            }

            // Country filtering (client-side refinement)
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
            switch (sortBy) {
                case 'rating':
                    if (b.vote_average !== a.vote_average) {
                        return b.vote_average - a.vote_average;
                    }
                    return b.vote_count - a.vote_count;

                case 'date':
                    const dateA = new Date(a.release_date || a.first_air_date || 0);
                    const dateB = new Date(b.release_date || b.first_air_date || 0);
                    return dateB.getTime() - dateA.getTime();

                case 'popularity':
                    return b.popularity - a.popularity;

                case 'relevance':
                default:
                    // Use search score if available, otherwise use popularity and vote count
                    if (a.searchScore !== undefined && b.searchScore !== undefined) {
                        return b.searchScore - a.searchScore;
                    }
                    const scoreA = (a.popularity * 0.7) + (a.vote_count * 0.3);
                    const scoreB = (b.popularity * 0.7) + (b.vote_count * 0.3);
                    return scoreB - scoreA;
            }
        });
    }

    // Enhanced method for autocomplete/suggestions with regex support
    async getSearchSuggestions(query: string, limit: number = 5, regexSearch: boolean = false) {
        if (!query?.trim()) return [];

        try {
            const searchRegex = regexSearch ? this.createSearchRegex(query, true) : null;

            const [movieRes, tvRes] = await Promise.all([
                axios.get(`${this.tmdbBaseUrl}/search/movie`, {
                    params: {
                        query: regexSearch ? '' : query,
                        language: 'en-US',
                        include_adult: false,
                        page: 1,
                    },
                    headers: { Authorization: `Bearer ${this.apiKey}` }
                }),
                axios.get(`${this.tmdbBaseUrl}/search/tv`, {
                    params: {
                        query: regexSearch ? '' : query,
                        language: 'en-US',
                        include_adult: false,
                        page: 1,
                    },
                    headers: { Authorization: `Bearer ${this.apiKey}` }
                }),
            ]);

            let movies = movieRes.data.results.slice(0, limit).map((m: any) => ({
                id: m.id,
                title: m.title,
                type: 'movie',
                year: m.release_date ? new Date(m.release_date).getFullYear() : null,
                poster_path: m.poster_path,
                vote_average: m.vote_average,
                popularity: m.popularity,
            }));

            let tvShows = tvRes.data.results.slice(0, limit).map((m: any) => ({
                id: m.id,
                title: m.name,
                type: 'tv',
                year: m.first_air_date ? new Date(m.first_air_date).getFullYear() : null,
                poster_path: m.poster_path,
                vote_average: m.vote_average,
                popularity: m.popularity,
            }));

            // Apply regex filtering if enabled
            if (regexSearch && searchRegex) {
                movies = movies.filter(m => this.matchesSearchPattern(m.title, searchRegex));
                tvShows = tvShows.filter(m => this.matchesSearchPattern(m.title, searchRegex));
            }

            return [...movies, ...tvShows]
                .sort((a, b) => {
                    // Sort by relevance (popularity + rating)
                    const scoreA = (a.popularity * 0.7) + (a.vote_average * 0.3);
                    const scoreB = (b.popularity * 0.7) + (b.vote_average * 0.3);
                    return scoreB - scoreA;
                })
                .slice(0, limit);

        } catch (error) {
            this.logger.error('Failed to get search suggestions:', error);
            return [];
        }
    }

    // Get available genres
    getAvailableGenres() {
        return Object.values(this.genreMap).sort();
    }

    // Get available countries
    getAvailableCountries() {
        return this.countryList.sort((a, b) => a.name.localeCompare(b.name));
    }
}