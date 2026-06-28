import { normalizeApiError, normalizeResponseError } from "./normalize-api-error";

export type ApiRequestOptions = RequestInit & {
  fallbackMessage?: string;
};

export async function apiRequest<T>(
  input: RequestInfo | URL,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { fallbackMessage, ...init } = options;

  try {
    const response = await fetch(input, init);
    if (!response.ok) throw await normalizeResponseError(response, fallbackMessage);
    return (await response.json()) as T;
  } catch (error) {
    throw normalizeApiError(error, fallbackMessage);
  }
}

export async function throwIfResponseError(
  response: Response,
  fallbackMessage?: string,
): Promise<void> {
  if (!response.ok) throw await normalizeResponseError(response, fallbackMessage);
}
