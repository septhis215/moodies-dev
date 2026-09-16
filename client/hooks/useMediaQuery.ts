"use client";

import { useCallback, useSyncExternalStore } from "react";

const getServerSnapshot = () => false;

/**
 * Subscribe to a media query without a component-level resize loop.
 *
 * The server snapshot keeps App Router hydration deterministic. The browser
 * only notifies React when the query crosses its breakpoint, which avoids
 * rerendering responsive components for every resize event.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined") return () => undefined;

      const mediaQuery = window.matchMedia(query);
      const onChange = () => onStoreChange();

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", onChange);
      } else {
        mediaQuery.addListener(onChange);
      }

      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener("change", onChange);
        } else {
          mediaQuery.removeListener(onChange);
        }
      };
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
