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
}
export interface CelebrityHub {
  people: HubPerson[];
  status: "ready" | "stale" | "unavailable";
  updatedAt: string | null;
}
