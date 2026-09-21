import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    const originalCommit = process.env.GIT_COMMIT_SHA;
    const originalLegacyCommit = process.env.COMMIT_SHA;

    afterEach(() => {
      if (originalCommit === undefined) delete process.env.GIT_COMMIT_SHA;
      else process.env.GIT_COMMIT_SHA = originalCommit;
      if (originalLegacyCommit === undefined) delete process.env.COMMIT_SHA;
      else process.env.COMMIT_SHA = originalLegacyCommit;
    });

    it('returns a provider-neutral commit identifier when configured', () => {
      process.env.GIT_COMMIT_SHA = 'abc123';
      delete process.env.COMMIT_SHA;

      expect(appController.health()).toEqual({ status: 'ok', commit: 'abc123' });
    });

    it('falls back to local when no commit identifier is configured', () => {
      delete process.env.GIT_COMMIT_SHA;
      delete process.env.COMMIT_SHA;

      expect(appController.health()).toEqual({ status: 'ok', commit: 'local' });
    });
  });
});
