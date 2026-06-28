import {
  createAppError,
  ERROR_MESSAGES,
  isAppError,
  type AppError,
  type AppErrorDetails,
  type AppErrorType,
  type FieldErrors,
} from "./app-error";

type ErrorPayload = {
  message?: unknown;
  error?: unknown;
  code?: unknown;
  statusCode?: unknown;
  fieldErrors?: unknown;
  details?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function firstMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) return value.find((item) => typeof item === "string");
  return undefined;
}

function parseFieldErrors(value: unknown): FieldErrors | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const result: FieldErrors = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") result[key] = raw;
    if (Array.isArray(raw)) {
      const messages = raw.filter((item): item is string => typeof item === "string");
      if (messages.length) result[key] = messages;
    }
  }

  return Object.keys(result).length ? result : undefined;
}

function typeForStatus(status?: number): AppErrorType {
  if (!status) return "UNKNOWN";
  if (status === 401 || status === 498) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 422 || status === 400 || status === 409) return "VALIDATION";
  if (status === 429) return "RATE_LIMIT";
  if (status >= 500) return "SERVER";
  return "UNKNOWN";
}

function codeFor(type: AppErrorType, status?: number, payload?: ErrorPayload): string {
  if (typeof payload?.code === "string") return payload.code;
  if (status === 498) return "AUTH_SESSION_EXPIRED";
  return `HTTP_${status ?? type}`;
}

function safeUserMessage(type: AppErrorType, payload?: ErrorPayload): string {
  const message = firstMessage(payload?.message ?? payload?.error);

  if (type === "VALIDATION" && message) return message;
  if (type === "UNAUTHORIZED" && message && !/token|jwt|stack|exception/i.test(message)) {
    return message;
  }

  return ERROR_MESSAGES[type];
}

export async function normalizeResponseError(
  response: Response,
  fallbackMessage?: string,
): Promise<AppError> {
  let payload: ErrorPayload | undefined;
  let rawText = "";

  try {
    rawText = await response.text();
    payload = rawText ? (JSON.parse(rawText) as ErrorPayload) : undefined;
  } catch {
    payload = undefined;
  }

  const type = typeForStatus(response.status);
  const detailSource = asRecord(payload?.details);
  const fieldErrors =
    parseFieldErrors(payload?.fieldErrors) ??
    parseFieldErrors(detailSource.fieldErrors);
  const details: AppErrorDetails = {
    response: payload ?? rawText,
    ...(fieldErrors ? { fieldErrors } : {}),
  };

  return createAppError({
    type,
    status: response.status,
    code: codeFor(type, response.status, payload),
    message:
      firstMessage(payload?.message) ??
      firstMessage(payload?.error) ??
      `${response.status} ${response.statusText}`.trim(),
    userMessage: fallbackMessage ?? safeUserMessage(type, payload),
    details,
    isOperational: true,
  });
}

export function normalizeApiError(error: unknown, fallbackMessage?: string): AppError {
  if (isAppError(error)) {
    return fallbackMessage ? { ...error, userMessage: fallbackMessage } : error;
  }

  if (error instanceof TypeError && /fetch|network|failed/i.test(error.message)) {
    return createAppError({
      type: "NETWORK",
      message: error.message,
      userMessage: fallbackMessage ?? ERROR_MESSAGES.NETWORK,
      code: "NETWORK_ERROR",
      details: { original: error },
      isOperational: true,
    });
  }

  if (error instanceof Error && error.message === "NO_TOKEN") {
    return createAppError({
      type: "UNAUTHORIZED",
      status: 401,
      message: "Missing or expired session",
      userMessage: fallbackMessage ?? "Please log in to continue.",
      code: "AUTH_REQUIRED",
      details: { original: error },
      isOperational: true,
    });
  }

  return createAppError({
    type: "UNKNOWN",
    message: error instanceof Error ? error.message : "Unknown error",
    userMessage: fallbackMessage ?? ERROR_MESSAGES.UNKNOWN,
    details: { original: error },
    isOperational: false,
  });
}
