export type TmdbAll = {
    id: number;
    title: string;
    overview: string;
    genres?: string[];
    poster_path: string | null;
    backdrop_path: string | null;
    release_date?: string | null;
    vote_average?: number;
    vote_count?: number;
    popularity?: number;
    origin_country?: string[];
    original_language?: string;
    recommendations?: TmdbAll[];
    type?: 'movie' | 'tv';
    trailer_key?: string | null;
    network?: string; // for tv
    created_by?: string; // for tv
    genre_ids?: number[]; // for internal use
    runtime?: number; // for movie
};

export type TmdbPerson = {
    id: number;
    name: string;
    known_for_department?: string;
    profile_path: string | null;
    popularity: number;
    known_for?: {
        id: number;
        title?: string;
        name?: string;
        media_type: 'movie' | 'tv';
        poster_path: string | null;
        overview?: string;
    }[];
};

export type TrendingTerm = {
    id: number;
    title: string;
    media_type: string; // "movie" | "tv" | "person" | etc.
};

export interface Candidate {
    id: number;
    title?: string;
    name?: string;
    overview?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    release_date?: string | null;
    first_air_date?: string | null;
    vote_average?: number;
    vote_count?: number;
    popularity?: number;
    origin_country?: string[];
    production_countries?: Array<{ iso_3166_1: string }>;
    genre_ids?: number[];
    original_language?: string;
    source: string;
    priority: number;
}

export interface ScoredCandidate extends Candidate {
    score: number;
}

export interface TrailerCandidate extends ScoredCandidate {
    trailer_key: string | null;
    hasTrailer: boolean;
}