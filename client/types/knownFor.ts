export interface KnownFor {
  adult: boolean;
  backdrop_path: string | null;
  genre_ids: number[];
  id: number;
  media_type: "movie" | "tv"; // or string if unsure
  original_language: string;
  original_title?: string; // only for movies
  overview: string;
  poster_path: string | null;
  release_date?: string; // movie only
  title?: string; // movie only
  name?: string; // tv only
  first_air_date?: string; // tv only
  video?: boolean;
  vote_average: number;
  vote_count: number;
}
