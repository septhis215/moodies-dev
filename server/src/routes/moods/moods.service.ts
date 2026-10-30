import { RedisService } from 'src/redis/redis.service';
import { rankRecommendations } from 'src/utils/recommendation-ranking';
import { Injectable, NotFoundException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TMDBService } from 'src/external-apis/services/tmdb.service';
import { GetRecommendationsDto } from './dto/get-recommendations.dto';
import { LogMoodDto } from './dto/log-mood.dto';
import { RecommendationFeedbackDto } from './dto/recommendation-feedback.dto';
import { Mood, MoodLog, Recommendation, MediaType, Prisma } from '@prisma/client';

// Emotional fit carries 70%; profile preferences cannot bypass mood eligibility.
const W_GENRE = 0.40;
const W_VALENCE = 0.11;
const W_AROUSAL = 0.08;
const W_POPULARITY = 0.09;
const W_QUALITY = 0.10;
const W_RECENCY = 0.06;
const W_KEYWORD = 0.11;
const W_LANGUAGE = 0.02;
const W_PREFERRED_GENRE = 0.03;

const WEIGHT_SUM = W_GENRE + W_VALENCE + W_AROUSAL + W_POPULARITY + W_QUALITY + W_RECENCY + W_KEYWORD + W_LANGUAGE + W_PREFERRED_GENRE;
if (Math.abs(WEIGHT_SUM - 1.0) > 0.001) {
    throw new Error(`Scoring weights must sum to 1.0, got ${WEIGHT_SUM}`);
}


// TMDB popularity is unbounded — cap before log-normalising so blockbusters
// don't get unbounded advantage over solid mid-tier titles.
const POPULARITY_CEIL = 120;

// Exponential half-life for recency decay (days). Item released exactly this
// many days ago scores 0.5; older items decay toward 0.
const RECENCY_HALF_LIFE_DAYS = 365 * 2;

const FALLBACK_MOVIE_GENRES = [18, 35, 28, 12, 878, 14];
const FALLBACK_TV_GENRES = [18, 35, 10759, 10765, 9648, 80];
const RECOMMENDATION_ALGORITHM = 'mood-scored-v6';

type ProfilePreferences = { preferredGenres: string[]; preferredLanguages: string[] };

const TMDB_MOVIE_GENRES = [
    { id: 28, name: 'Action' },
    { id: 12, name: 'Adventure' },
    { id: 16, name: 'Animation' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
    { id: 99, name: 'Documentary' },
    { id: 18, name: 'Drama' },
    { id: 10751, name: 'Family' },
    { id: 14, name: 'Fantasy' },
    { id: 36, name: 'History' },
    { id: 27, name: 'Horror' },
    { id: 10402, name: 'Music' },
    { id: 9648, name: 'Mystery' },
    { id: 10749, name: 'Romance' },
    { id: 878, name: 'Science Fiction' },
    { id: 10770, name: 'TV Movie' },
    { id: 53, name: 'Thriller' },
    { id: 10752, name: 'War' },
    { id: 37, name: 'Western' },
];

const TMDB_TV_GENRES = [
    { id: 10759, name: 'Action & Adventure' },
    { id: 16, name: 'Animation' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
    { id: 99, name: 'Documentary' },
    { id: 18, name: 'Drama' },
    { id: 10751, name: 'Family' },
    { id: 10762, name: 'Kids' },
    { id: 9648, name: 'Mystery' },
    { id: 10763, name: 'News' },
    { id: 10764, name: 'Reality' },
    { id: 10765, name: 'Sci-Fi & Fantasy' },
    { id: 10766, name: 'Soap' },
    { id: 10767, name: 'Talk' },
    { id: 10768, name: 'War & Politics' },
    { id: 37, name: 'Western' },
];

const TMDB_MOVIE_GENRE_IDS = new Set(TMDB_MOVIE_GENRES.map(genre => genre.id));
const TMDB_TV_GENRE_IDS = new Set(TMDB_TV_GENRES.map(genre => genre.id));

interface MoodGenreConfig {
    moviePrimaryGenreIds: number[];
    movieSecondaryGenreIds: number[];
    tvPrimaryGenreIds: number[];
    tvSecondaryGenreIds: number[];
    excludedGenreIds: number[];
    keywords: string[];
}

const MOOD_GENRE_CONFIG: Record<string, MoodGenreConfig> = {
    romantic: {
        moviePrimaryGenreIds: [10749],
        movieSecondaryGenreIds: [18, 35],
        tvPrimaryGenreIds: [],
        tvSecondaryGenreIds: [18, 35, 10766],
        excludedGenreIds: [27, 10752, 80, 53, 10768],
        keywords: [
            'love',
            'romance',
            'romantic',
            'relationship',
            'couple',
            'dating',
            'marriage',
            'heartbreak',
            'affection',
            'lovers',
            'first love',
            'love story',
        ],
    },
    happy: {
        moviePrimaryGenreIds: [35, 10751, 16],
        movieSecondaryGenreIds: [12, 14, 10402],
        tvPrimaryGenreIds: [35, 10751, 16],
        tvSecondaryGenreIds: [10762, 10766],
        excludedGenreIds: [27, 10752, 80, 53, 10768],
        keywords: [
            'fun',
            'funny',
            'comedy',
            'friendship',
            'joy',
            'uplifting',
            'feel good',
            'family',
            'adventure',
        ],
    },
    sad: {
        moviePrimaryGenreIds: [18],
        movieSecondaryGenreIds: [10749],
        tvPrimaryGenreIds: [18],
        tvSecondaryGenreIds: [10766],
        excludedGenreIds: [27, 28, 10759],
        keywords: [
            'grief',
            'loss',
            'tragedy',
            'heartbreak',
            'emotional',
            'sad',
            'melancholy',
            'farewell',
            'drama',
        ],
    },
    excited: {
        moviePrimaryGenreIds: [28, 12],
        movieSecondaryGenreIds: [878, 53, 14],
        tvPrimaryGenreIds: [10759],
        tvSecondaryGenreIds: [10765, 9648],
        excludedGenreIds: [99, 10767, 10763],
        keywords: [
            'action',
            'adventure',
            'hero',
            'battle',
            'mission',
            'survival',
            'chase',
            'fight',
            'warrior',
            'power',
        ],
    },
    relaxed: {
        moviePrimaryGenreIds: [10751, 16, 35],
        movieSecondaryGenreIds: [12, 14, 10402],
        tvPrimaryGenreIds: [10751, 16, 35],
        tvSecondaryGenreIds: [10762, 10766],
        excludedGenreIds: [27, 53, 80, 10768],
        keywords: [
            'calm',
            'cozy',
            'comfort',
            'family',
            'friendship',
            'slice of life',
            'peaceful',
            'lighthearted',
            'warm',
        ],
    },
    scared: {
        moviePrimaryGenreIds: [27, 53],
        movieSecondaryGenreIds: [9648, 878],
        tvPrimaryGenreIds: [9648],
        tvSecondaryGenreIds: [10765, 80],
        excludedGenreIds: [10751, 10762, 16, 35],
        keywords: [
            'horror',
            'ghost',
            'evil spirit',
            'demon',
            'haunted',
            'supernatural',
            'curse',
            'possession',
            'monster',
            'paranormal',
            'fear',
            'nightmare',
        ],
    },
};

const MOOD_CONFIG_ALIASES: Record<string, keyof typeof MOOD_GENRE_CONFIG> = {
    funny: 'happy',
    cozy: 'relaxed',
    serenity: 'relaxed',
    chill: 'relaxed',
    nostalgic: 'relaxed',
    bittersweet: 'sad',
    thrilling: 'excited',
    epic: 'excited',
    chaos: 'excited',
    horror: 'scared',
};
const ROMANCE_TEXT_TERMS = [
    'romance',
    'romantic',
    'love',
    'lovers',
    'relationship',
    'relationships',
    'couple',
    'couples',
    'dating',
    'marriage',
    'heart',
    'affair',
    'passion',
    'fall in love',
    'love story',
];

interface MediaGenreProfile {
    primary: number[];
    secondary: number[];
    excluded: number[];
}

interface MoodGenreProfile {
    movie: MediaGenreProfile;
    tv: MediaGenreProfile;
    related: string[];
}

const MEDIA_SPECIFIC_MOOD_GENRES: Record<string, MoodGenreProfile> = {
    happy: { movie: { primary: [35, 16], secondary: [10751, 12, 10402], excluded: [27, 80] }, tv: { primary: [35, 16], secondary: [10751, 10762, 10759], excluded: [80, 9648] }, related: ['funny', 'cozy', 'whimsy', 'inspirational'] },
    funny: { movie: { primary: [35], secondary: [16, 10751], excluded: [27, 53] }, tv: { primary: [35], secondary: [16, 10751], excluded: [80, 9648] }, related: ['happy', 'cozy', 'whimsy'] },
    cozy: { movie: { primary: [10751, 16], secondary: [35, 10749, 18], excluded: [27, 53, 80] }, tv: { primary: [10751, 16], secondary: [35, 18], excluded: [80, 9648] }, related: ['happy', 'serenity', 'romantic', 'nostalgic'] },
    whimsy: { movie: { primary: [14, 16], secondary: [10751, 35, 12], excluded: [27, 80] }, tv: { primary: [10765, 16], secondary: [10751, 35], excluded: [80] }, related: ['happy', 'cozy', 'epic', 'sci-fi'] },
    romantic: { movie: { primary: [10749], secondary: [18, 35], excluded: [10751, 16, 28, 12, 27, 878] }, tv: { primary: [10766, 18], secondary: [35], excluded: [10751, 16, 10759, 10762, 9648] }, related: ['bittersweet', 'cozy'] },
    serenity: { movie: { primary: [18, 99], secondary: [10402, 10751, 36], excluded: [27, 53, 28] }, tv: { primary: [18, 99], secondary: [35], excluded: [80, 9648, 10759] }, related: ['chill', 'cozy', 'documentary'] },
    chill: { movie: { primary: [18, 99], secondary: [10402, 14, 10751], excluded: [27, 53, 28] }, tv: { primary: [18, 99], secondary: [35], excluded: [80, 10759] }, related: ['serenity', 'cozy', 'documentary'] },
    inspirational: { movie: { primary: [18, 36, 99], secondary: [12, 10402], excluded: [27, 80] }, tv: { primary: [18, 99], secondary: [10759], excluded: [27, 9648] }, related: ['happy', 'documentary', 'epic'] },
    nostalgic: { movie: { primary: [35, 16, 10751], secondary: [10402, 36], excluded: [27, 53] }, tv: { primary: [16, 35, 10751], secondary: [18], excluded: [80, 9648] }, related: ['cozy', 'happy', 'bittersweet'] },
    bittersweet: { movie: { primary: [18, 10749], secondary: [36, 35], excluded: [27, 28] }, tv: { primary: [18, 10766], secondary: [16], excluded: [10759, 80] }, related: ['sad', 'romantic', 'nostalgic'] },
    sad: { movie: { primary: [18], secondary: [10749, 36, 99], excluded: [35, 10751] }, tv: { primary: [18], secondary: [10766, 99], excluded: [35, 10762] }, related: ['bittersweet', 'romantic', 'serenity'] },
    thrilling: { movie: { primary: [53, 28], secondary: [12, 80, 878], excluded: [10751, 10402] }, tv: { primary: [10759, 80], secondary: [9648, 10765], excluded: [10751, 10762] }, related: ['chaos', 'dark', 'mind-bending'] },
    epic: { movie: { primary: [12, 14, 28], secondary: [878, 36], excluded: [99, 10749] }, tv: { primary: [10765, 10759], secondary: [18], excluded: [10764, 10762] }, related: ['thrilling', 'sci-fi', 'whimsy'] },
    chaos: { movie: { primary: [28, 53], secondary: [80, 878, 27], excluded: [10751, 10749] }, tv: { primary: [10759, 80], secondary: [9648, 10765], excluded: [10751, 10762] }, related: ['thrilling', 'horror', 'dark'] },
    horror: { movie: { primary: [27], secondary: [9648, 53, 14], excluded: [10751, 35, 10749] }, tv: { primary: [9648, 10765], secondary: [80], excluded: [10751, 35] }, related: ['dark', 'mind-bending', 'chaos'] },
    dark: { movie: { primary: [9648, 53, 80], secondary: [18, 878], excluded: [10751, 35] }, tv: { primary: [9648, 80], secondary: [10765, 18], excluded: [10751, 10762] }, related: ['gritty', 'horror', 'mind-bending'] },
    gritty: { movie: { primary: [80, 18], secondary: [53, 36], excluded: [10751, 16] }, tv: { primary: [80, 18], secondary: [9648], excluded: [10751, 10762] }, related: ['dark', 'thrilling', 'documentary'] },
    'mind-bending': { movie: { primary: [9648, 878], secondary: [53, 18, 14], excluded: [10751, 35] }, tv: { primary: [9648, 10765], secondary: [80], excluded: [10751, 10762] }, related: ['dark', 'sci-fi', 'thrilling'] },
    'sci-fi': { movie: { primary: [878], secondary: [12, 28, 14, 53], excluded: [10749, 10751] }, tv: { primary: [10765], secondary: [10759, 18], excluded: [10751, 10762] }, related: ['mind-bending', 'epic', 'thrilling'] },
    western: { movie: { primary: [37], secondary: [28, 12, 80, 18], excluded: [10749, 10751] }, tv: { primary: [37], secondary: [18, 10759, 80], excluded: [10751, 10762] }, related: ['gritty', 'epic', 'thrilling'] },
    documentary: { movie: { primary: [99], secondary: [36, 10402, 18], excluded: [27, 28] }, tv: { primary: [99], secondary: [10764, 18], excluded: [10759, 10765] }, related: ['inspirational', 'serenity', 'gritty'] },
};

// ---------------------------------------------------------------------------
// Genre → valence / arousal proxy tables  (range: [-1, +1])
//
// Both tables use the same [-1, +1] scale as mood.valence / mood.arousal so
// the alignment formula  `1 - |diff| / 2`  (max distance = 2) correctly
// maps to [0, 1] for all mood values including negatives.
// ---------------------------------------------------------------------------
const GENRE_VALENCE: Record<number, number> = {
    35: 0.8,     // Comedy
    16: 0.7,     // Animation
    10751: 0.7,  // Family
    12: 0.6,     // Adventure
    10402: 0.6,  // Music
    10749: 0.7,  // Romance
    14: 0.5,     // Fantasy
    36: 0.1,     // History
    18: -0.1,    // Drama
    99: 0.0,     // Documentary
    878: 0.2,    // Sci-Fi
    28: 0.1,     // Action
    53: -0.4,    // Thriller
    9648: -0.2,  // Mystery
    80: -0.5,    // Crime
    27: -0.7,    // Horror
    37: 0.2,     // Western
    10759: 0.3,  // Action & Adventure (TV)
    10762: 0.8,  // Kids
    10764: 0.3,  // Reality
    10765: 0.2,  // Sci-Fi & Fantasy (TV)
    10766: 0.1,  // Soap
};

const GENRE_AROUSAL: Record<number, number> = {
    28: 0.9,     // Action
    53: 0.8,     // Thriller
    27: 0.8,     // Horror
    10759: 0.8,  // Action & Adventure (TV)
    878: 0.7,    // Sci-Fi
    12: 0.7,     // Adventure
    9648: 0.5,   // Mystery
    80: 0.6,     // Crime
    14: 0.4,     // Fantasy
    35: 0.4,     // Comedy
    16: 0.3,     // Animation
    10765: 0.4,  // Sci-Fi & Fantasy (TV)
    10402: 0.2,  // Music
    10749: 0.2,  // Romance
    37: 0.5,     // Western
    18: 0.0,     // Drama
    99: -0.2,    // Documentary
    36: 0.0,     // History
    10751: 0.1,  // Family
    10762: 0.3,  // Kids
    10764: 0.3,  // Reality
    10766: 0.1,  // Soap
};

interface ScoreBreakdown {
    genreScore: number;
    primaryGenreMatches: number;
    secondaryGenreMatches: number;
    excludedGenreMatches: number;
    romanceTextScore: number;
    valenceScore: number;
    arousalScore: number;
    popularityScore: number;
    qualityScore: number;
    recencyScore: number;
    keywordScore: number;
    languageScore: number;
    preferredGenreScore: number;
    sourceScore: number;
}

interface ScoredItem {
    raw: any;
    score: number;
    breakdown: ScoreBreakdown;
}

@Injectable()
export class MoodsService {
    private readonly logger = new Logger(MoodsService.name);

    private genreCache: Map<number, string> | null = null;
    private genreCacheExpiry = 0;
    private readonly GENRE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
    private readonly REC_CACHE_WINDOW_MINUTES = 30;

    constructor(
        private readonly prisma: PrismaService,
        private readonly tmdbService: TMDBService,
        private readonly redis: RedisService,
    ) { }

    // ---------------------------------------------------------------------------
    // Genre helpers
    // ---------------------------------------------------------------------------

    private async getGenreMap(): Promise<Map<number, string>> {
        const now = Date.now();
        if (this.genreCache && now < this.genreCacheExpiry) return this.genreCache;
        try {
            const [movieGenres, tvGenres] = await Promise.all([
                this.tmdbService.getMovieGenres(),
                this.tmdbService.getTVGenres(),
            ]);
            const map = new Map<number, string>();
            for (const g of [...TMDB_MOVIE_GENRES, ...TMDB_TV_GENRES, ...movieGenres, ...tvGenres]) {
                map.set(g.id, g.name);
            }
            this.genreCache = map;
            this.genreCacheExpiry = now + this.GENRE_CACHE_TTL_MS;
            return map;
        } catch (error) {
            this.logger.error('Failed to build genre map', error);
            return this.genreCache ?? new Map([...TMDB_MOVIE_GENRES, ...TMDB_TV_GENRES].map(g => [g.id, g.name]));
        }
    }

    async getGenreNames(genreIds: number[]): Promise<string[]> {
        if (!genreIds?.length) return [];
        const map = await this.getGenreMap();
        return genreIds.map(id => map.get(id)).filter((n): n is string => Boolean(n));
    }

    private getMoodKey(mood: Pick<Mood, 'name'>): string {
        return mood.name.toLowerCase().replace(/\s+/g, '-');
    }

    private getMoodConfig(mood: Pick<Mood, 'name'>): MoodGenreConfig | undefined {
        const moodKey = this.getMoodKey(mood);
        return MOOD_GENRE_CONFIG[moodKey] ?? (MEDIA_SPECIFIC_MOOD_GENRES[moodKey] ? undefined : MOOD_GENRE_CONFIG[MOOD_CONFIG_ALIASES[moodKey]]);
    }

    private getMoodKeywords(mood: Mood): string[] {
        const thematic: Record<string, string[]> = {
            serenity: ['nature', 'peaceful', 'countryside'], chill: ['slice of life', 'friendship', 'relaxing'],
            inspirational: ['underdog', 'biography', 'perseverance'], nostalgic: ['nostalgia', 'coming of age', 'childhood'],
            bittersweet: ['grief', 'farewell', 'coming of age'],
        };
        const configured = thematic[this.getMoodKey(mood)] ?? this.getMoodConfig(mood)?.keywords ?? [];
        const stored = (mood.keywords as string[] | null) ?? [];
        return Array.from(new Set([...configured, ...stored].map(keyword => keyword.toLowerCase())));
    }

    private getMoodGenreProfile(mood: Mood, mediaType: 'movie' | 'tv'): MediaGenreProfile {
        const config = this.getMoodConfig(mood);
        if (config) {
            const validGenreIds = mediaType === 'movie' ? TMDB_MOVIE_GENRE_IDS : TMDB_TV_GENRE_IDS;
            const primary = mediaType === 'movie' ? config.moviePrimaryGenreIds : config.tvPrimaryGenreIds;
            const secondary = mediaType === 'movie' ? config.movieSecondaryGenreIds : config.tvSecondaryGenreIds;

            return {
                primary: primary.filter(id => validGenreIds.has(id)),
                secondary: secondary.filter(id => validGenreIds.has(id)),
                excluded: config.excludedGenreIds.filter(id => validGenreIds.has(id)),
            };
        }

        const profile = MEDIA_SPECIFIC_MOOD_GENRES[this.getMoodKey(mood)]?.[mediaType];
        if (profile) return profile;

        const fallback = (mood.tmdbGenres as number[] | null) ?? (mediaType === 'movie' ? FALLBACK_MOVIE_GENRES : FALLBACK_TV_GENRES);
        return {
            primary: fallback.slice(0, 2),
            secondary: fallback.slice(2),
            excluded: [],
        };
    }

    private getItemSearchText(item: any): string {
        const metadata = typeof item.metadata === 'object' && item.metadata ? item.metadata : {};
        return [
            item.title,
            item.name,
            item.original_title,
            item.original_name,
            item.overview,
            item.tagline,
            item.keywords,
            item.status,
            item.origin_country,
            item.original_language,
            metadata.tagline,
            metadata.keywords,
            metadata.origin_country,
            metadata.original_language,
        ]
            .flat()
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
    }

    private getKeywordMatchScore(item: any, keywords: string[]): number {
        const text = this.getItemSearchText(item);
        if (!text.trim()) return 0;

        const normalized = ' ' + text.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ';
        const matches = keywords.filter(term => normalized.includes(' ' + term.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ')).length;
        return Math.min(1, matches / 3);
    }

    private getRomanceTextScore(item: any): number {
        return this.getKeywordMatchScore(item, ROMANCE_TEXT_TERMS);
    }

    // ---------------------------------------------------------------------------
    // Mood CRUD
    // ---------------------------------------------------------------------------

    async getAllMoods(): Promise<Mood[]> {
        return this.prisma.mood.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
    }

    async getMoodById(id: string): Promise<Mood> {
        const mood = await this.prisma.mood.findFirst({ where: { id, isActive: true } });
        if (!mood) throw new NotFoundException('Mood not found');
        return mood;
    }

    async logMood(dto: LogMoodDto): Promise<MoodLog> {
        await this.getMoodById(dto.moodId);
        return this.prisma.moodLog.create({
            data: {
                userId: dto.userId ?? 'anonymous',
                moodId: dto.moodId,
                intensity: dto.intensity ?? 5,
                tags: dto.tags ?? [],
                context: dto.context,
            },
            include: { mood: true },
        });
    }

    async getUserMoodHistory(userId: string, limit = 50): Promise<(MoodLog & { mood: Mood })[]> {
        return this.prisma.moodLog.findMany({
            where: { userId },
            include: { mood: true },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    // ---------------------------------------------------------------------------
    // Recommendations — public API
    // ---------------------------------------------------------------------------

    async getRecommendations(dto: GetRecommendationsDto): Promise<{
        recommendations: Recommendation[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const mood = await this.getMoodById(dto.moodId);
        const page = dto.page ?? 1, limit = dto.limit ?? 12;
        const seed = dto.seed ?? (dto.forceRefresh ? Math.floor(Math.random() * 4294967296) : 0);
        const preferences = await this.getProfilePreferences(dto.userId);
        const profileKey = JSON.stringify([preferences.preferredGenres, preferences.preferredLanguages]);
        const filters = JSON.stringify([dto.mediaType ?? 'both', dto.minRating ?? 0, dto.includeAdult === true, [...(dto.languages ?? [])].sort()]);
        const poolKey = RECOMMENDATION_ALGORITHM + ':' + mood.id + ':' + filters;
        const sessionKey = poolKey + ':session:' + (dto.userId ?? 'anonymous') + ':' + profileKey + ':' + seed + ':' + Boolean(dto.excludeViewed) + ':' + JSON.stringify(dto.excludeKeys ?? []);
        try {
            const selected = await this.redis.getOrSet<any[]>(sessionKey, 1800, async () => {
                const pool = await this.redis.getOrSet<any[]>(poolKey, 3600,
                    () => this.generateRecommendations(mood, { ...dto, userId: 'anonymous', limit: 32 }),
                    value => value.length > 0);
                let eligible = this.personalizeRecommendations(pool, preferences);
                if (dto.excludeViewed && dto.userId) {
                    const viewed = await this.prisma.recommendation.findMany({ where: { userId: dto.userId, viewed: true }, select: { tmdbId: true, mediaType: true } });
                    const viewedKeys = new Set(viewed.map(item => this.getContentKey(item)));
                    eligible = eligible.filter(item => !viewedKeys.has(this.getContentKey(item)));
                }
                const ranked = this.selectVariedRecommendations(eligible, eligible.length, dto.shuffle !== false, seed);
                const recent = new Set(dto.excludeKeys ?? []);
                return [...ranked.filter(item => !recent.has(this.getContentKey(item))), ...ranked.filter(item => recent.has(this.getContentKey(item)))];
            }, value => value.length > 0);
            if (!selected.length) return this.paginateResults(await this.getFallbackRecommendations(mood, dto, preferences), page, limit);
            const result = this.paginateResults(selected, page, limit);
            result.recommendations = await this.saveRecommendations(result.recommendations.map(item => ({ ...item, userId: dto.userId ?? 'anonymous' })));
            return result;
        } catch (error) {
            this.logger.error('Mood recommendations unavailable', error);
            const fallback = await this.getFallbackRecommendations(mood, dto, preferences);
            if (!fallback.length) throw new ServiceUnavailableException('Recommendations are temporarily unavailable. Please try again.');
            return this.paginateResults(fallback, page, limit);
        }
    }

    async regenerateRecommendations(dto: GetRecommendationsDto) {
        return this.getRecommendations({ ...dto, forceRefresh: true, page: 1 });
    }

    async provideFeedback(dto: RecommendationFeedbackDto, userId: string): Promise<Recommendation> {
        const rec = await this.prisma.recommendation.findUnique({ where: { id: dto.recommendationId } });
        if (!rec || rec.userId !== userId) throw new NotFoundException('Recommendation not found');
        return this.prisma.recommendation.update({
            where: { id: dto.recommendationId },
            data: {
                liked: dto.liked ?? rec.liked,
                viewed: dto.viewed ?? rec.viewed,
                rating: dto.rating ?? rec.rating,
                metadata: {
                    ...(rec.metadata as object),
                    userRating: dto.rating,
                    feedbackAt: new Date(),
                },
            },
        });
    }

    // ---------------------------------------------------------------------------
    // Cache
    // ---------------------------------------------------------------------------

    private async getFallbackRecommendations(mood: Mood, dto: GetRecommendationsDto, preferences: ProfilePreferences = { preferredGenres: [], preferredLanguages: [] }): Promise<any[]> {
        const genreMap = await this.getGenreMap();
        const windowStart = new Date();
        windowStart.setMinutes(windowStart.getMinutes() - this.REC_CACHE_WINDOW_MINUTES);

        const rows = await this.prisma.recommendation.findMany({
            where: {
                moodId: mood.id,
                userId: dto.userId ?? 'anonymous',
                algorithm: RECOMMENDATION_ALGORITHM,
                updatedAt: { gte: windowStart },
                ...(dto.mediaType && dto.mediaType !== 'both'
                    ? { mediaType: dto.mediaType.toUpperCase() as MediaType } : {}),
                ...(dto.minRating ? { voteAverage: { gte: new Prisma.Decimal(dto.minRating) } } : {}),
                ...(dto.excludeViewed ? { viewed: false } : {}),
            },
            orderBy: { score: 'desc' },
            take: (dto.limit ?? 12) * 6,
        });

        const mapped = rows.map(r => ({
            ...r,
            score: Number(r.score),
            genreIds: r.genreIds ?? [],
            genreNames: (r.genreIds ?? []).map((id: number) => genreMap.get(id)).filter(Boolean),
        }));

        return this.selectVariedRecommendations(this.personalizeRecommendations(mapped.filter(item => {
            const meta = item.metadata as any;
            return (dto.includeAdult === true || meta?.adult === false)
                && (!dto.languages?.length || dto.languages.includes(meta?.original_language));
        }), preferences), mapped.length, dto.shuffle !== false, dto.seed ?? 0);
    }

    private async getProfilePreferences(userId?: string): Promise<ProfilePreferences> {
        const empty = { preferredGenres: [], preferredLanguages: [] };
        if (!userId || userId === 'anonymous') return empty;
        try {
            const profile = await this.prisma.user.findUnique({
                where: { id: userId }, select: { preferredGenres: true, preferredLanguages: true },
            });
            const normalize = (values: string[]) => [...new Set(values.map(value => value.trim().toLowerCase()).filter(Boolean))].sort();
            return profile ? { preferredGenres: normalize(profile.preferredGenres), preferredLanguages: normalize(profile.preferredLanguages) } : empty;
        } catch (error) {
            this.logger.warn('Profile preferences unavailable; using neutral mood ranking');
            return empty;
        }
    }

    // Personalize copies of the shared pool; never put one user's boosts into it.
    private personalizeRecommendations(items: any[], preferences: ProfilePreferences): any[] {
        const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });
        return items.map(item => {
            const breakdown = item.metadata?.scoreBreakdown;
            if (!breakdown) return item;
            const genres = (item.genreIds ?? []) as number[];
            const matches = genres.filter(id => preferences.preferredGenres.includes(String(id))
                || preferences.preferredGenres.includes(([...TMDB_MOVIE_GENRES, ...TMDB_TV_GENRES].find(genre => genre.id === id)?.name ?? '').toLowerCase())).length;
            const preferredGenreScore = preferences.preferredGenres.length ? Math.min(1, matches / Math.min(genres.length || 1, 2)) : 0.5;
            const lang = String(item.metadata?.original_language ?? '').toLowerCase();
            const languageName = /^[a-z]{2,3}$/.test(lang) ? languageNames.of(lang)?.toLowerCase() : undefined;
            const languageScore = preferences.preferredLanguages.length
                ? Number(preferences.preferredLanguages.includes(lang) || Boolean(languageName && preferences.preferredLanguages.includes(languageName))) : 0.5;
            const personalized = { ...breakdown, preferredGenreScore, languageScore };
            return { ...item, score: new Prisma.Decimal(this.calculateScore(personalized)), metadata: { ...item.metadata, scoreBreakdown: personalized } };
        });
    }

    private calculateScore(breakdown: ScoreBreakdown): number {
        const raw = W_GENRE * breakdown.genreScore + W_VALENCE * breakdown.valenceScore
            + W_AROUSAL * breakdown.arousalScore + W_POPULARITY * breakdown.popularityScore
            + W_QUALITY * breakdown.qualityScore + W_RECENCY * breakdown.recencyScore
            + W_KEYWORD * breakdown.keywordScore + W_LANGUAGE * breakdown.languageScore
            + W_PREFERRED_GENRE * breakdown.preferredGenreScore;
        return Number(Math.max(0.01, Math.min(0.99, raw)).toFixed(3));
    }

    private async fetchCandidates(mood: Mood, dto: GetRecommendationsDto, expanded = false): Promise<any[]> {
        const types: Array<'movie' | 'tv'> = dto.mediaType && dto.mediaType !== 'both' ? [dto.mediaType] : ['movie', 'tv'];
        const hour = Math.floor(Date.now() / 3600000);
        const endpoints: Array<{ path: string; mediaType: 'movie' | 'tv'; keyword?: string }> = [];
        for (const mediaType of types) {
            const profile = this.getMoodGenreProfile(mood, mediaType);
            const dateField = mediaType === 'movie' ? 'primary_release_date' : 'first_air_date';
            for (const [index, sort] of ['popularity.desc', 'vote_average.desc', 'popularity.desc', 'popularity.desc'].entries()) {
                const genres = index === 0 ? profile.primary : [...profile.primary, ...profile.secondary];
                const params = new URLSearchParams({
                    with_genres: genres.join('|'), without_genres: profile.excluded.join('|'),
                    sort_by: sort, page: String(index < 2 ? (expanded ? 2 : 1) : 2 + ((hour + index + (expanded ? 3 : 0)) % 7)),
                    include_adult: String(dto.includeAdult === true), language: 'en-US',
                    'vote_count.gte': mediaType === 'movie' ? '50' : '25',
                    'vote_average.gte': String(Math.max(5.5, dto.minRating ?? 0)),
                });
                if (index === 3) {
                    if (this.getMoodKey(mood) === 'nostalgic') params.set(dateField + '.lte', '2009-12-31');
                    else params.set(dateField + '.gte', new Date(Date.now() - 3 * 365 * 86400000).toISOString().slice(0, 10));
                }
                if (genres.length) endpoints.push({ path: 'discover/' + mediaType + '?' + params.toString(), mediaType });
            }
        }
        const terms = this.getMoodKeywords(mood).filter(term => term.length > 4).slice(0, 2);
        const keywordResults = await Promise.allSettled(terms.map(term => this.tmdbService.request('search/keyword', { params: { query: term } })));
        const keywords = keywordResults.flatMap((result, index) => result.status === 'fulfilled'
            ? (result.value?.results ?? []).filter((keyword: any) => keyword.name?.toLowerCase() === terms[index]) : []);
        for (const keyword of keywords) for (const mediaType of types) {
            endpoints.push({ mediaType, keyword: keyword.name, path: 'discover/' + mediaType + '?' + new URLSearchParams({
                with_keywords: String(keyword.id), include_adult: String(dto.includeAdult === true), language: 'en-US', page: expanded ? '2' : '1',
                'vote_count.gte': '25', 'vote_average.gte': String(Math.max(5.5, dto.minRating ?? 0)),
            }).toString() });
        }
        const responses = await Promise.allSettled(endpoints.map(async endpoint => {
            const data = await this.tmdbService.request(endpoint.path);
            if (!Array.isArray(data?.results)) throw new Error('Recommendation source unavailable');
            return (data?.results ?? []).map((item: any) => ({ ...item, keywords: endpoint.keyword ? [endpoint.keyword] : [], mediaType: endpoint.mediaType, _source: 'discover' }));
        }));
        if (responses.length && responses.every(result => result.status === 'rejected')) {
            throw new ServiceUnavailableException('Recommendation sources are temporarily unavailable.');
        }
        return responses.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    }

    // ---------------------------------------------------------------------------
    // Hard filters
    // ---------------------------------------------------------------------------

    // Quality, explicit language preferences, release eligibility and safety apply to every source.
    private passesHardFilters(item: any, dto: GetRecommendationsDto): boolean {
        if ((item.vote_count ?? 0) < (item.mediaType === 'tv' ? 25 : 50)) return false;
        if ((item.vote_average ?? 0) < Math.max(5.5, dto.minRating ?? 0)) return false;
        if (!item.poster_path || !(item.overview ?? '').trim()) return false;
        if (dto.includeAdult !== true && item.adult === true) return false;
        if ((item.vote_average ?? 0) < (dto.minRating ?? 0)) return false;
        if (dto.languages?.length && !dto.languages.includes(item.original_language)) return false;
        const release = Date.parse(item.release_date ?? item.first_air_date ?? '');
        if (!Number.isFinite(release) || release > Date.now()) return false;

        const fromYear = (dto as any).fromYear as number | undefined;
        if (fromYear) {
            const dateStr = item.release_date ?? item.first_air_date ?? '';
            const year = dateStr ? new Date(dateStr).getFullYear() : 0;
            if (year > 0 && year < fromYear) return false;
        }

        return true;
    }

    // ---------------------------------------------------------------------------
    // Diversity rebalancing
    // ---------------------------------------------------------------------------

    // ---------------------------------------------------------------------------
    // Scoring engine — 7 dimensions
    // ---------------------------------------------------------------------------

    // Genre tone is a proxy; explicit thematic evidence and exclusions gate eligibility separately.
    private scoreItem(item: any, mood: Mood): ScoredItem {
        const mediaType = item.mediaType === 'tv' ? 'tv' : 'movie';
        const moodGenreProfile = this.getMoodGenreProfile(mood, mediaType);
        const primaryGenreSet = new Set(moodGenreProfile.primary);
        const secondaryGenreSet = new Set(moodGenreProfile.secondary);
        const excludedGenreSet = new Set(moodGenreProfile.excluded);
        const itemGenreSet = new Set<number>(item.genre_ids ?? []);
        const moodValence = Number(mood.valence ?? 0);
        const moodArousal = Number(mood.arousal ?? 0);
        const keywords = this.getMoodKeywords(mood);
        const moodKey = this.getMoodKey(mood);
        const romanceTextScore = moodKey === 'romantic' ? this.getRomanceTextScore(item) : 0;

        // 1. Genre match. Primary genres define the mood. Secondary genres can
        // support the match, while excluded genres strongly reduce confidence.
        const primaryGenreMatches = [...itemGenreSet].filter(g => primaryGenreSet.has(g)).length;
        const secondaryGenreMatches = [...itemGenreSet].filter(g => secondaryGenreSet.has(g)).length;
        const excludedGenreMatches = [...itemGenreSet].filter(g => excludedGenreSet.has(g)).length;
        const primaryGenre = (item.genre_ids ?? [])[0] as number | undefined;
        const primaryCoverage = primaryGenreSet.size > 0 ? primaryGenreMatches / Math.min(primaryGenreSet.size, 2) : 0;
        const secondaryCoverage = secondaryGenreSet.size > 0 ? secondaryGenreMatches / Math.min(secondaryGenreSet.size, 3) : 0;
        const genreDensity = itemGenreSet.size > 0
            ? (primaryGenreMatches + secondaryGenreMatches * 0.45) / itemGenreSet.size
            : 0;
        const leadGenreBonus =
            primaryGenre !== undefined && primaryGenreSet.has(primaryGenre)
                ? 0.18
                : primaryGenre !== undefined && secondaryGenreSet.has(primaryGenre)
                    ? 0.06
                    : 0;
        const exclusionPenalty = Math.min(0.5, excludedGenreMatches * 0.28);
        const romanceTextBoost = moodKey === 'romantic' && mediaType === 'tv' ? romanceTextScore * 0.26 : romanceTextScore * 0.12;
        const genreScore = Math.max(
            0,
            Math.min(1, primaryCoverage * 0.68 + secondaryCoverage * 0.20 + genreDensity * 0.12 + leadGenreBonus + romanceTextBoost - exclusionPenalty),
        );

        // 2. Valence alignment
        const itemValenceVals = [...itemGenreSet]
            .map(g => GENRE_VALENCE[g])
            .filter((v): v is number => v !== undefined);
        const itemValence = itemValenceVals.length > 0
            ? itemValenceVals.reduce((a, b) => a + b, 0) / itemValenceVals.length
            : 0;
        const valenceScore = 1 - Math.abs(moodValence - itemValence) / 2;

        // 3. Arousal alignment
        const itemArousalVals = [...itemGenreSet]
            .map(g => GENRE_AROUSAL[g])
            .filter((v): v is number => v !== undefined);
        const itemArousal = itemArousalVals.length > 0
            ? itemArousalVals.reduce((a, b) => a + b, 0) / itemArousalVals.length
            : 0;
        const arousalScore = 1 - Math.abs(moodArousal - itemArousal) / 2;

        // 4. Popularity — log-normalised
        const rawPop = Math.min(item.popularity ?? 0, POPULARITY_CEIL);
        const popularityBase = Math.log1p(rawPop) / Math.log1p(POPULARITY_CEIL);
        const popularityScore = Math.pow(popularityBase, 0.75);

        // 5. Quality — confidence-adjusted vote average
        const voteConfidence = Math.min(1, (item.vote_count ?? 0) / 300);
        const qualityScore = ((item.vote_average ?? 0) / 10) * voteConfidence;

        // 6. Recency — exponential decay
        const releaseDateStr = item.release_date ?? item.first_air_date ?? null;
        let recencyScore = 0;

        if (releaseDateStr) {
            const releaseMs = new Date(releaseDateStr).getTime();
            const daysSince = Math.max(0, (Date.now() - releaseMs) / 86_400_000);
            recencyScore = Math.pow(2, -daysSince / RECENCY_HALF_LIFE_DAYS);
            if (moodKey === 'nostalgic') recencyScore = 1 - recencyScore;
        }

        // 7. Keyword match from title, overview, tagline, metadata, and source
        // language/country hints.
        const keywordScore = this.getKeywordMatchScore(item, keywords);

        // Shared candidates remain neutral; profile boosts are applied per session.
        const languageScore = 0.5;
        const preferredGenreScore = 0.5;

        const sourceScore = item._source === 'discover'
            ? 1
            : item._source === 'romance-keyword'
                ? 0.9
                : item._source === 'international-keyword'
                    ? 0.88
                    : item._source === 'related'
                        ? 0.82
                        : 0.72;
        const breakdown: ScoreBreakdown = {
            genreScore: parseFloat(genreScore.toFixed(3)),
            primaryGenreMatches,
            secondaryGenreMatches,
            excludedGenreMatches,
            romanceTextScore: parseFloat(romanceTextScore.toFixed(3)),
            valenceScore: parseFloat(valenceScore.toFixed(3)),
            arousalScore: parseFloat(arousalScore.toFixed(3)),
            popularityScore: parseFloat(popularityScore.toFixed(3)),
            qualityScore: parseFloat(qualityScore.toFixed(3)),
            recencyScore: parseFloat(recencyScore.toFixed(3)),
            keywordScore,
            languageScore: parseFloat(languageScore.toFixed(3)),
            preferredGenreScore,
            sourceScore: parseFloat(sourceScore.toFixed(3)),
        };
        return { raw: item, score: this.calculateScore(breakdown), breakdown };
    }

    private hasAcceptableMoodGenreFit(scored: ScoredItem, mood: Mood): boolean {
        const moodKey = this.getMoodKey(mood);
        const mediaType = scored.raw.mediaType === 'tv' ? 'tv' : 'movie';
        const { genreScore, primaryGenreMatches, secondaryGenreMatches, excludedGenreMatches, romanceTextScore, keywordScore } = scored.breakdown;

        if (excludedGenreMatches > 0) return false;

        const thematicMoods = ['sad', 'bittersweet', 'serenity', 'chill', 'inspirational', 'nostalgic'];
        if (thematicMoods.includes(moodKey) && keywordScore === 0) {
            if (moodKey === 'nostalgic') {
                const year = Number((scored.raw.release_date ?? scored.raw.first_air_date ?? '').slice(0, 4));
                if (!year || year > new Date().getFullYear() - 15) return false;
            } else return false;
        }
        if (moodKey === 'horror' && mediaType === 'tv' && this.getKeywordMatchScore(scored.raw, ['horror', 'haunted', 'ghost', 'supernatural', 'terror', 'demon', 'vampire', 'zombie']) === 0) return false;

        if (['western', 'documentary', 'sci-fi', 'funny', 'horror'].includes(moodKey) && primaryGenreMatches === 0) return false;

        if (moodKey === 'romantic') {
            if (mediaType === 'tv') {
                return excludedGenreMatches === 0
                    && romanceTextScore >= 0.5
                    && (genreScore >= 0.28 || secondaryGenreMatches > 0);
            }

            return primaryGenreMatches > 0 && excludedGenreMatches === 0 && genreScore >= 0.42;
        }

        if (mediaType === 'tv' && keywordScore >= 0.67 && excludedGenreMatches === 0 && genreScore >= 0.26) {
            return true;
        }

        return primaryGenreMatches > 0 || (secondaryGenreMatches > 0 && genreScore >= 0.32);
    }

    // ---------------------------------------------------------------------------
    // Generation pipeline
    // ---------------------------------------------------------------------------

    private async generateRecommendations(mood: Mood, dto: GetRecommendationsDto): Promise<any[]> {
        const genreMap = await this.getGenreMap();

        const rawCandidates = await this.fetchCandidates(mood, dto);
        if (rawCandidates.length === 0) {
            this.logger.warn(`Zero candidates for mood "${mood.name}"`);
            return [];
        }

        const unique = this.removeDuplicateContent(rawCandidates);
        this.logger.debug(`${unique.length} unique candidates for mood "${mood.name}"`);

        const filtered = unique.filter(item => this.passesHardFilters(item, dto));
        this.logger.debug(`${filtered.length} after hard filters for mood "${mood.name}"`);

        if (filtered.length === 0) {
            this.logger.warn(`All candidates filtered out for mood "${mood.name}"`);
            return [];
        }

        let scored = filtered
            .map(item => this.scoreItem(item, mood))
            .filter(item => this.hasAcceptableMoodGenreFit(item, mood))
            .sort((a, b) => b.score - a.score);

        if (scored.length < 10) {
            const extra = await this.fetchCandidates(mood, dto, true);
            scored = this.removeDuplicateContent([...filtered, ...extra])
                .filter(item => this.passesHardFilters(item, dto))
                .map(item => this.scoreItem(item, mood))
                .filter(item => this.hasAcceptableMoodGenreFit(item, mood))
                .sort((a, b) => b.score - a.score);
        }

        if (scored.length === 0) {
            this.logger.warn(`No candidates passed mood genre fit for "${mood.name}"`);
            return [];
        }

        // Cache relevance candidates; diversify and vary the ordering per session.
        return scored.slice(0, 96).map(item => this.buildRecommendationShape(item, mood, dto.userId ?? 'anonymous', genreMap));
    }

    private buildRecommendationShape(
        scored: ScoredItem,
        mood: Mood,
        userId: string,
        genreMap: Map<number, string>,
    ): any {
        const item = scored.raw;
        const isMovie = item.mediaType === 'movie';
        const title = (isMovie ? item.title : item.name) ?? 'Untitled';
        const itemGenres: number[] = item.genre_ids ?? [];
        const genreNames = itemGenres.map(id => genreMap.get(id)).filter((n): n is string => Boolean(n));

        return {
            userId,
            moodId: mood.id,
            tmdbId: item.id,
            mediaType: isMovie ? MediaType.MOVIE : MediaType.TV,
            title,
            overview: item.overview ?? '',
            genreIds: itemGenres,
            genreNames,
            voteAverage: item.vote_average ?? 0,
            voteCount: item.vote_count ?? 0,
            popularity: item.popularity ?? 0,
            releaseDate: isMovie ? (item.release_date ?? null) : (item.first_air_date ?? null),
            posterPath: item.poster_path ?? null,
            backdropPath: item.backdrop_path ?? null,
            score: new Prisma.Decimal(scored.score),
            reason: this.buildReason(mood, scored.breakdown, itemGenres, genreMap, isMovie ? 'movie' : 'tv'),
            algorithm: RECOMMENDATION_ALGORITHM,
            metadata: {
                scoreBreakdown: scored.breakdown,
                source: item._source ?? 'unknown',
                original_language: item.original_language ?? '',
                adult: item.adult === true,
                moodValence: Number(mood.valence),
                moodArousal: Number(mood.arousal),
                fetchedAt: new Date().toISOString(),
            },
            viewed: false,
            liked: false,
            saved: false,
        };
    }

    private buildReason(
        mood: Mood,
        breakdown: ScoreBreakdown,
        genreIds: number[],
        genreMap: Map<number, string>,
        mediaType: 'movie' | 'tv',
    ): string {
        const moodName = mood.name.toLowerCase();
        const profile = this.getMoodGenreProfile(mood, mediaType);
        const genreSet = new Set(genreIds);
        const primaryNames = profile.primary
            .filter(id => genreSet.has(id))
            .map(id => genreMap.get(id))
            .filter((name): name is string => Boolean(name));
        const secondaryNames = profile.secondary
            .filter(id => genreSet.has(id))
            .map(id => genreMap.get(id))
            .filter((name): name is string => Boolean(name));
        const parts: string[] = [];

        if (primaryNames.length > 0) {
            parts.push(`${primaryNames.slice(0, 2).join(' and ')} as the main match`);
        }

        if (breakdown.keywordScore > 0) parts.push('matching story themes');
        else if (secondaryNames.length > 0) parts.push(`${secondaryNames.slice(0, 2).join(' and ')} themes`);

        if (this.getMoodKey(mood) === 'romantic' && breakdown.romanceTextScore >= 0.5) {
            parts.push('romantic story signals');
        }

        if (parts.length === 0 && breakdown.genreScore >= 0.32) {
            parts.push('compatible genre signals');
        }

        return parts.length > 0
            ? `Matches your ${moodName} mood with ${parts.slice(0, 2).join(', ')}.`
            : `Matches your ${moodName} mood with a strong overall fit.`;
    }

    // ---------------------------------------------------------------------------
    // Persistence
    // ---------------------------------------------------------------------------

    private async saveRecommendations(recommendations: any[]): Promise<any[]> {
        const persisted: any[] = [];
        for (let index = 0; index < recommendations.length; index += 10) {
            const batch = await Promise.all(recommendations.slice(index, index + 10).map(async item => {
                const { id, genreNames, popularity, createdAt, updatedAt, viewed, liked, saved, rating, ...data } = item;
                const key = { userId: item.userId, moodId: item.moodId, tmdbId: item.tmdbId, mediaType: item.mediaType };
                const row = await this.prisma.recommendation.upsert({
                    where: { userId_moodId_tmdbId_mediaType: key }, create: data, update: data,
                });
                return { ...row, genreNames };
            }));
            persisted.push(...batch);
        }
        return persisted;
    }

    // ---------------------------------------------------------------------------
    // Analytics
    // ---------------------------------------------------------------------------

    async getMoodAnalytics(userId?: string): Promise<any> {
        const moodLogs = await this.prisma.moodLog.findMany({
            where: userId ? { userId } : {},
            include: { mood: true },
            orderBy: { createdAt: 'desc' },
        });

        const moodCounts: Record<string, number> = {};
        const moodIntensities: Record<string, number[]> = {};

        for (const log of moodLogs) {
            const name = log.mood.name;
            moodCounts[name] = (moodCounts[name] ?? 0) + 1;
            (moodIntensities[name] ??= []).push(log.intensity);
        }

        const total = moodLogs.length;

        return {
            totalLogs: total,
            moodDistribution: Object.entries(moodCounts).map(([mood, count]) => ({
                mood,
                count,
                percentage: total > 0 ? ((count / total) * 100).toFixed(1) : '0.0',
            })),
            averageIntensities: Object.entries(moodIntensities).map(([mood, intensities]) => ({
                mood,
                average: intensities.reduce((a, b) => a + b, 0) / intensities.length,
            })),
            mostCommonMood: Object.entries(moodCounts).sort(([, a], [, b]) => b - a)[0] ?? null,
            recentActivity: moodLogs.slice(0, 10),
        };
    }

    // ---------------------------------------------------------------------------
    // Utilities
    // ---------------------------------------------------------------------------

    private paginateResults(
        recommendations: any[],
        page: number,
        limit: number,
    ): { recommendations: any[]; total: number; page: number; totalPages: number } {
        const total = recommendations.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const safePage = Math.max(1, page);
        const start = (safePage - 1) * limit;
        return {
            recommendations: recommendations.slice(start, start + limit),
            total,
            page: safePage,
            totalPages,
        };
    }

    private selectVariedRecommendations<T extends { score?: any; tmdbId?: number; id?: number | string; mediaType?: MediaType | string }>(
        recommendations: T[],
        limit: number,
        shuffle: boolean,
        seed = 0,
    ): T[] {
        const sorted = this.dedupeByContent([...recommendations].sort((a, b) => this.getRecommendationScore(b) - this.getRecommendationScore(a) || this.getContentKey(a).localeCompare(this.getContentKey(b))));
        if (!shuffle) return sorted.slice(0, limit);
        return rankRecommendations(sorted, item => {
            const rec = item as any;
            return { key: this.getContentKey(item), score: this.getRecommendationScore(item),
                genres: rec.genreIds ?? [], language: rec.metadata?.original_language,
                type: String(rec.mediaType), year: rec.releaseDate, collection: rec.metadata?.collectionId };
        }, seed).slice(0, limit);
    }

    private dedupeByContent<T extends { tmdbId?: number; id?: number | string; mediaType?: MediaType | string }>(items: T[]): T[] {
        const seen = new Set<string>();
        return items.filter(item => {
            const key = this.getContentKey(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    private getContentKey(item: { tmdbId?: number; id?: number | string; mediaType?: MediaType | string }): string {
        const rawMedia = String(item.mediaType ?? 'unknown').toLowerCase();
        const media = rawMedia === 'movie' || rawMedia === 'movies'
            ? 'movie'
            : rawMedia === 'tv' || rawMedia === 'series'
                ? 'tv'
                : rawMedia;
        return `${media}:${item.tmdbId ?? item.id ?? 'missing'}`;
    }

    private getRecommendationScore(item: { score?: any }): number {
        const score = item.score;
        if (typeof score === 'number') return score;
        if (typeof score === 'string') return Number(score);
        if (score && typeof score.toNumber === 'function') return score.toNumber();
        return Number(score ?? 0);
    }

    private removeDuplicateContent<T extends { id?: number; mediaType?: string }>(array: T[]): T[] {
        const unique = new Map<string, T>();
        for (const item of array) {
            const key = this.getContentKey(item);
            const previous = unique.get(key) as any;
            unique.set(key, previous ? { ...previous, keywords: [...new Set([...(previous.keywords ?? []), ...((item as any).keywords ?? [])])] } : item);
        }
        return [...unique.values()];
    }


}
