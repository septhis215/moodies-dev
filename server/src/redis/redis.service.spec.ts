import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { createClient } from 'redis';
import { RedisService } from './redis.service';

jest.mock('redis', () => ({ createClient: jest.fn() }));

describe('bounded Redis availability', () => {
  const create = createClient as jest.Mock;
  it('coalesces concurrent cache misses and releases failed loads for retry', async () => {
    const service = new RedisService(new ConfigService());
    const load = jest.fn(async () => { await new Promise(resolve => setTimeout(resolve, 5)); return [1, 2]; });
    const values = await Promise.all(Array.from({ length: 20 }, () => service.getOrSet('pool', 60, load)));
    expect(load).toHaveBeenCalledTimes(1);
    expect(values).toEqual(Array.from({ length: 20 }, () => [1, 2]));
    await expect(service.getOrSet('failure', 60, async () => { throw new Error('upstream'); })).rejects.toThrow('upstream');
    await expect(service.getOrSet('failure', 60, async () => 'recovered')).resolves.toBe('recovered');
  });
  afterEach(() => {
    jest.restoreAllMocks();
    create.mockReset();
  });

  it('fails closed for quotas but preserves cache-miss behavior when no store is configured', async () => {
    const service = new RedisService(new ConfigService());
    await expect(service.get('cache')).resolves.toBeNull();
    await expect(
      service.consumeRateLimits([{ key: 'bucket', points: 1, windowMs: 1000 }]),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(create).not.toHaveBeenCalled();
  });

  it('bounds stalled connection attempts, shares one attempt and cools down instead of reconnecting on every request', async () => {
    const destroy = jest.fn();
    const client = {
      on: jest.fn(),
      connect: jest.fn(() => new Promise(() => undefined)),
      isOpen: true,
      destroy,
    };
    create.mockReturnValue(client);
    const service = new RedisService(
      new ConfigService({
        REDIS_URL: 'redis://127.0.0.1:6379',
        REDIS_CONNECT_TIMEOUT_MS: 100,
      }),
    );
    const started = Date.now();
    await expect(
      Promise.all(Array.from({ length: 30 }, () => service.get('cache'))),
    ).resolves.toEqual(Array(30).fill(null));
    expect(Date.now() - started).toBeLessThan(1500);
    expect(create).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
    await expect(service.get('cache')).resolves.toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
    const options = create.mock.calls[0][0];
    expect(options.socket.reconnectStrategy).toBe(false);
    expect(options.disableOfflineQueue).toBe(true);
    expect(options.commandsQueueMaxLength).toBe(10_000);
  });
});
