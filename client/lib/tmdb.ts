export const TMDB_BASE = process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE ?? 'https://image.tmdb.org/t/p';

export function tmdbImage(path?: string | null, size = 'original') {
    if (!path) return null;
    return `${TMDB_BASE}/${size}${path}`;
}