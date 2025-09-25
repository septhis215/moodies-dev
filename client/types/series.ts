export type Series = {
    id: number;
    title: string;
    overview: string;
    genres?: string[];
    poster_path?: string | null;
    backdrop_path?: string | null;
    release_date?: string | null;
    vote_average?: number;
    trailer_key?: string | null;
    recommendations: Series[];
    type: 'movie' | 'tv' | 'person';
    number_of_episodes?: number | 0; // for tv
    first_air_date?: string | null; // for tv
};