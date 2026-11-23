"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { RailSkeleton } from "@/components/loading/PageSkeleton";

/** Mount once near the viewport; keep hash destinations available before loading. */
export function DeferredSection({ id, label, children, fallback, keepAnchor = false }: {
  id: string; label: string; children: ReactNode; fallback?: ReactNode; keepAnchor?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) return;
    const openHash = () => {
      if (window.location.hash.slice(1) === id) setReady(true);
    };
    openHash();
    window.addEventListener("hashchange", openHash);
    if (!("IntersectionObserver" in window)) {
      setReady(true);
      return () => window.removeEventListener("hashchange", openHash);
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setReady(true);
    }, { rootMargin: "400px" });
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", openHash);
    };
  }, [id, ready]);
  return <div ref={ref} id={ready && !keepAnchor ? undefined : id} data-deferred-section={id} data-section-ready={ready}
    role={ready ? undefined : "region"} aria-label={ready ? undefined : label} aria-busy={ready ? undefined : true}>
    {ready ? children : <div className="min-h-96 py-6"><span role="status" className="sr-only">Loading {label}</span>{fallback ?? <RailSkeleton />}</div>}
  </div>;
}

export default DeferredSection;
