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
const W_GENRE = 0.22;
const W_VALENCE = 0.14;
const W_AROUSAL = 0.09;
const W_POPULARITY = 0.22;
const W_QUALITY = 0.09;
const W_RECENCY = 0.14;
const W_KEYWORD = 0.05;
const W_LANGUAGE = 0.05;


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
const FALLBACK_MOVIE_GENRES = [18, 35, 28, 878, 14];
const FALLBACK_TV_GENRES = [18, 35, 10759, 10765, 9648];

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
    valenceScore: number;
    arousalScore: number;
    popularityScore: number;
    qualityScore: number;
    recencyScore: number;
    keywordScore: number;
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
            for (const g of [...movieGenres, ...tvGenres]) map.set(g.id, g.name);
            this.genreCache = map;
            this.genreCacheExpiry = now + this.GENRE_CACHE_TTL_MS;
            return map;
        } catch (error) {
            this.logger.error('Failed to build genre map', error);
            return this.genreCache ?? new Map();
        }
    }

    async getGenreNames(genreIds: number[]): Promise<string[]> {
        if (!genreIds?.length) return [];
        const map = await this.getGenreMap();
        return genreIds.map(id => map.get(id)).filter((n): n is string => Boolean(n));
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
                return this.paginateResults(cached, page, limit);
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

            await this.saveRecommendations(fresh);
            return this.paginateResults(fresh, page, limit);
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
        const windowStart = new Date();
        windowStart.setMinutes(windowStart.getMinutes() - this.REC_CACHE_WINDOW_MINUTES);

        const where: Prisma.RecommendationWhereInput = {
            moodId: dto.moodId,
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
            take: (dto.limit ?? 12) * 4,
        });

        return pool.slice(0, dto.limit ?? 12);
    }

    private async getFallbackRecommendations(mood: Mood, dto: GetRecommendationsDto): Promise<any[]> {
        const genreMap = await this.getGenreMap();
        const windowStart = new Date();
        windowStart.setMinutes(windowStart.getMinutes() - this.REC_CACHE_WINDOW_MINUTES);

        const rows = await this.prisma.recommendation.findMany({
            where: {
                moodId: mood.id,
                createdAt: { gte: windowStart },
                ...(dto.mediaType && dto.mediaType !== 'both'
                    ? { mediaType: dto.mediaType.toUpperCase() as MediaType } : {}),
                ...(dto.minRating ? { voteAverage: { gte: new Prisma.Decimal(dto.minRating) } } : {}),
                ...(dto.excludeViewed ? { viewed: false } : {}),
            },
            orderBy: { score: 'desc' },
            take: dto.limit ?? 12,
        });

        return rows.map(r => ({
            ...r,
            score: Number(r.score),
            genreIds: r.genreIds ?? [],
            genreNames: (r.genreIds ?? []).map((id: number) => genreMap.get(id)).filter(Boolean),
        }));
    }

    // ---------------------------------------------------------------------------
    // Content fetching — three passes
    // ---------------------------------------------------------------------------

    private async fetchCandidates(mood: Mood, dto: GetRecommendationsDto): Promise<any[]> {
        const genres = (mood.tmdbGenres as number[] | null) ?? [];
        const keywords = (mood.keywords as string[] | null) ?? [];
        const minVote = dto.minRating ?? 0;
        const wantMovies = dto.mediaType === 'both' || dto.mediaType === 'movie';
        const wantTV = dto.mediaType === 'both' || dto.mediaType === 'tv';
        const allContent: any[] = [];

        // Pass 1 — genre discover
        const pages = this.pickRandomPages(1, 20, DISCOVER_PAGES);
        await Promise.all(pages.flatMap(page => {
            const tasks: Promise<void>[] = [];
            if (wantMovies && genres.length > 0) {
                tasks.push(
                    this.tmdbService.getMoviesByGenres(genres, page, minVote)
                        .then(r => { if (Array.isArray(r)) allContent.push(...r.map((m: any) => ({ ...m, mediaType: 'movie', _source: 'discover' }))); })
                        .catch(e => this.logger.warn(`Discover movies p${page}: ${e?.message}`)),
                );
            }
            if (wantTV && genres.length > 0) {
                tasks.push(
                    this.tmdbService.getTVShowsByGenres(genres, page, minVote)
                        .then(r => { if (Array.isArray(r)) allContent.push(...r.map((t: any) => ({ ...t, mediaType: 'tv', _source: 'discover' }))); })
                        .catch(e => this.logger.warn(`Discover TV p${page}: ${e?.message}`)),
                );
            }
            return tasks;
        }));

        // Pass 2 — keyword search
        const searchKeywords = keywords.slice(0, 3);
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
        if (allContent.length < 30) {
            this.logger.debug(`Only ${allContent.length} candidates — broadening`);
            const extraPages = this.pickRandomPages(1, 10, 3);
            await Promise.all(extraPages.flatMap(page => {
                const tasks: Promise<void>[] = [];
                if (wantMovies) {
                    tasks.push(
                        this.tmdbService.getMoviesByGenres(genres.length > 0 ? genres : FALLBACK_MOVIE_GENRES, page, minVote)
                            .then(r => { if (Array.isArray(r)) allContent.push(...r.map((m: any) => ({ ...m, mediaType: 'movie', _source: 'broad' }))); })
                            .catch(() => { }),
                    );
                }
                if (wantTV) {
                    tasks.push(
                        this.tmdbService.getTVShowsByGenres(genres.length > 0 ? genres : FALLBACK_TV_GENRES, page, minVote)
                            .then(r => { if (Array.isArray(r)) allContent.push(...r.map((t: any) => ({ ...t, mediaType: 'tv', _source: 'broad' }))); })
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
        if ((item.vote_count ?? 0) < 50) return false; if (dto.includeAdult === false && item.adult === true) return false;

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
    private applyDiversityCap(scored: ScoredItem[], limit: number): ScoredItem[] {
        const genreCount: Record<number, number> = {};
        const selected: ScoredItem[] = [];
        const overflow: ScoredItem[] = [];

        for (const item of scored) {
            const primaryGenre = (item.raw.genre_ids ?? [])[0] as number | undefined;
            const count = primaryGenre !== undefined ? (genreCount[primaryGenre] ?? 0) : 0;

            if (primaryGenre === undefined || count < GENRE_DIVERSITY_CAP) {
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
        const moodGenreSet = new Set((mood.tmdbGenres as number[] | null) ?? []);
        const itemGenreSet = new Set<number>(item.genre_ids ?? []);
        const moodValence = Number(mood.valence ?? 0);
        const moodArousal = Number(mood.arousal ?? 0);
        const keywords = (mood.keywords as string[] | null) ?? [];

        // 1. Jaccard genre similarity
        const intersection = [...itemGenreSet].filter(g => moodGenreSet.has(g)).length;
        const union = new Set([...moodGenreSet, ...itemGenreSet]).size;
        const genreScore = union > 0 ? intersection / union : 0;

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

        // 7. Keyword match
        const searchText = `${item.title ?? item.name ?? ''} ${item.overview ?? ''}`.toLowerCase();
        const keywordScore = keywords.some(kw => searchText.includes(kw.toLowerCase())) ? 1 : 0;

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
        const raw =
            W_GENRE * genreScore +
            W_VALENCE * valenceScore +
            W_AROUSAL * arousalScore +
            W_POPULARITY * popularityScore +
            W_QUALITY * qualityScore +
            W_RECENCY * recencyScore +
            W_KEYWORD * keywordScore +
            W_LANGUAGE * languageScore;

        const score = parseFloat(Math.max(0.01, Math.min(0.99, raw)).toFixed(4));

        return {
            raw: item,
            score,
            breakdown: {
                genreScore: parseFloat(genreScore.toFixed(3)),
                valenceScore: parseFloat(valenceScore.toFixed(3)),
                arousalScore: parseFloat(arousalScore.toFixed(3)),
                popularityScore: parseFloat(popularityScore.toFixed(3)),
                qualityScore: parseFloat(qualityScore.toFixed(3)),
                recencyScore: parseFloat(recencyScore.toFixed(3)),
                keywordScore,
            },
        };
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

        const unique = this.removeDuplicates(rawCandidates, 'id');
        this.logger.debug(`${unique.length} unique candidates for mood "${mood.name}"`);

        const filtered = unique.filter(item => this.passesHardFilters(item, dto));
        this.logger.debug(`${filtered.length} after hard filters for mood "${mood.name}"`);

        if (filtered.length === 0) {
            this.logger.warn(`All candidates filtered out for mood "${mood.name}"`);
            return [];
        }

        const scored = filtered
            .map(item => this.scoreItem(item, mood))
            .sort((a, b) => b.score - a.score);

        const limit = dto.limit ?? 12;

        // Shuffle within top pool for request-to-request variety, then enforce
        // genre diversity cap so no single genre fills all slots.
        const topPool = this.shuffleArray(scored.slice(0, limit * 3));
        const diverse = this.applyDiversityCap(topPool, limit);

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
            reason: this.buildReason(mood, scored.breakdown, genreNames, item),
            algorithm: 'mood-scored-v3',
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
        genreNames: string[],
        item: any,
    ): string {
        const moodName = mood.name.toLowerCase();
        const moodValence = Number(mood.valence ?? 0);
        const moodArousal = Number(mood.arousal ?? 0);
        const keywords = (mood.keywords as string[] | null) ?? [];
        const { genreScore, valenceScore, arousalScore, popularityScore, recencyScore, keywordScore } = breakdown;

        const signals: string[] = [];

        if (genreScore >= 0.35 && genreNames.length > 0)
            signals.push(`its ${genreNames.slice(0, 2).join(' & ')} themes`);

        if (signals.length < 2 && valenceScore >= 0.80) {
            if (moodValence >= 0.5) signals.push('uplifting tone');
            else if (moodValence <= -0.3) signals.push('dark atmosphere');
            else signals.push('balanced emotional tone');
        }

        if (signals.length < 2 && arousalScore >= 0.80) {
            if (moodArousal >= 0.7) signals.push('fast pace');
            else if (moodArousal <= -0.2) signals.push('relaxed rhythm');
            else signals.push('steady tension');
        }

        if (signals.length < 2 && popularityScore >= 0.70)
            signals.push('widely popular');

        if (signals.length < 2 && recencyScore >= 0.75)
            signals.push('recently released');

        if (signals.length < 2 && keywordScore === 1) {
            const searchText = `${item.title ?? item.name ?? ''} ${item.overview ?? ''}`.toLowerCase();
            const hitKw = keywords.find(kw => searchText.includes(kw.toLowerCase()));
            if (hitKw) signals.push(`"${hitKw}" theme`);
        }

        return signals.length === 0
            ? `Matched your ${moodName} mood`
            : `Picked for ${moodName} — ${signals.join(', ')}`;
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
                        genreNames: r.genreNames ?? [],
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

    private removeDuplicates<T>(array: T[], key: keyof T): T[] {
        const seen = new Set();
        return array.filter(item => {
            const v = item[key];
            if (seen.has(v)) return false;
            seen.add(v);
            return true;
        });
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