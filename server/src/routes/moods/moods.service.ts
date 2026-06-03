import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TMDBService } from 'src/external-apis/services/tmdb.service';
import { GetRecommendationsDto } from './dto/get-recommendations.dto';
import { LogMoodDto } from './dto/log-mood.dto';
import { RecommendationFeedbackDto } from './dto/recommendation-feedback.dto';
import { Mood, MoodLog, Recommendation, MediaType, Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Scoring weights — must sum to 1.0
//
// v2 → v3 delta:
//   Genre      0.45 → 0.30  over-dominant; small-genre moods had near-zero
//                            Jaccard scores even for perfect thematic matches
//   Valence    0.20 → 0.18  slight trim to make room for new signals
//   Arousal    0.15 → 0.12  slight trim
//   Popularity  NEW → 0.15  log-normalised TMDB popularity; rewards content
//                            people actually watch without letting blockbusters
//                            monopolise the results
//   Quality    0.15 → 0.12  still present; popularity partially overlaps
//   Recency     NEW → 0.08  exponential time-decay; fresher content gets a
//                            mild boost so lists don't skew toward classics
//   Keyword    0.05 → 0.05  unchanged
// ---------------------------------------------------------------------------
const W_GENRE = 0.34;
const W_VALENCE = 0.10;
const W_AROUSAL = 0.07;
const W_POPULARITY = 0.18;
const W_QUALITY = 0.16;
const W_RECENCY = 0.06;
const W_KEYWORD = 0.06;
const W_LANGUAGE = 0.03;


const WEIGHT_SUM = W_GENRE + W_VALENCE + W_AROUSAL + W_POPULARITY + W_QUALITY + W_RECENCY + W_KEYWORD + W_LANGUAGE;
if (Math.abs(WEIGHT_SUM - 1.0) > 0.001) {
    throw new Error(`Scoring weights must sum to 1.0, got ${WEIGHT_SUM}`);
}

const DISCOVER_PAGES = 8;

// TMDB popularity is unbounded — cap before log-normalising so blockbusters
// don't get unbounded advantage over solid mid-tier titles.
const POPULARITY_CEIL = 120;

// Exponential half-life for recency decay (days). Item released exactly this
// many days ago scores 0.5; older items decay toward 0.
const RECENCY_HALF_LIFE_DAYS = 365 * 2;

// Maximum items sharing the same primary genre in one result set. Prevents
// "all 12 results are pure comedies" for moods dominated by a single genre.
const GENRE_DIVERSITY_CAP = 4;

// Language allow-list applied as a hard filter. Callers may override via
// dto.languages. Empty array = no language restriction.
const DEFAULT_LANGUAGES = ['en', 'ko', 'ja', 'zh'];
const FALLBACK_MOVIE_GENRES = [18, 35, 28, 12, 878, 14];
const FALLBACK_TV_GENRES = [18, 35, 10759, 10765, 9648, 80];
const MIN_STRONG_SCORE = 0.46;
const RECOMMENDATION_ALGORITHM = 'mood-scored-v4';

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
    western: { movie: { primary: [37], secondary: [28, 12, 80, 18], excluded: [10749, 10751] }, tv: { primary: [10759, 80], secondary: [18], excluded: [10751, 10762] }, related: ['gritty', 'epic', 'thrilling'] },
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
        return MOOD_GENRE_CONFIG[moodKey] ?? MOOD_GENRE_CONFIG[MOOD_CONFIG_ALIASES[moodKey]];
    }

    private getMoodKeywords(mood: Mood): string[] {
        const configured = this.getMoodConfig(mood)?.keywords ?? [];
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

    private getMoodGenresForMedia(mood: Mood, mediaType: 'movie' | 'tv'): number[] {
        const profile = this.getMoodGenreProfile(mood, mediaType);
        return Array.from(new Set([...profile.primary, ...profile.secondary]));
    }

    private getScoringGenreSet(mood: Mood, mediaType?: 'movie' | 'tv'): Set<number> {
        if (mediaType) return new Set(this.getMoodGenresForMedia(mood, mediaType));
        return new Set((mood.tmdbGenres as number[] | null) ?? []);
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

        const matches = keywords.filter(term => text.includes(term.toLowerCase())).length;
        return Math.min(1, matches / 3);
    }

    private getRomanceTextScore(item: any): number {
        return this.getKeywordMatchScore(item, ROMANCE_TEXT_TERMS);
    }

    private async getRelatedMoodGenres(
        mood: Mood,
        mediaType: 'movie' | 'tv',
    ): Promise<number[]> {
        const profile = MEDIA_SPECIFIC_MOOD_GENRES[this.getMoodKey(mood)];
        const direct = this.getMoodGenresForMedia(mood, mediaType);
        if (!profile?.related?.length) return direct;

        const related = profile.related.flatMap(key => {
            const relatedProfile = MEDIA_SPECIFIC_MOOD_GENRES[key]?.[mediaType];
            return relatedProfile ? [...relatedProfile.primary, ...relatedProfile.secondary] : [];
        });
        return Array.from(new Set([...direct.slice(0, 3), ...related]));
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
        const page = dto.page ?? 1;
        const limit = dto.limit ?? 12;

        if (!dto.forceRefresh) {
            const cached = await this.getCachedRecommendations(dto);
            if (cached.length >= limit) {
                this.logger.debug(`Cache hit: ${cached.length} recs for mood "${mood.name}"`);
                return this.paginateResults(
                    this.selectVariedRecommendations(cached, limit * page, dto.shuffle !== false),
                    page,
                    limit,
                );
            }
        }

        this.logger.debug(`Cache miss — generating recs for mood "${mood.name}"`);
        try {
            const fresh = await this.generateRecommendations(mood, dto);

            if (fresh.length === 0) {
                this.logger.warn(`No fresh recs for "${mood.name}", falling back to DB`);
                const fallback = await this.getFallbackRecommendations(mood, dto);
                await this.saveRecommendations(fallback);
                return this.paginateResults(fallback, page, limit);
            }

            if (dto.forceRefresh) {
                await this.clearCachedRecommendations(dto);
            }

            await this.saveRecommendations(fresh);
            return this.paginateResults(
                this.selectVariedRecommendations(fresh, limit * page, dto.shuffle !== false),
                page,
                limit,
            );
        } catch (error) {
            this.logger.error(`Generation error for mood "${mood.name}":`, error);
            const fallback = await this.getFallbackRecommendations(mood, dto);
            return this.paginateResults(fallback, page, limit);
        }
    }

    async regenerateRecommendations(dto: GetRecommendationsDto): Promise<{
        recommendations: any[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const where: Prisma.RecommendationWhereInput = {
            moodId: dto.moodId,
            ...(dto.userId ? { userId: dto.userId } : {}),
        };
        const { count } = await this.prisma.recommendation.deleteMany({ where });
        this.logger.debug(
            `Deleted ${count} stale recs for mood ${dto.moodId}${dto.userId ? ` / user ${dto.userId}` : ''}`,
        );
        return this.getRecommendations({ ...dto, forceRefresh: true, limit: dto.limit ?? 12, page: 1 });
    }

    async provideFeedback(dto: RecommendationFeedbackDto): Promise<Recommendation> {
        const rec = await this.prisma.recommendation.findUnique({ where: { id: dto.recommendationId } });
        if (!rec) throw new NotFoundException('Recommendation not found');
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

    private async getCachedRecommendations(dto: GetRecommendationsDto): Promise<Recommendation[]> {
        const genreMap = await this.getGenreMap();
        const windowStart = new Date();
        windowStart.setMinutes(windowStart.getMinutes() - this.REC_CACHE_WINDOW_MINUTES);

        const where: Prisma.RecommendationWhereInput = {
            moodId: dto.moodId,
            algorithm: RECOMMENDATION_ALGORITHM,
            createdAt: { gte: windowStart },
            ...(dto.userId ? { userId: dto.userId } : {}),
            ...(dto.mediaType && dto.mediaType !== 'both'
                ? { mediaType: dto.mediaType.toUpperCase() as MediaType } : {}),
            ...(dto.minRating ? { voteAverage: { gte: new Prisma.Decimal(dto.minRating) } } : {}),
            ...(dto.excludeViewed ? { viewed: false } : {}),
        };

        const pool = await this.prisma.recommendation.findMany({
            where,
            orderBy: { score: 'desc' },
            take: (dto.limit ?? 12) * 8,
        });

        return pool.map(r => ({
            ...r,
            genreNames: (r.genreIds ?? []).map((id: number) => genreMap.get(id)).filter(Boolean),
        } as Recommendation & { genreNames: string[] }));
    }

    private async getFallbackRecommendations(mood: Mood, dto: GetRecommendationsDto): Promise<any[]> {
        const genreMap = await this.getGenreMap();
        const windowStart = new Date();
        windowStart.setMinutes(windowStart.getMinutes() - this.REC_CACHE_WINDOW_MINUTES);

        const rows = await this.prisma.recommendation.findMany({
            where: {
                moodId: mood.id,
                algorithm: RECOMMENDATION_ALGORITHM,
                createdAt: { gte: windowStart },
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

        return this.selectVariedRecommendations(mapped, dto.limit ?? 12, dto.shuffle !== false);
    }

    private async clearCachedRecommendations(dto: GetRecommendationsDto): Promise<void> {
        await this.prisma.recommendation.deleteMany({
            where: {
                moodId: dto.moodId,
                algorithm: RECOMMENDATION_ALGORITHM,
                ...(dto.userId ? { userId: dto.userId } : {}),
                ...(dto.mediaType && dto.mediaType !== 'both'
                    ? { mediaType: dto.mediaType.toUpperCase() as MediaType } : {}),
            },
        });
    }

    // ---------------------------------------------------------------------------
    // Content fetching — three passes
    // ---------------------------------------------------------------------------

    private async fetchCandidates(mood: Mood, dto: GetRecommendationsDto): Promise<any[]> {
        const keywords = this.getMoodKeywords(mood);
        const minVote = dto.minRating ?? 0;
        const requestedMedia = dto.mediaType ?? 'both';
        const wantMovies = requestedMedia === 'both' || requestedMedia === 'movie';
        const wantTV = requestedMedia === 'both' || requestedMedia === 'tv';
        const moodKey = this.getMoodKey(mood);
        const movieGenres = this.getMoodGenresForMedia(mood, 'movie');
        const tvGenres = this.getMoodGenresForMedia(mood, 'tv');
        const allContent: any[] = [];

        // Pass 1 — genre discover
        const pages = this.pickRandomPages(1, DISCOVER_PAGES + 8, DISCOVER_PAGES);
        await Promise.all(pages.flatMap(page => {
            const tasks: Promise<void>[] = [];
            if (wantMovies && movieGenres.length > 0) {
                tasks.push(
                    this.tmdbService.getMoviesByGenres(movieGenres, page, minVote)
                        .then(r => { if (Array.isArray(r)) allContent.push(...r.map((m: any) => ({ ...m, mediaType: 'movie', _source: 'discover' }))); })
                        .catch(e => this.logger.warn(`Discover movies p${page}: ${e?.message}`)),
                );
            }
            if (wantTV && tvGenres.length > 0) {
                tasks.push(
                    this.tmdbService.getTVShowsByGenres(tvGenres, page, minVote)
                        .then(r => { if (Array.isArray(r)) allContent.push(...r.map((t: any) => ({ ...t, mediaType: 'tv', _source: 'discover' }))); })
                        .catch(e => this.logger.warn(`Discover TV p${page}: ${e?.message}`)),
                );
            }
            return tasks;
        }));

        // Pass 2 — keyword search
        const searchKeywords = this.shuffleArray(keywords).slice(0, 5);
        if (searchKeywords.length > 0) {
            await Promise.all(searchKeywords.flatMap(kw => {
                const tasks: Promise<void>[] = [];
                if (wantMovies) {
                    tasks.push(
                        this.tmdbService.searchContent(kw, 'movie')
                            .then(r => { if (Array.isArray(r)) allContent.push(...r.filter(i => !minVote || (i.vote_average ?? 0) >= minVote).map((m: any) => ({ ...m, mediaType: 'movie', _source: 'keyword' }))); })
                            .catch(e => this.logger.warn(`Keyword movie "${kw}": ${e?.message}`)),
                    );
                }
                if (wantTV) {
                    tasks.push(
                        this.tmdbService.searchContent(kw, 'tv')
                            .then(r => { if (Array.isArray(r)) allContent.push(...r.filter(i => !minVote || (i.vote_average ?? 0) >= minVote).map((t: any) => ({ ...t, mediaType: 'tv', _source: 'keyword' }))); })
                            .catch(e => this.logger.warn(`Keyword TV "${kw}": ${e?.message}`)),
                    );
                }
                return tasks;
            }));
            this.logger.debug(`Pass 2 done; total: ${allContent.length} for mood "${mood.name}"`);
        }

        // Pass 3 — broad fallback
        const configuredMoodKey = MOOD_CONFIG_ALIASES[moodKey] ?? moodKey;
        const internationalMood = ['romantic', 'sad', 'excited', 'scared'].includes(configuredMoodKey);
        if (internationalMood && searchKeywords.length > 0) {
            const languages = ['ko-KR', 'ja-JP', 'zh-CN'];
            await Promise.all(this.shuffleArray(searchKeywords).slice(0, 3).flatMap(kw =>
                languages.flatMap(language => {
                    const tasks: Promise<void>[] = [];
                    if (wantMovies) {
                        tasks.push(
                            this.tmdbService.searchContent(kw, 'movie', 1, language)
                                .then(r => { if (Array.isArray(r)) allContent.push(...r.filter(i => !minVote || (i.vote_average ?? 0) >= minVote).map((m: any) => ({ ...m, mediaType: 'movie', _source: 'international-keyword' }))); })
                                .catch(e => this.logger.warn(`International movie "${kw}" ${language}: ${e?.message}`)),
                        );
                    }
                    if (wantTV) {
                        tasks.push(
                            this.tmdbService.searchContent(kw, 'tv', 1, language)
                                .then(r => { if (Array.isArray(r)) allContent.push(...r.filter(i => !minVote || (i.vote_average ?? 0) >= minVote).map((t: any) => ({ ...t, mediaType: 'tv', _source: 'international-keyword' }))); })
                                .catch(e => this.logger.warn(`International TV "${kw}" ${language}: ${e?.message}`)),
                        );
                    }
                    return tasks;
                }),
            ));
        }

        if (moodKey === 'romantic' && wantTV) {
            const romanticTvSearches = ['romance', 'romantic drama', 'love story', 'relationship drama'];
            await Promise.all(romanticTvSearches.map(kw =>
                this.tmdbService.searchContent(kw, 'tv')
                    .then(r => {
                        if (Array.isArray(r)) {
                            allContent.push(
                                ...r
                                    .filter(i => !minVote || (i.vote_average ?? 0) >= minVote)
                                    .map((t: any) => ({ ...t, mediaType: 'tv', _source: 'romance-keyword' })),
                            );
                        }
                    })
                    .catch(e => this.logger.warn(`Romantic TV keyword "${kw}": ${e?.message}`)),
            ));
        }

        if (allContent.length < 60) {
            this.logger.debug(`Only ${allContent.length} candidates — broadening with related mood genres`);
            const extraPages = this.pickRandomPages(1, 10, 4);
            const relatedMovieGenres = wantMovies ? await this.getRelatedMoodGenres(mood, 'movie') : [];
            const relatedTvGenres = wantTV ? await this.getRelatedMoodGenres(mood, 'tv') : [];
            await Promise.all(extraPages.flatMap(page => {
                const tasks: Promise<void>[] = [];
                if (wantMovies) {
                    tasks.push(
                        this.tmdbService.getMoviesByGenres(relatedMovieGenres.length > 0 ? relatedMovieGenres : FALLBACK_MOVIE_GENRES, page, minVote)
                            .then(r => { if (Array.isArray(r)) allContent.push(...r.map((m: any) => ({ ...m, mediaType: 'movie', _source: 'related' }))); })
                            .catch(() => { }),
                    );
                }
                if (wantTV) {
                    tasks.push(
                        this.tmdbService.getTVShowsByGenres(relatedTvGenres.length > 0 ? relatedTvGenres : FALLBACK_TV_GENRES, page, minVote)
                            .then(r => { if (Array.isArray(r)) allContent.push(...r.map((t: any) => ({ ...t, mediaType: 'tv', _source: 'related' }))); })
                            .catch(() => { }),
                    );
                }
                return tasks;
            }));
        }

        this.logger.debug(`Fetched ${allContent.length} raw candidates for mood "${mood.name}"`);
        return allContent;
    }

    // ---------------------------------------------------------------------------
    // Hard filters
    // ---------------------------------------------------------------------------

    /**
     * Gates that eliminate items entirely before scoring.
     *
     * minRating  — Drop below caller's vote_average threshold.
     * adult      — Strip adult content unless dto.includeAdult is true.
     * language   — Allow-list of original_language codes (default: ['en']).
     *              Prevents non-English world cinema flooding results when a
     *              mood's genres are broad (e.g. Drama covers everything).
     *              Pass dto.languages = [] to disable the gate entirely.
     * fromYear   — Optional lower bound on release year. Useful when the mood
     *              or caller explicitly wants recent content only.
     */
    private passesHardFilters(item: any, dto: GetRecommendationsDto): boolean {
        if ((item.vote_count ?? 0) < (item.mediaType === 'tv' ? 40 : 80)) return false;
        if ((item.vote_average ?? 0) > 0 && (item.vote_average ?? 0) < 5.5) return false;
        if (!item.poster_path || !(item.overview ?? '').trim()) return false;
        if (dto.includeAdult === false && item.adult === true) return false;

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

    /**
     * Prevents a single genre from dominating the final result set.
     *
     * Walks the scored list (highest first) and enforces GENRE_DIVERSITY_CAP
     * per primary genre. Overflowing items are placed in a reserve list and
     * used to fill any gap if the main pass can't reach `limit`.
     */
    private applyDiversityCap(scored: ScoredItem[], limit: number, perGenreCap = GENRE_DIVERSITY_CAP): ScoredItem[] {
        const genreCount: Record<number, number> = {};
        const selected: ScoredItem[] = [];
        const overflow: ScoredItem[] = [];

        for (const item of scored) {
            const primaryGenre = (item.raw.genre_ids ?? [])[0] as number | undefined;
            const count = primaryGenre !== undefined ? (genreCount[primaryGenre] ?? 0) : 0;

            if (primaryGenre === undefined || count < perGenreCap) {
                selected.push(item);
                if (primaryGenre !== undefined) genreCount[primaryGenre] = count + 1;
            } else {
                overflow.push(item);
            }

            if (selected.length >= limit) break;
        }

        // Relax cap if we still can't fill the limit
        if (selected.length < limit) {
            for (const item of overflow) {
                selected.push(item);
                if (selected.length >= limit) break;
            }
        }

        return selected.slice(0, limit);
    }

    // ---------------------------------------------------------------------------
    // Scoring engine — 7 dimensions
    // ---------------------------------------------------------------------------

    /**
     * Scores a single TMDB item against a mood on seven independent signals,
     * each clamped to [0, 1] before weighting.
     *
     * 1. genreScore      Jaccard similarity: |intersection| / |union| of the
     *                    item's genre_ids and the mood's tmdbGenres. Reduced
     *                    weight (0.30) avoids punishing moods with small genre
     *                    sets or cross-genre items.
     *
     * 2. valenceScore    Emotional tone alignment. Averages GENRE_VALENCE for
     *                    each genre on the item, then computes
     *                    1 - |moodValence - itemValence| / 2. Scale is [-1,+1]
     *                    on both sides so max distance = 2 and the result is
     *                    always in [0, 1].
     *
     * 3. arousalScore    Energy/pace alignment via GENRE_AROUSAL. Same maths.
     *
     * 4. popularityScore Log-normalised TMDB popularity score. Raw TMDB
     *                    popularity is unbounded and Pareto-skewed — blockbusters
     *                    score 100-300+ while solid indie films score 5-20.
     *                    Log compression: log(1+pop) / log(1+CEIL). Items at the
     *                    cap score 1.0; the bottom 10% still score ~0.1 so they
     *                    aren't completely disadvantaged.
     *
     * 5. qualityScore    vote_average / 10, discounted by a confidence factor
     *                    that ramps 0→1 over the first 100 votes. A 10.0 from
     *                    3 votes scores ~0.30; the same 10.0 from 1000 votes
     *                    scores ~0.98.
     *
     * 6. recencyScore    Exponential time-decay from the release/air date.
     *                    Formula: 2^(-daysSince / HALF_LIFE). Today = 1.0;
     *                    HALF_LIFE days ago = 0.5; very old → approaches 0.
     *                    Items with no date receive a neutral 0.5 so they
     *                    compete on the other six signals.
     *
     * 7. keywordScore    Binary: 1 if any mood keyword appears in
     *                    title + overview (case-insensitive), 0 otherwise.
     */
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
        let recencyScore = 0.9;

        if (releaseDateStr) {
            const releaseMs = new Date(releaseDateStr).getTime();
            const daysSince = Math.max(0, (Date.now() - releaseMs) / 86_400_000);
            recencyScore = Math.pow(2, -daysSince / RECENCY_HALF_LIFE_DAYS);
            recencyScore = Math.pow(recencyScore, 0.85);
        }

        // 7. Keyword match from title, overview, tagline, metadata, and source
        // language/country hints.
        const keywordScore = this.getKeywordMatchScore(item, keywords);

        // 8. Language preference (soft boost)
        const lang = (item.original_language ?? '').toLowerCase();
        const preferredLangs = ['en', 'ko', 'ja', 'zh'];

        let languageScore = 0.6; // neutral baseline

        if (preferredLangs.includes(lang)) {
            languageScore = 1;
        } else if (!lang) {
            languageScore = 0.5;
        } else {
            languageScore = 0.4;
        }

        const sourceScore = item._source === 'discover'
            ? 1
            : item._source === 'romance-keyword'
                ? 0.9
                : item._source === 'international-keyword'
                    ? 0.88
                    : item._source === 'related'
                        ? 0.82
                        : 0.72;
        const raw =
            W_GENRE * genreScore +
            W_VALENCE * valenceScore +
            W_AROUSAL * arousalScore +
            W_POPULARITY * popularityScore +
            W_QUALITY * qualityScore +
            W_RECENCY * recencyScore +
            W_KEYWORD * keywordScore +
            W_LANGUAGE * languageScore;

        const score = parseFloat(Math.max(0.01, Math.min(0.99, raw * sourceScore)).toFixed(4));

        return {
            raw: item,
            score,
            breakdown: {
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
                sourceScore: parseFloat(sourceScore.toFixed(3)),
            },
        };
    }

    private hasAcceptableMoodGenreFit(scored: ScoredItem, mood: Mood): boolean {
        const moodKey = this.getMoodKey(mood);
        const mediaType = scored.raw.mediaType === 'tv' ? 'tv' : 'movie';
        const { genreScore, primaryGenreMatches, secondaryGenreMatches, excludedGenreMatches, romanceTextScore, keywordScore } = scored.breakdown;

        if (excludedGenreMatches >= 2) return false;
        if (excludedGenreMatches > 0 && primaryGenreMatches === 0) return false;

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

        const scored = filtered
            .map(item => this.scoreItem(item, mood))
            .filter(item => this.hasAcceptableMoodGenreFit(item, mood))
            .sort((a, b) => b.score - a.score);

        if (scored.length === 0) {
            this.logger.warn(`No candidates passed mood genre fit for "${mood.name}"`);
            return [];
        }

        const requestedLimit = dto.limit ?? 12;
        const limit = Math.min(50, Math.max(requestedLimit * 3, 24));
        const strong = scored.filter(item => item.score >= MIN_STRONG_SCORE);
        const rankedPool = strong.length >= Math.min(limit, 8) ? strong : scored;

        const topPool = rankedPool.slice(0, limit * 5);
        const randomizedPool = this.randomizeWithinScoreBands(topPool, 0.05);
        const diverse = this.applyDiversityCap(randomizedPool, limit, Math.max(GENRE_DIVERSITY_CAP, Math.ceil(limit / 4)));

        this.logger.debug(
            `Final: ${diverse.length} items selected for mood "${mood.name}" (scores ${diverse[0]?.score ?? 0}–${diverse[diverse.length - 1]?.score ?? 0})`,
        );

        return diverse.map(s =>
            this.buildRecommendationShape(s, mood, dto.userId ?? 'anonymous', genreMap),
        );
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
            reason: this.buildReason(mood, scored.breakdown, itemGenres, genreMap),
            algorithm: RECOMMENDATION_ALGORITHM,
            metadata: {
                scoreBreakdown: scored.breakdown,
                source: item._source ?? 'unknown',
                moodValence: Number(mood.valence),
                moodArousal: Number(mood.arousal),
                fetchedAt: new Date().toISOString(),
            },
            viewed: false,
            liked: false,
            saved: false,
        };
    }

    /**
     * Generates a concise, signal-driven reason string for the user.
     *
     * Priority:
     *   1. Genre match    — most informative; always shown when score ≥ 0.35
     *   2. Emotional tone — shown when valence or arousal score is notably high
     *   3. Popularity     — "widely popular" when that's a dominant driver
     *   4. Recency        — "recently released" for fresh content
     *   5. Keyword        — surfaces the exact keyword hit
     *
     * Capped at 2 signals to keep the string scannable.
     */
    private buildReason(
        mood: Mood,
        breakdown: ScoreBreakdown,
        genreIds: number[],
        genreMap: Map<number, string>,
    ): string {
        const moodName = mood.name.toLowerCase();
        const mediaType = genreIds.some(id => id === 10766 || id === 10759 || id === 10765 || id === 10762 || id === 10764)
            ? 'tv'
            : 'movie';
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

        if (secondaryNames.length > 0) {
            parts.push(`${secondaryNames.slice(0, 2).join(' and ')} as supporting flavor`);
        }

        if (this.getMoodKey(mood) === 'romantic' && breakdown.romanceTextScore >= 0.5) {
            parts.push('romantic story signals');
        }

        if (parts.length === 0 && breakdown.genreScore >= 0.32) {
            parts.push('compatible genre signals');
        }

        return parts.length > 0
            ? `Matches your ${moodName} mood with ${parts.join(', ')}.`
            : `Matches your ${moodName} mood with a strong overall fit.`;
    }

    // ---------------------------------------------------------------------------
    // Persistence
    // ---------------------------------------------------------------------------

    private async saveRecommendations(recommendations: any[]): Promise<void> {
        if (!recommendations.length) return;

        // Pre-dedup by (moodId, userId, tmdbId, mediaType) — createMany's
        // skipDuplicates only guards exact full-row matches, not this key tuple.
        const seen = new Set<string>();
        const deduped = recommendations.filter(r => {
            const key = `${r.moodId}:${r.userId}:${r.tmdbId}:${r.mediaType}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const BATCH = 20;
        for (let i = 0; i < deduped.length; i += BATCH) {
            const batch = deduped.slice(i, i + BATCH);
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
                this.logger.error(`Failed to save batch at index ${i}:`, (error as any).message);
            }
        }
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
        const safePage = Math.min(Math.max(1, page), totalPages);
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
    ): T[] {
        const sorted = this.dedupeByContent(
            [...recommendations].sort((a, b) => this.getRecommendationScore(b) - this.getRecommendationScore(a)),
        );

        if (!shuffle || sorted.length <= limit) return sorted.slice(0, limit);

        const selected: T[] = [];
        const seen = new Set<string>();
        const add = (item: T) => {
            const key = this.getContentKey(item);
            if (seen.has(key)) return;
            seen.add(key);
            selected.push(item);
        };

        const candidatePool = sorted.slice(0, Math.min(sorted.length, limit * 8));
        const jittered = this.randomizeWithinScoreBands(candidatePool, 0.05);

        for (const item of jittered) {
            add(item);
            if (selected.length >= limit) break;
        }

        if (selected.length < limit) {
            for (const item of sorted) {
                add(item);
                if (selected.length >= limit) break;
            }
        }

        return selected.slice(0, limit);
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

    private randomizeWithinScoreBands<T extends { score?: any }>(items: T[], bandSize = 0.05): T[] {
        const bands = new Map<number, T[]>();

        for (const item of items) {
            const score = this.getRecommendationScore(item);
            const band = Math.floor(score / bandSize);
            const current = bands.get(band) ?? [];
            current.push(item);
            bands.set(band, current);
        }

        return [...bands.entries()]
            .sort(([a], [b]) => b - a)
            .flatMap(([, bandItems]) => this.shuffleArray(bandItems));
    }

    private removeDuplicates<T>(array: T[], key: keyof T): T[] {
        const seen = new Set();
        return array.filter(item => {
            const v = item[key];
            if (seen.has(v)) return false;
            seen.add(v);
            return true;
        });
    }

    private removeDuplicateContent<T extends { id?: number; mediaType?: string }>(array: T[]): T[] {
        return this.dedupeByContent(array);
    }

    private shuffleArray<T>(array: T[]): T[] {
        const a = [...array];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    private pickRandomPages(min: number, max: number, count: number): number[] {
        const pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);
        return this.shuffleArray(pool).slice(0, Math.min(count, pool.length));
    }
}
