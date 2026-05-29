import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: ['warn', 'error']

    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') return;

    const models = Object.keys(this).filter(key => !key.startsWith('_') && !key.startsWith('$'));

    for (const model of models) {
      if (this[model]?.deleteMany) {
        await this[model].deleteMany({});
      }
    }
  }
}