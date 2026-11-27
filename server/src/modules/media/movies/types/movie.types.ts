export type ContentType = 'movie';

export type TmdbMovie = {
    id: number;
    title: string;
    overview: string;
    genres?: string[];
    poster_path: string | null;
    backdrop_path: string | null;
    release_date: string;
    vote_average?: number;
    vote_count?: number;
    popularity?: number;
    origin_country?: string[];
    recommendations?: TmdbMovie[];
    type?: ContentType;
    trailer_key?: string | null;
    runtime?: number;
    genre_ids?: number[]; // for internal use
};

export type PaginatedMovies = {
    data: TmdbMovie[];
    page: number;
    totalPages: number;
    total: number;
};

export type MovieListResult = TmdbMovie[] | PaginatedMovies;