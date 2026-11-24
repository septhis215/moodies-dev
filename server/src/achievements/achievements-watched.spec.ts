import { ConfigService } from '@nestjs/config';
import { MediaType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AchievementCatalogService } from './achievement-catalog.service';
import { AchievementEvidenceService } from './achievement-evidence.service';
import { AchievementsService } from './achievements.service';
import { AchievementsController } from './achievements.controller';

describe('watched title membership', () => {
  function setup(enabled = true) {
    const findMany = jest.fn().mockResolvedValue([
      { tmdbId: 17, mediaType: MediaType.MOVIE },
      { tmdbId: 17, mediaType: MediaType.TV },
    ]);
    const service = new AchievementsService(
      { watchedTitle: { findMany } } as unknown as PrismaService,
      {} as AchievementCatalogService,
      {} as AchievementEvidenceService,
      new ConfigService({ ACHIEVEMENTS_ENABLED: String(enabled) }),
    );
    return { service, findMany };
  }
  it('reads only the authenticated account in one minimal query', async () => {
    const { service, findMany } = setup();
    const controller = new AchievementsController(service);
    await expect(
      controller.watchedTitles({ user: { sub: 'account-one' } }),
    ).resolves.toEqual({
      enabled: true,
      titles: [
        { tmdbId: 17, type: 'movie' },
        { tmdbId: 17, type: 'tv' },
      ],
    });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'account-one' },
      select: { tmdbId: true, mediaType: true },
    });
  });
  it('returns disabled without querying watched data', async () => {
    const { service, findMany } = setup(false);
    await expect(service.watchedTitles('account-one')).resolves.toEqual({
      enabled: false,
      titles: [],
    });
    expect(findMany).not.toHaveBeenCalled();
  });
  it('rejects a missing account before reading membership', () => {
    const { service, findMany } = setup();
    expect(() =>
      new AchievementsController(service).watchedTitles({ user: {} }),
    ).toThrow('Invalid account');
    expect(findMany).not.toHaveBeenCalled();
  });
});
