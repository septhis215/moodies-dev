import type { AppToastVariant } from "./toast-types";

export const TOAST_DURATIONS: Record<AppToastVariant, number> = {
  success: 4500,
  info: 5000,
  warning: 6000,
  error: 8000,
};

export const TOAST_IDS = {
  authSessionExpired: "auth-session-expired",
  networkError: "network-error",
  watchlistUpdateError: "watchlist-update-error",
  favoriteUpdateError: "favorite-update-error",
  reviewSubmitError: "review-submit-error",
  passwordResetError: "password-reset-error",
} as const;
