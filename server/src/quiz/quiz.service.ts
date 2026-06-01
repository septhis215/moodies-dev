import { Injectable } from '@nestjs/common';
import { TMDBService } from 'src/external-apis/services/tmdb.service';

export interface QuizAnswer {
    genres: string[];
    mood: string;
    mediaType?: string;
}

export interface GenreCount {
    [key: string]: number;
}

export interface TMDBMovie {
    id: number;
    title?: string;
    name?: string;
    poster_path: string;
    backdrop_path: string;
    vote_average: number;
    vote_count: number;
    release_date?: string;
    first_air_date?: string;
    media_type?: string;
    overview: string;
    genre_ids: number[];
    original_language: string;
    popularity: number;
}

export interface RecommendationResult {
    results: TMDBMovie[];
    analysis: {
        topGenres: string[];
        topMoods: string[];
        preferredMediaType: string | null;
        genreIds: number[];
    };
    totalResults: number;
}

@Injectable()
export class QuizRecommendationService {
    private readonly token = process.env.TMDB_API_KEY;
    private readonly MIN_RESULTS = 25;

    constructor(private readonly tmdbService: TMDBService) { }

    // Enhanced genre mapping with TV genre IDs included
    private readonly GENRE_MAPPINGS: { [key: string]: { movie: number[]; tv: number[] } } = {
        action: { movie: [28], tv: [10759] },
        adventure: { movie: [12], tv: [10759] },
        animation: { movie: [16], tv: [16] },
        comedy: { movie: [35], tv: [35] },
        crime: { movie: [80], tv: [80] },
        drama: { movie: [18], tv: [18] },
        family: { movie: [10751], tv: [10751] },
        fantasy: { movie: [14], tv: [10765] },
        horror: { movie: [27], tv: [] },
        mystery: { movie: [9648], tv: [9648] },
        romance: { movie: [10749], tv: [] },
        'sci-fi': { movie: [878], tv: [10765] },
        thriller: { movie: [53], tv: [] },
        documentary: { movie: [99], tv: [99] },
        war: { movie: [10752], tv: [10768] },
        western: { movie: [37], tv: [37] },
    };

    private async tmdb(endpoint: string) {
        return this.tmdbService.request(endpoint);
    }

    async getRecommendations(answers: QuizAnswer[]): Promise<RecommendationResult> {
        // Validate API token
        if (!this.token) {
            console.error('TMDB_API_KEY is not set in environment variables');
            throw new Error('TMDB API key is not configured');
        }

        // Analyze user answers
        const analysis = this.analyzeAnswers(answers);

        console.log('Analysis result:', JSON.stringify(analysis, null, 2));

        // Fetch recommendations from TMDB
        const recommendations = await this.fetchFromTMDB(analysis);

        return {
            results: recommendations,
            analysis,
            totalResults: recommendations.length,
        };
    }

    private analyzeAnswers(answers: QuizAnswer[]) {
        const genreCounts: GenreCount = {};
        const moodCounts: GenreCount = {};
        let preferredMediaType: string | null = null;
        let mediaTypeCount = 0;

        // Count genre and mood occurrences
        answers.forEach((answer) => {
            answer.genres.forEach((genre) => {
                const normalizedGenre = genre.toLowerCase().trim();
                genreCounts[normalizedGenre] = (genreCounts[normalizedGenre] || 0) + 1;
            });

            if (answer.mood) {
                moodCounts[answer.mood] = (moodCounts[answer.mood] || 0) + 1;
            }

            if (answer.mediaType) {
                mediaTypeCount++;
                preferredMediaType = answer.mediaType;
            }
        });

        // Get top 3 genres (or all if less than 3)
        const topGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([genre]) => genre);

        // Get top 2 moods
        const topMoods = Object.entries(moodCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([mood]) => mood);

        // Map genres to TMDB genre IDs based on media type
        const genreIds = this.mapGenresToIds(topGenres, preferredMediaType);

        return {
            topGenres,
            topMoods,
            preferredMediaType,
            genreIds,
        };
    }

    private mapGenresToIds(genres: string[], mediaType: string | null): number[] {
        const ids: number[] = [];

        genres.forEach((genre) => {
            const mapping = this.GENRE_MAPPINGS[genre];
            if (mapping) {
                if (mediaType === 'movie') {
                    ids.push(...mapping.movie);
                } else if (mediaType === 'tv') {
                    ids.push(...mapping.tv);
                } else {
                    // If no preference, include both
                    ids.push(...mapping.movie, ...mapping.tv);
                }
            }
        });

        // Remove duplicates
        return [...new Set(ids)];
    }

    private async fetchFromTMDB(analysis: {
        genreIds: number[];
        preferredMediaType: string | null;
        topGenres: string[];
    }): Promise<TMDBMovie[]> {
        const allResults: TMDBMovie[] = [];
        const uniqueIds = new Set<string>();

        try { 
            // Strategy 1: Fetch with genres if available
            if (analysis.genreIds.length > 0) {
                const genreResults = await this.fetchWithGenres(
                    analysis.genreIds,
                    analysis.preferredMediaType
                );

                genreResults.forEach(item => {
                    const key = `${item.media_type}-${item.id}`;
                    if (!uniqueIds.has(key)) {
                        uniqueIds.add(key);
                        allResults.push(item);
                    }
                });
            }

            console.log(`After genre fetch: ${allResults.length} results`);

            // Strategy 2: If we don't have enough results, fetch popular content
            if (allResults.length < this.MIN_RESULTS) {
                console.log('Fetching popular content to reach minimum...');
                const popularResults = await this.fetchPopularContent(
                    analysis.preferredMediaType,
                    Math.ceil((this.MIN_RESULTS - allResults.length) / 20) + 1
                );

                popularResults.forEach(item => {
                    const key = `${item.media_type}-${item.id}`;
                    if (!uniqueIds.has(key)) {
                        uniqueIds.add(key);
                        allResults.push(item);
                    }
                });
            }

            console.log(`After popular fetch: ${allResults.length} results`);

            // Strategy 3: If still not enough, fetch trending content
            if (allResults.length < this.MIN_RESULTS) {
                console.log('Fetching trending content to reach minimum...');
                const trendingResults = await this.fetchTrendingContent(
                    analysis.preferredMediaType
                );

                trendingResults.forEach(item => {
                    const key = `${item.media_type}-${item.id}`;
                    if (!uniqueIds.has(key)) {
                        uniqueIds.add(key);
                        allResults.push(item);
                    }
                });
            }

            console.log(`Final results count: ${allResults.length}`);

            // Shuffle for variety and return at least MIN_RESULTS
            const shuffled = this.shuffleArray(allResults);
            return shuffled.slice(0, Math.max(this.MIN_RESULTS, shuffled.length));
        } catch (error) {
            console.error('Error fetching from TMDB:', error);
            throw error;
        }
    }

    private async fetchWithGenres(
        genreIds: number[],
        mediaType: string | null
    ): Promise<TMDBMovie[]> {
        const results: TMDBMovie[] = [];
        const genreQuery = genreIds.join('|');
        const pagesToFetch = 5; // Fetch more pages to ensure we have enough

        try {
            // Fetch movies
            if (!mediaType || mediaType === 'movie') {
                for (let page = 1; page <= pagesToFetch; page++) {
                    try {
                        const data = await this.tmdb(
                            `/discover/movie?with_genres=${genreQuery}&sort_by=popularity.desc&vote_count.gte=20&page=${page}&include_adult=false`
                        );

                        if (data.results && data.results.length > 0) {
                            const moviesWithType = data.results.map((movie: any) => ({
                                ...movie,
                                media_type: 'movie',
                            }));
                            results.push(...moviesWithType);
                        }

                        // Small delay to avoid rate limiting
                        await this.delay(100);
                    } catch (error) {
                        console.error(`Movie fetch failed for page ${page}:`, error.message);
                    }
                }
            }

            // Fetch TV shows
            if (!mediaType || mediaType === 'tv') {
                for (let page = 1; page <= pagesToFetch; page++) {
                    try {
                        const data = await this.tmdb(
                            `/discover/tv?with_genres=${genreQuery}&sort_by=popularity.desc&vote_count.gte=20&page=${page}&include_adult=false`
                        );

                        if (data.results && data.results.length > 0) {
                            const tvWithType = data.results.map((tv: any) => ({
                                ...tv,
                                media_type: 'tv',
                            }));
                            results.push(...tvWithType);
                        }

                        await this.delay(100);
                    } catch (error) {
                        console.error(`TV fetch failed for page ${page}:`, error.message);
                    }
                }
            }
        } catch (error) {
            console.error('Error in fetchWithGenres:', error);
        }

        return results;
    }

    private async fetchPopularContent(
        mediaType: string | null,
        pages: number = 3
    ): Promise<TMDBMovie[]> {
        const results: TMDBMovie[] = [];

        try {
            // Fetch popular movies
            if (!mediaType || mediaType === 'movie') {
                for (let page = 1; page <= pages; page++) {
                    try {
                        const data = await this.tmdb(`/movie/popular?page=${page}`);

                        if (data.results) {
                            const moviesWithType = data.results.map((movie: any) => ({
                                ...movie,
                                media_type: 'movie',
                            }));
                            results.push(...moviesWithType);
                        }

                        await this.delay(100);
                    } catch (error) {
                        console.error(`Popular movies fetch failed for page ${page}:`, error.message);
                    }
                }
            }

            // Fetch popular TV shows
            if (!mediaType || mediaType === 'tv') {
                for (let page = 1; page <= pages; page++) {
                    try {
                        const data = await this.tmdb(`/tv/popular?page=${page}`);

                        if (data.results) {
                            const tvWithType = data.results.map((tv: any) => ({
                                ...tv,
                                media_type: 'tv',
                            }));
                            results.push(...tvWithType);
                        }

                        await this.delay(100);
                    } catch (error) {
                        console.error(`Popular TV fetch failed for page ${page}:`, error.message);
                    }
                }
            }
        } catch (error) {
            console.error('Error in fetchPopularContent:', error);
        }

        return results;
    }

    private async fetchTrendingContent(
        mediaType: string | null
    ): Promise<TMDBMovie[]> {
        const results: TMDBMovie[] = [];

        try {
            // Fetch trending all
            if (!mediaType) {
                try {
                    const data = await this.tmdb('/trending/all/week');

                    if (data.results) {
                        results.push(...data.results);
                    }
                } catch (error) {
                    console.error('Trending all fetch failed:', error.message);
                }
            } else {
                // Fetch trending for specific media type
                try {
                    const data = await this.tmdb(`/trending/${mediaType}/week`);

                    if (data.results) {
                        const withType = data.results.map((item: any) => ({
                            ...item,
                            media_type: mediaType,
                        }));
                        results.push(...withType);
                    }
                } catch (error) {
                    console.error(`Trending ${mediaType} fetch failed:`, error.message);
                }
            }
        } catch (error) {
            console.error('Error in fetchTrendingContent:', error);
        }

        return results;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Helper method to get recommendations by specific genres
    async getRecommendationsByGenres(
        genreNames: string[],
        mediaType?: string,
        limit: number = 25,
    ): Promise<TMDBMovie[]> {
        const normalizedGenres = genreNames.map(g => g.toLowerCase().trim());
        const genreIds = this.mapGenresToIds(normalizedGenres, mediaType || null);

        if (genreIds.length === 0) {
            // If no valid genres, return popular content
            return await this.fetchPopularContent(mediaType || null, 2);
        }

        const results = await this.fetchFromTMDB({
            genreIds,
            preferredMediaType: mediaType || null,
            topGenres: normalizedGenres,
        });

        return results.slice(0, Math.max(limit, this.MIN_RESULTS));
    }

    // Get all available genres
    getAvailableGenres(): string[] {
        return Object.keys(this.GENRE_MAPPINGS);
    }
}