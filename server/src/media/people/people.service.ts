import { Injectable } from '@nestjs/common';
import { TMDBService } from 'src/external-apis/services/tmdb.service';
import { RedisService } from 'src/redis/redis.service';

const PEOPLE_PROFILE_TTL = 60 * 60 * 6;
const PEOPLE_SECTION_TTL = 60 * 60 * 2;
const PEOPLE_VIDEOS_TTL = 60 * 60 * 4;
const PEOPLE_MEDIA_VIDEO_TTL = 60 * 60 * 12;
const PEOPLE_REQUEST_TIMEOUT_MS = 4500;

@Injectable()
export class PeopleService {
  private creditCache = new Map<string, any>();
  private relatedVideoCache = new Map<
    string,
    { expires: number; data: any[] }
  >();

  constructor(
    private readonly tmdbService: TMDBService,
    private readonly redisService: RedisService,
  ) {}

  private tmdb(endpoint: string) {
    return this.tmdbService.request(endpoint);
  }

  private async cached<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
    shouldCache: (value: T) => boolean = () => true,
  ): Promise<T> {
    try {
      return await this.redisService.getOrSet(
        key,
        ttlSeconds,
        fetcher,
        shouldCache,
      );
    } catch {
      return fetcher();
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs = PEOPLE_REQUEST_TIMEOUT_MS,
  ): Promise<T | null> {
    let timer: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async trending(type: string) {
    const data = await this.tmdb(`trending/person/${type}`);
    return data.results;
  }

  async getPersonDetails(id: number) {
    return this.cached(
      `people:profile:${id}:v2`,
      PEOPLE_PROFILE_TTL,
      async () => {
        const details = await this.tmdb(
          `person/${id}?append_to_response=images,combined_credits,external_ids`,
        );

        return this.shapePersonDetails(details);
      },
      (details) => Boolean(details?.id),
    );
  }

  private shapePersonDetails(details: any) {
    if (details.combined_credits) {
      details.combined_credits.cast = this.removeDuplicateCredits(
        details.combined_credits.cast || [],
      )
        .sort(
          (a: any, b: any) =>
            Number(b?.popularity || 0) - Number(a?.popularity || 0),
        )
        .slice(0, 160)
        .map((credit: any) => this.shapeCredit(credit));
      details.combined_credits.crew = [];
    }

    details.images = {
      profiles: (details.images?.profiles || [])
        .slice(0, 18)
        .map((profile: any) => ({
          file_path: profile.file_path,
          aspect_ratio: profile.aspect_ratio,
          height: profile.height,
          width: profile.width,
          vote_average: profile.vote_average,
        })),
    };

    delete details.movie_credits;
    delete details.tv_credits;
    delete details.tagged_images;

    return details;
  }

  private shapeCredit(credit: any) {
    return {
      id: credit.id,
      media_type: credit.media_type,
      title: credit.title,
      name: credit.name,
      character: credit.character,
      job: credit.job,
      order: credit.order,
      episode_count: credit.episode_count,
      poster_path: credit.poster_path,
      backdrop_path: credit.backdrop_path,
      overview: credit.overview,
      release_date: credit.release_date,
      first_air_date: credit.first_air_date,
      vote_average: credit.vote_average,
      popularity: credit.popularity,
      genre_ids: credit.genre_ids || [],
    };
  }

  /**
   * Remove duplicate credits based on ID and title/name
   * Keeps the entry with more complete information
   */
  private removeDuplicateCredits(credits: any[]): any[] {
    const seen = new Map<string, any>();

    for (const credit of credits) {
      const key =
        `${credit.id}_${credit.title || credit.name || ''}`.toLowerCase();

      if (!seen.has(key)) {
        seen.set(key, credit);
      } else {
        // Keep the one with more information
        const existing = seen.get(key);
        const existingScore = this.getCreditCompletenesScore(existing);
        const currentScore = this.getCreditCompletenesScore(credit);

        if (currentScore > existingScore) {
          seen.set(key, credit);
        }
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Calculate a score for how complete a credit entry is
   */
  private getCreditCompletenesScore(credit: any): number {
    let score = 0;

    if (credit.character) score += 2;
    if (credit.poster_path) score += 1;
    if (credit.vote_average > 0) score += 1;
    if (credit.release_date || credit.first_air_date) score += 1;
    if (credit.overview) score += 1;

    return score;
  }

  async getMovieCredits(id: number) {
    return this.cached(
      `people:credits:movie:${id}:v1`,
      PEOPLE_PROFILE_TTL,
      async () => {
        const credits = await this.tmdb(`person/${id}/movie_credits`);
        return {
          ...credits,
          cast: this.removeDuplicateCredits(credits.cast || []),
          crew: this.removeDuplicateCredits(credits.crew || []),
        };
      },
      (credits) => Boolean(credits),
    );
  }

  async getTvCredits(id: number) {
    return this.cached(
      `people:credits:tv:${id}:v1`,
      PEOPLE_PROFILE_TTL,
      async () => {
        const credits = await this.tmdb(`person/${id}/tv_credits`);
        return {
          ...credits,
          cast: this.removeDuplicateCredits(credits.cast || []),
          crew: this.removeDuplicateCredits(credits.crew || []),
        };
      },
      (credits) => Boolean(credits),
    );
  }

  async getImages(id: number) {
    return this.cached(
      `people:images:${id}:v1`,
      PEOPLE_PROFILE_TTL,
      () => this.tmdb(`person/${id}/images`),
      (images) => Array.isArray(images?.profiles),
    );
  }

  async getTaggedImages(id: number) {
    return this.cached(
      `people:tagged-images:${id}:v1`,
      PEOPLE_PROFILE_TTL,
      () => this.tmdb(`person/${id}/tagged_images`),
      (images) => Array.isArray(images?.results),
    );
  }

  async searchPeople(query: string, page: number = 1) {
    return await this.tmdb(
      `search/person?query=${encodeURIComponent(query)}&page=${page}`,
    );
  }

  async getPopular(page: number = 1) {
    return await this.tmdb(`person/popular?page=${page}`);
  }

  async getTitleCredits(mediaType: 'movie' | 'tv', id: number) {
    const endpoint = `${mediaType}/${id}/credits`;
    return await this.tmdb(endpoint);
  }

  async searchMovie(query: string, page = 1) {
    return this.tmdb(
      `search/movie?query=${encodeURIComponent(query)}&page=${page}`,
    );
  }

  async searchTv(query: string, page = 1) {
    return this.tmdb(
      `search/tv?query=${encodeURIComponent(query)}&page=${page}`,
    );
  }

  private async getTrendingPeople() {
    return this.tmdb(`trending/person/week`);
  }

  private isNameSimilar(a?: string, b?: string) {
    if (!a || !b) return false;
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
    const ta = norm(a);
    const tb = norm(b);
    if (ta.length === 0 || tb.length === 0) return false;
    const setA = new Set(ta);
    const intersect = tb.filter((t) => setA.has(t)).length;
    const ratio = intersect / Math.max(ta.length, tb.length);
    return ratio >= 0.6;
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  async getSimilarPeople(id: number) {
    return this.cached(
      `people:similar:${id}:v2`,
      PEOPLE_SECTION_TTL,
      () => this.computeSimilarPeople(id),
      (people) => Array.isArray(people),
    );
  }

  private async computeSimilarPeople(id: number) {
    const person = await this.getPersonDetails(id);
    const credits = person.combined_credits?.cast || [];
    const nationality = this.extractNationality(person.place_of_birth);

    const genreFrequency = new Map<number, number>();
    const titleIds = new Set<number>();

    for (const c of credits) {
      (c.genre_ids || []).forEach((g: number) =>
        genreFrequency.set(g, (genreFrequency.get(g) || 0) + 1),
      );
      if (c.id) titleIds.add(c.id);
    }

    const coStars = new Map<number, number>();
    const candidateMap = new Map<
      number,
      { id: number; name?: string; source?: string }
    >();

    if (nationality) {
      const regionPeople = await this.searchPeopleByNationality(nationality);
      for (const p of regionPeople || []) {
        if (p.id !== id && !candidateMap.has(p.id)) {
          candidateMap.set(p.id, {
            id: p.id,
            name: p.name,
            source: 'regional-search',
          });
        }
      }
    }

    if (candidateMap.size < 25) {
      const titleArray = Array.from(titleIds);
      const titleBatchSize = 10;

      for (let i = 0; i < titleArray.length; i += titleBatchSize) {
        const batch = titleArray.slice(i, i + titleBatchSize);
        const creditPromises = batch.map((tid) => {
          const mediaType =
            credits.find((c) => c.id === tid)?.media_type === 'tv'
              ? 'tv'
              : 'movie';
          return this.getTitleCreditsCached(tid, mediaType);
        });

        const settled = await Promise.allSettled(creditPromises);
        for (const s of settled) {
          if (s.status === 'fulfilled' && s.value?.cast) {
            for (const castMember of s.value.cast) {
              if (!castMember || castMember.id === id) continue;
              coStars.set(castMember.id, (coStars.get(castMember.id) || 0) + 1);
              if (!candidateMap.has(castMember.id)) {
                candidateMap.set(castMember.id, {
                  id: castMember.id,
                  name: castMember.name,
                  source: 'title-cast',
                });
              }
            }
          }
        }
        if (candidateMap.size >= 30) break;
      }
    }

    if (candidateMap.size < 30) {
      const knownTitles = (person.known_for || [])
        .map((k: any) => k.title || k.name)
        .filter(Boolean)
        .slice(0, 3);

      for (const title of knownTitles) {
        const [mvRes, tvRes] = await Promise.allSettled([
          this.searchMovie(title),
          this.searchTv(title),
        ]);

        const results: any[] = [];
        if (mvRes.status === 'fulfilled' && mvRes.value?.results)
          results.push(...mvRes.value.results.slice(0, 2));
        if (tvRes.status === 'fulfilled' && tvRes.value?.results)
          results.push(...tvRes.value.results.slice(0, 2));

        for (const r of results) {
          const mediaType = r?.title ? 'movie' : 'tv';
          const creditsRes = await this.getTitleCreditsCached(r.id, mediaType);
          if (creditsRes?.cast) {
            for (const castMember of creditsRes.cast) {
              if (!castMember || castMember.id === id) continue;
              coStars.set(castMember.id, (coStars.get(castMember.id) || 0) + 1);
              if (!candidateMap.has(castMember.id)) {
                candidateMap.set(castMember.id, {
                  id: castMember.id,
                  name: castMember.name,
                  source: 'known-title-cast',
                });
              }
            }
          }
        }
        if (candidateMap.size >= 35) break;
      }
    }

    if (candidateMap.size < 20) {
      const trending = await this.getTrendingPeople();
      for (const t of trending.results || []) {
        if (t.id !== id && !candidateMap.has(t.id)) {
          candidateMap.set(t.id, {
            id: t.id,
            name: t.name,
            source: 'trending',
          });
        }
      }
    }

    const candidateIds = Array.from(candidateMap.keys()).filter(
      (cid) => cid !== id,
    );
    const detailsById = new Map<number, any>();
    const detailBatchSize = 15;

    for (const chunk of this.chunkArray(
      candidateIds.slice(0, 90),
      detailBatchSize,
    )) {
      const detailsSettled = await Promise.allSettled(
        chunk.map((cid) => this.getPersonDetails(cid)),
      );
      for (let i = 0; i < chunk.length; i++) {
        const cid = chunk[i];
        const res = detailsSettled[i];
        if (res.status === 'fulfilled' && res.value)
          detailsById.set(cid, res.value);
      }
    }

    const originalGenres = new Set<number>([...genreFrequency.keys()]);
    const scored: any[] = [];

    for (const [cid, meta] of candidateMap.entries()) {
      const d = detailsById.get(cid);
      if (!d || this.isNameSimilar(d.name, person.name)) continue;

      const candGenreSet = new Set<number>();
      (d.combined_credits?.cast || []).forEach((c: any) => {
        (c.genre_ids || []).forEach((g: number) => candGenreSet.add(g));
      });

      const sharedGenres = [...originalGenres].filter((g) =>
        candGenreSet.has(g),
      ).length;
      const coStarCount = coStars.get(cid) || 0;
      const theirNationality = this.extractNationality(d.place_of_birth);
      const sameNationality =
        theirNationality && nationality && theirNationality === nationality;
      const pop = d.popularity || 0;

      const popBoost = Math.pow(Math.log10(pop + 1), 2.5) * 10;

      let score = 0;
      score += sameNationality ? 12 : 0;
      score += d.known_for_department === person.known_for_department ? 3 : 0;
      score += sharedGenres * 0.5;
      score += coStarCount * 1.0;
      score += popBoost;

      if (meta.source === 'title-cast' && coStarCount < 2 && pop < 5) {
        score *= 0.6;
      }

      scored.push({ ...d, score });
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, 25);
  }

  async searchPeopleByNationality(nation: string) {
    const keywords: Record<string, string[]> = {
      korea: ['korean', 'south korea', 'republic of korea'],
      japan: ['japan', 'japanese'],
      usa: ['american', 'usa', 'united states'],
      china: ['chinese', 'china'],
      india: ['indian', 'india'],
    };

    const terms = keywords[nation.toLowerCase()] || [nation];
    const results: any[] = [];

    for (const term of terms) {
      const res = await this.searchPeople(term);
      if (res?.results) results.push(...res.results.slice(0, 10));
    }

    return results;
  }

  private extractNationality(place?: string): string | null {
    if (!place) return null;
    const parts = place.split(',').map((p) => p.trim());
    const country = parts[parts.length - 1];
    return country || null;
  }

  private async getTitleCreditsCached(
    id: number,
    mediaType: 'movie' | 'tv' = 'movie',
  ) {
    const key = `${mediaType}_${id}`;
    if (this.creditCache.has(key)) return this.creditCache.get(key);

    const details = await this.cached(
      `people:title-credits:${mediaType}:${id}:v1`,
      PEOPLE_MEDIA_VIDEO_TTL,
      () => this.getTitleCredits(mediaType, id),
      (credits) => Boolean(credits?.cast || credits?.crew),
    ).catch(() => null);
    if (details) this.creditCache.set(key, details);
    return details;
  }

  private getCreditDate(credit: any): string {
    return credit?.release_date || credit?.first_air_date || '';
  }

  private getCreditTitle(credit: any): string {
    return credit?.title || credit?.name || 'Untitled';
  }

  private getReleaseYear(credit: any): number | null {
    const date = this.getCreditDate(credit);
    return date ? new Date(date).getFullYear() : null;
  }

  private normalizeRelatedVideoType(video: any): string {
    const rawType = String(video?.type || '').trim();
    const name = String(video?.name || '').toLowerCase();

    if (rawType === 'Trailer') return 'Trailer';
    if (rawType === 'Teaser') return 'Teaser';
    if (rawType === 'Clip') return 'Clip';
    if (rawType === 'Featurette') return 'Featurette';
    if (rawType === 'Behind the Scenes') return 'Behind the Scenes';
    if (rawType === 'Interview' || name.includes('interview'))
      return 'Interview';
    if (name.includes('official preview') || name.includes('preview'))
      return 'Official Preview';
    if (
      name.includes('talk show') ||
      name.includes('variety') ||
      name.includes('appearance') ||
      name.includes('segment')
    )
      return 'Variety Appearance';
    return rawType || 'Video';
  }

  private isUsefulRelatedVideo(video: any): boolean {
    if (!video?.key || video.site !== 'YouTube') return false;

    const type = this.normalizeRelatedVideoType(video);
    return [
      'Trailer',
      'Teaser',
      'Clip',
      'Featurette',
      'Behind the Scenes',
      'Interview',
      'Official Preview',
      'Variety Appearance',
    ].includes(type);
  }

  private normalizeSearchText(value?: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private hasMeaningfulRoleReference(role?: string): boolean {
    const normalized = this.normalizeSearchText(role);
    if (!normalized || normalized.length < 3) return false;
    return ![
      'self',
      'himself',
      'herself',
      'themself',
      'guest',
      'cameo',
      'contestant',
      'participant',
    ].some((term) => normalized === term || normalized.includes(`${term} `));
  }

  private getRoleCategory(credit: any): string {
    const role = this.normalizeSearchText(
      credit?.character || credit?.job || '',
    );
    if (/(host|presenter|mc|emcee|panelist|mentor|judge)/.test(role))
      return 'host';
    if (/(main cast|regular|recurring|comedian|performer|member)/.test(role))
      return 'regular';
    if (/(guest|cameo|special appearance)/.test(role)) return 'guest';
    if (/(contestant|participant)/.test(role)) return 'participant';
    if (/(archive footage|uncredited)/.test(role)) return 'weak';
    if (/(self|himself|herself|themself)/.test(role)) return 'self';
    return role ? 'character' : 'unknown';
  }

  private isWeakCelebrityCredit(credit: any): boolean {
    return ['guest', 'participant', 'weak'].includes(
      this.getRoleCategory(credit),
    );
  }

  private isNonScriptedTvCredit(credit: any): boolean {
    if (credit?.media_type !== 'tv') return false;
    const strictGenres = new Set([10763, 10764, 10767]);
    return (credit.genre_ids || []).some((genreId: number) =>
      strictGenres.has(genreId),
    );
  }

  private isStrongNonScriptedCredit(credit: any, knownFor: boolean): boolean {
    if (!this.isNonScriptedTvCredit(credit)) return false;
    const episodeCount = Number(credit?.episode_count || 0);
    const roleCategory = this.getRoleCategory(credit);
    const order = Number.isFinite(credit?.order) ? Number(credit.order) : null;

    return (
      knownFor ||
      ['host', 'regular'].includes(roleCategory) ||
      episodeCount >= 8 ||
      (episodeCount >= 4 && order !== null && order <= 8)
    );
  }

  private isKnownForCredit(credit: any, knownForTitles: Set<string>): boolean {
    const title = this.normalizeSearchText(this.getCreditTitle(credit));
    return knownForTitles.has(title);
  }

  private getPersonReferenceScore(
    video: any,
    person: any,
    credit: any,
  ): number {
    const videoName = this.normalizeSearchText(video?.name);
    const names = [person?.name, ...(person?.also_known_as || [])]
      .map((name) => this.normalizeSearchText(name))
      .filter((name) => name.length >= 4);

    const nameHit = names.some((name) => videoName.includes(name));
    if (nameHit) return 70;

    const role = credit?.character || credit?.job || '';
    if (
      this.hasMeaningfulRoleReference(role) &&
      videoName.includes(this.normalizeSearchText(role))
    ) {
      return 45;
    }

    return 0;
  }

  private getCreditRelevanceScore(
    credit: any,
    knownForTitles: Set<string>,
  ): number {
    let score = 0;
    const mediaType = credit?.media_type === 'tv' ? 'tv' : 'movie';
    const order = Number.isFinite(credit?.order) ? Number(credit.order) : null;
    const episodeCount = Number(credit?.episode_count || 0);
    const year = this.getReleaseYear(credit);
    const knownFor = this.isKnownForCredit(credit, knownForTitles);
    const roleCategory = this.getRoleCategory(credit);

    if (knownFor) score += 45;

    if (order !== null) {
      if (order <= 3) score += 42;
      else if (order <= 8) score += 30;
      else if (order <= 15) score += 12;
      else score -= 8;
    } else if (mediaType === 'movie') {
      score += 14;
    }

    if (mediaType === 'tv') {
      if (episodeCount >= 30) score += 40;
      else if (episodeCount >= 12) score += 30;
      else if (episodeCount >= 6) score += 18;
      else if (episodeCount >= 3) score += 8;
      else if (episodeCount > 0) score -= 26;
    }

    if (this.isNonScriptedTvCredit(credit)) {
      if (this.isStrongNonScriptedCredit(credit, knownFor)) score += 34;
      else score -= 16;
    }

    if (roleCategory === 'host') score += 30;
    else if (roleCategory === 'regular') score += 24;
    else if (roleCategory === 'self' && episodeCount >= 6) score += 12;
    else if (roleCategory === 'guest' && episodeCount <= 2) score -= 24;
    else if (roleCategory === 'participant' && episodeCount <= 2) score -= 18;

    if (this.hasMeaningfulRoleReference(credit?.character || credit?.job)) {
      score += 10;
    }

    if (
      this.isWeakCelebrityCredit(credit) &&
      !knownFor &&
      !this.isStrongNonScriptedCredit(credit, knownFor)
    )
      score -= 24;

    score += Math.min(Number(credit?.vote_average || 0) * 2.5, 25);
    score += Math.min(Math.log10(Number(credit?.popularity || 0) + 1) * 10, 32);
    if (credit?.poster_path || credit?.backdrop_path) score += 5;
    if (year) score += Math.max(0, Math.min(8, year - 2016));

    return score;
  }

  private getRelevanceLabel(
    credit: any,
    directReferenceScore: number,
    baseRelevance: number,
    knownFor: boolean,
  ): string {
    if (directReferenceScore >= 70) return 'Featured Work';
    if (directReferenceScore >= 45) return 'Featured Role';
    if (knownFor) return 'Known For';

    const order = Number.isFinite(credit?.order) ? Number(credit.order) : null;
    const episodeCount = Number(credit?.episode_count || 0);
    const roleCategory = this.getRoleCategory(credit);
    if (this.isNonScriptedTvCredit(credit)) {
      if (['host', 'regular'].includes(roleCategory) || episodeCount >= 8) {
        return 'Variety Appearance';
      }
      return 'Show Appearance';
    }
    if ((order !== null && order <= 8) || episodeCount >= 12) {
      return 'Featured Work';
    }

    if (baseRelevance >= 70) return 'Featured Work';
    return 'Related Work';
  }

  private shouldIncludeRelatedVideo(
    credit: any,
    video: any,
    person: any,
    knownForTitles: Set<string>,
    baseRelevance: number,
    directReferenceScore: number,
  ): boolean {
    const mediaType = credit?.media_type === 'tv' ? 'tv' : 'movie';
    const episodeCount = Number(credit?.episode_count || 0);
    const order = Number.isFinite(credit?.order) ? Number(credit.order) : null;
    const knownFor = this.isKnownForCredit(credit, knownForTitles);
    const directlyAboutCelebrity = directReferenceScore > 0;
    const strongNonScripted = this.isStrongNonScriptedCredit(credit, knownFor);

    if (!this.isUsefulRelatedVideo(video)) return false;

    if (
      mediaType === 'tv' &&
      episodeCount > 0 &&
      episodeCount <= 2 &&
      !knownFor &&
      !directlyAboutCelebrity &&
      !strongNonScripted
    ) {
      return false;
    }

    if (
      this.isNonScriptedTvCredit(credit) &&
      !directlyAboutCelebrity &&
      !knownFor &&
      !strongNonScripted &&
      (episodeCount < 6 || (order !== null && order > 10))
    ) {
      return false;
    }

    if (
      this.isWeakCelebrityCredit(credit) &&
      !directlyAboutCelebrity &&
      !knownFor &&
      !strongNonScripted
    ) {
      return false;
    }

    return (
      baseRelevance >= 38 ||
      knownFor ||
      directlyAboutCelebrity ||
      strongNonScripted
    );
  }

  private getRelatedVideoQualityScore(video: any): number {
    const type = this.normalizeRelatedVideoType(video);
    let score = 0;

    if (video.official) score += 35;
    if (type === 'Trailer') score += 80;
    else if (type === 'Teaser') score += 70;
    else if (type === 'Clip') score += 45;
    else if (type === 'Featurette') score += 35;
    else if (type === 'Behind the Scenes') score += 30;
    else if (type === 'Interview') score += 42;
    else if (type === 'Official Preview') score += 25;
    else if (type === 'Variety Appearance') score += 38;

    if (video.size >= 1080) score += 8;
    else if (video.size >= 720) score += 5;

    return score;
  }

  private getKnownForTitles(person: any): Set<string> {
    return new Set(
      [
        ...(person.known_for || []),
        ...(person.combined_credits?.cast || [])
          .filter((credit: any) => Number(credit?.vote_average || 0) >= 7.5)
          .sort(
            (a: any, b: any) =>
              Number(b?.vote_average || 0) - Number(a?.vote_average || 0),
          )
          .slice(0, 5),
      ]
        .map((credit: any) =>
          this.normalizeSearchText(this.getCreditTitle(credit)),
        )
        .filter(Boolean),
    );
  }

  private getPrioritizedPersonCredits(
    person: any,
    limit: number,
    minRelevance = 28,
  ) {
    const knownForTitles = this.getKnownForTitles(person);

    const credits = this.removeDuplicateCredits(
      person.combined_credits?.cast || [],
    )
      .filter(
        (credit: any) =>
          credit?.id &&
          (credit.media_type === 'movie' || credit.media_type === 'tv'),
      )
      .map((credit: any) => ({
        ...credit,
        celebrity_relevance_score: this.getCreditRelevanceScore(
          credit,
          knownForTitles,
        ),
      }))
      .filter((credit: any) => credit.celebrity_relevance_score >= minRelevance)
      .sort(
        (a: any, b: any) =>
          b.celebrity_relevance_score - a.celebrity_relevance_score,
      )
      .slice(0, limit);

    return { credits, knownForTitles };
  }

  private async getMediaVideosCached(
    mediaType: 'movie' | 'tv',
    id: number,
  ): Promise<any[]> {
    const data = await this.cached(
      `people:media-videos:${mediaType}:${id}:en-US:v1`,
      PEOPLE_MEDIA_VIDEO_TTL,
      () =>
        this.withTimeout(this.tmdb(`${mediaType}/${id}/videos?language=en-US`)),
      (value) => Boolean(value),
    );

    return Array.isArray(data?.results) ? data.results : [];
  }

  async getRelatedVideos(id: number) {
    const cacheKey = `person-related-videos:${id}`;
    const cached = this.relatedVideoCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;

    const data = await this.cached(
      `people:related-videos:${id}:v3`,
      PEOPLE_VIDEOS_TTL,
      async () => {
        const person = await this.getPersonDetails(id);
        const { credits, knownForTitles } = this.getPrioritizedPersonCredits(
          person,
          10,
          32,
        );

        const settled: PromiseSettledResult<any[]>[] = [];
        for (const chunk of this.chunkArray(credits, 4)) {
          const chunkResults = await Promise.allSettled(
            chunk.map(async (credit: any) => {
              const mediaType = credit.media_type === 'tv' ? 'tv' : 'movie';
              const videos = await this.getMediaVideosCached(
                mediaType,
                credit.id,
              );

              return videos
                .filter((video: any) => {
                  const directReferenceScore = this.getPersonReferenceScore(
                    video,
                    person,
                    credit,
                  );
                  return this.shouldIncludeRelatedVideo(
                    credit,
                    video,
                    person,
                    knownForTitles,
                    credit.celebrity_relevance_score,
                    directReferenceScore,
                  );
                })
                .map((video: any) => {
                  const videoType = this.normalizeRelatedVideoType(video);
                  const directReferenceScore = this.getPersonReferenceScore(
                    video,
                    person,
                    credit,
                  );
                  const knownFor = this.isKnownForCredit(
                    credit,
                    knownForTitles,
                  );
                  const celebrityRelevanceScore =
                    credit.celebrity_relevance_score + directReferenceScore;
                  const videoQualityScore =
                    this.getRelatedVideoQualityScore(video);
                  const relevanceLabel = this.getRelevanceLabel(
                    credit,
                    directReferenceScore,
                    credit.celebrity_relevance_score,
                    knownFor,
                  );

                  return {
                    id: `${mediaType}-${credit.id}-${video.key}`,
                    media_id: credit.id,
                    media_type: mediaType,
                    media_title: this.getCreditTitle(credit),
                    media_poster_path: credit.poster_path || null,
                    media_backdrop_path: credit.backdrop_path || null,
                    media_vote_average: credit.vote_average || null,
                    release_year: this.getReleaseYear(credit),
                    role: credit.character || credit.job || null,
                    video_id: video.id || null,
                    video_key: video.key,
                    video_source: video.site || 'YouTube',
                    youtube_url: `https://www.youtube.com/watch?v=${video.key}`,
                    thumbnail_url: `https://img.youtube.com/vi/${video.key}/hqdefault.jpg`,
                    video_title: video.name || videoType,
                    video_type: videoType,
                    official: Boolean(video.official),
                    published_at: video.published_at || null,
                    celebrity_relevance_score: Math.round(
                      celebrityRelevanceScore,
                    ),
                    relevance_label: relevanceLabel,
                    relevance_reason: `${relevanceLabel} for ${this.getCreditTitle(credit)}`,
                    score: celebrityRelevanceScore * 4 + videoQualityScore,
                  };
                });
            }),
          );
          settled.push(...chunkResults);
        }

        const deduped = new Map<string, any>();
        for (const result of settled) {
          if (result.status !== 'fulfilled') continue;

          for (const video of result.value) {
            const key = [
              video.video_key,
              video.media_type,
              video.media_id,
              video.video_source,
              String(video.video_title || '')
                .toLowerCase()
                .trim(),
            ].join(':');

            const existing = deduped.get(key);
            if (!existing || video.score > existing.score)
              deduped.set(key, video);
          }
        }

        return Array.from(deduped.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, 16)
          .map(({ score, ...video }) => video);
      },
      (videos) => Array.isArray(videos),
    );

    this.relatedVideoCache.set(cacheKey, {
      expires: Date.now() + 1000 * PEOPLE_VIDEOS_TTL,
      data,
    });

    return data;
  }

  async getUpcomingProjects(id: number) {
    return this.cached(
      `people:upcoming:${id}:v1`,
      PEOPLE_SECTION_TTL,
      async () => {
        const movieCredits = await this.getMovieCredits(id);
        const tvCredits = await this.getTvCredits(id);

        const today = new Date().toISOString().split('T')[0];

        const upcomingMovies = (
          movieCredits.cast
            ?.filter(
              (movie) => !movie.release_date || movie.release_date > today,
            )
            .sort((a, b) => {
              if (!a.release_date && !b.release_date) return 0;
              if (!a.release_date) return 1;
              if (!b.release_date) return -1;
              return (
                new Date(a.release_date).getTime() -
                new Date(b.release_date).getTime()
              );
            })
            .slice(0, 10) || []
        ).map((movie) => ({ ...movie, media_type: 'movie' }));

        const upcomingTV = (
          tvCredits.cast
            ?.filter(
              (show) => !show.first_air_date || show.first_air_date > today,
            )
            .sort((a, b) => {
              if (!a.first_air_date && !b.first_air_date) return 0;
              if (!a.first_air_date) return 1;
              if (!b.first_air_date) return -1;
              return (
                new Date(a.first_air_date).getTime() -
                new Date(b.first_air_date).getTime()
              );
            })
            .slice(0, 10) || []
        ).map((show) => ({ ...show, media_type: 'tv' }));

        return {
          movies: upcomingMovies,
          tv: upcomingTV,
          total: upcomingMovies.length + upcomingTV.length,
        };
      },
      (projects) => Boolean(projects),
    );
  }

  async getCollaborations(id: number) {
    return this.cached(
      `people:collaborations:${id}:v2`,
      PEOPLE_SECTION_TTL,
      () => this.computeCollaborations(id),
      (collaborations) => Array.isArray(collaborations),
    );
  }

  private async computeCollaborations(id: number) {
    const person = await this.getPersonDetails(id);
    const { credits } = this.getPrioritizedPersonCredits(person, 18, 20);

    const collaborators = new Map<
      number,
      { name: string; count: number; projects: string[]; profile_path: string }
    >();

    for (const chunk of this.chunkArray(credits, 6)) {
      const settled = await Promise.allSettled(
        chunk.map(async (credit) => {
          const mediaType = credit.media_type === 'tv' ? 'tv' : 'movie';
          const titleCredits = await this.getTitleCreditsCached(
            credit.id,
            mediaType,
          );

          return { credit, titleCredits };
        }),
      );

      for (const result of settled) {
        if (result.status !== 'fulfilled') continue;

        const { credit, titleCredits } = result.value;

        if (titleCredits?.cast) {
          for (const cast of titleCredits.cast.slice(0, 10)) {
            if (cast.id !== id) {
              if (!collaborators.has(cast.id)) {
                collaborators.set(cast.id, {
                  name: cast.name,
                  count: 0,
                  projects: [],
                  profile_path: cast.profile_path || '',
                });
              }
              const collab = collaborators.get(cast.id);
              if (!collab) continue;
              collab.count++;
              collab.projects.push(credit.title || credit.name);
            }
          }
        }
      }
    }

    return Array.from(collaborators.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}
