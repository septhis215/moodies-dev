"use client";

import { useEffect, useSyncExternalStore } from "react";
import Toast from "@/components/ui/Toast";
import { appToast, appToastStore } from "@/lib/toast";
import type { AppToastItem } from "@/lib/toast";

declare global {
  interface Window {
    showToast?: (
      message: string,
      variant?: AppToastItem["variant"],
      duration?: number,
      title?: string | null,
      posterUrl?: string | null,
      imageSize?: { width: number; height: number },
    ) => void;
  }
}

export function AppToaster() {
  const toasts = useSyncExternalStore(
    appToastStore.subscribe,
    appToastStore.getSnapshot,
    appToastStore.getServerSnapshot,
  );

  useEffect(() => {
    window.showToast = (
      message,
      variant = "info",
      duration,
      title = null,
      posterUrl = null,
      imageSize,
    ) => {
      appToast[variant](message, {
        title,
        duration,
        posterUrl,
        imageSize,
      });
    };

    return () => {
      delete window.showToast;
    };
  }, []);

  return (
    <>
      <style>{`
        .m-toast-viewport {
          position: fixed;
          right: 16px;
          bottom: calc(16px + env(safe-area-inset-bottom));
          z-index: 9999;
          display: flex;
          width: min(420px, calc(100vw - 32px));
          max-height: calc(100dvh - 32px);
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
            top: calc(12px + env(safe-area-inset-top));
            right: 12px;
            bottom: auto;
            left: 12px;
            width: auto;
            max-height: min(60dvh, 360px);
            align-items: stretch;
          }
        }
      `}</style>
      <div className="m-toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className="m-toast-shell">
            <Toast
              message={toast.message}
              variant={toast.variant}
              duration={toast.duration}
              title={toast.title}
              posterUrl={toast.posterUrl}
              imageSize={toast.imageSize}
              action={toast.action}
              loading={toast.loading}
              onClose={() => appToast.dismiss(toast.id)}
              createdAt={toast.createdAt}
            />
          </div>
        ))}
      </div>
    </>
  );
}
