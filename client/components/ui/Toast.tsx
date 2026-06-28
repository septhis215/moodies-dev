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
    iconClassName: string;
    ringClassName: string;
  }
> = {
  success: {
    label: "Success",
    icon: CheckCircle2,
    role: "status",
    iconClassName: "text-emerald-400",
    ringClassName: "bg-emerald-500/10 ring-emerald-500/20",
  },
  error: {
    label: "Error",
    icon: AlertCircle,
    role: "alert",
    iconClassName: "text-[#E3262A]",
    ringClassName: "bg-[#E3262A]/10 ring-[#E3262A]/25",
  },
  warning: {
    label: "Warning",
    icon: TriangleAlert,
    role: "alert",
    iconClassName: "text-amber-300",
    ringClassName: "bg-amber-400/10 ring-amber-400/20",
  },
  info: {
    label: "Info",
    icon: Info,
    role: "status",
    iconClassName: "text-white/70",
    ringClassName: "bg-white/7 ring-white/10",
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
  duration = 4000,
  title = null,
  posterUrl = null,
  imageSize,
  action,
  loading = false,
}) => {
  const [isPaused, setIsPaused] = React.useState(false);
  const remainingRef = React.useRef(duration ?? 0);
  const startedAtRef = React.useRef<number | null>(null);
  const timeoutRef = React.useRef<number | null>(null);
  const onCloseRef = React.useRef(onClose);
  const isPersistent = duration === null;

  const meta = VARIANT_META[variant] ?? VARIANT_META.info;
  const Icon = loading ? Loader2 : meta.icon;
  const displayTitle = title || defaultTitle(variant, loading);

  const clearTimer = React.useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startTimer = React.useCallback(() => {
    if (isPersistent) return;

    clearTimer();
    startedAtRef.current = performance.now();
    timeoutRef.current = window.setTimeout(() => {
      onCloseRef.current();
    }, Math.max(remainingRef.current || 4000, 800));
  }, [clearTimer, isPersistent]);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    remainingRef.current = duration ?? 0;
    startTimer();

    return clearTimer;
  }, [clearTimer, duration, startTimer]);

  const pauseTimer = () => {
    if (isPaused || isPersistent) return;

    if (startedAtRef.current !== null) {
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (performance.now() - startedAtRef.current),
      );
    }

    clearTimer();
    setIsPaused(true);
  };

  const resumeTimer = () => {
    if (!isPaused || isPersistent) return;

    setIsPaused(false);
    startTimer();
  };

  return (
    <div
      role={meta.role}
      aria-live={meta.role === "alert" ? "assertive" : "polite"}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
      onFocus={pauseTimer}
      onBlur={resumeTimer}
      className={cn(
        "group pointer-events-auto relative grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 overflow-hidden rounded-md border border-white/10 bg-[#101012]/95 p-4 pr-3 text-white shadow-lg shadow-black/35 backdrop-blur-md",
        "animate-in fade-in slide-in-from-bottom-2 duration-200",
      )}
    >
      {posterUrl ? (
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-white/10 bg-white/[0.04]">
          <img
            src={posterUrl}
            alt=""
            className="h-full w-full object-cover"
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
      ) : (
        <div
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-md ring-1",
            meta.ringClassName,
          )}
          aria-hidden
        >
          <Icon
            className={cn(
              "h-4 w-4",
              loading && "animate-spin",
              meta.iconClassName,
            )}
          />
        </div>
      )}

      <div className="min-w-0 pt-0.5">
        <div className="truncate text-sm font-semibold leading-5 text-white">
          {displayTitle}
        </div>
        <div className="mt-1 text-sm leading-5 text-white/65">{message}</div>
        {action && (
          <button
            type="button"
            className="mt-3 inline-flex h-8 items-center justify-center rounded-md bg-white px-3 text-xs font-semibold text-black transition hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
            onClick={() => {
              action.onClick();
              onClose();
            }}
          >
            {action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/45 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
};

export default Toast;
