"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Toast from "@/components/ui/Toast";

type ToastVariant = "info" | "success" | "warning" | "error";

type ToastItem = {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  title?: string | null;
  posterUrl?: string | null;
  imageSize?: { width: number; height: number };
  createdAt: number;
};

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

declare global {
  interface Window {
    showToast?: ToastContextValue["toast"];
  }
}

const MAX_VISIBLE_TOASTS = 3;

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback(
    (
      message: string,
      variant: ToastVariant = "info",
      duration: number = 3500,
      title: string | null = null,
      posterUrl: string | null = null,
      imageSize?: { width: number; height: number },
    ) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const createdAt = performance.now();

      setToasts((s) =>
        [
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
        ].slice(-MAX_VISIBLE_TOASTS),
      );
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setToasts((s) => s.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  useEffect(() => {
    window.showToast = toast;

    return () => {
      if (window.showToast === toast) {
        delete window.showToast;
      }
    };
  }, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <style>{`
        .m-toast-viewport {
          position: fixed;
          top: 76px;
          right: 20px;
          z-index: 9999;
          display: flex;
          width: min(392px, calc(100vw - 28px));
          max-height: calc(100dvh - 96px);
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          pointer-events: none;
        }

        .m-toast-shell {
          width: 100%;
          pointer-events: auto;
        }

        @media (max-width: 640px) {
          .m-toast-viewport {
            top: auto;
            right: 10px;
            bottom: calc(12px + env(safe-area-inset-bottom));
            left: 10px;
            width: auto;
            max-height: min(50dvh, 300px);
            align-items: stretch;
          }
        }
      `}</style>
      <div className="m-toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className="m-toast-shell">
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
