"use client";

import { usePathname } from "next/navigation";
import { NavbarComponent } from "@/components/Navbar";
import { Suspense, useEffect, useState } from "react";
import { useLoading } from "./context/LoadingContext";
import { useScrollToHash } from "@/hooks/useScrollToHash";
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading } = useLoading();
  const [isMounted, setIsMounted] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  useScrollToHash(100);

  useEffect(() => {
    setIsMounted(false);
    const timer = setTimeout(() => setIsMounted(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => setIsNavigating(false), 500);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Add this: Hide navbar on feed pages
  const isFeedRoute = pathname.includes('/feed') || pathname === '/discover';
  const isAuthRoute = pathname.startsWith("/auth");
  const isReviewsRoute = pathname.includes("/reviews");

  const shouldShowNavbar =
    isMounted &&
    !isNavigating &&
    !isAuthRoute &&
    !isReviewsRoute &&
    !isFeedRoute &&  // Add this line
    !isLoading;

  return (
    <>
      {shouldShowNavbar && (
        <Suspense fallback={null}>
          <NavbarComponent />
        </Suspense>
      )}
      <main>{children}</main>
    </>
  );
}