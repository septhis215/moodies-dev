import { Controller, INestApplication, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { ClientIpService } from './client-ip.service';
import { TurnstileAction } from './turnstile-action.decorator';
import { TurnstileVerifiedGuard } from './turnstile-verified.guard';
import { TurnstileService } from './turnstile.service';
import { TurnstileController } from './turnstile.controller';

let mutations = 0;
@Controller('fixture')
class ProtectedFixture {
  @Post('signup')
  @TurnstileAction('signup')
  @UseGuards(TurnstileVerifiedGuard)
  signup() {
    mutations++;
    return { success: true };
  }
}

describe('CAPTCHA HTTP boundary', () => {
  let app: INestApplication;
  const originalFetch = global.fetch;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProtectedFixture, TurnstileController],
      providers: [
        TurnstileService,
        TurnstileVerifiedGuard,
        ClientIpService,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            NODE_ENV: 'staging',
            TURNSTILE_SECRET_KEY: 'test-secret',
            TURNSTILE_ALLOWED_HOSTNAMES: 'app.example.test',
          }),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });
  beforeEach(() => {
    mutations = 0;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });
  afterAll(async () => {
    await app?.close();
  });
  it('rejects direct API requests carrying only the old verification cookie', async () => {
    const result = await request(app.getHttpServer())
      .post('/api/fixture/signup')
      .set('Cookie', 'moodies_turnstile_verified=legacy-cookie')
      .send({});
    expect(result.status).toBe(400);
    expect(result.body.code).toBe('CAPTCHA_REQUIRED');
    expect(mutations).toBe(0);
  });
  it('rejects wrong-host tokens and preserves the actionable error code', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        Response.json({
          success: true,
          hostname: 'wrong.example',
          action: 'signup',
        }),
      );
    const result = await request(app.getHttpServer())
      .post('/api/fixture/signup')
      .set('x-turnstile-token', 'wrong-host')
      .send({});
    expect(result.status).toBe(403);
    expect(result.body.code).toBe('CAPTCHA_REJECTED');
    expect(mutations).toBe(0);
  });
  it('passes accepted proof once and rejects replay before business logic', async () => {
    const used = new Set<string>();
    global.fetch = jest.fn().mockImplementation(async (_url, init) => {
      const token = init.body.get('response');
      const duplicate = used.has(token);
      used.add(token);
      return Response.json(
        duplicate
          ? { success: false, 'error-codes': ['timeout-or-duplicate'] }
          : { success: true, hostname: 'app.example.test', action: 'signup' },
      );
    });
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/fixture/signup')
          .set('x-turnstile-token', 'once')
          .send({})
      ).status,
    ).toBe(201);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/fixture/signup')
          .set('x-turnstile-token', 'once')
          .send({})
      ).status,
    ).toBe(403);
    expect(mutations).toBe(1);
  });
  it('returns a retryable 503, not success or authentication expiry, on provider failure', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('provider unavailable'));
    const result = await request(app.getHttpServer())
      .post('/api/fixture/signup')
      .set('x-turnstile-token', 'token')
      .send({});
    expect(result.status).toBe(503);
    expect(result.body.code).toBe('CAPTCHA_UNAVAILABLE');
    expect(mutations).toBe(0);
  });
  it('retires generic verification and marks the old status response non-cacheable', async () => {
    const status = await request(app.getHttpServer()).get(
      '/api/security/turnstile/status',
    );
    expect(status.headers['cache-control']).toBe('no-store');
    expect(status.body.verified).toBe(false);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/security/turnstile/verify')
          .send({ token: 'old-flow' })
      ).status,
    ).toBe(410);
  });
});
