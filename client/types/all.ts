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
    type: 'movie' | 'tv' | 'person';
    runtime?: number | 0; // for movie
    number_of_episodes?: number | 0; // for tv
    first_air_date?: string | null; // for tv
    name?: string | 'N/A'; // for person
    profile_path?: string | null; // for person
};