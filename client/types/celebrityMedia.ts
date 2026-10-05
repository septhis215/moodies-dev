export type VideoCategory =
  | "trailer"
  | "clip"
  | "interview"
  | "performance"
  | "music-video"
  | "behind-scenes"
  | "appearance"
  | "event"
  | "fancam"
  | "live"
  | "other";
export type MediaSource = "tmdb" | "youtube" | "wikimedia" | "openverse";
export interface CelebrityPhoto {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  width: number;
  height: number;
  source: MediaSource;
  sourceUrl: string;
  attribution: string;
  license: string;
  licenseUrl?: string;
  relevanceScore: number;
}
export interface CelebrityVideo {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  channelId?: string;
  publishedAt: string | null;
  duration: string | null;
  category: VideoCategory;
  source: MediaSource;
  url: string;
  official: boolean;
  relevanceScore?: number;
  context?: string;
  canEmbed: boolean;
  regionRestrictions?: { allowed?: string[]; blocked?: string[] };
}
export interface CelebrityMedia {
  photos: CelebrityPhoto[];
  videos: CelebrityVideo[];
  sources: Record<MediaSource, "ready" | "stale" | "unavailable" | "disabled">;
  totalPhotos: number;
  totalVideos: number;
  updatedAt: string;
}
