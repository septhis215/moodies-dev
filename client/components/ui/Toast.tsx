"use client";

import React from "react";

type ToastVariant = "info" | "success" | "warning" | "error";

interface ToastProps {
  message: string;
  onClose: () => void;
  variant?: ToastVariant;
  duration?: number;
  createdAt: number;
  title?: string | null;
  posterUrl?: string | null;
  imageSize?: { width: number; height: number };
}

type ToastTone = {
  eyebrow: string;
  title: string;
  accent: string;
  tint: string;
  border: string;
  role: "status" | "alert";
};

type ToastIntent = {
  eyebrow: string;
  title: string;
  action:
    | "added"
    | "removed"
    | "login"
    | "logout"
    | "loading"
    | "account"
    | "default";
};

const TONES: Record<ToastVariant, ToastTone> = {
  info: {
    eyebrow: "Moodies note",
    title: "Quick update",
    accent: "#e94f37",
    tint: "rgba(233, 79, 55, 0.1)",
    border: "rgba(233, 79, 55, 0.28)",
    role: "status",
  },
  success: {
    eyebrow: "Nice",
    title: "All set",
    accent: "#42d392",
    tint: "rgba(66, 211, 146, 0.1)",
    border: "rgba(66, 211, 146, 0.24)",
    role: "status",
  },
  warning: {
    eyebrow: "Heads up",
    title: "Check this first",
    accent: "#f6b73c",
    tint: "rgba(246, 183, 60, 0.12)",
    border: "rgba(246, 183, 60, 0.3)",
    role: "alert",
  },
  error: {
    eyebrow: "Not completed",
    title: "Something went wrong",
    accent: "#ff5b5f",
    tint: "rgba(255, 91, 95, 0.12)",
    border: "rgba(255, 91, 95, 0.3)",
    role: "alert",
  },
};

function getIntent(message: string, variant: ToastVariant): ToastIntent {
  const text = message.toLowerCase();

  if (/signing|loading|creating|please wait|almost there/.test(text)) {
    return {
      eyebrow: "In progress",
      title: "Working on it",
      action: "loading",
    };
  }

  if (/logged out|signed out|log out|sign out|logout/i.test(text)) {
    return {
      eyebrow: "Signed out",
      title: "See you next time",
      action: "logout",
    };
  }

  if (
    /welcome|signed in|logged in|sign-in complete|login successful/.test(text)
  ) {
    return {
      eyebrow: "Welcome back",
      title: "You are signed in",
      action: "login",
    };
  }

  if (/added/.test(text)) {
    return {
      eyebrow: "Added",
      title: "Saved to your space",
      action: "added",
    };
  }

  if (/removed|deleted/.test(text)) {
    return {
      eyebrow: "Removed",
      title: "Removed from your space",
      action: "removed",
    };
  }

  if (/log in|sign in|not logged/.test(text)) {
    return {
      eyebrow: "Sign in needed",
      title: "Continue with your account",
      action: "account",
    };
  }

  return {
    eyebrow: TONES[variant].eyebrow,
    title: TONES[variant].title,
    action: "default",
  };
}

function getIntentTone(intent: ToastIntent, tone: ToastTone) {
  switch (intent.action) {
    case "added":
      return {
        accent: "#42d392",
        tint: "rgba(66, 211, 146, 0.12)",
        border: "rgba(66, 211, 146, 0.28)",
      };
    case "removed":
      return {
        accent: "#ff7a59",
        tint: "rgba(255, 122, 89, 0.12)",
        border: "rgba(255, 122, 89, 0.3)",
      };
    case "login":
      return {
        accent: "#62c6ff",
        tint: "rgba(98, 198, 255, 0.12)",
        border: "rgba(98, 198, 255, 0.3)",
      };
    case "logout":
      return {
        accent: "#b497ff",
        tint: "rgba(180, 151, 255, 0.12)",
        border: "rgba(180, 151, 255, 0.3)",
      };
    case "loading":
      return {
        accent: "#e94f37",
        tint: "rgba(233, 79, 55, 0.12)",
        border: "rgba(233, 79, 55, 0.3)",
      };
    case "account":
      return {
        accent: "#f6b73c",
        tint: "rgba(246, 183, 60, 0.12)",
        border: "rgba(246, 183, 60, 0.3)",
      };
    default:
      return {
        accent: tone.accent,
        tint: tone.tint,
        border: tone.border,
      };
  }
}

const Toast: React.FC<ToastProps> = ({
  message,
  onClose,
  variant = "info",
  duration = 3500,
  title = null,
  posterUrl = null,
  imageSize,
}) => {
  const [isPaused, setIsPaused] = React.useState(false);
  const remainingRef = React.useRef(duration);
  const startedAtRef = React.useRef<number | null>(null);
  const timeoutRef = React.useRef<number | null>(null);
  const onCloseRef = React.useRef(onClose);

  const tone = TONES[variant] ?? TONES.info;
  const intent = getIntent(message, variant);
  const intentTone = getIntentTone(intent, tone);
  const displayTitle = title || intent.title;
  const displayMessage = title ? message : message || intent.title;
  const hasMedia = Boolean(posterUrl);

  const clearTimer = React.useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startTimer = React.useCallback(() => {
    clearTimer();
    startedAtRef.current = performance.now();
    timeoutRef.current = window.setTimeout(() => {
      onCloseRef.current();
    }, remainingRef.current);
  }, [clearTimer]);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    remainingRef.current = duration;
    startTimer();

    return clearTimer;
  }, [clearTimer, duration, startTimer]);

  const pauseTimer = () => {
    if (isPaused) return;

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
    if (!isPaused) return;

    setIsPaused(false);
    startTimer();
  };

  return (
    <>
      <style>{`
        .m-toast {
          --toast-accent: #e94f37;
          --toast-tint: rgba(233, 79, 55, 0.1);
          --toast-border: rgba(233, 79, 55, 0.28);
          --toast-duration: 3500ms;
          position: relative;
          width: min(100%, 392px);
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-left-color: var(--toast-border);
          border-radius: 14px;
          background: rgba(13, 13, 15, 0.96);
          color: #ffffff;
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.34);
          animation: mToastEnter 180ms ease-out both;
        }

        .m-toast__body {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          padding: 11px 10px 12px 12px;
        }

        .m-toast__signal,
        .m-toast__media {
          width: 42px;
          height: 42px;
          overflow: hidden;
          border-radius: 12px;
          border: 1px solid var(--toast-border);
          background: var(--toast-tint);
        }

        .m-toast__signal {
          position: relative;
          background:
            linear-gradient(135deg, var(--toast-tint), rgba(255, 255, 255, 0.025)),
            #151517;
        }

        .m-toast__media {
          position: relative;
          display: grid;
          place-items: center;
          background: #171719;
        }

        .m-toast__media img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .m-toast__color-chip {
          position: absolute;
          right: 6px;
          bottom: 6px;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: var(--toast-accent);
          box-shadow: 0 0 0 4px rgba(13, 13, 15, 0.86);
        }

        .m-toast__signal::before {
          content: "";
          position: absolute;
          inset: 7px;
          border-radius: 9px;
          background: var(--toast-accent);
          opacity: 0.88;
        }

        .m-toast__content {
          min-width: 0;
        }

        .m-toast__eyebrow {
          margin-bottom: 2px;
          color: var(--toast-accent);
          font-size: 10px;
          line-height: 13px;
          font-weight: 800;
          letter-spacing: 0.7px;
          text-transform: uppercase;
        }

        .m-toast__title {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #ffffff;
          font-size: 14px;
          line-height: 19px;
          font-weight: 800;
          letter-spacing: 0;
        }

        .m-toast__message {
          display: -webkit-box;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          margin-top: 1px;
          color: rgba(255, 255, 255, 0.66);
          font-size: 12px;
          line-height: 17px;
          letter-spacing: 0;
        }

        .m-toast__close {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: rgba(255, 255, 255, 0.58);
          cursor: pointer;
          transition: background 120ms ease, color 120ms ease;
        }

        .m-toast__close:hover,
        .m-toast__close:focus-visible {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          outline: none;
        }

        .m-toast__track {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 2px;
          background: rgba(255, 255, 255, 0.08);
        }

        .m-toast__track > i {
          display: block;
          width: 100%;
          height: 100%;
          background: var(--toast-accent);
          transform-origin: left;
          animation: mToastTrack var(--toast-duration) linear forwards;
          animation-play-state: running;
        }

        .m-toast[data-paused="true"] .m-toast__track > i {
          animation-play-state: paused;
        }

        @keyframes mToastEnter {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes mToastTrack {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }

        @media (max-width: 640px) {
          .m-toast {
            width: 100%;
            border-radius: 13px;
          }

          .m-toast__body {
            grid-template-columns: auto minmax(0, 1fr) auto;
            gap: 9px;
            padding: 10px 9px 11px 10px;
          }

          .m-toast__signal,
          .m-toast__media {
            width: 38px;
            height: 38px;
            border-radius: 11px;
          }

          .m-toast__color-chip {
            right: 5px;
            bottom: 5px;
            width: 9px;
            height: 9px;
          }

          .m-toast__signal::before {
            inset: 7px;
            border-radius: 8px;
          }

          .m-toast__title {
            font-size: 13px;
            line-height: 18px;
          }

          .m-toast__message {
            font-size: 12px;
            line-height: 16px;
            -webkit-line-clamp: 2;
          }

          .m-toast__close {
            width: 28px;
            height: 28px;
          }

          @keyframes mToastEnter {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        }

        @media (max-width: 360px) {
          .m-toast__eyebrow {
            font-size: 9px;
          }

          .m-toast__message {
            -webkit-line-clamp: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .m-toast,
          .m-toast__track > i {
            animation: none;
          }

          .m-toast__close {
            transition: none;
          }
        }
      `}</style>

      <div
        role={tone.role}
        aria-live={tone.role === "alert" ? "assertive" : "polite"}
        className="m-toast"
        data-paused={isPaused}
        onMouseEnter={pauseTimer}
        onMouseLeave={resumeTimer}
        onFocus={pauseTimer}
        onBlur={resumeTimer}
        style={
          {
            "--toast-accent": intentTone.accent,
            "--toast-tint": intentTone.tint,
            "--toast-border": intentTone.border,
            "--toast-duration": `${duration}ms`,
          } as React.CSSProperties
        }
      >
        <div className="m-toast__body">
          {hasMedia ? (
            <div className="m-toast__media" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={posterUrl ?? ""}
                alt=""
                style={
                  imageSize
                    ? {
                        width: `${imageSize.width}px`,
                        height: `${imageSize.height}px`,
                        objectFit: "contain",
                      }
                    : undefined
                }
              />
              <span className="m-toast__color-chip" />
            </div>
          ) : (
            <div className="m-toast__signal" aria-hidden />
          )}

          <div className="m-toast__content">
            <div className="m-toast__eyebrow">{intent.eyebrow}</div>
            <div className="m-toast__title">{displayTitle}</div>
            <div className="m-toast__message">{displayMessage}</div>
          </div>

          <button
            type="button"
            className="m-toast__close"
            onClick={onClose}
            aria-label="Dismiss notification"
            title="Dismiss"
          >
            <span aria-hidden>X</span>
          </button>
        </div>

        <div className="m-toast__track" aria-hidden>
          <i />
        </div>
      </div>
    </>
  );
};

export default Toast;
