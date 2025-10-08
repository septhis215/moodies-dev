import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PeopleService {
  private readonly baseUrl: string;
  private readonly token: string;
  private creditCache = new Map<string, any>();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('TMDB_BASE') ?? 'null tmdb base';
    this.token = this.configService.get<string>('TMDB_API_KEY') ?? 'null tmdb api key';
  }

  private async tmdb(endpoint: string) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await firstValueFrom(
      this.httpService.get(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
        },
      }),
    );
    return response.data;
  }

  async trending(type: string) {
    const data = await this.tmdb(`trending/person/${type}`);
    return data.results;
  }

  async getPersonDetails(id: number) {
    return await this.tmdb(
      `person/${id}?append_to_response=images,combined_credits,external_ids,movie_credits,tv_credits,tagged_images`
    );
  }

  async getMovieCredits(id: number) {
    return await this.tmdb(`person/${id}/movie_credits`);
  }

  async getTvCredits(id: number) {
    return await this.tmdb(`person/${id}/tv_credits`);
  }

  async getImages(id: number) {
    return await this.tmdb(`person/${id}/images`);
  }

  async getTaggedImages(id: number) {
    return await this.tmdb(`person/${id}/tagged_images`);
  }

  async searchPeople(query: string, page: number = 1) {
    return await this.tmdb(`search/person?query=${encodeURIComponent(query)}&page=${page}`);
  }

  async getPopular(page: number = 1) {
    return await this.tmdb(`person/popular?page=${page}`);
  }

  async getTitleCredits(mediaType: 'movie' | 'tv', id: number) {
    const endpoint = `${mediaType}/${id}/credits`;
    return await this.tmdb(endpoint);
  }

  async searchMovie(query: string, page = 1) {
    return this.tmdb(`search/movie?query=${encodeURIComponent(query)}&page=${page}`);
  }

  async searchTv(query: string, page = 1) {
    return this.tmdb(`search/tv?query=${encodeURIComponent(query)}&page=${page}`);
  }

  private async getTrendingPeople() {
    return this.tmdb(`trending/person/week`);
  }

  private isNameSimilar(a?: string, b?: string) {
    if (!a || !b) return false;
    const norm = (s: string) =>
      s.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
    const ta = norm(a);
    const tb = norm(b);
    if (ta.length === 0 || tb.length === 0) return false;
    const setA = new Set(ta);
    const intersect = tb.filter(t => setA.has(t)).length;
    const ratio = intersect / Math.max(ta.length, tb.length);
    return ratio >= 0.6;
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  async getSimilarPeople(id: number) {
    const person = await this.getPersonDetails(id);
    const credits = person.combined_credits?.cast || [];
    const nationality = this.extractNationality(person.place_of_birth);

    const genreFrequency = new Map<number, number>();
    const titleIds = new Set<number>();

    for (const c of credits) {
      (c.genre_ids || []).forEach((g: number) =>
        genreFrequency.set(g, (genreFrequency.get(g) || 0) + 1)
      );
      if (c.id) titleIds.add(c.id);
    }

    const coStars = new Map<number, number>();
    const candidateMap = new Map<number, { id: number; name?: string; source?: string }>();

    if (nationality) {
      const regionPeople = await this.searchPeopleByNationality(nationality);
      for (const p of regionPeople || []) {
        if (p.id !== id && !candidateMap.has(p.id)) {
          candidateMap.set(p.id, { id: p.id, name: p.name, source: 'regional-search' });
        }
      }
    }

    if (candidateMap.size < 25) {
      const titleArray = Array.from(titleIds);
      const titleBatchSize = 10;

      for (let i = 0; i < titleArray.length; i += titleBatchSize) {
        const batch = titleArray.slice(i, i + titleBatchSize);
        const creditPromises = batch.map(tid => {
          const mediaType = credits.find(c => c.id === tid)?.media_type === 'tv' ? 'tv' : 'movie';
          return this.getTitleCreditsCached(tid, mediaType);
        });

        const settled = await Promise.allSettled(creditPromises);
        for (const s of settled) {
          if (s.status === 'fulfilled' && s.value?.cast) {
            for (const castMember of s.value.cast) {
              if (!castMember || castMember.id === id) continue;
              coStars.set(castMember.id, (coStars.get(castMember.id) || 0) + 1);
              if (!candidateMap.has(castMember.id)) {
                candidateMap.set(castMember.id, { id: castMember.id, name: castMember.name, source: 'title-cast' });
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
          candidateMap.set(t.id, { id: t.id, name: t.name, source: 'trending' });
        }
      }
    }

    const candidateIds = Array.from(candidateMap.keys()).filter(cid => cid !== id);
    const detailsById = new Map<number, any>();
    const detailBatchSize = 15;

    for (const chunk of this.chunkArray(candidateIds.slice(0, 200), detailBatchSize)) {
      const detailsSettled = await Promise.allSettled(chunk.map(cid => this.getPersonDetails(cid)));
      for (let i = 0; i < chunk.length; i++) {
        const cid = chunk[i];
        const res = detailsSettled[i];
        if (res.status === 'fulfilled' && res.value) detailsById.set(cid, res.value);
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

      const sharedGenres = [...originalGenres].filter(g => candGenreSet.has(g)).length;
      const coStarCount = coStars.get(cid) || 0;
      const theirNationality = this.extractNationality(d.place_of_birth);
      const sameNationality = theirNationality && nationality && theirNationality === nationality;
      const pop = d.popularity || 0;

      const popBoost = Math.pow(Math.log10(pop + 1), 2.5) * 10;

      let score = 0;
      score += sameNationality ? 12 : 0;
      score += (d.known_for_department === person.known_for_department) ? 3 : 0;
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
      korea: ["korean", "south korea", "republic of korea"],
      japan: ["japan", "japanese"],
      usa: ["american", "usa", "united states"],
      china: ["chinese", "china"],
      india: ["indian", "india"],
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
    const parts = place.split(',').map(p => p.trim());
    const country = parts[parts.length - 1];
    return country || null;
  }

  private async getTitleCreditsCached(id: number, mediaType: 'movie' | 'tv' = 'movie') {
    const key = `${mediaType}_${id}`;
    if (this.creditCache.has(key)) return this.creditCache.get(key);

    const details = await this.getTitleCredits(mediaType, id).catch(() => null);
    if (details) this.creditCache.set(key, details);
    return details;
  }

  async getUpcomingProjects(id: number) {
    const movieCredits = await this.getMovieCredits(id);
    const tvCredits = await this.getTvCredits(id);

    const today = new Date().toISOString().split('T')[0];

    const upcomingMovies = (movieCredits.cast
      ?.filter(movie => !movie.release_date || movie.release_date > today)
      .sort((a, b) => {
        if (!a.release_date && !b.release_date) return 0;
        if (!a.release_date) return 1;
        if (!b.release_date) return -1;
        return new Date(a.release_date).getTime() - new Date(b.release_date).getTime();
      })
      .slice(0, 10) || [])
      .map(movie => ({ ...movie, media_type: "movie" }));

    const upcomingTV = (tvCredits.cast
      ?.filter(show => !show.first_air_date || show.first_air_date > today)
      .sort((a, b) => {
        if (!a.first_air_date && !b.first_air_date) return 0;
        if (!a.first_air_date) return 1;
        if (!b.first_air_date) return -1;
        return new Date(a.first_air_date).getTime() - new Date(b.first_air_date).getTime();
      })
      .slice(0, 10) || [])
      .map(show => ({ ...show, media_type: "tv" }));

    return {
      movies: upcomingMovies,
      tv: upcomingTV,
      total: upcomingMovies.length + upcomingTV.length
    };
  }

  // NEW: Get career timeline with proper chronological data
  // async getCareerTimeline(id: number) {
  //   const person = await this.getPersonDetails(id);
  //   const allCredits = [...(person.combined_credits?.cast || [])];

  //   // Sort credits by actual date
  //   const sortedCredits = allCredits
  //     .filter(c => c.release_date || c.first_air_date)
  //     .sort((a, b) => {
  //       const dateA = new Date(a.release_date || a.first_air_date).getTime();
  //       const dateB = new Date(b.release_date || b.first_air_date).getTime();
  //       return dateA - dateB;
  //     });

  //   if (sortedCredits.length === 0) return null;

  //   // 🧠 Find the actual debut work:
  //   // For TV shows, skip very old shows where the actor probably wasn't in the first year
  //   const firstValidWork = sortedCredits.find(credit => {
  //     const year = new Date(credit.release_date || credit.first_air_date).getFullYear();
  //     const currentYear = new Date().getFullYear();
  //     return year >= 1900 && year <= currentYear;
  //   }) || sortedCredits[0];

  //   const topRated = [...sortedCredits].sort((a, b) => b.vote_average - a.vote_average)[0];
  //   const recentWork = sortedCredits[sortedCredits.length - 1];

  //   // 🗂 Group by decade
  //   const decades = new Map<string, any[]>();
  //   sortedCredits.forEach(credit => {
  //     const year = new Date(credit.release_date || credit.first_air_date).getFullYear();
  //     const decade = Math.floor(year / 10) * 10;
  //     const key = `${decade}s`;

  //     const decadeArray = decades.get(key) ?? [];
  //     decadeArray.push(credit);
  //     decades.set(key, decadeArray);
  //   });

  //   const debutYear = new Date(firstValidWork.release_date || firstValidWork.first_air_date).getFullYear();
  //   const lastYear = new Date(recentWork.release_date || recentWork.first_air_date).getFullYear();
  //   const totalYears = Math.max(1, lastYear - debutYear + 1); // ensure at least 1 year

  //   return {
  //     debut: {
  //       title: firstValidWork.title || firstValidWork.name,
  //       year: debutYear,
  //       character: firstValidWork.character,
  //       rating: firstValidWork.vote_average
  //     },
  //     breakout: {
  //       title: topRated.title || topRated.name,
  //       year: new Date(topRated.release_date || topRated.first_air_date).getFullYear(),
  //       character: topRated.character,
  //       rating: topRated.vote_average
  //     },
  //     recent: {
  //       title: recentWork.title || recentWork.name,
  //       year: lastYear,
  //       character: recentWork.character,
  //       rating: recentWork.vote_average
  //     },
  //     decades: Array.from(decades.entries()).map(([decade, works]) => ({
  //       period: decade,
  //       count: works.length,
  //       avgRating: (works.reduce((sum, w) => sum + w.vote_average, 0) / works.length).toFixed(1),
  //       topWork: works.sort((a, b) => b.vote_average - a.vote_average)[0]
  //     })),
  //     totalYears
  //   };
  // }



  // NEW: Get collaboration network
  async getCollaborations(id: number) {
    const person = await this.getPersonDetails(id);
    const credits = person.combined_credits?.cast || [];

    const collaborators = new Map<number, { name: string; count: number; projects: string[] }>();

    for (const credit of credits.slice(0, 50)) {
      try {
        const mediaType = credit.media_type === 'tv' ? 'tv' : 'movie';
        const titleCredits = await this.getTitleCreditsCached(credit.id, mediaType);

        if (titleCredits?.cast) {
          for (const cast of titleCredits.cast.slice(0, 10)) {
            if (cast.id !== id) {
              if (!collaborators.has(cast.id)) {
                collaborators.set(cast.id, { name: cast.name, count: 0, projects: [] });
              }
              const collab = collaborators.get(cast.id);
              if (!collab) continue;
              collab.count++;
              collab.projects.push(credit.title || credit.name);
            }
          }
        }
      } catch (error) {
        continue;
      }
    }

    return Array.from(collaborators.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}