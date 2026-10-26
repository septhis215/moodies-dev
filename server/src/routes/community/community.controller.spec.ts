import {
  ForbiddenException,
  UnauthorizedException,
  ValidationPipe,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { JwtGuard } from 'src/auth/guard';
import { OptionalJwtGuard } from 'src/auth/guard/optional-jwt.guard';
import { TurnstileVerifiedGuard } from 'src/common/security/turnstile-verified.guard';
import { ReviewBanGuard } from '../review/guard/review-ban.guard';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

describe('community HTTP boundaries', () => {
  const id = 'b6c12e6d-f737-4edf-bd36-964eebf7eab1';
  let app: INestApplication<Server>;
  let httpServer: Server;
  let authenticated = false;
  let banned = false;
  const service = {
    getPost: jest.fn().mockResolvedValue({ id }),
    getPosts: jest
      .fn()
      .mockResolvedValue({ posts: [], pagination: { total: 0 } }),
    getReplies: jest.fn().mockResolvedValue({ replies: [] }),
    createPost: jest.fn().mockResolvedValue({ id }),
    createReply: jest.fn().mockResolvedValue({ id }),
    setPostReaction: jest.fn().mockResolvedValue({ myReaction: 'LIKE' }),
    removePostReaction: jest.fn().mockResolvedValue({ myReaction: null }),
    setReplyReaction: jest.fn().mockResolvedValue({ myReaction: 'LIKE' }),
    removeReplyReaction: jest.fn().mockResolvedValue({ myReaction: null }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CommunityController],
      providers: [{ provide: CommunityService, useValue: service }],
    })
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          if (!authenticated) throw new UnauthorizedException();
          context.switchToHttp().getRequest<{ user?: { id: string } }>().user =
            { id: 'signed-in-member' };
          return true;
        },
      })
      .overrideGuard(OptionalJwtGuard)
      .useValue({
        canActivate() {
          return true;
        },
      })
      .overrideGuard(ReviewBanGuard)
      .useValue({
        canActivate() {
          if (banned) throw new ForbiddenException();
          return true;
        },
      })
      .overrideGuard(TurnstileVerifiedGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          if (
            !context
              .switchToHttp()
              .getRequest<{ headers: Record<string, unknown> }>().headers[
              'x-turnstile-token'
            ]
          )
            throw new ForbiddenException();
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
    httpServer = app.getHttpServer();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    authenticated = false;
    banned = false;
    jest.clearAllMocks();
  });

  it('allows guests to read posts and replies', async () => {
    await request(httpServer).get('/api/community/posts').expect(200);
    await request(httpServer).get(`/api/community/posts/${id}`).expect(200);
    await request(httpServer)
      .get(`/api/community/posts/${id}/replies`)
      .expect(200);
    expect(service.getPosts).toHaveBeenCalledWith(
      { page: 1, limit: 10 },
      undefined,
    );
  });

  it.each([
    ['post', '/posts'],
    ['post', `/posts/${id}/replies`],
    ['post', `/posts/${id}/reactions`],
    ['delete', `/posts/${id}/reactions`],
    ['post', `/replies/${id}/reactions`],
    ['delete', `/replies/${id}/reactions`],
  ])('requires sign-in for %s %s', async (method, path) => {
    const agent = request(httpServer);
    await (
      method === 'post'
        ? agent.post(`/api/community${path}`)
        : agent.delete(`/api/community${path}`)
    )
      .send({})
      .expect(401);
  });

  it('requires verification for posts and replies and blocks restricted authors', async () => {
    authenticated = true;
    const body = {
      title: 'A useful idea',
      content: 'Please add a useful filter.',
    };
    await request(httpServer)
      .post('/api/community/posts')
      .send(body)
      .expect(403);
    await request(httpServer)
      .post(`/api/community/posts/${id}/replies`)
      .send(body)
      .expect(403);
    banned = true;
    await request(httpServer)
      .post('/api/community/posts')
      .set('x-turnstile-token', 'fixture')
      .send(body)
      .expect(403);
    await request(httpServer)
      .post(`/api/community/posts/${id}/replies`)
      .set('x-turnstile-token', 'fixture')
      .send(body)
      .expect(403);
    expect(service.createPost).not.toHaveBeenCalled();
    expect(service.createReply).not.toHaveBeenCalled();
  });

  it('takes identity only from the session and trims public content', async () => {
    authenticated = true;
    await request(httpServer)
      .post('/api/community/posts')
      .set('x-turnstile-token', 'fixture')
      .send({
        userId: 'someone-else',
        title: '  A useful idea  ',
        content: '  Please add a useful filter.  ',
      })
      .expect(201);
    expect(service.createPost).toHaveBeenCalledWith('signed-in-member', {
      title: 'A useful idea',
      content: 'Please add a useful filter.',
    });
    await request(httpServer)
      .post(`/api/community/posts/${id}/reactions`)
      .send({ userId: 'someone-else', type: 'LIKE' })
      .expect(201);
    expect(service.setPostReaction).toHaveBeenCalledWith(
      'signed-in-member',
      id,
      'LIKE',
    );
  });

  it('rejects malformed IDs, unbounded pagination, whitespace, and unsupported reactions', async () => {
    authenticated = true;
    await request(httpServer)
      .get('/api/community/posts?sort=invalid')
      .expect(400);
    await request(httpServer)
      .get('/api/community/posts?filter=invalid')
      .expect(400);
    await request(httpServer)
      .get('/api/community/posts/not-a-uuid')
      .expect(400);
    await request(httpServer)
      .get('/api/community/posts?limit=1000')
      .expect(400);
    await request(httpServer)
      .get('/api/community/posts?postId=x&page=-1')
      .expect(400);
    await request(httpServer)
      .get('/api/community/posts/not-a-uuid/replies')
      .expect(400);
    await request(httpServer)
      .post('/api/community/posts')
      .set('x-turnstile-token', 'fixture')
      .send({ title: '   ', content: '             ' })
      .expect(400);
    await request(httpServer)
      .post(`/api/community/posts/${id}/reactions`)
      .send({ type: 'INVALID' })
      .expect(400);
    expect(service.createPost).not.toHaveBeenCalled();
    expect(service.setPostReaction).not.toHaveBeenCalled();
  });
});
