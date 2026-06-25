export type PaginatedPage<T = never> = {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
};

export function emptyPaginatedPage<T = never>(): PaginatedPage<T> {
  return { data: [], total: 0, page: 1, totalPages: 0 };
}

export async function fetchJsonWithFallback<T>(
  url: string,
  fallback: T,
  init?: RequestInit
): Promise<T> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export function fetchPaginatedPage<T = never>(
  url: string,
  init?: RequestInit
): Promise<PaginatedPage<T>> {
  return fetchJsonWithFallback(url, emptyPaginatedPage<T>(), init);
}
