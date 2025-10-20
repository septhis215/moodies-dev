"use client";

import { usePathname } from "next/navigation";
import { NavbarComponent } from "@/components/Navbar";
import { Suspense, useEffect, useState } from "react";
import { useLoading } from "./context/LoadingContext";
import useAutoLogout from "./auth/AutoLogout";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useAutoLogout();

  const pathname = usePathname();
  const { isLoading } = useLoading();
  const [isMounted, setIsMounted] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Handle initial mount - hide navbar briefly on page load/refresh
  useEffect(() => {
    setIsMounted(false);
    const timer = setTimeout(() => setIsMounted(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Handle route changes - hide navbar during navigation
  useEffect(() => {
    setIsNavigating(true);
    const timer = setTimeout(() => setIsNavigating(false), 500);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Define routes where navbar should be hidden
  const isAuthRoute = pathname.startsWith("/auth");
  const isReviewsRoute = pathname.includes("/reviews");

  // Hide navbar during:
  // 1. Initial mount/page refresh
  // 2. Route navigation
  // 3. Context loading state
  // 4. Auth or review pages
  const shouldShowNavbar =
    isMounted &&
    !isNavigating &&
    !isAuthRoute &&
    !isReviewsRoute &&
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