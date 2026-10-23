import { ConfigService } from '@nestjs/config';
import { TurnstileService } from './turnstile.service';
import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';

describe('Turnstile verification security', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });
  const create = (overrides: Record<string, unknown> = {}) =>
    new TurnstileService(
      new ConfigService({
        TURNSTILE_SECRET_KEY: 'test-secret',
        TURNSTILE_ALLOWED_HOSTNAMES: 'app.example.test',
        NODE_ENV: 'staging',
        ...overrides,
      }),
    );
  const success = () =>
    Response.json({
      success: true,
      hostname: 'app.example.test',
      action: 'signup',
    });

  it('rejects a successful token minted on an unexpected hostname', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      Response.json({
        success: true,
        hostname: 'untrusted.example',
        action: 'signup',
      }),
    );
    const service = new TurnstileService(
      new ConfigService({
        TURNSTILE_SECRET_KEY: 'test-secret',
        TURNSTILE_ALLOWED_HOSTNAMES: 'app.example.test',
        NODE_ENV: 'staging',
      }),
    );
    await expect(
      service.verifyToken('test-token', '192.0.2.1'),
    ).rejects.toThrow();
  });

  it('accepts the expected hostname and action and sends only trusted remote IP', async () => {
    const fetcher = jest.fn().mockResolvedValue(success());
    global.fetch = fetcher;
    await expect(
      create().verifyToken('test-token', '192.0.2.1', 'signup'),
    ).resolves.toBe(true);
    const options = fetcher.mock.calls[0][1];
    expect(options.body.get('remoteip')).toBe('192.0.2.1');
    expect(options.body.get('idempotency_key')).toMatch(/^[a-f\d-]{36}$/);
    expect(options.redirect).toBe('error');
  });

  it.each([undefined, '', ' ', {}, ['token'], 'x'.repeat(2049)])(
    'rejects invalid token input before calling Cloudflare (%p)',
    async (token) => {
      global.fetch = jest.fn();
      await expect(
        create().verifyToken(token, undefined, 'signup'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(global.fetch).not.toHaveBeenCalled();
    },
  );

  it('rejects a valid token for a different action', async () => {
    global.fetch = jest.fn().mockResolvedValue(success());
    await expect(
      create().verifyToken('test-token', undefined, 'signin'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('derives the hostname from configured frontend origins when no override exists', async () => {
    global.fetch = jest.fn().mockResolvedValue(success());
    await expect(
      create({
        TURNSTILE_ALLOWED_HOSTNAMES: undefined,
        CORS_ORIGINS: 'https://app.example.test, https://other.example.test',
      }).verifyToken('token', undefined, 'signup'),
    ).resolves.toBe(true);
  });

  it('never retries a rejected/expired/duplicate token', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      Response.json({
        success: false,
        'error-codes': ['timeout-or-duplicate'],
      }),
    );
    await expect(
      create().verifyToken('used-token', undefined, 'signup'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries a transport failure with the same idempotency key', async () => {
    const fetcher = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(success());
    global.fetch = fetcher;
    await expect(
      create().verifyToken('token', undefined, 'signup'),
    ).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1].body.get('idempotency_key')).toBe(
      fetcher.mock.calls[1][1].body.get('idempotency_key'),
    );
  });

  it.each([
    Response.json({ success: true }, { status: 503 }),
    Response.json(null),
    new Response('not JSON'),
  ])(
    'bounds malformed/provider failures and returns 503, not success',
    async (response) => {
      global.fetch = jest.fn().mockImplementation(async () => response.clone());
      await expect(
        create().verifyToken('token', undefined, 'signup'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    },
  );

  it('aborts hung verification attempts rather than waiting indefinitely', async () => {
    global.fetch = jest.fn().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener(
            'abort',
            () => reject(new Error('aborted')),
            { once: true },
          );
        }),
    );
    const started = Date.now();
    await expect(
      create({ TURNSTILE_VERIFY_TIMEOUT_MS: 100 }).verifyToken(
        'token',
        undefined,
        'signup',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(Date.now() - started).toBeLessThan(1500);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    { TURNSTILE_SECRET_KEY: undefined },
    { TURNSTILE_ALLOWED_HOSTNAMES: '' },
    { TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' },
    { TURNSTILE_VERIFY_URL: 'https://untrusted.example/verify' },
  ])(
    'fails closed for unsafe deployment configuration (%p)',
    async (settings) => {
      global.fetch = jest.fn();
      await expect(
        create(settings).verifyToken('token', undefined, 'signup'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(global.fetch).not.toHaveBeenCalled();
    },
  );

  it('bounds concurrent provider work and releases capacity after completion', async () => {
    let release: (response: Response) => void = () => undefined;
    global.fetch = jest.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const service = create({ TURNSTILE_MAX_CONCURRENT: 1 });
    const first = service.verifyToken('first', undefined, 'signup');
    await expect(
      service.verifyToken('second', undefined, 'signup'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    release(success());
    await expect(first).resolves.toBe(true);
    global.fetch = jest.fn().mockResolvedValue(success());
    await expect(
      service.verifyToken('third', undefined, 'signup'),
    ).resolves.toBe(true);
  });
  it('supports official Cloudflare dummy responses only for explicit local-development test credentials', async () => {
    global.fetch = jest
      .fn()
      .mockImplementation(async () =>
        Response.json({ success: true, hostname: 'localhost', action: 'test' }),
      );
    const service = create({
      NODE_ENV: 'development',
      TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
    });
    await expect(
      service.verifyToken('XXXX.DUMMY.TOKEN.XXXX', undefined, 'signup'),
    ).resolves.toBe(true);
    await expect(
      service.verifyToken('real-token', undefined, 'signup'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      create({ NODE_ENV: 'development' }).verifyToken(
        'XXXX.DUMMY.TOKEN.XXXX',
        undefined,
        'signup',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('handles the real provider synthetic response without weakening real-key metadata checks', async () => {
    global.fetch = jest
      .fn()
      .mockImplementation(async () =>
        Response.json({ success: true, hostname: 'example.com' }),
      );
    const service = create({
      NODE_ENV: 'development',
      TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
    });
    await expect(
      service.verifyToken('XXXX.DUMMY.TOKEN.XXXX', undefined, 'signup'),
    ).resolves.toBe(true);
    await expect(
      create().verifyToken('real-token', undefined, 'signup'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
