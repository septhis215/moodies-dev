import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  constructor(private configService: ConfigService) {}

  private client;

  async onModuleInit() {
    const host = await this.configService.get<string>('REDIS_HOST');
    const pass = await this.configService.get<string>('REDIS_PASS');
    const port = await this.configService.get<number>('REDIS_PORT');

    this.client = createClient({
      username: 'default',
      password: pass,
      socket: {
        host: host,
        port: port,
      },
    });

    this.client.on('error', (err) => console.log('Redis Client Error', err));
    await this.client.connect();
    console.log('Redis client connected...');
  }

  async onModuleDestroy() {
    await this.client.disconnect();
  }

  // the life duration of keys, after <number> hours, redis auto-deletes the key.
  async set(key: string, value: string, ttlSeconds: number) {
    await this.client.set(key, value, { EX: ttlSeconds });
  }

  async get(key: string) {
    return await this.client.get(key);
  }
}
