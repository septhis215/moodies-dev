export type SnapshotFormat = "square";
export type SnapshotType = "content" | "review";
export type SnapshotMediaType = "MOVIE" | "TV";

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
