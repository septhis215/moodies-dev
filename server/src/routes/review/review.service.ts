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
    const profanityHit = this.profanityFilter.check(dto.content);
    if (profanityHit.block) {
      throw new BadRequestException('Please rephrase your review.');
    }

    const toxicity = await this.toxicityService.analyze(dto.content);
    const decision = this.moderationDecision.decide(toxicity);

    if (decision.reject) {
      throw new BadRequestException('Review rejected. Please rewrite.');
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
        profanityHit: profanityHit.hit,
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

    return review;
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
    if (toxicity.severe) {
      throw new BadRequestException('Reply contains harmful content.');
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

    if (toxicity.score >= 0.4) {
      await this.userService.applyReviewWarning(userId);
    }

    return reply;
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
          // Flagged reviews go to bottom
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

    return {
      reviews,
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
          status: ReviewStatus.PUBLISHED, // Only show published reviews
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
          status: ReviewStatus.PUBLISHED,
        },
      }),
    ]);

    // Calculate top 3 mood emojis
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
      reviews,
      topMoods,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
