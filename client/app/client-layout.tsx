"use client";

import { usePathname } from "next/navigation";
import { NavbarComponent } from "@/components/Navbar";
import { Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { useScrollToHash } from "@/hooks/useScrollToHash";

// Routes where the navbar should not appear.
// startsWith is used for prefixes (e.g. /auth/login).
const NAVBAR_HIDDEN_PREFIXES = ["/auth", "/feed"];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const isFeed = pathname === "/feed";

  useScrollToHash(100);

  useLayoutEffect(() => {
    if (isFeed || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const entrance = mainRef.current?.animate?.([{ opacity: 0.94 }, { opacity: 1 }], {
      duration: 180,
      easing: "ease-out",
    });
    return () => entrance?.cancel();
  }, [pathname, isFeed]);

  // Scroll to top on every route change.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  const shouldShowNavbar = !NAVBAR_HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
  const isSelectedContentPage = /^\/(movies|tv)\/[^/]+(?:\/(reviews|credits))?\/?$/.test(pathname);

  const mainClassName = shouldShowNavbar && !isSelectedContentPage
    ? `${pathname === "/quiz" ? "min-h-dvh" : "min-h-screen"} bg-black pt-[var(--mobile-nav-safe)] lg:pt-0`
    : "min-h-screen bg-black";

  return (
    <>
      {shouldShowNavbar && (
        <Suspense fallback={null}>
          <NavbarComponent transparent={isSelectedContentPage} />
        </Suspense>
      )}
      <main ref={mainRef} className={mainClassName}>{children}</main>
    </>
  );
}
