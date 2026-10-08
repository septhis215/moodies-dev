"use client";

import { useEffect } from "react";
import MoodiesErrorPage from "@/components/errors/MoodiesErrorPage";
import { bodyFont, displayFont } from "@/lib/fonts";
import "./globals.css";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[GlobalError]", error); }, [error]);
  return <html lang="en"><body className={`${bodyFont.variable} ${displayFont.variable}`} style={{ margin: 0, background: "#0b0909" }}><MoodiesErrorPage status={500} onRetry={reset} standalone /></body></html>;
}
