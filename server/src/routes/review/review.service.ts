import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
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
import { MediaType, ReactionType, ReviewStatus } from '@prisma/client';
import {
  ReviewEntity,
  ReviewReplyEntity,
  ReviewWithRepliesEntity,
} from './entities';
import { TmdbClientService } from 'src/media/all/client/tmdb-client.service';
import { RedisService } from 'src/redis/redis.service';
import type { SnapshotFormat } from './dto/create-snapshot.dto';

// Short cache for the public discovery carousels (critics corner / community
// picks). They previously hit the DB — plus per-item TMDB fallbacks — on every
// request; a 2-minute cache collapses that to one build per window.
const CRITICS_CORNER_TTL = 120; // seconds
const SNAPSHOT_SIZE = 1080;
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

const reactionSelect = {
  type: true,
  userId: true,
} as const;

type SnapshotMediaInfo = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  releaseYear?: string | null;
  typeLabel: 'Movie' | 'TV Show';
  posterUrl?: string | null;
  backdropUrl?: string | null;
  genres: string[];
  directors: string[];
  runtimeLabel?: string | null;
  ratingLabel?: string | null;
  popularity?: number | null;
};

type SnapshotTmdbInfo = Record<string, unknown>;
type SnapshotCachedPayload = {
  info?: SnapshotTmdbInfo;
  credits?: {
    crew?: unknown;
  };
};

type SnapshotPayload = {
  snapshotUrl: null;
  snapshotType: 'content' | 'review';
  format: SnapshotFormat;
  width: number;
  height: number;
  content: SnapshotMediaInfo;
  review?: {
    id: string;
    rating: number;
    content: string;
    createdAt: string;
    authorName?: string | null;
    username?: string | null;
    isPrivate: boolean;
  };
};

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private prisma: PrismaService,
    private profanityFilter: ProfanityFilterService,
    private toxicityService: ToxicityAnalysisService,
    private moderationDecision: ModerationDecisionService,
    private userService: UserService,
    private tmdbClient: TmdbClientService,
    private redis: RedisService,
  ) {}

  async createReview(userId: string, dto: CreateReviewDto) {
    this.logger.debug(`Creating review for user ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { reviewBannedUntil: true },
    });

    this.logger.debug(
      `Review ban status for user ${userId}: ${user?.reviewBannedUntil ?? 'none'}`,
    );

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

    // Create the review and bump both counters (user + content) atomically.
    const [review] = await this.prisma.$transaction([
      this.prisma.review.create({
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
              name: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { reviewCount: { increment: 1 } },
      }),
      this.prisma.mediaStat.upsert({
        where: {
          tmdbId_mediaType: { tmdbId: dto.tmdbId, mediaType: dto.mediaType },
        },
        create: {
          tmdbId: dto.tmdbId,
          mediaType: dto.mediaType,
          reviewCount: 1,
        },
        update: { reviewCount: { increment: 1 } },
      }),
    ]);

    if (decision.warnUser) {
      await this.userService.applyReviewWarning(userId);
    }

    await this.invalidatePublicReviewCaches();

    const reviewEntity = new ReviewEntity(review);
    return reviewEntity.toPublic();
  }

  private async invalidatePublicReviewCaches() {
    try {
      await Promise.all([
        this.redis.deleteByPrefix('reviews:critics-corner:movies:'),
        this.redis.deleteByPrefix('reviews:critics-corner:tv:'),
        this.redis.deleteByPrefix('reviews:community-picks:'),
      ]);
    } catch (err) {
      this.logger.warn(
        `Failed to invalidate public review caches: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async createContentSnapshot(
    mediaTypeParam: string,
    tmdbId: number,
    format: SnapshotFormat = 'square',
  ): Promise<SnapshotPayload> {
    this.validateSnapshotFormat(format);
    const mediaType = this.normalizeSnapshotMediaType(mediaTypeParam);

    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      throw new BadRequestException('A valid content id is required.');
    }

    const content = await this.getSnapshotContent(mediaType, tmdbId);

    return {
      snapshotUrl: null,
      snapshotType: 'content',
      format,
      width: SNAPSHOT_SIZE,
      height: SNAPSHOT_SIZE,
      content,
    };
  }

  async createReviewSnapshot(
    userId: string,
    reviewId: string,
    format: SnapshotFormat = 'square',
  ): Promise<SnapshotPayload> {
    this.validateSnapshotFormat(format);

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        user: {
          select: {
            name: true,
            username: true,
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found.');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException(
        'You can only create snapshots for your own reviews.',
      );
    }

    const content = await this.getSnapshotContent(review.mediaType, review.tmdbId);

    return {
      snapshotUrl: null,
      snapshotType: 'review',
      format,
      width: SNAPSHOT_SIZE,
      height: SNAPSHOT_SIZE,
      content,
      review: {
        id: review.id,
        rating: review.rating,
        content: review.content,
        createdAt: review.createdAt.toISOString(),
        authorName: review.user.name,
        username: review.user.username,
        isPrivate: false,
      },
    };
  }

  private validateSnapshotFormat(format: SnapshotFormat) {
    if (format !== 'square') {
      throw new BadRequestException('Only square snapshots are supported.');
    }
  }

  private normalizeSnapshotMediaType(mediaType: string): MediaType {
    const normalized = mediaType.trim().toUpperCase();
    if (normalized === 'MOVIE' || normalized === 'MOVIES') {
      return MediaType.MOVIE;
    }
    if (normalized === 'TV' || normalized === 'SHOW' || normalized === 'SERIES') {
      return MediaType.TV;
    }
    throw new BadRequestException('Unsupported content type.');
  }

  private async getSnapshotContent(
    mediaType: MediaType,
    tmdbId: number,
  ): Promise<SnapshotMediaInfo> {
    const cachedDetail = await this.prisma.mediaDetail.findUnique({
      where: {
        tmdbId_mediaType: {
          tmdbId,
          mediaType,
        },
      },
    });

    const cachedPayload = cachedDetail?.payload as
      | SnapshotCachedPayload
      | undefined;
    const cachedInfo = cachedPayload?.info;

    const fallbackRaw: unknown = cachedInfo
      ? null
      : await this.tmdbClient
          .tmdb(
            `${mediaType === MediaType.TV ? 'tv' : 'movie'}/${tmdbId}?language=en-US&append_to_response=${
              mediaType === MediaType.TV ? 'aggregate_credits' : 'credits'
            }`,
          )
          .catch(() => null);
    const fallbackInfo = this.asSnapshotInfo(fallbackRaw);

    const info = cachedInfo ?? fallbackInfo;
    if (!info) {
      throw new NotFoundException('Content not found.');
    }

    const crewSource =
      cachedPayload?.credits?.crew ??
      this.asSnapshotInfo(fallbackRaw)?.credits ??
      this.asSnapshotInfo(fallbackRaw)?.aggregate_credits;

    return this.toSnapshotMediaInfo(
      mediaType,
      tmdbId,
      cachedDetail?.title,
      info,
      crewSource,
    );
  }

  private toSnapshotMediaInfo(
    mediaType: MediaType,
    tmdbId: number,
    cachedTitle: string | undefined,
    info: SnapshotTmdbInfo,
    crewSource?: unknown,
  ): SnapshotMediaInfo {
    const releaseDate =
      this.asString(info.release_date) ?? this.asString(info.first_air_date);
    const releaseYear = releaseDate?.slice(0, 4) || null;
    const genres = this.extractSnapshotGenres(info.genres);
    const directors = this.extractSnapshotDirectors(info, crewSource);
    const voteAverage = this.asNumber(info.vote_average);
    const runtimeLabel =
      mediaType === MediaType.TV
        ? this.seasonCountLabel(this.asNumber(info.number_of_seasons))
        : this.runtimeLabel(this.asNumber(info.runtime));

    const title =
      cachedTitle ||
      this.asString(info.title) ||
      this.asString(info.name) ||
      this.asString(info.original_title) ||
      this.asString(info.original_name);

    if (!title) {
      throw new NotFoundException('Content title not found.');
    }

    return {
      tmdbId,
      mediaType,
      title,
      releaseYear,
      typeLabel: mediaType === MediaType.TV ? 'TV Show' : 'Movie',
      posterUrl: this.tmdbImageUrl(this.asString(info.poster_path), 'w780'),
      backdropUrl: this.tmdbImageUrl(this.asString(info.backdrop_path), 'w1280'),
      genres,
      directors,
      runtimeLabel,
      ratingLabel:
        voteAverage && voteAverage > 0 ? `${voteAverage.toFixed(1)} average` : null,
      popularity: this.asNumber(info.popularity),
    };
  }

  private extractSnapshotGenres(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((genre) => {
        if (typeof genre === 'string') return genre;
        if (genre && typeof genre === 'object' && 'name' in genre) {
          return this.asString((genre as { name?: unknown }).name);
        }
        return undefined;
      })
      .filter((genre): genre is string => Boolean(genre))
      .slice(0, 3);
  }

  private extractSnapshotDirectors(
    info: SnapshotTmdbInfo,
    crewSource?: unknown,
  ): string[] {
    const fromInfo = this.asString(info.director);
    const crew = this.extractCrewArray(crewSource);
    const directors = crew
      .filter((member) => member.job === 'Director')
      .map((member) => member.name)
      .filter((name): name is string => Boolean(name));

    const createdBy = this.extractCreatedByNames(info.created_by);
    const names = [fromInfo, ...directors, ...createdBy].filter(
      (name): name is string => Boolean(name),
    );
    return Array.from(new Set(names)).slice(0, 4);
  }

  private extractCrewArray(value: unknown): Array<{ job?: string; name?: string }> {
    const maybeCrew =
      value && typeof value === 'object' && 'crew' in value
        ? (value as { crew?: unknown }).crew
        : value;

    if (!Array.isArray(maybeCrew)) return [];
    return maybeCrew.map((member) => {
      if (!member || typeof member !== 'object') return {};
      const record = member as Record<string, unknown>;
      return {
        job: this.asString(record.job),
        name: this.asString(record.name),
      };
    });
  }

  private extractCreatedByNames(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((creator) => {
        if (!creator || typeof creator !== 'object') return undefined;
        return this.asString((creator as { name?: unknown }).name);
      })
      .filter((name): name is string => Boolean(name));
  }

  private tmdbImageUrl(path: string | undefined, size: 'w780' | 'w1280') {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${TMDB_IMAGE_BASE}/${size}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private runtimeLabel(minutes: number | undefined) {
    if (!minutes || minutes <= 0) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

  private seasonCountLabel(seasonCount: number | undefined) {
    if (!seasonCount || seasonCount <= 0) return null;
    return `${seasonCount} season${seasonCount === 1 ? '' : 's'}`;
  }

  private asString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private asNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : undefined;
  }

  private asSnapshotInfo(value: unknown): SnapshotTmdbInfo | null {
    return value && typeof value === 'object'
      ? (value as SnapshotTmdbInfo)
      : null;
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
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    this.logger.debug(
      `Reply ${reply.id} created for user ${userId}; toxicity score ${toxicity.score}`,
    );

    const replyEntity = new ReviewReplyEntity(reply);
    return replyEntity.toPublic();
  }

  async setReviewReaction(
    userId: string,
    reviewId: string,
    type: ReactionType,
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    await this.prisma.reviewReaction.upsert({
      where: {
        reviewId_userId: { reviewId, userId },
      },
      create: {
        reviewId,
        userId,
        type,
      },
      update: {
        type,
      },
    });

    return this.getReviewReactionSummary(reviewId, userId);
  }

  async removeReviewReaction(userId: string, reviewId: string) {
    await this.prisma.reviewReaction.deleteMany({
      where: { reviewId, userId },
    });

    return this.getReviewReactionSummary(reviewId, userId);
  }

  async setReplyReaction(userId: string, replyId: string, type: ReactionType) {
    const reply = await this.prisma.reviewReply.findUnique({
      where: { id: replyId },
      select: { id: true },
    });

    if (!reply) {
      throw new NotFoundException('Reply not found');
    }

    await this.prisma.reviewReplyReaction.upsert({
      where: {
        replyId_userId: { replyId, userId },
      },
      create: {
        replyId,
        userId,
        type,
      },
      update: {
        type,
      },
    });

    return this.getReplyReactionSummary(replyId, userId);
  }

  async removeReplyReaction(userId: string, replyId: string) {
    await this.prisma.reviewReplyReaction.deleteMany({
      where: { replyId, userId },
    });

    return this.getReplyReactionSummary(replyId, userId);
  }

  private async getReviewReactionSummary(reviewId: string, viewerId: string) {
    const reactions = await this.prisma.reviewReaction.findMany({
      where: { reviewId },
      select: reactionSelect,
    });

    return this.toReactionSummary(reactions, viewerId);
  }

  private async getReplyReactionSummary(replyId: string, viewerId: string) {
    const reactions = await this.prisma.reviewReplyReaction.findMany({
      where: { replyId },
      select: reactionSelect,
    });

    return this.toReactionSummary(reactions, viewerId);
  }

  private toReactionSummary(
    reactions: Array<{ type: ReactionType; userId: string }>,
    viewerId?: string,
  ) {
    return {
      reactionCounts: Object.values(ReactionType)
        .map((type) => ({
          type,
          count: reactions.filter((reaction) => reaction.type === type).length,
        }))
        .filter((item) => item.count > 0),
      myReaction: viewerId
        ? (reactions.find((reaction) => reaction.userId === viewerId)?.type ??
          null)
        : null,
    };
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
              name: true,
              avatarUrl: true,
            },
          },
          replies: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true,
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

  async getMovieCriticsCorner(limit = 6) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 6, 24));
    return this.redis.getOrSet(
      `reviews:critics-corner:movies:${safeLimit}`,
      CRITICS_CORNER_TTL,
      () => this.buildMovieCriticsCorner(safeLimit),
      (r) => Array.isArray(r) && r.length > 0,
    );
  }

  private async buildMovieCriticsCorner(safeLimit: number) {
    const poolSize = Math.max(safeLimit * 4, 24);

    const reviews = await this.prisma.review.findMany({
      where: {
        mediaType: MediaType.MOVIE,
        status: { in: [ReviewStatus.PUBLISHED, ReviewStatus.FLAGGED] },
        content: { not: '' },
      },
      take: poolSize,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    const randomizedReviews = reviews
      .sort(() => Math.random() - 0.5)
      .slice(0, safeLimit);

    if (randomizedReviews.length === 0) return [];

    const cachedDetails = await this.prisma.mediaDetail.findMany({
      where: {
        mediaType: MediaType.MOVIE,
        tmdbId: { in: randomizedReviews.map((review) => review.tmdbId) },
      },
    });
    const detailsByTmdbId = new Map(
      cachedDetails.map((detail) => [detail.tmdbId, detail]),
    );

    return Promise.all(
      randomizedReviews.map(async (review) => {
        const publicReview = new ReviewEntity(review).toPublic();
        const cachedDetail = detailsByTmdbId.get(review.tmdbId);
        const cachedPayload = cachedDetail?.payload as
          | {
              info?: {
                title?: string | null;
                original_title?: string | null;
                poster_path?: string | null;
                backdrop_path?: string | null;
                release_date?: string | null;
              };
            }
          | undefined;
        const cachedInfo = cachedPayload?.info;
        const fallbackMovie = cachedDetail
          ? null
          : await this.tmdbClient
              .tmdb(`movie/${review.tmdbId}?language=en-US`)
              .catch(() => null);

        return {
          ...publicReview,
          movie: {
            id: review.tmdbId,
            title:
              cachedDetail?.title ||
              cachedInfo?.title ||
              cachedInfo?.original_title ||
              fallbackMovie?.title ||
              fallbackMovie?.original_title ||
              `Movie #${review.tmdbId}`,
            posterPath:
              cachedInfo?.poster_path ?? fallbackMovie?.poster_path ?? null,
            backdropPath:
              cachedInfo?.backdrop_path ?? fallbackMovie?.backdrop_path ?? null,
            releaseDate:
              cachedInfo?.release_date ?? fallbackMovie?.release_date ?? null,
          },
        };
      }),
    );
  }

  async getTVCriticsCorner(limit = 6) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 6, 24));
    return this.redis.getOrSet(
      `reviews:critics-corner:tv:${safeLimit}`,
      CRITICS_CORNER_TTL,
      () => this.buildTVCriticsCorner(safeLimit),
      (r) => Array.isArray(r) && r.length > 0,
    );
  }

  private async buildTVCriticsCorner(safeLimit: number) {
    const poolSize = Math.max(safeLimit * 4, 24);

    const reviews = await this.prisma.review.findMany({
      where: {
        mediaType: MediaType.TV,
        status: { in: [ReviewStatus.PUBLISHED, ReviewStatus.FLAGGED] },
        content: { not: '' },
      },
      take: poolSize,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    const randomizedReviews = reviews
      .sort(() => Math.random() - 0.5)
      .slice(0, safeLimit);

    if (randomizedReviews.length === 0) return [];

    const cachedDetails = await this.prisma.mediaDetail.findMany({
      where: {
        mediaType: MediaType.TV,
        tmdbId: { in: randomizedReviews.map((review) => review.tmdbId) },
      },
    });
    const detailsByTmdbId = new Map(
      cachedDetails.map((detail) => [detail.tmdbId, detail]),
    );

    return Promise.all(
      randomizedReviews.map(async (review) => {
        const publicReview = new ReviewEntity(review).toPublic();
        const cachedDetail = detailsByTmdbId.get(review.tmdbId);
        const cachedPayload = cachedDetail?.payload as
          | {
              info?: {
                name?: string | null;
                original_name?: string | null;
                title?: string | null;
                poster_path?: string | null;
                backdrop_path?: string | null;
                first_air_date?: string | null;
              };
            }
          | undefined;
        const cachedInfo = cachedPayload?.info;
        const fallbackTV = cachedDetail
          ? null
          : await this.tmdbClient
              .tmdb(`tv/${review.tmdbId}?language=en-US`)
              .catch(() => null);

        return {
          ...publicReview,
          tv: {
            id: review.tmdbId,
            title:
              cachedDetail?.title ||
              cachedInfo?.name ||
              cachedInfo?.original_name ||
              cachedInfo?.title ||
              fallbackTV?.name ||
              fallbackTV?.original_name ||
              `Series #${review.tmdbId}`,
            posterPath:
              cachedInfo?.poster_path ?? fallbackTV?.poster_path ?? null,
            backdropPath:
              cachedInfo?.backdrop_path ?? fallbackTV?.backdrop_path ?? null,
            firstAirDate:
              cachedInfo?.first_air_date ?? fallbackTV?.first_air_date ?? null,
          },
        };
      }),
    );
  }

  async getCommunityPicks(limit = 18) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 18, 36));
    return this.redis.getOrSet(
      `reviews:community-picks:${safeLimit}`,
      CRITICS_CORNER_TTL,
      () => this.buildCommunityPicks(safeLimit),
      (r) => Array.isArray(r) && r.length > 0,
    );
  }

  private async buildCommunityPicks(safeLimit: number) {
    const poolSize = Math.max(safeLimit * 4, 36);

    const reviews = await this.prisma.review.findMany({
      where: {
        status: { in: [ReviewStatus.PUBLISHED, ReviewStatus.FLAGGED] },
        content: { not: '' },
      },
      take: poolSize,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    const randomizedReviews = reviews
      .sort(() => Math.random() - 0.5)
      .slice(0, safeLimit);

    const cachedDetails = await this.prisma.mediaDetail.findMany({
      where: {
        OR: randomizedReviews.map((review) => ({
          tmdbId: review.tmdbId,
          mediaType: review.mediaType,
        })),
      },
    });
    const detailsByKey = new Map(
      cachedDetails.map((detail) => [
        `${detail.mediaType}:${detail.tmdbId}`,
        detail,
      ]),
    );

    return randomizedReviews.map((review) => {
      const publicReview = new ReviewEntity(review).toPublic();
      const detail = detailsByKey.get(`${review.mediaType}:${review.tmdbId}`);
      const payload = detail?.payload as
        | {
            info?: {
              title?: string | null;
              name?: string | null;
              original_title?: string | null;
              original_name?: string | null;
              poster_path?: string | null;
              backdrop_path?: string | null;
              release_date?: string | null;
              first_air_date?: string | null;
            };
          }
        | undefined;
      const info = payload?.info;
      const title =
        detail?.title ||
        info?.title ||
        info?.name ||
        info?.original_title ||
        info?.original_name ||
        `${review.mediaType === MediaType.TV ? 'TV' : 'Movie'} #${review.tmdbId}`;

      return {
        ...publicReview,
        media: {
          id: review.tmdbId,
          type: review.mediaType,
          title,
          posterPath: info?.poster_path ?? null,
          backdropPath: info?.backdrop_path ?? null,
          releaseDate: info?.release_date ?? info?.first_air_date ?? null,
        },
      };
    });
  }

  async getMediaReviews(
    tmdbId: number,
    mediaType: string,
    page = 1,
    limit = 10,
    viewerId?: string,
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
              name: true,
              avatarUrl: true,
            },
          },
          reactions: {
            select: reactionSelect,
          },
          replies: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  avatarUrl: true,
                },
              },
              reactions: {
                select: reactionSelect,
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
      (review) => new ReviewWithRepliesEntity({ ...review, viewerId }),
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

  async getPublicUserProfile(userIdOrUsername: string, limit = 80) {
    const take = Math.max(1, Math.min(Number(limit) || 80, 120));
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ id: userIdOrUsername }, { username: userIdOrUsername }],
      },
      select: {
        id: true,
        username: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        discloseProfileInfo: true,
        discloseWatchlist: true,
        discloseReviews: true,
        discloseLiked: true,
        discloseBadges: true,
        discloseRecentActivity: true,
        watchlistItems: {
          select: { tmdbId: true, mediaType: true, addedAt: true },
        },
        likedItems: {
          select: { tmdbId: true, mediaType: true, addedAt: true },
        },
        userAchievements: {
          where: { unlocked: true },
          include: {
            achievement: {
              include: { badge: true },
            },
          },
          orderBy: { unlockedAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const disclosure = {
      profileInfo: user.discloseProfileInfo,
      watchlist: user.discloseWatchlist,
      reviews: user.discloseReviews,
      liked: user.discloseLiked,
      badges: user.discloseBadges,
      recentActivity: user.discloseRecentActivity,
    };
    const publicUser = {
      id: user.id,
      username: user.username,
      name: disclosure.profileInfo ? user.name : null,
      avatarUrl: disclosure.profileInfo ? user.avatarUrl : null,
      createdAt: disclosure.profileInfo ? user.createdAt : null,
    };
    // Aggregate the normalized item rows back into the { movieId, seriesId } shape
    // the rest of this method (and the response) expects; addedAt = most recent.
    const aggregateItems = (
      items: { tmdbId: number; mediaType: MediaType; addedAt: Date }[],
    ) => {
      const movieId: string[] = [];
      const seriesId: string[] = [];
      let addedAt: Date | null = null;
      for (const item of items) {
        (item.mediaType === MediaType.MOVIE ? movieId : seriesId).push(String(item.tmdbId));
        if (!addedAt || item.addedAt > addedAt) addedAt = item.addedAt;
      }
      return { movieId, seriesId, addedAt };
    };
    const watchlist = disclosure.watchlist
      ? aggregateItems(user.watchlistItems)
      : { movieId: [], seriesId: [], addedAt: null };
    const liked = disclosure.liked
      ? aggregateItems(user.likedItems)
      : { movieId: [], seriesId: [], addedAt: null };
    const achievements = disclosure.badges
      ? user.userAchievements.map((progress) => ({
          achievement: {
            id: progress.achievement.id,
            key: progress.achievement.key,
            title: progress.achievement.title,
            description: progress.achievement.description,
            category: progress.achievement.category,
            requirementType: progress.achievement.requirementType,
            requirementTarget: progress.achievement.requirementTarget,
            requiredCount: progress.achievement.requiredCount,
            progressLogic: progress.achievement.progressLogic,
            reasoningTemplate: progress.achievement.reasoningTemplate,
            lockedHint: progress.achievement.lockedHint,
            active: progress.achievement.active,
          },
          badge: progress.achievement.badge,
          progress,
        }))
      : [];
    const badges = disclosure.badges
      ? achievements
          .filter((row) => row.badge)
          .map((row) => ({
            id: row.badge!.id,
            badgeType: row.badge!.badgeName,
            awardedAt: row.progress.unlockedAt ?? row.progress.updatedAt,
          }))
      : [];

    const publicWhere = {
      userId: user.id,
      status: { in: [ReviewStatus.PUBLISHED, ReviewStatus.FLAGGED] },
    };

    const [reviews, totalReviews, ratingAggregate, movieReviews, tvReviews] =
      disclosure.reviews
        ? await Promise.all([
            this.prisma.review.findMany({
              where: publicWhere,
              take,
              orderBy: { createdAt: 'desc' },
            }),
            this.prisma.review.count({ where: publicWhere }),
            this.prisma.review.aggregate({
              where: {
                ...publicWhere,
                status: ReviewStatus.PUBLISHED,
                affectsRating: true,
              },
              _avg: { rating: true },
            }),
            this.prisma.review.count({
              where: { ...publicWhere, mediaType: 'MOVIE' },
            }),
            this.prisma.review.count({
              where: { ...publicWhere, mediaType: 'TV' },
            }),
          ])
        : [[], 0, { _avg: { rating: null } }, 0, 0];

    const moodCounts = reviews
      .flatMap((review) => review.moodEmojis)
      .reduce(
        (acc, mood) => {
          acc[mood] = (acc[mood] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

    const topMoods = Object.entries(moodCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([emoji, count]) => ({ emoji, count }));

    const recentActivity = disclosure.recentActivity
      ? [
          ...(disclosure.reviews
            ? reviews.slice(0, 3).map((review) => ({
                type: 'review',
                label: `Reviewed ${review.mediaType === 'TV' ? 'a TV show' : 'a movie'}`,
                createdAt: review.createdAt,
              }))
            : []),
          ...(disclosure.watchlist && watchlist.addedAt
            ? [
                {
                  type: 'watchlist',
                  label: 'Updated watchlist',
                  createdAt: watchlist.addedAt,
                },
              ]
            : []),
          ...(disclosure.liked && liked.addedAt
            ? [
                {
                  type: 'liked',
                  label: 'Updated liked titles',
                  createdAt: liked.addedAt,
                },
              ]
            : []),
        ]
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .slice(0, 5)
      : [];

    return {
      user: publicUser,
      disclosure,
      stats: {
        totalReviews,
        movieReviews,
        tvReviews,
        averageRating: ratingAggregate._avg.rating
          ? Math.round(ratingAggregate._avg.rating * 10) / 10
          : 0,
        topMoods,
      },
      reviews: reviews.map((review) => new ReviewEntity(review).toPublic()),
      watchlist: {
        movieId: watchlist.movieId,
        seriesId: watchlist.seriesId,
      },
      liked: {
        movieId: liked.movieId,
        seriesId: liked.seriesId,
      },
      badges,
      achievements,
      recentActivity,
    };
  }

  async getMyReviews(userId: string, page = 1, limit = 200) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where: { userId } }),
    ]);

    const reviewEntities = reviews.map((r) => new ReviewEntity(r));
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

  async getReviewBanStatus(user: { reviewBannedUntil?: Date }) {
    const now = new Date();
    const bannedDate = user.reviewBannedUntil;

    return {
      banned: !!bannedDate && bannedDate > now,
      bannedUntil: bannedDate && bannedDate > now ? bannedDate : null,
    };
  }
}
