import { normalizeApiError } from "./normalize-api-error";
import type { AppError } from "./app-error";
import { appToast, TOAST_IDS } from "@/lib/toast";

type UnauthorizedHandler = (error: AppError) => void;

export type HandleErrorOptions = {
  fallbackMessage?: string;
  showToast?: boolean;
  silent?: boolean;
  log?: boolean;
  toastTitle?: string | null;
  toastKey?: string;
};

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function registerUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export function handleAppError(error: unknown, options: HandleErrorOptions = {}): AppError {
  const appError = normalizeApiError(error, options.fallbackMessage);

  if (appError.type === "UNAUTHORIZED") {
    unauthorizedHandler?.(appError);
  }

  if (!options.silent && options.showToast !== false) {
    const key =
      options.toastKey ??
      (appError.type === "UNAUTHORIZED"
        ? TOAST_IDS.authSessionExpired
        : appError.type === "NETWORK"
          ? TOAST_IDS.networkError
          : appError.code ?? appError.type);

    appToast.error(appError.userMessage, {
      id: key,
      title: options.toastTitle ?? null,
      duration: appError.type === "UNAUTHORIZED" ? 6000 : 5000,
      dedupeKey: key,
    });
  }

  if (options.log !== false && process.env.NODE_ENV !== "production") {
    console.error("[AppError]", appError);
  }

  return appError;
}
