import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PeopleService } from '../people.service';
import { MediaCacheService } from './media-cache.service';
import { MediaHttpService } from './media-http.service';
import { normalize, type CelebrityIdentity } from './celebrity-media.types';
import { affiliations } from './celebrity-affiliations';

type Hints = {
  aliases?: string[];
  contexts?: string[];
  officialChannelIds?: string[];
};
type Binding = Record<string, { value: string }>;
@Injectable()
export class CelebrityIdentityService {
  constructor(
    private readonly people: PeopleService,
    private readonly cache: MediaCacheService,
    private readonly http: MediaHttpService,
    private readonly config: ConfigService,
  ) {}

  async resolve(id: number): Promise<CelebrityIdentity> {
    const person = await this.people.getPersonDetails(id);
    let hints: Hints = {};
    try {
      const all = JSON.parse(
        this.config.get<string>('CELEBRITY_MEDIA_IDENTITIES') || '{}',
      ) as Record<string, Hints>;
      hints = all[String(id)] || {};
    } catch {
      /* Invalid optional metadata never breaks a profile. */
    }
    const strings = (values: unknown) =>
      Array.isArray(values)
        ? values
            .filter(
              (value): value is string =>
                typeof value === 'string' && value.trim().length > 1,
            )
            .slice(0, 20)
        : [];
    const group = String(person.biography || '').match(
      /(?:member|leader|vocalist|rapper|dancer)\s+(?:of|in)\s+(?:the\s+)?(?:(?:South Korean|Korean|Japanese|American)\s+)?(?:(?:girl|boy|pop|K-pop|musical|music)\s+)?(?:group|band)\s+([\p{L}\p{N}&-]+(?:\s+[\p{L}\p{N}&-]+){0,2})(?=[.,;\n]|$)/iu,
    )?.[1];
    const identity: CelebrityIdentity = {
      id,
      name: String(person.name),
      aliases: [
        ...new Set([
          String(person.name),
          ...strings(person.also_known_as),
          ...strings(hints.aliases),
        ]),
      ],
      contexts: [
        ...new Set([
          ...strings(hints.contexts),
          ...affiliations(person),
          ...(group ? [group] : []),
          ...(person.combined_credits?.cast || [])
            .slice(0, 5)
            .map(
              (credit: { title?: string; name?: string }) =>
                credit.title || credit.name || '',
            )
            .filter((name: string) => name.length >= 4),
        ]),
      ],
      department: String(person.known_for_department || ''),
      officialChannelIds: strings(hints.officialChannelIds).filter((value) =>
        /^UC[\w-]{22}$/.test(value),
      ),
    };
    try {
      const result = await this.cache.get(
        `celebrity:${id}:identity:v1`,
        86400,
        async () => {
          const imdb = /^nm\d+$/.test(person.external_ids?.imdb_id || '')
            ? String(person.external_ids.imdb_id)
            : null;
          const query = `SELECT DISTINCT ?person ?groupLabel ?channel ?category WHERE {
          { ?person wdt:P4985 "${id}". } ${imdb ? `UNION { ?person wdt:P345 "${imdb}". }` : ''}
          ?person wdt:P31 wd:Q5.
          OPTIONAL { ?person wdt:P373 ?category. }
          OPTIONAL { ?person wdt:P463 ?group. ?group rdfs:label ?groupLabel. FILTER(LANG(?groupLabel) = "en") }
          OPTIONAL { { ?person wdt:P2397 ?channel. } UNION { ?person wdt:P463/wdt:P2397 ?channel. } }
        } LIMIT 30`;
          const url = new URL('https://query.wikidata.org/sparql');
          url.search = new URLSearchParams({
            query,
            format: 'json',
          }).toString();
          const data = await this.http.json<{
            results?: { bindings?: Binding[] };
          }>(url);
          if (!Array.isArray(data.results?.bindings))
            throw new Error('Invalid Wikidata identity response');
          return data.results.bindings;
        },
      );
      const ids = new Set(
        result.value
          .map((row) => row.person?.value.split('/').pop())
          .filter(Boolean),
      );
      // Conflicting identifiers are ambiguous; never choose the first candidate.
      if (ids.size === 1) {
        const qid = [...ids][0];
        if (qid && /^Q\d+$/.test(qid)) {
          identity.wikidataId = qid;
          identity.commonsCategory = result.value.find(
            (row) => row.category,
          )?.category.value;
          identity.contexts = [
            ...new Set([
              ...strings(hints.contexts),
              ...result.value
                .map((row) => row.groupLabel?.value)
                .filter(Boolean),
              ...identity.contexts,
            ]),
          ];
          identity.officialChannelIds = [
            ...new Set([
              ...identity.officialChannelIds,
              ...result.value
                .map((row) => row.channel?.value)
                .filter((value) => value && /^UC[\w-]{22}$/.test(value)),
            ]),
          ];
        }
      }
    } catch {
      /* TMDB and explicit identity hints remain usable. */
    }
    identity.aliases = identity.aliases.filter((alias) =>
      !identity.contexts.some((context) => normalize(context) === normalize(alias)));
    return identity;
  }
}
