import { ReviewReply as PrismaReviewReply } from '@prisma/client';

export class ReviewReplyEntity implements PrismaReviewReply {
  id: string;
  reviewId: string;
  userId: string;
  content: string;
  createdAt: Date;

  // user may include these fields but it is optional
  user?: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };

  constructor(partial: Partial<ReviewReplyEntity>) {
    Object.assign(this, partial);
  }

  toPublic() {
    return {
      content: this.content,
      createdAt: this.createdAt,
      user: this.user
        ? {
            username: this.user.username,
            avatarUrl: this.user.avatarUrl,
          }
        : undefined,
    };
  }
}
