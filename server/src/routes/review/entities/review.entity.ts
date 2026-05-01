import {
  Review as PrismaReview,
  ReviewStatus,
  MediaType,
} from '@prisma/client';

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
      ...rest
    } = this;

    return {
      ...rest,
      user: user
        ? {
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
