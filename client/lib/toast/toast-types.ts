export type AppToastVariant = "info" | "success" | "warning" | "error";

export type AppToastAction = {
  label: string;
  onClick: () => void;
};

export type AppToastOptions = {
  id?: string;
  title?: string | null;
  duration?: number | null;
  posterUrl?: string | null;
  imageSize?: { width: number; height: number };
  dedupeKey?: string;
  action?: AppToastAction;
};

export type AppToastItem = {
  id: string;
  message: string;
  variant: AppToastVariant;
  duration: number | null;
  title: string | null;
  posterUrl: string | null;
  imageSize?: { width: number; height: number };
  action?: AppToastAction;
  loading?: boolean;
  createdAt: number;
};

export type PromiseToastMessages<T> = {
  loading: string;
  success: string | ((value: T) => string);
  error: string | ((error: unknown) => string);
};
