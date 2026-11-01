export type NewsSource = "variety" | "deadline" | "thr";
export type NewsTopic = "news" | "happenings" | "projects";
export interface CelebrityArticle {
  id: string;
  title: string;
  url: string;
  source: NewsSource;
  publisher: string;
  publishedAt: string;
  topic: NewsTopic;
  imageUrl?: string | null;
}
export interface CelebrityNews {
  articles: CelebrityArticle[];
  sources: Array<{
    id: NewsSource;
    name: string;
    url: string;
    status: "ready" | "stale" | "unavailable";
    fetchedAt: string | null;
  }>;
  person: { id: number; name: string } | null;
  windowDays: number;
}
export interface HubPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
  trending_title?: string;
  known_for?: Array<{
    id: number;
    title: string;
    media_type: "movie" | "tv";
    poster_path?: string | null;
    backdrop_path?: string | null;
  }>;
}
export interface CelebrityHub {
  people: HubPerson[];
  status: "ready" | "stale" | "unavailable";
  updatedAt: string | null;
}
