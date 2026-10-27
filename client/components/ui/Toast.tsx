"use client";

import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  TriangleAlert,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./Toast.module.css";

type ToastVariant = "info" | "success" | "warning" | "error";

interface ToastProps {
  message: string;
  onClose: () => void;
  variant?: ToastVariant;
  duration?: number | null;
  createdAt: number;
  title?: string | null;
  posterUrl?: string | null;
  imageSize?: { width: number; height: number };
  action?: {
    label: string;
    onClick: () => void;
  };
  loading?: boolean;
}

const VARIANT_META: Record<
  ToastVariant,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    role: "status" | "alert";
  }
> = {
  success: {
    label: "Success",
    icon: CheckCircle2,
    role: "status",
  },
  error: {
    label: "Error",
    icon: AlertCircle,
    role: "alert",
  },
  warning: {
    label: "Warning",
    icon: TriangleAlert,
    role: "alert",
  },
  info: {
    label: "Info",
    icon: Info,
    role: "status",
  },
};

function defaultTitle(variant: ToastVariant, loading: boolean) {
  if (loading) return "Working on it";
  return VARIANT_META[variant].label;
}

const Toast: React.FC<ToastProps> = ({
  message,
  onClose,
  variant = "info",
  duration = 5000,
  title = null,
  posterUrl = null,
  imageSize,
  action,
  loading = false,
  createdAt,
}) => {
  const pauseReasons = React.useRef(new Set<"pointer" | "focus">());
  const remainingRef = React.useRef(duration ?? 0);
  const startedAtRef = React.useRef<number | null>(null);
  const timeoutRef = React.useRef<number | null>(null);
  const onCloseRef = React.useRef(onClose);
  const isPersistent = duration === null;

  const meta = VARIANT_META[variant] ?? VARIANT_META.info;
  const Icon = loading ? Loader2 : meta.icon;
  const displayTitle = title || defaultTitle(variant, loading);

  const clearTimer = React.useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startTimer = React.useCallback(() => {
    if (isPersistent || pauseReasons.current.size) return;

    clearTimer();
    startedAtRef.current = performance.now();
    timeoutRef.current = window.setTimeout(
      () => {
        onCloseRef.current();
      },
      Math.max(remainingRef.current, 0),
    );
  }, [clearTimer, isPersistent]);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    remainingRef.current = duration ?? 0;
    startTimer();

    return clearTimer;
  }, [clearTimer, createdAt, duration, startTimer]);

  const pauseTimer = (reason: "pointer" | "focus") => {
    const alreadyPaused = pauseReasons.current.size > 0;
    pauseReasons.current.add(reason);
    if (alreadyPaused || isPersistent) return;

    if (startedAtRef.current !== null) {
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (performance.now() - startedAtRef.current),
      );
    }

    clearTimer();
  };

  const resumeTimer = (reason: "pointer" | "focus") => {
    pauseReasons.current.delete(reason);
    if (pauseReasons.current.size || isPersistent) return;
    startTimer();
  };

  return (
    <div
      role={meta.role}
      aria-live={meta.role === "alert" ? "assertive" : "polite"}
      aria-atomic="true"
      onMouseEnter={() => pauseTimer("pointer")}
      onMouseLeave={() => resumeTimer("pointer")}
      onFocus={() => pauseTimer("focus")}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          resumeTimer("focus");
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
      data-variant={variant}
      className={styles.toast}
    >
      <div className={styles.icon} aria-hidden="true">
        <Icon className={cn("h-5 w-5", loading && styles.spinner)} />
      </div>

      <div className={styles.content}>
        {posterUrl && (
          <div className={styles.poster}>
            <img
              src={posterUrl}
              alt=""
              className="h-full w-full object-contain"
              style={
                imageSize
                  ? {
                      width: imageSize.width,
                      height: imageSize.height,
                      objectFit: "contain",
                    }
                  : undefined
              }
            />
          </div>
        )}
        <div className={styles.copy}>
          <div className={styles.title}>{displayTitle}</div>
          <div className={styles.message}>{message}</div>
          {action && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                action.onClick();
                onClose();
              }}
            >
              {action.label}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className={styles.dismiss}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
};

export default Toast;
