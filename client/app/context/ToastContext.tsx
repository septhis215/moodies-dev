"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { appToast } from "@/lib/toast";

type ToastVariant = "info" | "success" | "warning" | "error";

type ToastContextValue = {
  toast: (
    message: string,
    variant?: ToastVariant,
    duration?: number,
    title?: string | null,
    posterUrl?: string | null,
    imageSize?: { width: number; height: number },
  ) => void;
};

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toast = useCallback(
    (
      message: string,
      variant: ToastVariant = "info",
      duration: number = 3500,
      title: string | null = null,
      posterUrl: string | null = null,
      imageSize?: { width: number; height: number },
    ) => {
      appToast[variant](message, {
        title,
        duration,
        posterUrl,
        imageSize,
      });
    },
    [],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  return useContext(ToastContext);
}
