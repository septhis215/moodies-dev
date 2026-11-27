import { ReactionType, ReviewReply as PrismaReviewReply } from '@prisma/client';

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

export class ReviewReplyEntity implements PrismaReviewReply {
  id!: string;
  reviewId!: string;
  userId!: string;
  content!: string;
  createdAt!: Date;

  // user may include these fields but it is optional
  user?: {
    id: string;
    username: string;
    name?: string | null;
    avatarUrl: string | null;
  };
  reactions?: ReactionLike[];
  viewerId?: string;

  constructor(partial: Partial<ReviewReplyEntity>) {
    Object.assign(this, partial);
  }

  toPublic() {
    return {
      id: this.id,
      content: this.content,
      createdAt: this.createdAt,
      ...summarizeReactions(this.reactions, this.viewerId),
      user: this.user
        ? {
            id: this.user.id,
            username: this.user.username,
            name: this.user.name,
            avatarUrl: this.user.avatarUrl,
          }
        : undefined,
    };
  }
}
