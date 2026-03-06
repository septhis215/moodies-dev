export type ContentType = 'tv';

export type TmdbTv = {
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
    recommendations?: TmdbTv[];
    type: ContentType;
    trailer_key?: string | null;
    network?: string;
    created_by?: string;
    genre_ids?: number[];
    number_of_episodes?: number;
    number_of_seasons?: number;
    first_air_date?: string | null;
    last_air_date?: string | null;
    status?: string;
    runtime?: number;
};

export type PaginatedTv = {
    data: TmdbTv[];
    page: number;
    totalPages: number;
    total: number;
};

export type TvListResult = TmdbTv[] | PaginatedTv;