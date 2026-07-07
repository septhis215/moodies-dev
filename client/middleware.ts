import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (
    (process.env.APP_ENV === "staging" ||
      process.env.NEXT_PUBLIC_APP_ENV === "staging") &&
    request.nextUrl.pathname === "/celeb"
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
