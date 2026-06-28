"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#000", color: "#fff" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 24px",
            fontFamily:
              'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          <section style={{ maxWidth: 560, textAlign: "center" }}>
            <p
              style={{
                margin: "0 0 12px",
                color: "rgba(255,255,255,0.45)",
                fontSize: 12,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
              }}
            >
              Moodies
            </p>
            <h1 style={{ margin: 0, fontSize: 42, lineHeight: 1.1 }}>
              Something went wrong.
            </h1>
            <p
              style={{
                margin: "18px auto 0",
                color: "rgba(255,255,255,0.65)",
                lineHeight: 1.6,
              }}
            >
              The app hit an unexpected problem. Please try again.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 30,
                border: 0,
                borderRadius: 6,
                background: "#fff",
                color: "#000",
                padding: "12px 18px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
