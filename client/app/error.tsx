"use client";

import { useEffect } from "react";
import MoodiesErrorPage from "@/components/errors/MoodiesErrorPage";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[RouteError]", error); }, [error]);
  return <MoodiesErrorPage status={500} onRetry={reset} />;
}
