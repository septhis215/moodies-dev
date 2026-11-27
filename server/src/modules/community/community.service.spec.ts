import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReactionType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProfanityFilterService } from '../moderation/profanity-filter.service';
import { ToxicityAnalysisService } from '../moderation/toxicity-analysis.service';
import { CommunityService } from './community.service';
import {
  CommunityPageDto,
  CommunityTopicsQueryDto,
  CreateCommunityPostDto,
  CreateCommunityReplyDto,
} from './dto/community.dto';

describe('community forum', () => {
  const setup = () => {
    const prisma = {
      communityPost: {
        findUnique: jest.fn().mockResolvedValue({ id: 'post' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
      communityReply: {
        findUnique: jest.fn().mockResolvedValue({ id: 'reply' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
      communityPostReaction: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      communityReplyReaction: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    const profanity = { check: jest.fn().mockReturnValue({ block: false }) };
    const toxicity = {
      analyze: jest.fn().mockResolvedValue({ score: 0, severe: false }),
    };
    const service = new CommunityService(
      prisma as unknown as PrismaService,
      profanity as unknown as ProfanityFilterService,
      toxicity as unknown as ToxicityAnalysisService,
    );
    return { service, prisma, profanity, toxicity };
  };

  it('filters and counts the full forum query consistently before pagination', async () => {
    const { service, prisma } = setup();
    await service.getPosts({
      page: 1,
      limit: 10,
      search: 'mood',
      filter: 'unanswered',
      sort: 'most-replies',
    });
    const where = {
      replies: { none: {} },
      OR: [
        { title: { contains: 'mood', mode: 'insensitive' } },
        { content: { contains: 'mood', mode: 'insensitive' } },
      ],
    };
    expect(prisma.communityPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        take: 10,
        orderBy: [
          { replies: { _count: 'desc' } },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
      }),
    );
    expect(prisma.communityPost.count).toHaveBeenCalledWith({ where });
  });

  it('requires a session for personal topics and scopes them to that session', async () => {
    const { service, prisma } = setup();
    await expect(
      service.getPosts({ page: 1, limit: 10, filter: 'mine' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.communityPost.findMany).not.toHaveBeenCalled();
    await service.getPosts({ page: 1, limit: 10, filter: 'mine' }, 'member');
    expect(prisma.communityPost.count).toHaveBeenCalledWith({
      where: { userId: 'member' },
    });
  });

  it('returns a direct topic with its reaction summary and rejects a missing topic', async () => {
    const { service, prisma } = setup();
    prisma.communityPost.findUnique.mockResolvedValue({
      id: 'post',
      content: 'The discussion',
      _count: { replies: 3 },
    });
    await expect(service.getPost('post')).resolves.toMatchObject({
      id: 'post',
      replyCount: 3,
      reactionCounts: [],
      myReaction: null,
    });
    prisma.communityPost.findUnique.mockResolvedValue(null);
    await expect(service.getPost('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('includes only the newest reply as a topic activity summary', async () => {
    const { service, prisma } = setup();
    const latestReply = {
      id: 'reply',
      createdAt: new Date(),
      user: { id: 'other', username: 'Sam' },
    };
    prisma.communityPost.findMany.mockResolvedValue([
      { id: 'post', _count: { replies: 20 }, replies: [latestReply] },
    ]);
    const result = await service.getPosts({ page: 1, limit: 10 });
    expect(result.posts[0].latestReply).toEqual(latestReply);
    expect(result.posts[0]).not.toHaveProperty('replies');
  });

  it('validates bounded forum search and supported view and sort options', async () => {
    const query = plainToInstance(CommunityTopicsQueryDto, {
      search: '  mood  ',
      sort: 'most-replies',
      filter: 'unanswered',
    });
    expect(query.search).toBe('mood');
    expect(await validate(query)).toHaveLength(0);
    for (const invalid of [
      { search: 'x'.repeat(101) },
      { sort: 'invalid' },
      { filter: 'invalid' },
    ]) {
      expect(
        (await validate(plainToInstance(CommunityTopicsQueryDto, invalid)))
          .length,
      ).toBeGreaterThan(0);
    }
  });

  it('creates feedback using the authenticated author and moderates its title and content together', async () => {
    const { service, prisma, toxicity } = setup();
    prisma.communityPost.create.mockResolvedValue({
      id: 'post',
      title: 'An idea',
      content: 'More useful filters',
      _count: { replies: 0 },
      user: { username: 'alex' },
    });
    await expect(
      service.createPost('member', {
        title: 'An idea',
        content: 'More useful filters',
      }),
    ).resolves.toMatchObject({
      id: 'post',
      replyCount: 0,
      reactionCounts: [],
      myReaction: null,
    });
    expect(toxicity.analyze).toHaveBeenCalledWith(
      'An idea\nMore useful filters',
    );
    expect(prisma.communityPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: 'member',
          title: 'An idea',
          content: 'More useful filters',
        },
      }),
    );
  });

  it('blocks excessive profanity before creating feedback', async () => {
    const { service, prisma, profanity } = setup();
    profanity.check.mockReturnValue({ block: true });
    await expect(
      service.createPost('member', {
        title: 'Title',
        content: 'Some feedback',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.communityPost.create).not.toHaveBeenCalled();
  });

  it.each([
    { score: 0.4, severe: false },
    { score: 0, severe: true },
  ])('blocks inappropriate replies (%o)', async (result) => {
    const { service, prisma, toxicity } = setup();
    toxicity.analyze.mockResolvedValue(result);
    await expect(
      service.createReply('member', 'post', { content: 'A reply' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.communityReply.create).not.toHaveBeenCalled();
  });

  it('does not create replies against a missing post', async () => {
    const { service, prisma } = setup();
    prisma.communityPost.findUnique.mockResolvedValue(null);
    await expect(
      service.createReply('member', 'missing', { content: 'A reply' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.communityReply.create).not.toHaveBeenCalled();
  });

  it('paginates posts and aggregates counts without disclosing who reacted', async () => {
    const { service, prisma } = setup();
    prisma.communityPost.findMany.mockResolvedValue([
      { id: 'post', _count: { replies: 12 }, user: { username: 'alex' } },
    ]);
    prisma.communityPost.count.mockResolvedValue(21);
    prisma.communityPostReaction.groupBy.mockResolvedValue([
      { postId: 'post', type: ReactionType.LOVE, _count: { _all: 7 } },
    ]);
    prisma.communityPostReaction.findMany.mockResolvedValue([
      { postId: 'post', type: ReactionType.LOVE },
    ]);
    const result = await service.getPosts({ page: 2, limit: 10 }, 'member');
    expect(prisma.communityPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
    });
    expect(result.posts[0]).toMatchObject({
      replyCount: 12,
      reactionCounts: [{ type: 'LOVE', count: 7 }],
      myReaction: 'LOVE',
    });
    expect(result.posts[0]).not.toHaveProperty('_count');
    expect(prisma.communityPostReaction.findMany).toHaveBeenCalledWith({
      where: { postId: { in: ['post'] }, userId: 'member' },
      select: { postId: true, type: true },
    });
  });

  it('permits anonymous reads with counts and no personal reaction query', async () => {
    const { service, prisma } = setup();
    prisma.communityPost.findMany.mockResolvedValue([
      { id: 'post', _count: { replies: 0 } },
    ]);
    const result = await service.getPosts({ page: 1, limit: 10 });
    expect(result.posts[0].myReaction).toBeNull();
    expect(prisma.communityPostReaction.findMany).not.toHaveBeenCalled();
  });

  it('loads replies independently using bounded, stable pagination', async () => {
    const { service, prisma } = setup();
    prisma.communityReply.findMany.mockResolvedValue([
      { id: 'reply', content: 'I agree' },
    ]);
    prisma.communityReply.count.mockResolvedValue(15);
    prisma.communityReplyReaction.groupBy.mockResolvedValue([
      { replyId: 'reply', type: ReactionType.LIKE, _count: { _all: 2 } },
    ]);
    const result = await service.getReplies('post', { page: 2, limit: 10 });
    expect(prisma.communityReply.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { postId: 'post' },
        skip: 10,
        take: 10,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(result.replies[0]).toMatchObject({
      reactionCounts: [{ type: 'LIKE', count: 2 }],
      myReaction: null,
    });
  });

  it("upserts one reaction per author and post, then deletes only that author's reaction", async () => {
    const { service, prisma } = setup();
    await service.setPostReaction('member', 'post', ReactionType.LOVE);
    expect(prisma.communityPostReaction.upsert).toHaveBeenCalledWith({
      where: { postId_userId: { postId: 'post', userId: 'member' } },
      create: { postId: 'post', userId: 'member', type: 'LOVE' },
      update: { type: 'LOVE' },
    });
    await service.removePostReaction('member', 'post');
    expect(prisma.communityPostReaction.deleteMany).toHaveBeenCalledWith({
      where: { postId: 'post', userId: 'member' },
    });
  });

  it('supports replacing and removing a reply reaction', async () => {
    const { service, prisma } = setup();
    await service.setReplyReaction('member', 'reply', ReactionType.HAHA);
    expect(prisma.communityReplyReaction.upsert).toHaveBeenCalledWith({
      where: { replyId_userId: { replyId: 'reply', userId: 'member' } },
      create: { replyId: 'reply', userId: 'member', type: 'HAHA' },
      update: { type: 'HAHA' },
    });
    await service.removeReplyReaction('member', 'reply');
    expect(prisma.communityReplyReaction.deleteMany).toHaveBeenCalledWith({
      where: { replyId: 'reply', userId: 'member' },
    });
  });

  it('rejects reactions on missing replies', async () => {
    const { service, prisma } = setup();
    prisma.communityReply.findUnique.mockResolvedValue(null);
    await expect(
      service.setReplyReaction('member', 'missing', ReactionType.LIKE),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.communityReplyReaction.upsert).not.toHaveBeenCalled();
  });

  it('trims input and rejects whitespace-only, short and oversized content', async () => {
    const good = plainToInstance(CreateCommunityPostDto, {
      title: '  Useful idea  ',
      content: '  Please add a mood filter.  ',
    });
    expect(good.title).toBe('Useful idea');
    expect(good.content).toBe('Please add a mood filter.');
    expect(await validate(good)).toHaveLength(0);
    for (const body of [
      { title: '   ', content: '          ' },
      { title: 'ok', content: 'short' },
      { title: 'x'.repeat(121), content: 'x'.repeat(3001) },
    ]) {
      expect(
        (await validate(plainToInstance(CreateCommunityPostDto, body))).length,
      ).toBeGreaterThan(0);
    }
    for (const content of ['   ', 'hi', 'x'.repeat(501)]) {
      expect(
        (await validate(plainToInstance(CreateCommunityReplyDto, { content })))
          .length,
      ).toBeGreaterThan(0);
    }
  });

  it('defaults pagination and rejects invalid or unbounded query values', async () => {
    expect(plainToInstance(CommunityPageDto, {})).toEqual({
      page: 1,
      limit: 10,
    });
    for (const query of [
      { page: '0' },
      { page: 'NaN' },
      { page: '1.5' },
      { page: '10001' },
      { limit: '0' },
      { limit: '21' },
    ]) {
      expect(
        (await validate(plainToInstance(CommunityPageDto, query))).length,
      ).toBeGreaterThan(0);
    }
  });
});
