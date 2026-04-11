import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { ModerationDecisionService } from '../moderation/moderation-decision.service';
import { ProfanityFilterService } from '../moderation/profanity-filter.service';
import { ToxicityAnalysisService } from '../moderation/toxicity-analysis.service';
import { UserService } from './../user/user.service';
import { ReviewStatus } from '@prisma/client';
import {
  ReviewEntity,
  ReviewReplyEntity,
  ReviewWithRepliesEntity,
} from './entities';

@Injectable()
export class ReviewService {
  constructor(
    private prisma: PrismaService,
    private profanityFilter: ProfanityFilterService,
    private toxicityService: ToxicityAnalysisService,
    private moderationDecision: ModerationDecisionService,
    private userService: UserService,
  ) {}

  async createReview(userId: string, dto: CreateReviewDto) {
    console.log('🚀 createReview called for userId:', userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { reviewBannedUntil: true },
    });

    console.log('👤 User ban status:', user?.reviewBannedUntil);

    const profanityResult = this.profanityFilter.check(dto.content);

    if (profanityResult.block) {
      throw new BadRequestException(
        'Your review contains excessive profanity. Please rephrase to continue.',
      );
    }

    const toxicity = await this.toxicityService.analyze(dto.content);
    const decision = this.moderationDecision.decide(toxicity);

    if (decision.reject) {
      throw new BadRequestException(
        'Review contains harmful content. Please rewrite with constructive criticism.',
      );
    }

    const review = await this.prisma.review.create({
      data: {
        userId,
        tmdbId: dto.tmdbId,
        mediaType: dto.mediaType,
        rating: dto.rating,
        content: dto.content,
        moodEmojis: dto.moodEmojis,
        status: decision.status,
        affectsRating: decision.affectsRating,
        profanityHit: profanityResult.hit,
        toxicityScore: toxicity.score,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (decision.warnUser) {
      await this.userService.applyReviewWarning(userId);
    }

    const reviewEntity = new ReviewEntity(review);
    return reviewEntity.toPublic();
  }

  async createReply(userId: string, reviewId: string, dto: CreateReplyDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const profanityResult = this.profanityFilter.check(dto.content);
    if (profanityResult.block) {
      throw new BadRequestException('Please rephrase your reply.');
    }

    const toxicity = await this.toxicityService.analyze(dto.content);
    if (toxicity.severe || toxicity.score >= 0.4) {
      throw new BadRequestException(
        'Reply contains inappropriate content. Please rewrite.',
      );
    }

    const reply = await this.prisma.reviewReply.create({
      data: {
        reviewId,
        userId,
        content: dto.content,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    console.log('✅ Reply created (no warning applied):', {
      replyId: reply.id,
      userId,
      toxicityScore: toxicity.score,
    });

    const replyEntity = new ReviewReplyEntity(reply);
    return replyEntity.toPublic();
  }

  async getReviews(query: ReviewQueryDto) {
    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const where = status ? { status } : {};

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { status: 'asc' }, // PUBLISHED < FLAGGED
          { createdAt: 'desc' },
        ],
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          replies: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    // Convert to entities and sanitize
    const reviewEntities = reviews.map(
      (review) => new ReviewWithRepliesEntity(review),
    );

    return {
      reviews: reviewEntities.map((r) => r.toPublic()),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMediaReviews(
    tmdbId: number,
    mediaType: string,
    page = 1,
    limit = 10,
  ) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          tmdbId,
          mediaType: mediaType as any,
          status: { in: [ReviewStatus.PUBLISHED, ReviewStatus.FLAGGED] },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          replies: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      }),
      this.prisma.review.count({
        where: {
          tmdbId,
          mediaType: mediaType as any,
          status: { in: [ReviewStatus.PUBLISHED, ReviewStatus.FLAGGED] },
        },
      }),
    ]);

    const allMoodEmojis = reviews.flatMap((r) => r.moodEmojis);
    const moodCounts = allMoodEmojis.reduce(
      (acc, emoji) => {
        acc[emoji] = (acc[emoji] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const topMoods = Object.entries(moodCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([emoji, count]) => ({ emoji, count }));

    // Convert to entities and sanitize
    const reviewEntities = reviews.map(
      (review) => new ReviewWithRepliesEntity(review),
    );

    return {
      reviews: reviewEntities.map((r) => r.toPublic()),
      topMoods,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTopMoods(tmdbId: number, mediaType: string) {
    const reviews = await this.prisma.review.findMany({
      where: {
        tmdbId,
        mediaType: mediaType as any,
        status: ReviewStatus.PUBLISHED,
      },
      select: {
        moodEmojis: true,
      },
    });

    const allMoodEmojis = reviews.flatMap((r) => r.moodEmojis);

    const moodCounts = allMoodEmojis.reduce(
      (acc, emoji) => {
        acc[emoji] = (acc[emoji] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const topMoods = Object.entries(moodCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([emoji, count]) => ({ emoji, count }));

    return {
      tmdbId,
      mediaType,
      totalReviews: reviews.length,
      topMoods,
    };
  }

  async getReviewStats(tmdbId: number, mediaType: string) {
    const reviews = await this.prisma.review.findMany({
      where: {
        tmdbId,
        mediaType: mediaType as any,
        status: ReviewStatus.PUBLISHED,
        affectsRating: true, 
      },
      select: {
        rating: true,
      },
    });

    const totalRatings = reviews.length;
    const averageRating =
      totalRatings > 0
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalRatings
        : 0;

    return {
      tmdbId,
      mediaType,
      totalRatings,
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
    };
  }

  async getReviewBanStatus(user: { reviewBannedUntil?: Date }) {
    const now = new Date();
    const bannedDate = user.reviewBannedUntil;

    return {
      banned: !!bannedDate && bannedDate > now,
      bannedUntil: bannedDate && bannedDate > now ? bannedDate : null,
    };
  }
}
