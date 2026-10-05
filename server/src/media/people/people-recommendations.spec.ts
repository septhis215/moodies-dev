import { PeopleRecommendationsService } from './people-recommendations.service';
import { PeopleService } from './people.service';
import { RedisService } from 'src/redis/redis.service';
import { isAdultProfile } from './media/celebrity-affiliations';

const member = (id: number, name: string) => ({
  id,
  name,
  adult: false,
  biography: `${name} is a singer and a member of the girl group RESCENE.`,
  popularity: 0.2,
  profile_path: '/profile.jpg',
  combined_credits: { cast: [] },
});
function harness(overrides = {}) {
  const profiles = [
    member(1, 'Woni'),
    member(2, 'Minami'),
    member(3, 'Liv'),
    member(4, 'May'),
    member(5, 'Zena'),
    {
      ...member(6, 'Minami'),
      biography: 'A Japanese adult video actress.',
      adult: false,
      popularity: 9999,
    },
    {
      ...member(7, 'Popular stranger'),
      biography: 'A popular performer.',
      popularity: 9999,
    },
    { ...member(8, 'Unsafe'), adult: true },
  ];
  const people = {
    getPersonDetails: jest.fn(async (id: number) =>
      profiles.find((person) => person.id === id),
    ),
    searchPeople: jest.fn().mockResolvedValue({ results: profiles }),
    getTitleCredits: jest.fn().mockResolvedValue({ cast: [] }),
    ...overrides,
  };
  const redis = { getOrSet: jest.fn(async (_key, _ttl, load) => load()) };
  return {
    service: new PeopleRecommendationsService(
      people as unknown as PeopleService,
      redis as unknown as RedisService,
    ),
    people,
    redis,
  };
}
describe('related celebrity recommendations', () => {
  it('prioritises every verified RESCENE bandmate and rejects adult namesakes and unrelated popular people', async () => {
    const { service, redis } = harness();
    const result = await service.getSimilarPeople(1);
    expect(result.map((person) => person.id).sort()).toEqual([2, 3, 4, 5]);
    expect(
      result.every((person) => person.relationship === 'RESCENE member'),
    ).toBe(true);
    expect(redis.getOrSet.mock.calls[0][0]).toBe('people:similar:1:v3');
  });
  it('does not invent similar profiles when no genuine connections exist', async () => {
    const { service, people } = harness({
      getPersonDetails: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Independent performer',
        biography: '',
        combined_credits: { cast: [] },
      }),
    });
    expect(await service.getSimilarPeople(1)).toEqual([]);
    expect(people.searchPeople).not.toHaveBeenCalled();
  });
  it('keeps safe collaborators, including similarly named people, even when a group search fails', async () => {
    const { service } = harness({
      searchPeople: jest.fn().mockRejectedValue(new Error('Search outage')),
      getPersonDetails: jest.fn(async (id) =>
        id === 1
          ? {
              ...member(1, 'Woni'),
              combined_credits: {
                cast: [{ id: 20, media_type: 'tv', adult: false }],
              },
            }
          : {
              id,
              name: 'Woni Kim',
              adult: false,
              biography: 'An actor.',
              popularity: 0.1,
            },
      ),
      getTitleCredits: jest.fn().mockResolvedValue({
        cast: [
          { id: 9, adult: false },
          { id: 10, adult: true },
        ],
      }),
    });
    expect(
      (await service.getSimilarPeople(1)).map((person) => person.id),
    ).toEqual([9]);
  });
  it('fails closed for adult source profiles and adult credits without flagging normal films about sex', async () => {
    expect(isAdultProfile({ biography: 'A pornographic film actress.' })).toBe(
      true,
    );
    expect(
      isAdultProfile({ combined_credits: { cast: [{ adult: true }] } }),
    ).toBe(true);
    expect(isAdultProfile({ biography: 'An actor in Sex Education.' })).toBe(
      false,
    );
    expect(
      await harness({
        getPersonDetails: jest.fn().mockResolvedValue({ id: 1, adult: true }),
      }).service.getSimilarPeople(1),
    ).toEqual([]);
  });
  it('keeps bandmates in the candidate budget when large casts contain many collaborators', async () => {
    const bandmates = [
      member(2, 'Minami'),
      member(3, 'Liv'),
      member(4, 'May'),
      member(5, 'Zena'),
    ];
    const source = {
      ...member(1, 'Woni'),
      combined_credits: {
        cast: Array.from({ length: 8 }, (_, id) => ({
          id,
          media_type: 'tv',
          adult: false,
        })),
      },
    };
    const { service } = harness({
      searchPeople: jest.fn().mockResolvedValue({ results: bandmates }),
      getTitleCredits: jest.fn(async (_type, id) => ({
        cast: Array.from({ length: 20 }, (_, offset) => ({
          id: 100 + id * 20 + offset,
        })),
      })),
      getPersonDetails: jest.fn(async (id) =>
        id === 1
          ? source
          : bandmates.find((member) => member.id === id) || {
              id,
              name: 'Collaborator',
              biography: 'An actor.',
              adult: false,
            },
      ),
    });
    expect(
      (await service.getSimilarPeople(1))
        .slice(0, 4)
        .map((person) => person.id),
    ).toEqual([2, 3, 4, 5]);
  });
  it('continues without Redis', async () => {
    const { service, redis } = harness();
    redis.getOrSet.mockRejectedValue(new Error('Redis offline'));
    expect(await service.getSimilarPeople(1)).toHaveLength(4);
  });
});
