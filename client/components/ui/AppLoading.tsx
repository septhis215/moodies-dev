"use client";

import { usePathname } from "next/navigation";
import PageSkeleton from "@/components/loading/PageSkeleton";
import { skeletonForPath } from "@/components/loading/route-skeleton";

/** Session bootstrap registers the destination's full-page loading screen. */
export default function AppLoading() {
  const pathname = usePathname();
  return <PageSkeleton variant={skeletonForPath(pathname)} />;
}
