// strong disqualifier regex (word boundaries, allow hyphen/space variants)
export const DISQUALIFY_RE = /\b(red[-\s]?band|uncut|uncensored|nsfw|explicit|age[-\s]?restricted|18\+|adult|mature|tv[-\s]?ma|redband)\b/i;

export const CACHE_TTL = {
    BASIC_DATA: 60 * 60 * 24,      // 24 hours for trending
    RECOMMENDATIONS: 60 * 60 * 24, // 24 hours for recommendations
    TRAILERS: 60 * 60 * 24,        // 24 hours for trailers
    GENRES: 60 * 60 * 48           // 48 hours for genres
} as const;

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

export function getItemYear(item: any): number | null {
    const dateStr = item.release_date || item.first_air_date;
    if (!dateStr) return null;
    const year = parseInt(dateStr.split('-')[0]);
    return isNaN(year) ? null : year;
}

export function isRecentOrUpcoming(item: any): boolean {
    const dateStr = item.release_date || item.first_air_date;
    if (!dateStr) return false;
    const releaseDate = new Date(dateStr);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return releaseDate >= threeMonthsAgo;
}

export function seededShuffleArray(array: any[], seed: number): any[] {
    const shuffled = [...array];
    let currentIndex = shuffled.length;
    const random = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };
    while (currentIndex !== 0) {
        const randomIndex = Math.floor(random() * currentIndex);
        currentIndex -= 1;
        const temp = shuffled[currentIndex];
        shuffled[currentIndex] = shuffled[randomIndex];
        shuffled[randomIndex] = temp;
    }
    return shuffled;
}

export function getSeededRandom(seed: number, max: number): number {
    const x = Math.sin(seed) * 10000;
    return Math.floor((x - Math.floor(x)) * max);
}