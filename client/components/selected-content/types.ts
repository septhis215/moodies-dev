export type TrailerData = {
  iso_639_1?: string;
  iso_3166_1?: string;
  name?: string;
  key?: string;
  site?: string;
  size?: number;
  type?: string;
  official?: boolean;
  published_at?: string;
  id?: string;
};

export type ProviderListing = {
  provider_name: string;
  logo_path?: string;
};

export type ProviderCountry = {
  flatrate?: ProviderListing[];
  rent?: ProviderListing[];
  buy?: ProviderListing[];
};

export type ProviderData = {
  results?: Record<string, ProviderCountry>;
};

export type SeasonData = Record<string, unknown>;

export type MovieDetailsData = {
  info: {
    id: number;
    title: string;
    overview: string;
    release_date: string;
    runtime: number;
    budget: number;
    revenue: number;
    vote_average: number;
    vote_count: number;
    genres: Array<{ id: number; name: string }>;
    production_companies: Array<{
      id: number;
      name: string;
      logo_path?: string;
    }>;
    production_countries: Array<{ iso_3166_1: string; name?: string }>;
    spoken_languages: Array<{ iso_639_1: string; name: string }>;
    status: string;
    tagline?: string;
    homepage?: string;
    poster_path?: string;
    backdrop_path?: string;
    content_type: "movie";
    director?: string;
    content_rating?: string;
  };
  credits: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path?: string;
      order: number;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path?: string;
    }>;
  };
  trailer?: TrailerData;
  providers?: ProviderData;
  reviews?: unknown[];
  similar?: unknown[];
  raw?: unknown;
};

export type TvDetailsData = {
  info: {
    id: number;
    title: string;
    original_title?: string;
    overview: string;
    release_date: string;
    runtime: number;
    budget: number;
    revenue: number;
    vote_average: number;
    vote_count: number;
    genres: Array<{ id: number; name: string }>;
    production_companies: Array<{
      id: number;
      name: string;
      logo_path?: string;
    }>;
    production_countries: Array<{ iso_3166_1: string; name?: string }>;
    spoken_languages: Array<{ iso_639_1: string; name: string }>;
    status: string;
    tagline?: string;
    homepage?: string;
    poster_path?: string;
    backdrop_path?: string;
    adult: boolean;
    created_by?: Array<{ id: number; name: string }>;
    content_type: "tv";
    director?: string;
    content_rating?: string;
    number_of_seasons?: number;
    number_of_episodes?: number;
    episode_run_time?: number[];
    first_air_date?: string;
    last_air_date?: string;
    networks?: Array<{ id: number; name: string; logo_path?: string }>;
    seasons?: SeasonData[];
    next_episode_to_air?: {
      episode_number: number;
      season_number: number;
      name: string;
      overview?: string;
      air_date: string;
      runtime?: number;
      still_path?: string;
    } | null;
    last_episode_to_air?: {
      episode_number: number;
      season_number: number;
      name: string;
      air_date: string;
      runtime?: number;
    } | null;
  };
  credits: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      profile_path?: string;
      order: number;
    }>;
    crew: Array<{
      id: number;
      name: string;
      job?: string;
      jobs?: Array<{ job: string }>;
      department: string;
      profile_path?: string;
    }>;
  };
  trailer?: TrailerData;
  providers?: ProviderData;
  reviews?: unknown[];
  similar?: unknown[];
  raw?: unknown;
};
