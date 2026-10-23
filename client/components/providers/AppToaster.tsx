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
          top: calc(88px + env(safe-area-inset-top));
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          display: flex;
          width: min(460px, calc(100vw - 32px));
          max-height: calc(100dvh - 112px - env(safe-area-inset-top));
          overflow-y: auto;
          overscroll-behavior: contain;
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
          pointer-events: none;
        }

        .m-toast-shell {
          width: 100%;
          flex-shrink: 0;
          pointer-events: auto;
        }

        @media (max-width: 639px) {
          .m-toast-viewport {
            top: calc(76px + env(safe-area-inset-top));
            right: 12px;
            bottom: auto;
            left: 12px;
            transform: none;
            width: auto;
            max-height: calc(100dvh - 100px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
            align-items: stretch;
          }
        }
      `}</style>
      <div className="m-toast-viewport">
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
