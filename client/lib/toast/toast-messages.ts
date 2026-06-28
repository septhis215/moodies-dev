import type { AppToastVariant } from "./toast-types";

export const TOAST_DURATIONS: Record<AppToastVariant, number> = {
  success: 3500,
  info: 4000,
  warning: 5000,
  error: 6000,
};

export const TOAST_IDS = {
  authSessionExpired: "auth-session-expired",
  networkError: "network-error",
  watchlistUpdateError: "watchlist-update-error",
  favoriteUpdateError: "favorite-update-error",
  reviewSubmitError: "review-submit-error",
  passwordResetError: "password-reset-error",
} as const;
