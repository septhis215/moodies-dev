import { TOAST_DURATIONS } from "./toast-messages";
import type {
  AppToastItem,
  AppToastOptions,
  AppToastVariant,
  PromiseToastMessages,
} from "./toast-types";

const MAX_VISIBLE_TOASTS = 3;
const TOAST_DEDUPE_MS = 3000;

let sequence = 0;
let toasts: AppToastItem[] = [];
const listeners = new Set<() => void>();
const recentToastKeys = new Map<string, number>();

function now() {
  if (typeof performance !== "undefined") return performance.now();
  return Date.now();
}

function nextId() {
  sequence += 1;
  return `toast-${Date.now()}-${sequence}`;
}

function emitChange() {
  for (const listener of listeners) listener();
}

function getDedupeKey(
  variant: AppToastVariant,
  message: string,
  options?: AppToastOptions,
) {
  return options?.dedupeKey ?? options?.id ?? `${variant}:${options?.title ?? ""}:${message}`;
}

function shouldShow(
  variant: AppToastVariant,
  message: string,
  options?: AppToastOptions,
) {
  const key = getDedupeKey(variant, message, options);
  const current = Date.now();
  const lastShown = recentToastKeys.get(key) ?? 0;
  if (current - lastShown < TOAST_DEDUPE_MS) return false;
  recentToastKeys.set(key, current);
  return true;
}

function publish(
  variant: AppToastVariant,
  message: string,
  options: AppToastOptions = {},
  loading = false,
) {
  const id = options.id ?? nextId();
  const existingIndex = toasts.findIndex((toast) => toast.id === id);

  if (existingIndex === -1 && !shouldShow(variant, message, options)) {
    return id;
  }

  const item: AppToastItem = {
    id,
    message,
    variant,
    duration: options.duration ?? (loading ? null : TOAST_DURATIONS[variant]),
    title: options.title ?? null,
    posterUrl: options.posterUrl ?? null,
    imageSize: options.imageSize,
    action: options.action,
    loading,
    createdAt: now(),
  };

  if (existingIndex >= 0) {
    toasts = toasts.map((toast) => (toast.id === id ? item : toast));
  } else {
    toasts = [...toasts, item].slice(-MAX_VISIBLE_TOASTS);
  }

  emitChange();
  return id;
}

function resolveMessage<T>(
  message: string | ((value: T) => string),
  value: T,
) {
  return typeof message === "function" ? message(value) : message;
}

export const appToast = {
  success(message: string, options?: AppToastOptions) {
    return publish("success", message, options);
  },
  error(message: string, options?: AppToastOptions) {
    return publish("error", message, options);
  },
  warning(message: string, options?: AppToastOptions) {
    return publish("warning", message, options);
  },
  info(message: string, options?: AppToastOptions) {
    return publish("info", message, options);
  },
  loading(message: string, options?: AppToastOptions) {
    return publish("info", message, options, true);
  },
  dismiss(id?: string) {
    toasts = id ? toasts.filter((toast) => toast.id !== id) : [];
    emitChange();
  },
  promise<T>(
    promise: Promise<T>,
    messages: PromiseToastMessages<T>,
    options: AppToastOptions = {},
  ) {
    const id = appToast.loading(messages.loading, options);

    promise
      .then((value) => {
        appToast.success(resolveMessage(messages.success, value), {
          ...options,
          id,
        });
      })
      .catch((error: unknown) => {
        appToast.error(resolveMessage(messages.error, error), {
          ...options,
          id,
        });
      });

    return promise;
  },
};

export const appToastStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot() {
    return toasts;
  },
  getServerSnapshot() {
    return [] as AppToastItem[];
  },
};
