import { ReviewEntity } from './review.entity';
import { ReviewReplyEntity } from './review-reply.entity';

export class ReviewWithRepliesEntity extends ReviewEntity {
  replies: ReviewReplyEntity[];

  constructor(data: any) {
    const { replies, ...reviewData } = data;
    super(reviewData);

    this.replies = (replies || []).map(
      (reply: any) => new ReviewReplyEntity(reply),
    );
  }

  toPublic() {
    const publicReview = super.toPublic();
    return {
      ...publicReview,
      replies: this.replies.map((reply) => reply.toPublic()),
    };
  }
}
