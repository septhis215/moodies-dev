export type AppErrorType =
  | "NETWORK"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "RATE_LIMIT"
  | "SERVER"
  | "UNKNOWN";

export type FieldErrors = Record<string, string | string[]>;

export type AppErrorDetails = {
  fieldErrors?: FieldErrors;
  original?: unknown;
  response?: unknown;
};

export type AppError = {
  type: AppErrorType;
  status?: number;
  message: string;
  userMessage: string;
  code?: string;
  details?: AppErrorDetails;
  isOperational: boolean;
};

export const ERROR_MESSAGES: Record<AppErrorType, string> = {
  NETWORK: "Network error. Please check your connection and try again.",
  UNAUTHORIZED: "Please log in again to continue.",
  FORBIDDEN: "You do not have permission to do this.",
  NOT_FOUND: "We could not find what you were looking for.",
  VALIDATION: "Please check the highlighted fields and try again.",
  RATE_LIMIT: "Too many requests. Please wait a moment and try again.",
  SERVER: "Something went wrong on our side. Please try again later.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export function isAppError(error: unknown): error is AppError {
  return (
    !!error &&
    typeof error === "object" &&
    "type" in error &&
    "userMessage" in error &&
    "isOperational" in error
  );
}

export function createAppError(error: Partial<AppError> & Pick<AppError, "type">): AppError {
  return {
    message: error.message ?? ERROR_MESSAGES[error.type],
    userMessage: error.userMessage ?? ERROR_MESSAGES[error.type],
    isOperational: error.isOperational ?? true,
    ...error,
  };
}
