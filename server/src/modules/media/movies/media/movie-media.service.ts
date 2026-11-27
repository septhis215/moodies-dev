import { Injectable, Logger } from '@nestjs/common';
import { MovieTmdbClientService } from '../client/movie-tmdb-client.service';

@Injectable()
export class MovieMediaService {
    private readonly logger = new Logger(MovieMediaService.name);

    constructor(private readonly client: MovieTmdbClientService) { }

    async images(id: number, type: string = 'movie') {
        const data = await this.client.tmdb(`${type}/${id}/images`);
        if (!data) return { posters: [], backdrops: [] };

        const THRESHOLD = 2.5;

        const filterThreshold = (images: any[] = []) => {
            const above = images.filter(
                (img) => img?.vote_average && img.vote_average >= THRESHOLD,
            );
            return (above.length > 0 ? above : images)
                .map((img) => img?.file_path ?? null)
                .filter((f: string | null): f is string => Boolean(f));
        };

        return {
            posters: filterThreshold(data?.posters),
            backdrops: filterThreshold(data?.backdrops),
        };
    }

    async videos(id: number, type: string = 'movie') {
        const data = await this.client.tmdb(`${type}/${id}/videos`);
        if (!data) return { videos: [] };

        const PRIORITY_TYPES = ['Trailer', 'Teaser', 'Clip', 'Featurette'];
        const MIN_SIZE = 720;

        const videos: Array<{
            id: string;
            key: string;
            name: string;
            site?: string | null;
            type?: string | null;
            size?: number | null;
            official: boolean;
            iso_639_1?: string | null;
            iso_3166_1?: string | null;
            published_at?: string | null;
        }> = (data.results ?? [])
            .filter((v: any) => {
                return (
                    Boolean(v?.key) &&
                    v?.site?.toLowerCase() === 'youtube' &&
                    Boolean(v?.official) &&
                    (typeof v?.size === 'number' ? v.size >= MIN_SIZE : true) &&
                    PRIORITY_TYPES.includes(v?.type)
                );
            })
            .sort((a: any, b: any) => {
                const typeOrder = (t: string) => PRIORITY_TYPES.indexOf(t);
                const aPriority = typeOrder(a.type);
                const bPriority = typeOrder(b.type);
                if (aPriority !== bPriority) return aPriority - bPriority;

                const aSize = a.size ?? 0;
                const bSize = b.size ?? 0;
                if (aSize !== bSize) return bSize - aSize;

                return (
                    new Date(b.published_at ?? 0).getTime() -
                    new Date(a.published_at ?? 0).getTime()
                );
            })
            .slice(0, 30)
            .map((v: any) => ({
                id: v?.id ?? '',
                key: v?.key ?? '',
                name: v?.name ?? '',
                site: v?.site ?? null,
                type: v?.type ?? null,
                size: typeof v?.size === 'number' ? v.size : null,
                official: Boolean(v?.official),
                iso_639_1: v?.iso_639_1 ?? null,
                iso_3166_1: v?.iso_3166_1 ?? null,
                published_at: v?.published_at ?? null,
            }));

        return { videos };
    }

    async getTrendingReviews(limit = 40): Promise<{
        quote: string;
        name: string;
        title: string;
        avatar: string;
        rating?: number | null;
    }[]> {
        if (!this.client.token) {
            this.logger.warn('TMDB_API_KEY not set; returning empty reviews');
            return [];
        }

        try {
            const reviews: {
                quote: string;
                name: string;
                title: string;
                avatar: string;
                rating?: number | null;
            }[] = [];

            for (let p = 1; p <= 3; p++) {
                const trendingData = await this.client.tmdb(
                    `trending/movie/week?language=en-US&page=${p}`,
                );
                const results = trendingData?.results ?? [];

                for (const item of results) {
                    if (reviews.length >= limit) break;

                    const reviewPromises = Array.from({ length: 3 }, (_, i) =>
                        this.client.tmdb(`movie/${item.id}/reviews?language=en-US&page=${i + 1}`),
                    );
                    const reviewPagesData = await Promise.all(reviewPromises);

                    for (const pageData of reviewPagesData) {
                        for (const review of pageData?.results ?? []) {
                            const avatarPath = review?.author_details?.avatar_path;
                            if (avatarPath) {
                                let avatar = avatarPath.trim();
                                if (avatar.startsWith('/http')) avatar = avatar.substring(1);
                                else if (avatar.startsWith('/'))
                                    avatar = `https://image.tmdb.org/t/p/w185${avatar}`;

                                reviews.push({
                                    quote: review.content.slice(0, 200) + '...',
                                    name: review.author ?? 'Anonymous',
                                    title: item.title ?? 'Untitled',
                                    avatar,
                                    rating: review.author_details.rating ?? null,
                                });
                            }
                            if (reviews.length >= limit) break;
                        }
                        if (reviews.length >= limit) break;
                    }
                }

                if (reviews.length >= limit) break;
            }

            return reviews.sort(() => Math.random() - 0.5);
        } catch (err) {
            this.logger.error('Failed to fetch trending reviews', err as any);
            return [];
        }
    }
}