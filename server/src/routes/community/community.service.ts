import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReactionType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProfanityFilterService } from '../moderation/profanity-filter.service';
import { ToxicityAnalysisService } from '../moderation/toxicity-analysis.service';
import {
  CommunityPageDto,
  CreateCommunityPostDto,
  CreateCommunityReplyDto,
} from './dto/community.dto';

const userSelect = { id: true, username: true, avatarUrl: true } as const;
const postSelect = {
  id: true,
  title: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  user: { select: userSelect },
  _count: { select: { replies: true } },
} as const;
const replySelect = {
  id: true,
  postId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  user: { select: userSelect },
} as const;
type ReactionSummary = {
  reactionCounts: { type: ReactionType; count: number }[];
  myReaction: ReactionType | null;
};
const emptyReactions: ReactionSummary = {
  reactionCounts: [],
  myReaction: null,
};

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profanity: ProfanityFilterService,
    private readonly toxicity: ToxicityAnalysisService,
  ) {}

  async getPosts({ page, limit }: CommunityPageDto, viewerId?: string) {
    const [posts, total] = await Promise.all([
      this.prisma.communityPost.findMany({
        select: postSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.communityPost.count(),
    ]);
    const reactions = await this.postReactions(
      posts.map((post) => post.id),
      viewerId,
    );
    return {
      posts: posts.map(({ _count, ...post }) => ({
        ...post,
        replyCount: _count.replies,
        ...reactions.get(post.id),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createPost(userId: string, dto: CreateCommunityPostDto) {
    await this.moderate(`${dto.title}\n${dto.content}`);
    const { _count, ...post } = await this.prisma.communityPost.create({
      data: { userId, title: dto.title, content: dto.content },
      select: postSelect,
    });
    return { ...post, replyCount: _count.replies, ...emptyReactions };
  }

  async getReplies(
    postId: string,
    { page, limit }: CommunityPageDto,
    viewerId?: string,
  ) {
    await this.requirePost(postId);
    const where = { postId };
    const [replies, total] = await Promise.all([
      this.prisma.communityReply.findMany({
        where,
        select: replySelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.communityReply.count({ where }),
    ]);
    const reactions = await this.replyReactions(
      replies.map((reply) => reply.id),
      viewerId,
    );
    return {
      replies: replies.map((reply) => ({
        ...reply,
        ...reactions.get(reply.id),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createReply(
    userId: string,
    postId: string,
    dto: CreateCommunityReplyDto,
  ) {
    await this.requirePost(postId);
    await this.moderate(dto.content);
    const reply = await this.prisma.communityReply.create({
      data: { postId, userId, content: dto.content },
      select: replySelect,
    });
    return { ...reply, ...emptyReactions };
  }

  async setPostReaction(userId: string, postId: string, type: ReactionType) {
    await this.requirePost(postId);
    await this.prisma.communityPostReaction.upsert({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId, type },
      update: { type },
    });
    return (await this.postReactions([postId], userId)).get(postId);
  }

  async removePostReaction(userId: string, postId: string) {
    await this.requirePost(postId);
    await this.prisma.communityPostReaction.deleteMany({
      where: { postId, userId },
    });
    return (await this.postReactions([postId], userId)).get(postId);
  }

  async setReplyReaction(userId: string, replyId: string, type: ReactionType) {
    await this.requireReply(replyId);
    await this.prisma.communityReplyReaction.upsert({
      where: { replyId_userId: { replyId, userId } },
      create: { replyId, userId, type },
      update: { type },
    });
    return (await this.replyReactions([replyId], userId)).get(replyId);
  }

  async removeReplyReaction(userId: string, replyId: string) {
    await this.requireReply(replyId);
    await this.prisma.communityReplyReaction.deleteMany({
      where: { replyId, userId },
    });
    return (await this.replyReactions([replyId], userId)).get(replyId);
  }

  private async requirePost(id: string) {
    if (
      !(await this.prisma.communityPost.findUnique({
        where: { id },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('This community post could not be found.');
    }
  }

  private async requireReply(id: string) {
    if (
      !(await this.prisma.communityReply.findUnique({
        where: { id },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('This reply could not be found.');
    }
  }

  private async moderate(content: string) {
    // Use the same moderation threshold as review replies, including the post title.
    if (this.profanity.check(content).block) {
      throw new BadRequestException(
        'Please rephrase your feedback with less profanity.',
      );
    }
    const result = await this.toxicity.analyze(content);
    if (result.severe || result.score >= 0.4) {
      throw new BadRequestException(
        'Please keep your feedback constructive and respectful.',
      );
    }
  }

  private async postReactions(
    ids: string[],
    viewerId?: string,
  ): Promise<Map<string, ReactionSummary>> {
    if (!ids.length) return new Map();
    const [counts, mine] = await Promise.all([
      this.prisma.communityPostReaction.groupBy({
        by: ['postId', 'type'],
        where: { postId: { in: ids } },
        _count: { _all: true },
      }),
      viewerId
        ? this.prisma.communityPostReaction.findMany({
            where: { postId: { in: ids }, userId: viewerId },
            select: { postId: true, type: true },
          })
        : ([] as { postId: string; type: ReactionType }[]),
    ]);
    return new Map(
      ids.map((id) => [
        id,
        {
          reactionCounts: counts
            .filter((row) => row.postId === id)
            .map((row) => ({ type: row.type, count: row._count._all })),
          myReaction: mine.find((row) => row.postId === id)?.type ?? null,
        },
      ]),
    );
  }

  private async replyReactions(
    ids: string[],
    viewerId?: string,
  ): Promise<Map<string, ReactionSummary>> {
    if (!ids.length) return new Map();
    const [counts, mine] = await Promise.all([
      this.prisma.communityReplyReaction.groupBy({
        by: ['replyId', 'type'],
        where: { replyId: { in: ids } },
        _count: { _all: true },
      }),
      viewerId
        ? this.prisma.communityReplyReaction.findMany({
            where: { replyId: { in: ids }, userId: viewerId },
            select: { replyId: true, type: true },
          })
        : ([] as { replyId: string; type: ReactionType }[]),
    ]);
    return new Map(
      ids.map((id) => [
        id,
        {
          reactionCounts: counts
            .filter((row) => row.replyId === id)
            .map((row) => ({ type: row.type, count: row._count._all })),
          myReaction: mine.find((row) => row.replyId === id)?.type ?? null,
        },
      ]),
    );
  }
}
