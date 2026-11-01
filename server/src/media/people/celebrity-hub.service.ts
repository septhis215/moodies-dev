import { Injectable } from '@nestjs/common';
import { PeopleService } from './people.service';
import { MediaCacheService } from './media/media-cache.service';

export interface HubPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
  trending_title?: string;
}
@Injectable()
export class CelebrityHubService {
  constructor(
    private readonly people: PeopleService,
    private readonly cache: MediaCacheService,
  ) {}

  async getHub(): Promise<{
    people: HubPerson[];
    status: 'ready' | 'stale' | 'unavailable';
    updatedAt: string | null;
  }> {
    try {
      const result = await this.cache.get(
        'celebrity:hub:trending:v3',
        900,
        async () => {
          const trending: unknown = await this.people.getHubPeople();
          if (!Array.isArray(trending))
            throw new Error('Invalid TMDB response');
          const people: HubPerson[] = trending
            .filter(
              (person: Record<string, unknown>) =>
                person &&
                Number.isSafeInteger(person.id) &&
                Number(person.id) > 0 &&
                typeof person.name === 'string' &&
                person.name.trim() &&
                person.adult !== true,
            )
            .slice(0, 12)
            .map((person: Record<string, unknown>) => ({
              id: Number(person.id),
              name: String(person.name),
              profile_path:
                typeof person.profile_path === 'string' &&
                /^\/[\w.-]+$/.test(person.profile_path)
                  ? person.profile_path
                  : null,
              known_for_department:
                typeof person.known_for_department === 'string'
                  ? person.known_for_department
                  : 'Entertainment',
              trending_title:
                typeof person.trending_title === 'string'
                  ? person.trending_title
                  : undefined,
            }));
          return { people, updatedAt: new Date().toISOString() };
        },
        6 * 3600,
      );
      return { ...result.value, status: result.stale ? 'stale' : 'ready' };
    } catch {
      return { people: [], status: 'unavailable', updatedAt: null };
    }
  }
}
