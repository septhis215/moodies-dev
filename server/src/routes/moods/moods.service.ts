import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TMDBService } from 'src/external-apis/services/tmdb.service';
import { GetRecommendationsDto } from './dto/get-recommendations.dto';
import { LogMoodDto } from './dto/log-mood.dto';
import { RecommendationFeedbackDto } from './dto/recommendation-feedback.dto';
import { Mood, MoodLog, Recommendation, MediaType, Prisma } from '@prisma/client';

@Injectable()
export class MoodsService {
    private readonly logger = new Logger(MoodsService.name);

    constructor(
        private prisma: PrismaService,
        private tmdbService: TMDBService,
    ) { }

    async getGenreNames(genreIds: number[]): Promise<string[]> {
        try {
            // Fetch both movie and TV genres to cover all cases
            const [movieGenres, tvGenres] = await Promise.all([
                this.tmdbService.getMovieGenres(),
                this.tmdbService.getTVGenres()
            ]);

            const allGenres = [...movieGenres, ...tvGenres];
            const uniqueGenres = new Map(allGenres.map(g => [g.id, g]));
            return genreIds
                .map(id => uniqueGenres.get(id)?.name)
                .filter((name): name is string => Boolean(name));

        } catch (error) {
            this.logger.error('Failed to fetch genre names', error);
            return [];
        }
    }

    async getAllMoods(): Promise<Mood[]> {
        return this.prisma.mood.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
    }

    async getMoodById(id: string): Promise<Mood> {
        const mood = await this.prisma.mood.findFirst({
            where: {
                id,
                isActive: true
            },
        });

        if (!mood) {
            throw new NotFoundException('Mood not found');
        }

        return mood;
    }

    async logMood(logMoodDto: LogMoodDto): Promise<MoodLog> {
        const mood = await this.getMoodById(logMoodDto.moodId);

        return this.prisma.moodLog.create({
            data: {
                userId: logMoodDto.userId || 'anonymous',
                moodId: logMoodDto.moodId,
                intensity: logMoodDto.intensity || 5,
                tags: logMoodDto.tags || [],
                context: logMoodDto.context,
            },
            include: {
                mood: true,
            },
        });
    }

    async getUserMoodHistory(userId: string, limit: number = 50): Promise<(MoodLog & { mood: Mood })[]> {
        return this.prisma.moodLog.findMany({
            where: { userId },
            include: { mood: true },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    async getRecommendations(dto: GetRecommendationsDto): Promise<{
        recommendations: Recommendation[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const mood = await this.getMoodById(dto.moodId);

        // For non-force refresh, check cache but with shorter timeout
        if (!dto.forceRefresh) {
            const existingRecommendations = await this.getCachedRecommendations(dto);
            if (existingRecommendations.length >= (dto.limit || 12)) {
                this.logger.debug(`Using cached recommendations for mood: ${mood.name}`);
                // Add genre names to cached recommendations
                const enrichedRecommendations = await this.enrichRecommendationsWithGenres(existingRecommendations);
                return this.paginateResults(
                    enrichedRecommendations,
                    dto.page ?? 1,
                    dto.limit ?? 12
                );
            }
        }

        // Generate fresh recommendations
        this.logger.debug(`Generating fresh recommendations for mood: ${mood.name}`);
        const newRecommendations = await this.generateRecommendations(mood, dto);

        // Save to database for caching
        await this.saveRecommendations(newRecommendations);

        return this.paginateResults(newRecommendations, dto.page ?? 1, dto.limit || 12);
    }

    private async getCachedRecommendations(dto: GetRecommendationsDto): Promise<Recommendation[]> {
        // Reduce cache time to 30 minutes for more variety
        const thirtyMinutesAgo = new Date();
        thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

        const whereCondition: Prisma.RecommendationWhereInput = {
            moodId: dto.moodId,
            createdAt: { gte: thirtyMinutesAgo },
        };

        if (dto.userId) {
            whereCondition.userId = dto.userId;
        }

        if (dto.mediaType && dto.mediaType !== 'both') {
            whereCondition.mediaType = dto.mediaType.toUpperCase() as MediaType;
        }

        return this.prisma.recommendation.findMany({
            where: whereCondition,
            orderBy: [
                { score: 'desc' },
                { createdAt: 'desc' },
            ],
            take: dto.limit || 12,
        });
    }

    private async generateRecommendations(mood: Mood, dto: GetRecommendationsDto): Promise<any[]> {
        const recommendations: any[] = [];
        const targetLimit = dto.limit || 12;

        // Get user's mood history for personalization
        let userMoodHistory: (MoodLog & { mood: Mood })[] = [];
        if (dto.userId) {
            userMoodHistory = await this.getUserMoodHistory(dto.userId, 20);
        }

        // Get user preferences if available
        const userPreferences = dto.userId
            ? await this.prisma.userPreference.findUnique({ where: { userId: dto.userId } })
            : null;

        // Fetch from multiple pages to ensure variety and avoid duplicates
        const pagesToFetch = Math.max(10, Math.ceil(targetLimit / 10)); // Ensure we fetch enough pages
        const shuffledPages = this.shuffleArray([...Array(20)].map((_, i) => i + 1)).slice(0, pagesToFetch);

        this.logger.debug(`Fetching from pages: ${shuffledPages.join(', ')} for mood: ${mood.name}`);

        // Collect all content from multiple pages
        const allMovies: any[] = [];
        const allTVShows: any[] = [];

        for (const page of shuffledPages) {
            try {
                if (dto.mediaType === 'both' || dto.mediaType === 'movie') {
                    const movies = await this.tmdbService.getMoviesByGenres(
                        mood.tmdbGenres,
                        page,
                        dto.minRating,
                    );
                    allMovies.push(...movies);
                }

                if (dto.mediaType === 'both' || dto.mediaType === 'tv') {
                    const tvShows = await this.tmdbService.getTVShowsByGenres(
                        mood.tmdbGenres,
                        page,
                        dto.minRating,
                    );
                    allTVShows.push(...tvShows);
                }
            } catch (error) {
                this.logger.warn(`Failed to fetch page ${page} for mood ${mood.name}:`, error.message);
                // Continue with other pages
            }
        }

        // Remove duplicates based on TMDB ID
        const uniqueMovies = this.removeDuplicates(allMovies, 'id');
        const uniqueTVShows = this.removeDuplicates(allTVShows, 'id');

        this.logger.debug(`Fetched ${uniqueMovies.length} unique movies and ${uniqueTVShows.length} unique TV shows`);

        // Shuffle the arrays for randomization
        this.shuffleArray(uniqueMovies);
        this.shuffleArray(uniqueTVShows);

        // Process recommendations
        if (uniqueMovies.length > 0) {
            const movieRecommendations = await this.processMovieRecommendations(
                uniqueMovies,
                mood,
                dto.userId || 'anonymous',
                userMoodHistory,
                userPreferences,
            );
            recommendations.push(...movieRecommendations);
        }

        if (uniqueTVShows.length > 0) {
            const tvRecommendations = await this.processTVRecommendations(
                uniqueTVShows,
                mood,
                dto.userId || 'anonymous',
                userMoodHistory,
                userPreferences,
            );
            recommendations.push(...tvRecommendations);
        }
        this.shuffleArray(recommendations);
        // Diversify and limit results
        const finalRecommendations = this.diversifyRecommendations(recommendations, targetLimit);

        this.logger.debug(`Generated ${finalRecommendations.length} final recommendations for mood: ${mood.name}`);

        return finalRecommendations;
    }

    private removeDuplicates<T>(array: T[], key: keyof T): T[] {
        const seen = new Set();
        return array.filter(item => {
            const keyValue = item[key];
            if (seen.has(keyValue)) {
                return false;
            }
            seen.add(keyValue);
            return true;
        });
    }

    private async enrichRecommendationsWithGenres(recommendations: Recommendation[]): Promise<Recommendation[]> {
        // Add genre names to recommendations
        return Promise.all(recommendations.map(async (rec) => {
            const genreNames = await this.getGenreNames(rec.genreIds);
            return {
                ...rec,
                genreNames, // Add genre names for frontend
            } as any;
        }));
    }

    private async processMovieRecommendations(
        movies: any[],
        mood: Mood,
        userId: string,
        userHistory: (MoodLog & { mood: Mood })[],
        userPreferences: any,
    ): Promise<any[]> {
        return Promise.all(movies.map(async movie => {
            const score = this.calculateRecommendationScore(movie, mood, userHistory, userPreferences);
            const genreNames = await this.getGenreNames(movie.genre_ids);

            return {
                userId,
                moodId: mood.id,
                tmdbId: movie.id,
                mediaType: MediaType.MOVIE,
                title: movie.title,
                overview: movie.overview,
                genreIds: movie.genre_ids,
                genreNames, // Add genre names
                voteAverage: movie.vote_average,
                voteCount: movie.vote_count,
                releaseDate: movie.release_date,
                posterPath: movie.poster_path,
                backdropPath: movie.backdrop_path,
                score: new Prisma.Decimal(score.toFixed(3)),
                reason: this.generateRecommendationReason(movie, mood, score),
                algorithm: 'mood-based-tmdb-v2',
                metadata: {
                    moodMatch: this.calculateMoodMatch(movie.genre_ids, mood.tmdbGenres),
                    popularity: movie.popularity,
                    userMoodPreference: this.calculateUserMoodPreference(mood.id, userHistory),
                    userPreferenceMatch: userPreferences ? this.calculateUserPreferenceMatch(movie.genre_ids, userPreferences) : 0.5,
                    fetchedAt: new Date(),
                },
                viewed: false,
                liked: false,
                saved: false,
            };
        }));
    }

    private async processTVRecommendations(
        tvShows: any[],
        mood: Mood,
        userId: string,
        userHistory: (MoodLog & { mood: Mood })[],
        userPreferences: any,
    ): Promise<any[]> {
        return Promise.all(tvShows.map(async show => {
            const score = this.calculateRecommendationScore(show, mood, userHistory, userPreferences);
            const genreNames = await this.getGenreNames(show.genre_ids);

            return {
                userId,
                moodId: mood.id,
                tmdbId: show.id,
                mediaType: MediaType.TV,
                title: show.name,
                overview: show.overview,
                genreIds: show.genre_ids,
                genreNames, // Add genre names
                voteAverage: show.vote_average,
                voteCount: show.vote_count,
                releaseDate: show.first_air_date,
                posterPath: show.poster_path,
                backdropPath: show.backdrop_path,
                score: new Prisma.Decimal(score.toFixed(3)),
                reason: this.generateRecommendationReason(show, mood, score),
                algorithm: 'mood-based-tmdb-v2',
                metadata: {
                    moodMatch: this.calculateMoodMatch(show.genre_ids, mood.tmdbGenres),
                    popularity: show.popularity,
                    userMoodPreference: this.calculateUserMoodPreference(mood.id, userHistory),
                    userPreferenceMatch: userPreferences ? this.calculateUserPreferenceMatch(show.genre_ids, userPreferences) : 0.5,
                    fetchedAt: new Date(),
                },
                viewed: false,
                liked: false,
                saved: false,
            };
        }));
    }

    private calculateRecommendationScore(
        content: any,
        mood: Mood,
        userHistory: (MoodLog & { mood: Mood })[],
        userPreferences: any,
    ): number {
        let score = 0;

        // Base mood-genre match (35% weight)
        const genreMatch = this.calculateMoodMatch(content.genre_ids, mood.tmdbGenres);
        score += genreMatch * 0.35;

        // Content quality based on ratings (20% weight)
        const qualityScore = Math.min(content.vote_average / 10, 1);
        score += qualityScore * 0.20;

        // User mood preference (20% weight)
        const userMoodPreference = this.calculateUserMoodPreference(mood.id, userHistory);
        score += userMoodPreference * 0.2;

        // User genre preferences (15% weight)
        const userGenrePreference = userPreferences
            ? this.calculateUserPreferenceMatch(content.genre_ids, userPreferences)
            : 0.5;
        score += userGenrePreference * 0.15;

        // Popularity boost (10% weight)
        const popularityScore = Math.min(content.popularity / 1000, 1);
        score += popularityScore * 0.10;

        // Recency factor (example: 15% weight)
        const releaseDate = new Date(content.release_date || content.first_air_date || Date.now());
        const now = new Date();
        const yearsDiff = (now.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

        // Normalize: recent (0 years) => 1, old (10+ years) => 0
        const recencyScore = Math.max(0, Math.min(1, 1 - yearsDiff / 10));
        score += recencyScore * 0.15;

        return Math.min(score, 1.0);
    }


    private calculateMoodMatch(contentGenres: number[], moodGenres: number[]): number {
        if (moodGenres.length === 0) return 0.5;

        const intersection = contentGenres.filter(genre => moodGenres.includes(genre));
        return Math.min(intersection.length / moodGenres.length * 1.5, 1.0);
    }

    private calculateUserMoodPreference(moodId: string, userHistory: (MoodLog & { mood: Mood })[]): number {
        if (userHistory.length === 0) return 0.5;

        const moodCount = userHistory.filter(log => log.moodId === moodId).length;
        const recentMoodCount = userHistory.slice(0, 10).filter(log => log.moodId === moodId).length;

        const overallPreference = moodCount / userHistory.length;
        const recentPreference = recentMoodCount / Math.min(10, userHistory.length);

        return (overallPreference * 0.3 + recentPreference * 0.7);
    }

    private calculateUserPreferenceMatch(contentGenres: number[], userPreferences: any): number {
        if (!userPreferences.preferredGenres || userPreferences.preferredGenres.length === 0) {
            return 0.5;
        }

        const preferredMatches = contentGenres.filter(genre =>
            userPreferences.preferredGenres.includes(genre)
        ).length;

        const dislikedMatches = contentGenres.filter(genre =>
            userPreferences.dislikedGenres?.includes(genre)
        ).length;

        const preferenceScore = preferredMatches / userPreferences.preferredGenres.length;
        const penaltyScore = dislikedMatches > 0 ? 0.2 : 0;

        return Math.max(preferenceScore - penaltyScore, 0);
    }

    private generateRecommendationReason(content: any, mood: Mood, score: number): string {
        const moodName = mood.name.toLowerCase();
        const rating = content.vote_average;

        const reasons = [
            `Perfect match for your ${moodName} mood`,
            `Highly rated (${rating.toFixed(1)}/10) content that fits your current vibe`,
            `Popular choice for ${moodName} moments`,
            `Based on your preferences, you'll love this`,
            `Great ${rating.toFixed(1)}/10 rating matches your mood`,
            `Trending content that aligns with your ${moodName} feeling`,
            `Discovered just for your ${moodName} mood`,
            `Fresh pick that matches your vibe perfectly`,
        ];

        return reasons[Math.floor(Math.random() * reasons.length)];
    }

    private diversifyRecommendations(recommendations: any[], limit: number): any[] {
        // Shuffle first to ensure randomness
        this.shuffleArray(recommendations);

        // Sort by score but maintain some randomness within score bands
        recommendations.sort((a, b) => {
            const scoreA = Number(a.score);
            const scoreB = Number(b.score);

            // If scores are very close (within 0.1), maintain random order
            if (Math.abs(scoreA - scoreB) < 0.1) {
                return Math.random() - 0.5;
            }

            return scoreB - scoreA;
        });

        // Ensure mix of movies and TV shows
        const movies = recommendations.filter(r => r.mediaType === MediaType.MOVIE);
        const tvShows = recommendations.filter(r => r.mediaType === MediaType.TV);

        const result: any[] = [];
        const targetMovies = Math.floor(limit * 0.6); // 60% movies
        const targetTV = limit - targetMovies;

        // Add movies and TV shows alternately for variety
        let movieIndex = 0;
        let tvIndex = 0;

        for (let i = 0; i < limit && (movieIndex < movies.length || tvIndex < tvShows.length); i++) {
            if (result.length < targetMovies && movieIndex < movies.length &&
                (tvIndex >= tvShows.length || i % 2 === 0)) {
                result.push(movies[movieIndex++]);
            } else if (result.length < limit && tvIndex < tvShows.length) {
                result.push(tvShows[tvIndex++]);
            } else if (movieIndex < movies.length) {
                result.push(movies[movieIndex++]);
            }
        }

        return result.slice(0, limit);
    }

    private shuffleArray<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    private async saveRecommendations(recommendations: any[]): Promise<void> {
        if (recommendations.length === 0) return;

        const batchSize = 20;

        for (let i = 0; i < recommendations.length; i += batchSize) {
            const batch = recommendations.slice(i, i + batchSize);

            try {
                await this.prisma.recommendation.createMany({
                    data: batch.map(r => ({
                        userId: r.userId,
                        moodId: r.moodId,
                        tmdbId: r.tmdbId,
                        mediaType: r.mediaType,
                        title: r.title,
                        overview: r.overview ?? null,
                        genreIds: r.genreIds,
                        voteAverage: new Prisma.Decimal(r.voteAverage),
                        voteCount: r.voteCount,
                        releaseDate: r.releaseDate ?? null,
                        posterPath: r.posterPath ?? null,
                        backdropPath: r.backdropPath ?? null,
                        score: new Prisma.Decimal(r.score),
                        reason: r.reason,
                        algorithm: r.algorithm,
                        metadata: r.metadata ?? Prisma.JsonNull,
                        viewed: r.viewed,
                        liked: r.liked,
                        saved: r.saved,
                        rating: r.rating ?? null,
                    })),
                    skipDuplicates: true,
                });
            } catch (error) {
                this.logger.error(`Failed to save recommendation batch ${i}:`, error.message);
            }
        }
    }

    private paginateResults(recommendations: any[], page: number, limit: number): {
        recommendations: any[];
        total: number;
        page: number;
        totalPages: number;
    } {
        const total = recommendations.length;
        const totalPages = Math.ceil(total / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        return {
            recommendations: recommendations.slice(startIndex, endIndex),
            total,
            page,
            totalPages,
        };
    }

    async provideFeedback(dto: RecommendationFeedbackDto) {
        const recommendation = await this.prisma.recommendation.findUnique({
            where: { id: dto.recommendationId },
        });

        if (!recommendation) {
            throw new NotFoundException('Recommendation not found');
        }

        return this.prisma.recommendation.update({
            where: { id: dto.recommendationId },
            data: {
                liked: dto.liked ?? recommendation.liked,
                viewed: dto.viewed ?? recommendation.viewed,
                rating: dto.rating ?? recommendation.rating,
                metadata: {
                    ...(recommendation.metadata as object),
                    userRating: dto.rating,
                    feedbackAt: new Date(),
                },
            },
        });
    }

    async regenerateRecommendations(dto: GetRecommendationsDto): Promise<{
        recommendations: any[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        // Clear recent cache for this mood to ensure fresh results
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const whereCondition: any = {
            moodId: dto.moodId,
            createdAt: { gte: oneHourAgo },
        };

        if (dto.userId) {
            whereCondition.userId = dto.userId;
        }

        await this.prisma.recommendation.deleteMany({ where: whereCondition });

        // Force fresh recommendations
        return this.getRecommendations({
            ...dto,
            forceRefresh: true,
            limit: dto.limit || 12,
            page: 1
        });
    }

    async getMoodAnalytics(userId?: string): Promise<any> {
        const whereCondition = userId ? { userId } : {};

        const moodLogs = await this.prisma.moodLog.findMany({
            where: whereCondition,
            include: {
                mood: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        const moodCounts: Record<string, number> = {};
        const moodIntensities: Record<string, number[]> = {};

        moodLogs.forEach((log) => {
            const moodName = log.mood.name;
            moodCounts[moodName] = (moodCounts[moodName] || 0) + 1;

            if (!moodIntensities[moodName]) {
                moodIntensities[moodName] = [];
            }
            moodIntensities[moodName].push(log.intensity);
        });

        const analytics = {
            totalLogs: moodLogs.length,
            moodDistribution: Object.entries(moodCounts).map(([mood, count]) => ({
                mood,
                count,
                percentage: ((count as number) / moodLogs.length * 100).toFixed(1),
            })),
            averageIntensities: Object.entries(moodIntensities).map(([mood, intensities]) => ({
                mood,
                average:
                    (intensities as number[]).reduce((a, b) => a + b, 0) /
                    (intensities as number[]).length,
            })),
            mostCommonMood:
                Object.entries(moodCounts).sort(([, a], [, b]) => (b as number) - (a as number))[0],
            recentActivity: moodLogs.slice(0, 10),
        };

        return analytics;
    }
}