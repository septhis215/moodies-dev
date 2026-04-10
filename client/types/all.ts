export type All = {
    id: number;
    title: string;
    overview: string;
    genres?: string[];
    poster_path?: string | null;
    backdrop_path?: string | null;
    release_date?: string | null;
    vote_average?: number;
    trailer_key?: string | null;
    recommendations: All[];
    popularity?: number | null;
    type: 'movie' | 'tv' | 'person';
    runtime?: number | 0; // for movie
    number_of_episodes?: number | 0; // for tv
    number_of_seasons?: number | 0;
    origin_country?: string[];
    first_air_date?: string | null; // for tv
    year?: string | null;
    name?: string | 'N/A'; // for person
    profile_path?: string | null; // for person
};