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
    return {
        data: items.slice(startIndex, endIndex),
        page,
        totalPages,
        total,
    };
}

export function mapToTmdbMovie(m: any, genreMap: Record<number, string>): import('../types/movie.types').TmdbMovie {
    return {
        id: m.id,
        title: m.title ?? m.name ?? 'Untitled',
        overview: m.overview ?? '',
        poster_path: m.poster_path ?? null,
        backdrop_path: m.backdrop_path ?? null,
        release_date: m.release_date ?? m.first_air_date ?? null,
        vote_average: m.vote_average,
        vote_count: m.vote_count,
        popularity: m.popularity,
        origin_country: m.origin_country ?? m.production_countries?.map((c: any) => c.iso_3166_1) ?? [],
        genres: m.genre_ids
            ? m.genre_ids.map((id: number) => genreMap[id] || 'Unknown')
            : [],
        type: 'movie',
        recommendations: [],
    };
}