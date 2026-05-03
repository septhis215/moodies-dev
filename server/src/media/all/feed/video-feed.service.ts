import { Injectable, Logger } from '@nestjs/common';
import { TmdbClientService } from '../client/tmdb-client.service';
import { VideoScoringService } from '../videos/video-scoring.service';
import { getSeededRandom, seededShuffleArray, isRecentOrUpcoming, getItemYear, isUpcoming, isRecentRelease } from '../utils/helpers';

@Injectable()
export class VideoFeedService {
    private readonly logger = new Logger(VideoFeedService.name);

    constructor(
        private readonly client: TmdbClientService,
        private readonly videoScoring: VideoScoringService,
    ) { }

    async getVideoFeed(salt: number = 0, page: number = 1, mediaType?: 'movie' | 'tv') {
        try {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const pastDate = new Date();
            pastDate.setFullYear(pastDate.getFullYear() - 2);
            const pastDateStr = pastDate.toISOString().split('T')[0];

            const sessionSeed = Math.floor(Date.now() / (1000 * 60 * 15));
            const pageSeed = sessionSeed + page + (salt % 500); // fold salt in, bounded
            // salt comes from the frontend's per-session random value.
            // Bounding with % 500 keeps the seed space manageable and matches
            // the frontend's 0-499 range. Different sessions now produce
            // genuinely different pageSeed values even on the same page number.
            const pageOffset = Math.floor((page - 1) / 3);

            const requests: any[] = [];
            // Use pageSeed (which now includes salt) to derive a varied TMDB page
            const tmdbPageVariant = (pageSeed % 3) + 1; // cycles 1-3 based on seed


            // TMDB's /movie/upcoming endpoint has ~4 pages. Always fetching page=1
            // means the raw candidate pool is identical every time. tmdbPageVariant
            // rotates through pages 1-3 deterministically per seed, giving different
            // raw input to the shuffle. We keep the discover call on `page` too so
            // sequential pagination still progresses forward.
            if (!mediaType || mediaType === 'movie') {
                requests.push(
                    this.client.tmdb(`trending/movie/week?page=${page}`),
                    this.client.tmdb(`movie/upcoming?page=${tmdbPageVariant}&region=US`),
                    this.client.tmdb(`discover/movie?sort_by=popularity.desc&primary_release_date.gte=${todayStr}&page=${page}`),
                    this.client.tmdb(`discover/movie?sort_by=popularity.desc&primary_release_date.gte=${todayStr}&page=${tmdbPageVariant}`),
                    this.client.tmdb(`discover/movie?language=en-US&sort_by=popularity.desc&primary_release_date.gte=${pastDateStr}&page=${page}`),
                    this.client.tmdb(`discover/movie?with_original_language=ko&sort_by=popularity.desc&page=${page}&include_adult=false&without_keywords=13090,190720`),
                );
            }

            if (!mediaType || mediaType === 'tv') {
                requests.push(
                    this.client.tmdb(`trending/tv/week?page=${page}`),
                    this.client.tmdb(`tv/popular?page=${page + pageOffset}`),
                    this.client.tmdb(`tv/on_the_air?page=${page}`),
                    this.client.tmdb(`tv/airing_today?page=${page}`),
                    this.client.tmdb(`discover/tv?sort_by=popularity.desc&first_air_date.gte=${todayStr}&page=${page}`),
                    this.client.tmdb(`discover/tv?sort_by=popularity.desc&first_air_date.gte=${todayStr}&page=${tmdbPageVariant}`),
                    this.client.tmdb(`discover/tv?with_original_language=ko&sort_by=popularity.desc&page=${page}&include_adult=false&without_keywords=13090,190720`),
                );
            }

            const results = await Promise.allSettled(requests);
            const allItems: any[] = [];

            for (const result of results) {
                if (result.status === 'fulfilled' && result.value?.results) {
                    allItems.push(...result.value.results);
                }
            }

            const filteredItems = this.preFilterItems(allItems);
            const uniqueItems = Array.from(
                new Map(filteredItems.map(item => [item.id, item])).values()
            );

            const scoredMixed = this.seededShuffle(uniqueItems, pageSeed, 2.0);
            const itemsToEnrich = scoredMixed.slice(0, 35);
            const itemsWithVideos = await this.enrichWithVideos(itemsToEnrich, pageSeed);

            const validItems = itemsWithVideos.filter(item => item.primary_video);
            const finalResults = this.applyFinalShuffle(validItems, pageSeed);

            return {
                results: finalResults,
                page,
                total_pages: 100,
                hasMore: page < 100 && finalResults.length > 0
            };
        } catch (error) {
            console.error('Error fetching video feed:', error);
            return { results: [], page, total_pages: 0, hasMore: false };
        }
    }

    private applyFinalShuffle(items: any[], seed: number): any[] {
        if (items.length === 0) return items;

        // Separate upcoming items before tier assignment
        const upcomingItems = items.filter(i => isUpcoming(i));
        const releasedItems = items.filter(i => !isUpcoming(i));

        const tiers = { premium: [] as any[], high: [] as any[], medium: [] as any[] };
        releasedItems.forEach(item => {
            const score = this.calculateItemQualityScore(item);
            if (score >= 45) tiers.premium.push(item);
            else if (score >= 35) tiers.high.push(item);
            else tiers.medium.push(item);
        });

        const shuffledPremium = seededShuffleArray(tiers.premium, seed);
        const shuffledHigh = seededShuffleArray(tiers.high, seed + 100);
        const shuffledMedium = seededShuffleArray(tiers.medium, seed + 200);
        const upcomingSeed = seed ^ (seed << 5) ^ 0xdeadbeef; // bitwise mix for more variance
        const shuffledUpcoming = seededShuffleArray(upcomingItems, upcomingSeed);
        // seed + 300 is a trivially small offset from the main seed — both the
        // released and upcoming pools had nearly identical shuffle patterns.
        // XOR-mixing creates a seed that's uncorrelated with the parent, so
        // upcoming ordering is independent of the released-content ordering.
        const result: any[] = [];
        let pIdx = 0, hIdx = 0, mIdx = 0, uIdx = 0;

        // Inject 1 upcoming item every 4 slots (25% representation floor)
        const UPCOMING_INTERVAL = 4;
        let slotCount = 0;

        while (
            pIdx < shuffledPremium.length ||
            hIdx < shuffledHigh.length ||
            mIdx < shuffledMedium.length ||
            uIdx < shuffledUpcoming.length
        ) {
            // Inject upcoming at regular interval if available
            if (uIdx < shuffledUpcoming.length && slotCount % UPCOMING_INTERVAL === 0) {
                result.push(shuffledUpcoming[uIdx++]);
                slotCount++;
                continue;
            }

            for (let i = 0; i < 2 && pIdx < shuffledPremium.length; i++) {
                result.push(shuffledPremium[pIdx++]); slotCount++;
            }
            if (hIdx < shuffledHigh.length) { result.push(shuffledHigh[hIdx++]); slotCount++; }
            if (pIdx < shuffledPremium.length) { result.push(shuffledPremium[pIdx++]); slotCount++; }
            if (mIdx < shuffledMedium.length) { result.push(shuffledMedium[mIdx++]); slotCount++; }
        }

        // Append any remaining upcoming items that didn't get injected
        while (uIdx < shuffledUpcoming.length) result.push(shuffledUpcoming[uIdx++]);

        return result;
    }

    private seededShuffle(array: any[], seed: number, jitter = 2.0): any[] {
        const seededRandomForId = (id: number | string, offset = 0) => {
            const n = typeof id === 'number' ? id : parseInt(String(id).replace(/\D/g, '') || '0', 10);
            const x = Math.sin((seed + offset) * 9301 + n * 49297) * 43758.5453123;
            return Math.abs(x - Math.floor(x));
        };

        const scoredItems = array.map(item => ({
            item,
            qualityScore: this.calculateItemQualityScore(item),
            isNewRelease: isRecentOrUpcoming(item),
            isKorean: item.original_language === 'ko'
        }));

        const compareWithJitter = (a: any, b: any) => {
            const scoreDiff = b.qualityScore - a.qualityScore;
            if (jitter === 0) return scoreDiff;
            const randDiff = seededRandomForId(b.item.id ?? (Math.random() * 1000000)) -
                seededRandomForId(a.item.id ?? (Math.random() * 1000000));
            return scoreDiff + randDiff * jitter;
        };

        const newReleases = scoredItems.filter(s => s.isNewRelease);
        const koreanContent = scoredItems.filter(s => !s.isNewRelease && s.isKorean);
        const regularContent = scoredItems.filter(s => !s.isNewRelease && !s.isKorean);

        newReleases.sort(compareWithJitter);
        koreanContent.sort(compareWithJitter);
        regularContent.sort(compareWithJitter);

        const mixed: any[] = [];
        let newIdx = 0, koreanIdx = 0, regularIdx = 0;

        while (newIdx < newReleases.length || koreanIdx < koreanContent.length || regularIdx < regularContent.length) {
            const regularCount = Math.floor(seededRandomForId(regularIdx + seed, 100) * 2) + 2;
            for (let i = 0; i < regularCount && regularIdx < regularContent.length; i++) {
                mixed.push(regularContent[regularIdx++].item);
            }
            if (newIdx < newReleases.length) mixed.push(newReleases[newIdx++].item);
            if (koreanIdx < koreanContent.length) mixed.push(koreanContent[koreanIdx++].item);
            if (koreanIdx < koreanContent.length && seededRandomForId(koreanIdx + seed, 200) > 0.6) {
                mixed.push(koreanContent[koreanIdx++].item);
            }
        }

        return mixed;
    }

    private preFilterItems(items: any[]): any[] {
        const currentYear = new Date().getFullYear();
        return items.filter(item => {
            if (item.adult === true) return false;
            if (!item.poster_path) return false;

            const releaseYear = getItemYear(item);
            const upcoming = isUpcoming(item);
            const isNewRelease = isRecentRelease(item);
            const isKorean = item.original_language === 'ko';

            // Upcoming items: skip all vote-based gates entirely
            if (upcoming) {
                if ((item.popularity || 0) < 20) return false;
                return true;
            }

            if (!isNewRelease && !isKorean) {
                if ((item.vote_count || 0) < 10) return false;
                if ((item.vote_average || 0) < 5.0) return false;
            } else if (isKorean && !isNewRelease) {
                if ((item.vote_count || 0) < 5) return false;
                if ((item.vote_average || 0) < 4.5) return false;
            }

            if (releaseYear && releaseYear < (isKorean ? 1995 : 2000)) return false;
            if (!item.overview || item.overview.length < 10) return false;

            const allowedLanguages = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'pt', 'it', 'hi'];
            if (item.original_language && !allowedLanguages.includes(item.original_language)) {
                if ((item.vote_count || 0) < 500) return false;
            }
            return true;
        });
    }

    private calculateItemQualityScore(item: any): number {
        let score = 0;
        const upcoming = isUpcoming(item);
        const recentlyReleased = isRecentRelease(item);

        if (upcoming) {
            score += 25;
            const releaseDate = new Date(item.release_date || item.first_air_date);
            const daysUntilRelease = (releaseDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
            if (daysUntilRelease <= 30) score += 15;
            else if (daysUntilRelease <= 90) score += 10;
            else if (daysUntilRelease <= 180) score += 5;
            score += Math.log10((item.popularity || 1) + 1) * 22;
        } else {
            if (recentlyReleased) score += 20;
            score += Math.log10((item.popularity || 1) + 1) * 8;
            if (item.vote_count > 0) score += (item.vote_average || 0) * 3;
            score += Math.log10((item.vote_count || 1) + 1) * 2;

            const year = getItemYear(item);
            if (year && !recentlyReleased) {
                const yearDiff = new Date().getFullYear() - year;
                if (yearDiff <= 2) score += 10;
                else if (yearDiff <= 5) score += 7;
                else if (yearDiff <= 10) score += 5;
                else if (yearDiff <= 15) score += 3;
            }
        }

        if (item.backdrop_path) score += 2;
        if (item.original_language === 'en') score += 4;
        else if (item.original_language === 'ko') score += 4;

        return score;
    }

    private async enrichWithVideos(items: any[], seed: number) {
        const enriched: any[] = [];
        const allowedRegions = [
            'MY', 'SG', 'ID', 'TH', 'PH', 'VN', 'BN', 'KH', 'LA',
            'HK', 'TW', 'IN', 'AU', 'NZ', 'US', 'GB', 'KR', 'JP'
        ];

        const targetCount = Math.min(items.length, 30);
        const batchSize = 8;

        this.logger.log(`Starting enrichment of ${items.length} items, target: ${targetCount}`);

        for (let i = 0; i < items.length && enriched.length < targetCount; i += batchSize) {
            const batch = items.slice(i, i + batchSize);

            const batchResults = await Promise.allSettled(
                batch.map(item => this.processItemWithVideos(item, allowedRegions, seed))
            );

            for (const result of batchResults) {
                if (result.status === 'fulfilled' && result.value) {
                    enriched.push(result.value);
                    if (enriched.length >= targetCount) break;
                } else if (result.status === 'rejected') {
                    this.logger.error('Failed to process item:', result.reason);
                }
            }

            if (i + batchSize < items.length && enriched.length < targetCount) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        this.logger.log(`Enrichment complete: ${enriched.length} items with valid videos`);
        return enriched;
    }

    private async processItemWithVideos(item: any, allowedRegions: string[], seed: number) {
        try {
            const mediaType = item.title ? 'movie' : 'tv';
            let videos = item.videos || [];

            if (videos.length === 0) {
                const videosResponse = await this.client.tmdb(`${mediaType}/${item.id}/videos`);
                videos = videosResponse.results || [];
            }

            const filteredVideos = this.videoScoring.filterVideos(videos, allowedRegions);
            if (filteredVideos.length === 0) return null;

            const availableVideos = await this.videoScoring.getAvailableVideos(filteredVideos);

            // For upcoming items, fall back to unverified filtered videos if oEmbed checks fail.
            // YouTube availability checks can fail for region-locked or pre-release content.
            const videosToUse = availableVideos.length > 0
                ? availableVideos
                : (isUpcoming(item) ? filteredVideos.slice(0, 3) : []);  // ← fallback

            if (videosToUse.length === 0) return null;

            const scoredVideos = this.videoScoring.sortByScore(videosToUse);
            const topVideos = scoredVideos.slice(0, 8);
            const primaryCandidates = topVideos.slice(0, Math.min(4, topVideos.length));
            const primaryIndex = getSeededRandom(item.id + seed, primaryCandidates.length);
            const primaryVideo = primaryCandidates[primaryIndex];
            if (!primaryVideo || !primaryVideo.key) return null;

            return { ...item, media_type: mediaType, videos: topVideos, primary_video: primaryVideo };
        } catch (err) {
            this.logger.error(`Error processing item ${item.id}:`, err);
            return null;
        }
    }
}