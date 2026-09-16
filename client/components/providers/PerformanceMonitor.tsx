"use client";

import { useEffect } from "react";

type PerformanceMetric = {
  name: string;
  value: number;
  path: string;
  timestamp: number;
};

function sendMetric(metric: PerformanceMetric) {
  const endpoint = process.env.NEXT_PUBLIC_PERFORMANCE_ENDPOINT;
  if (!endpoint) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[performance]", metric);
    }
    return;
  }

  const body = JSON.stringify(metric);
  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
    return;
  }

  void fetch(endpoint, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => undefined);
}

function report(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0) return;
  sendMetric({
    name,
    value: Math.round(value * 100) / 100,
    path: window.location.pathname,
    timestamp: Date.now(),
  });
}

export default function PerformanceMonitor() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;

    const observers: PerformanceObserver[] = [];
    const observe = (
      type: string,
      callback: (entries: PerformanceEntryList) => void,
    ) => {
      if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return;
      const observer = new PerformanceObserver((list) => callback(list.getEntries()));
      observer.observe({ type, buffered: true });
      observers.push(observer);
    };

    observe("paint", (entries) => {
      entries.forEach((entry) => {
        if (entry.name === "first-contentful-paint") report("FCP", entry.startTime);
      });
    });
    observe("largest-contentful-paint", (entries) => {
      const last = entries.at(-1);
      if (last) report("LCP", last.startTime);
    });
    observe("layout-shift", (entries) => {
      const score = entries.reduce((sum, entry) => {
        const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        return sum + (layoutShift.hadRecentInput ? 0 : layoutShift.value || 0);
      }, 0);
      report("CLS", score);
    });
    observe("first-input", (entries) => {
      const firstInput = entries[0] as PerformanceEntry & { processingStart?: number } | undefined;
      if (firstInput?.processingStart !== undefined) {
        report("INP", firstInput.processingStart - firstInput.startTime);
      }
    });

    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation) {
      report("TTFB", navigation.responseStart - navigation.requestStart);
      report("DOM_CONTENT_LOADED", navigation.domContentLoadedEventEnd);
    }

    return () => observers.forEach((observer) => observer.disconnect());
  }, []);

  return null;
}
