export type General = {
    id: number;
    title: string;
    overview: string;
    genres: string[];
    poster_path?: string | null;
    backdrop_path?: string | null;
    release_date?: string;
    vote_average?: number;
    trailer_key?: string | null;
};