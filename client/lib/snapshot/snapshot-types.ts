export type SnapshotFormat = "square";
export type SnapshotType = "content" | "review";
export type SnapshotMediaType = "MOVIE" | "TV";

export type SnapshotOptions = {
  layout: 'premiere' | 'ticket' | 'editorial' | 'cinematic';
  format: 'square' | 'portrait' | 'story' | 'landscape';
  accent: 'coral' | 'gold' | 'ivory' | 'custom';
  customAccent: string;
  tone: 'midnight' | 'paper' | 'warm';
  artwork: 'auto' | 'poster' | 'backdrop' | 'none';
  imagePosition: number;
  imageZoom: number;
  overlay: number;
  titleScale: number;
  align: 'left' | 'center';
  showDetails: boolean;
  showRating: boolean;
  showCredit: boolean;
  showQuote: boolean;
  texture: boolean;
  border: boolean;
  caption: string;
  displayTitle: string;
  fileType: 'png' | 'jpeg';
};

export const DEFAULT_SNAPSHOT_OPTIONS: SnapshotOptions = {
  layout: 'premiere', format: 'portrait', accent: 'coral', customAccent: '#ff765f',
  tone: 'midnight', artwork: 'auto', imagePosition: 50, imageZoom: 100, overlay: 60,
  titleScale: 100, align: 'left', showDetails: true, showRating: true,
  showCredit: true, showQuote: true, texture: false, border: false,
  caption: '', displayTitle: '', fileType: 'png',
};

export type SnapshotContent = {
  tmdbId: number;
  mediaType: SnapshotMediaType;
  title: string;
  releaseYear?: string | null;
  typeLabel: "Movie" | "TV Show";
  posterUrl?: string | null;
  backdropUrl?: string | null;
  genres: string[];
  directors?: string[];
  runtimeLabel?: string | null;
  ratingLabel?: string | null;
  popularity?: number | null;
};

export type SnapshotReview = {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  authorName?: string | null;
  username?: string | null;
  isPrivate: boolean;
};

export type SnapshotPayload = {
  snapshotUrl: string | null;
  snapshotType: SnapshotType;
  format: SnapshotFormat;
  width: number;
  height: number;
  content: SnapshotContent;
  review?: SnapshotReview;
};

export type SnapshotSource =
  | {
      type: "content";
      mediaType: SnapshotMediaType | "movie" | "tv" | "movies";
      tmdbId: string | number;
    }
  | {
      type: "review";
      reviewId: string;
    };
