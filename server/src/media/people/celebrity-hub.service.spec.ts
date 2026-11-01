import { CelebrityHubService } from './celebrity-hub.service';
import { PeopleService } from './people.service';
import { MediaCacheService } from './media/media-cache.service';
import { RedisService } from 'src/redis/redis.service';
import { TMDBService } from 'src/external-apis/services/tmdb.service';

describe('CelebrityHubService', () => {
  it('features only credited people from safe trending titles, with a bounded number of upstream calls', async () => {
    const actor = {
      id: 31,
      name: 'Tom Hanks',
      profile_path: '/tom.jpg',
      popularity: 50,
      known_for_department: 'Acting',
    };
    const tmdb = {
      request: jest.fn().mockImplementation((path: string) =>
        Promise.resolve(
          path === 'trending/all/week'
            ? {
                results: [
                  {
                    id: 1,
                    title: 'A trending film',
                    media_type: 'movie',
                    adult: false,
                  },
                  {
                    id: 2,
                    name: 'An adult film',
                    media_type: 'movie',
                    adult: true,
                  },
                ],
              }
            : { cast: [actor, actor, { ...actor, id: 9, adult: true }] },
        ),
      ),
    };
    const redis = {
      getOrSet: jest
        .fn()
        .mockImplementation((_key, _ttl, load: () => Promise<unknown>) =>
          load(),
        ),
    };
    const service = new PeopleService(
      tmdb as unknown as TMDBService,
      redis as unknown as RedisService,
    );
    expect(await service.getHubPeople()).toMatchObject([
      { id: 31, name: 'Tom Hanks', trending_title: 'A trending film' },
    ]);
    expect(tmdb.request).toHaveBeenCalledTimes(2);
    expect(tmdb.request).not.toHaveBeenCalledWith('person/31');
  });
  it('bounds and validates the TMDB list and shares concurrent loads', async () => {
    const people = {
      getHubPeople: jest
        .fn()
        .mockResolvedValue([
          {
            id: 1,
            name: 'Actor',
            profile_path: '/portrait.jpg',
            known_for_department: 'Acting',
          },
          { id: 2, name: 'Adult', adult: true },
          { id: '3', name: 'Invalid' },
          null,
          ...Array.from({ length: 30 }, (_, i) => ({
            id: i + 4,
            name: `Person ${i}`,
            profile_path: 'https://evil.test/a.png',
          })),
        ]),
    };
    const cache = new MediaCacheService({
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
    } as unknown as RedisService);
    const service = new CelebrityHubService(
      people as unknown as PeopleService,
      cache,
    );
    const [result] = await Promise.all([service.getHub(), service.getHub()]);
    expect(people.getHubPeople).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ready');
    expect(result.people).toHaveLength(12);
    expect(result.people[0].name).toBe('Actor');
    expect(result.people[1].profile_path).toBeNull();
  });
  it('reports TMDB failure without blocking other hub content', async () => {
    const people = {
      getHubPeople: jest.fn().mockRejectedValue(new Error('offline')),
    };
    const cache = new MediaCacheService({
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
    } as unknown as RedisService);
    const result = await new CelebrityHubService(
      people as unknown as PeopleService,
      cache,
    ).getHub();
    expect(result).toEqual({
      people: [],
      status: 'unavailable',
      updatedAt: null,
    });
  });
});
