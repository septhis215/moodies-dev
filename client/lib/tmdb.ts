export const TMDB_BASE =
  process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE ?? "https://image.tmdb.org/t/p";

export const TMDB_IMAGE_SIZES = {
  posterTiny: "w92",
  posterSmall: "w185",
  posterCard: "w342",
  posterLarge: "w500",
  backdropCard: "w780",
  backdropHero: "w1280",
  profileAvatar: "w185",
  profileCard: "w342",
  logoSmall: "w92",
  logoCard: "w300",
  original: "original",
} as const;

export type TmdbImageVariant = keyof typeof TMDB_IMAGE_SIZES;
export type TmdbImageSize = TmdbImageVariant | (string & {});

export const TMDB_IMAGE_FALLBACKS = {
  poster: "/placeholder-poster.svg",
  backdrop: "/placeholder-backdrop.svg",
  profile: "/placeholder-person.svg",
} as const;

function normalizeTmdbPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export function resolveTmdbImageSize(size: TmdbImageSize = "original") {
  return size in TMDB_IMAGE_SIZES
    ? TMDB_IMAGE_SIZES[size as TmdbImageVariant]
    : size;
}

export function isTmdbImageUrl(src?: string | null) {
  return Boolean(
    src &&
      (/^https:\/\/image\.tmdb\.org\/t\/p\//.test(src) ||
        src.startsWith(`${TMDB_BASE}/`)),
  );
}

export function getTmdbImageUrl(
  path: string,
  options?: {
    size?: TmdbImageSize;
    fallback?: string | null;
  },
): string;
export function getTmdbImageUrl(
  path?: string | null,
  options?: {
    size?: TmdbImageSize;
    fallback?: string | null;
  },
): string | null;
export function getTmdbImageUrl(
  path?: string | null,
  options: {
    size?: TmdbImageSize;
    fallback?: string | null;
  } = {},
): string | null {
  const { size = "original", fallback = null } = options;
  if (!path?.trim()) return fallback;
  if (isTmdbImageUrl(path)) return path;
  return `${TMDB_BASE}/${resolveTmdbImageSize(size)}${normalizeTmdbPath(path)}`;
}

export function tmdbImage(path: string, size?: TmdbImageSize): string;
export function tmdbImage(
  path?: string | null,
  size?: TmdbImageSize,
): string | null;
export function tmdbImage(
  path?: string | null,
  size: TmdbImageSize = "original",
) {
  return getTmdbImageUrl(path, { size });
}
