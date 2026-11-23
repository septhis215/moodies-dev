"use client";

import { useEffect, useSyncExternalStore } from "react";
import Toast from "@/components/ui/Toast";
import { appToast, appToastStore } from "@/lib/toast";
import type { AppToastItem } from "@/lib/toast";
import styles from "@/components/ui/Toast.module.css";

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
    <div className={styles.viewport}>
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.shell}>
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
  );
}
