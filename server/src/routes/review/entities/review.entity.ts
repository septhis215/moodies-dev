import {
  Review as PrismaReview,
  ReviewStatus,
  MediaType,
  ReactionType,
} from '@prisma/client';

type ReactionLike = {
  type: ReactionType;
  userId: string;
};

function summarizeReactions(reactions?: ReactionLike[], viewerId?: string) {
  const counts = Object.values(ReactionType).map((type) => ({
    type,
    count: reactions?.filter((reaction) => reaction.type === type).length ?? 0,
  }));

  return {
    reactionCounts: counts.filter((item) => item.count > 0),
    myReaction: viewerId
      ? (reactions?.find((reaction) => reaction.userId === viewerId)?.type ??
        null)
      : null,
  };
}

export class ReviewEntity implements PrismaReview {
  id!: string;
  userId!: string;
  tmdbId!: number;
  mediaType!: MediaType;
  rating!: number;
  content!: string;
  moodEmojis!: string[];
  status!: ReviewStatus;
  flaggedReason!: string | null;
  toxicityScore!: number | null;
  profanityHit!: boolean;
  affectsRating!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  // user may include these fields but it is optional
  user?: {
    id: string;
    username: string;
    name?: string | null;
    avatarUrl: string | null;
  };

  replies?: any[];
  reactions?: ReactionLike[];
  viewerId?: string;

  constructor(partial: Partial<ReviewEntity>) {
    Object.assign(this, partial);
  }

  toPublic() {
    const {
      userId,
      toxicityScore,
      profanityHit,
      flaggedReason,
      user,
      reactions,
      viewerId,
      ...rest
    } = this;

    return {
      ...rest,
      ...summarizeReactions(reactions, viewerId),
      user: user
        ? {
            id: user.id,
            username: user.username,
            name: user.name,
            avatarUrl: user.avatarUrl,
          }
        : undefined,
    };
  }

  isPublic(): boolean {
    return (
      this.status === ReviewStatus.PUBLISHED ||
      this.status === ReviewStatus.FLAGGED
    );
  }

  shouldAffectRating(): boolean {
    return this.affectsRating && this.status === ReviewStatus.PUBLISHED;
  }
}
