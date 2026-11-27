import { Injectable, Logger } from '@nestjs/common';
import { TmdbClientService } from '../client/tmdb-client.service';

@Injectable()
export class ReviewsService {
    private readonly logger = new Logger(ReviewsService.name);

    constructor(private readonly client: TmdbClientService) { }

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

            const trendingPages = 3;
            const reviewPages = 3;

            for (let p = 1; p <= trendingPages; p++) {
                const trendingData = await this.client.tmdb(
                    `${this.client.baseUrl}/trending/all/week?language=en-US&page=${p}`
                );
                const results = trendingData?.results ?? [];

                for (const item of results) {
                    if (reviews.length >= limit) break;

                    const reviewPromises: Promise<any>[] = [];
                    for (let rp = 1; rp <= reviewPages; rp++) {
                        reviewPromises.push(
                            this.client.tmdb(
                                `${this.client.baseUrl}/${item.media_type}/${item.id}/reviews?language=en-US&page=${rp}`
                            )
                        );
                    }

                    const reviewPagesData = await Promise.all(reviewPromises);

                    for (const pageData of reviewPagesData) {
                        const reviewsPage = pageData?.results ?? [];
                        for (const review of reviewsPage) {
                            const avatarPath = review?.author_details?.avatar_path;
                            if (avatarPath) {
                                let avatar = avatarPath.trim();
                                if (avatar.startsWith('/http')) avatar = avatar.substring(1);
                                else if (avatar.startsWith('/')) avatar = `https://image.tmdb.org/t/p/w185${avatar}`;

                                reviews.push({
                                    quote: review.content.slice(0, 200) + '...',
                                    name: review.author ?? 'Anonymous',
                                    title: item.title ?? item.name ?? 'Untitled',
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