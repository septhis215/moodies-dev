const COMMUNITY_PATH =
  /^\/community(?:\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i;
const AUTH_RETURN_KEY = "moodies:community-auth-return";

function communityDestination(value: string | null | undefined): URL | null {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return null;
  try {
    const destination = new URL(value, "https://moodies.invalid");
    return destination.origin === "https://moodies.invalid" &&
      COMMUNITY_PATH.test(destination.pathname)
      ? destination
      : null;
  } catch {
    return null;
  }
}

export function communityAuthReturnHref(
  value: string | null | undefined,
): string {
  const destination = communityDestination(value);
  return destination
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : "/";
}

export function communityReturnHref(value: string | null | undefined): string {
  const destination = communityDestination(value);
  return destination?.pathname === "/community"
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : "/community";
}

export function communitySignInHref(destination: string): string {
  const returnTo = communityAuthReturnHref(destination);
  return `/auth/login?returnTo=${encodeURIComponent(returnTo === "/" ? "/community" : returnTo)}`;
}

export function rememberCommunityAuthReturn(destination: string): void {
  try {
    const href = communityAuthReturnHref(destination);
    if (href !== "/")
      sessionStorage.setItem(
        AUTH_RETURN_KEY,
        JSON.stringify({ href, savedAt: Date.now() }),
      );
    else sessionStorage.removeItem(AUTH_RETURN_KEY);
  } catch {
    /* Sign-in still works when browser storage is unavailable. */
  }
}

export function consumeCommunityAuthReturn(): string | null {
  try {
    const saved = sessionStorage.getItem(AUTH_RETURN_KEY);
    sessionStorage.removeItem(AUTH_RETURN_KEY);
    if (!saved) return null;
    const { href, savedAt } = JSON.parse(saved);
    if (
      typeof savedAt !== "number" ||
      Date.now() - savedAt > 10 * 60 * 1000 ||
      savedAt > Date.now()
    )
      return null;
    const destination = communityAuthReturnHref(
      typeof href === "string" ? href : null,
    );
    return destination === "/" ? null : destination;
  } catch {
    return null;
  }
}
