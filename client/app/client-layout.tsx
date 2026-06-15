"use client";

import { usePathname } from "next/navigation";
import { NavbarComponent } from "@/components/Navbar";
import { Suspense, useEffect } from "react";
import { useScrollToHash } from "@/hooks/useScrollToHash";

// Routes where the navbar should not appear.
// startsWith is used for prefixes (e.g. /auth/login), includes for segments (e.g. /movies/123/reviews).
const NAVBAR_HIDDEN_PREFIXES = ["/auth", "/feed", "/discover"];
const NAVBAR_HIDDEN_SEGMENTS = ["/reviews", "/credits"];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useScrollToHash(100);

  // Scroll to top on every route change.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  const shouldShowNavbar =
    !NAVBAR_HIDDEN_PREFIXES.some((p) => pathname.startsWith(p)) &&
    !NAVBAR_HIDDEN_SEGMENTS.some((s) => pathname.includes(s));

  const mainClassName = shouldShowNavbar
    ? "min-h-screen bg-black pt-[var(--mobile-nav-safe)] lg:pt-0"
    : "min-h-screen bg-black";

  return (
    <>
      {shouldShowNavbar && (
        <Suspense fallback={null}>
          <NavbarComponent />
        </Suspense>
      )}
      <main className={mainClassName}>{children}</main>
    </>
  );
}
