import { TmdbTv } from '../types/tv.types';

export function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function getRecentDate(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
}

export function paginateItems<T>(
    items: T[],
    page: number,
    limit: number,
): { data: T[]; page: number; totalPages: number; total: number } {
    const total = items.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    return { data: items.slice(startIndex, endIndex), page, totalPages, total };
}

export function mapToTmdbTv(
    m: any,
    genreMap: Record<number, string>,
    includeRecommendations = false,
): TmdbTv {
    return {
        id: m.id,
        title: m.title ?? m.name ?? 'Untitled',
        overview: m.overview ?? '',
        poster_path: m.poster_path ?? null,
        backdrop_path: m.backdrop_path ?? null,
        release_date: m.first_air_date ?? null,
        vote_average: m.vote_average,
        vote_count: m.vote_count,
        popularity: m.popularity,
        origin_country: m.origin_country ?? [],
        genres: m.genre_ids
            ? m.genre_ids.map((id: number) => genreMap[id] || 'Unknown')
            : [],
        type: 'tv',
        recommendations: includeRecommendations ? [] : undefined,
        network: m.networks?.[0]?.name,
        created_by: m.created_by?.[0]?.name,
        genre_ids: m.genre_ids,
        number_of_episodes: m.number_of_episodes,
        number_of_seasons: m.number_of_seasons,
        first_air_date: m.first_air_date,
        last_air_date: m.last_air_date,
        status: m.status,
        runtime: m.runtime,
    };
}