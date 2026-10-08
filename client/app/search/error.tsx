"use client";

import { useEffect } from "react";
import MoodiesErrorPage from "@/components/errors/MoodiesErrorPage";

export default function SearchError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[SearchError]", error); }, [error]);
  return <MoodiesErrorPage status={500} onRetry={reset} title="Search needs another take." note="We couldn’t load your search results. Try again, or head home to explore more stories." />;
}
