import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { PeopleService } from './people.service';
import {
  affiliations,
  GROUP_ROSTERS,
  isAdultProfile,
} from './media/celebrity-affiliations';
import { normalize } from './media/celebrity-media.types';

@Injectable()
export class PeopleRecommendationsService {
  constructor(
    private readonly people: PeopleService,
    private readonly redis: RedisService,
  ) {}

  async getSimilarPeople(id: number) {
    const load = () => this.compute(id);
    try {
      return await this.redis.getOrSet(
        `people:similar:${id}:v3`,
        7200,
        load,
        (value) => Array.isArray(value),
      );
    } catch {
      return load();
    }
  }

  private async compute(id: number) {
    const person = await this.people.getPersonDetails(id);
    if (!person || isAdultProfile(person)) return [];
    const groups = affiliations(person);
    const candidates = new Map<number, number>();
    const add = (candidate: { id?: number; adult?: boolean }, shared = 0) => {
      if (
        Number.isInteger(candidate.id) &&
        candidate.id! > 0 &&
        candidate.id !== id &&
        candidate.adult !== true
      ) {
        candidates.set(
          candidate.id!,
          (candidates.get(candidate.id!) || 0) + shared,
        );
      }
    };
    const searches = [
      ...new Set(
        groups.flatMap((group) => [
          group,
          ...(GROUP_ROSTERS.find((roster) => roster.name === group)?.members ||
            []),
        ]),
      ),
    ].slice(0, 8);
    // A stage-name search only discovers IDs. The full biography must establish
    // the same group; a popular namesake is not a related performer.
    for (let i = 0; i < searches.length; i += 4) {
      const settled = await Promise.allSettled(
        searches
          .slice(i, i + 4)
          .map((query) => this.people.searchPeople(query)),
      );
      for (const result of settled) {
        if (result.status === 'fulfilled')
          for (const candidate of (result.value?.results || []).slice(0, 6))
            add(candidate);
      }
    }
    const groupCandidates = new Set(candidates.keys());
    const credits = (person.combined_credits?.cast || [])
      .filter(
        (credit: { adult?: boolean; media_type?: string }) =>
          credit.adult !== true &&
          ['movie', 'tv'].includes(credit.media_type || ''),
      )
      .slice(0, 8);
    for (let i = 0; i < credits.length; i += 4) {
      const settled = await Promise.allSettled(
        credits
          .slice(i, i + 4)
          .map((credit: { id: number; media_type: 'movie' | 'tv' }) =>
            this.people.getTitleCredits(credit.media_type, credit.id),
          ),
      );
      for (const result of settled) {
        if (result.status === 'fulfilled')
          for (const candidate of (result.value?.cast || []).slice(0, 20))
            add(candidate, 1);
      }
    }
    const ids = [...candidates.keys()]
      .sort(
        (a, b) =>
          Number(groupCandidates.has(b)) - Number(groupCandidates.has(a)) ||
          candidates.get(b)! - candidates.get(a)!,
      )
      .slice(0, 40);
    const related: Array<{
      id: number;
      name: string;
      profile_path: string | null;
      known_for_department: string;
      popularity: number;
      relationship: string;
      score: number;
    }> = [];
    for (let i = 0; i < ids.length; i += 4) {
      const settled = await Promise.allSettled(
        ids
          .slice(i, i + 4)
          .map((candidateId) => this.people.getPersonDetails(candidateId)),
      );
      for (const result of settled) {
        if (result.status !== 'fulfilled') continue;
        const candidate = result.value;
        if (!candidate || candidate.id === id || isAdultProfile(candidate))
          continue;
        const sharedGroup = affiliations(candidate).find((group) =>
          groups.some((original) => normalize(original) === normalize(group)),
        );
        const sharedCredits = candidates.get(candidate.id) || 0;
        if (!sharedGroup && !sharedCredits) continue;
        // Popularity only breaks ties between equally connected people.
        const popularity = Math.max(0, Number(candidate.popularity) || 0);
        related.push({
          id: candidate.id,
          name: candidate.name,
          profile_path: candidate.profile_path || null,
          known_for_department:
            candidate.known_for_department || 'Entertainment',
          popularity,
          relationship: sharedGroup
            ? `${sharedGroup} member`
            : `Shared ${sharedCredits === 1 ? 'a project' : 'projects'}`,
          score:
            (sharedGroup ? 1000 : 0) +
            Math.min(sharedCredits, 8) * 20 +
            Math.min(Math.log1p(popularity), 10),
        });
      }
    }
    return related
      .sort((a, b) => b.score - a.score)
      .slice(0, 18)
      .map(({ score: _score, ...candidate }) => candidate);
  }
}
