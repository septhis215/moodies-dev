"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import Toast from "@/components/ui/Toast";

type ToastItem = {
  id: string;
  message: string;
  variant?: "info" | "success" | "warning" | "error";
  duration?: number;
  title?: string | null;
  posterUrl?: string | null;
  imageSize?: { width: number; height: number };
  createdAt: number;
};

const ToastContext = createContext({
  toast: (
    message: string,
    variant?: "info" | "success" | "warning" | "error",
    duration?: number,
    title?: string | null,
    posterUrl?: string | null,
    imageSize?: { width: number; height: number }
  ) => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback(
    (
      message: string,
      variant: "info" | "success" | "warning" | "error" = "info",
      duration: number = 3500,
      title: string | null = null,
      posterUrl: string | null = null,
      imageSize?: { width: number; height: number }
    ) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const createdAt = performance.now();

      setToasts((s) => [
        ...s,
        {
          id,
          message,
          variant,
          duration,
          title,
          posterUrl,
          imageSize,
          createdAt,
        },
      ]);
    },
    []
  );
  const remove = useCallback((id: string) => {
    setToasts((s) => s.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        style={{
          position: "fixed",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          pointerEvents: "none",
          gap: 12,
          padding: "0 16px",
          maxWidth: "90vw",
        }}
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              pointerEvents: "auto",
              width: "100%",
              maxWidth: 640,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Toast
              message={t.message}
              variant={t.variant}
              duration={t.duration}
              title={t.title}
              posterUrl={t.posterUrl}
              imageSize={t.imageSize}
              onClose={() => remove(t.id)}
              createdAt={t.createdAt}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
