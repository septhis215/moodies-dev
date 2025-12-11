"use client";

import React from "react";

interface ToastProps {
  message: string;
  onClose: () => void;
  variant?: "info" | "success" | "warning" | "error";
  duration?: number; // ms
  createdAt: number; // Timestamp when toast was created
  title?: string | null;
  posterUrl?: string | null;
}

const ACCENT: Record<string, string> = {
  info: "linear-gradient(90deg,#8b5cf6,#06b6d4)",
  success: "linear-gradient(90deg,#16a34a,#06b6d4)",
  warning: "linear-gradient(90deg,#f59e0b,#ef4444)",
  error: "linear-gradient(90deg,#ef4444,#8b5cf6)",
};

const Toast: React.FC<ToastProps> = ({
  message,
  onClose,
  variant = "info",
  duration = 3500,
  createdAt,
  title = null,
  posterUrl = null,
}) => {
  const [progress, setProgress] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    // Use the createdAt timestamp as the start time so each toast's timer is independent
    const startTime = createdAt;

    const loop = (now: number) => {
      const elapsed = now - startTime;
      const pct = Math.min(1, elapsed / duration);
      setProgress(pct);

      if (pct >= 1) {
        onClose();
      } else {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [duration, onClose, createdAt]);

  // Determine badge text: prefer "Added" / "Removed" based on message content,
  // otherwise map variant to Warning/Error/Info-like labels (no "SUCCESS")
  const badgeLabel = React.useMemo(() => {
    if (/added/i.test(message)) return "Added";
    if (/removed/i.test(message)) return "Removed";
    if (variant === "warning") return "Warning";
    if (variant === "error") return "Error";
    // fallback
    return "Info";
  }, [message, variant]);

  return (
    <>
      <style>{`
        .m-toast {
          width: 100%;
          max-width: 640px;
          color: #fff;
          background: rgba(10,11,13,0.6);
          border-radius: 12px;
          padding: 12px 14px;
          display: flex;
          gap: 12px;
          align-items: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.6);
          backdrop-filter: blur(8px) saturate(120%);
          border: 1px solid rgba(255,255,255,0.04);
          transform-origin: top center;
          animation: toastIn 360ms cubic-bezier(.2,.9,.25,1);
        }

        .m-toast__left {
          flex: 0 0 auto;
          width: 56px;
          height: 80px;
          border-radius: 8px;
          overflow: hidden;
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.12));
          display: grid;
          place-items: center;
          box-shadow: inset 0 -6px 18px rgba(0,0,0,0.4);
        }

        .m-toast__left img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .m-toast__placeholder {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          font-weight: 700;
          color: rgba(255,255,255,0.9);
          background: linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
        }

        .m-toast__content {
          flex: 1 1 auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .m-toast__message-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .m-toast__message {
          font-weight: 700;
          font-size: 14px;
          line-height: 1.2;
        }

        .m-toast__sub {
          font-size: 12px;
          opacity: 0.8;
        }

        .m-toast__badge {
          margin-left: auto;
          display: inline-block;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 11px;
          opacity: 0.95;
          color: rgba(255,255,255,0.95);
          background: linear-gradient(90deg, rgba(255,255,255,0.03), transparent);
          border: 1px solid rgba(255,255,255,0.02);
          letter-spacing: 0.6px;
        }

        .m-toast__close {
          margin-left: 12px;
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.9);
          cursor: pointer;
          font-size: 16px;
          opacity: 0.9;
        }

        .m-toast__progress {
          height: 4px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(255,255,255,0.06);
          margin-top: 8px;
        }

        .m-toast__progress > i {
          display: block;
          height: 100%;
          width: 0%;
          background: var(--accent);
          transform-origin: left;
        }

        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-10px) scale(.995); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (max-width: 640px) {
          .m-toast { padding: 10px 12px; gap: 10px; }
          .m-toast__left { width: 44px; height: 64px; }
          .m-toast__message { font-size: 13px; }
          .m-toast__sub { font-size: 11px; }
          .m-toast__badge { display: none; }
          .m-toast__progress { height: 3px; margin-top: 6px; }
        }
      `}</style>

      <div
        role="status"
        aria-live="polite"
        className="m-toast"
        style={{
          border: "1px solid rgba(255,255,255,0.04)",
          // dynamic accent variable for progress bar
          ["--accent" as any]: ACCENT[variant] ?? ACCENT.info,
        }}
      >
        <div className="m-toast__left" aria-hidden>
          {posterUrl ? (
            // simple img tag to avoid next/image layout complexity inside floating toasts
            <img src={posterUrl} alt={title ?? "poster"} />
          ) : (
            <div className="m-toast__placeholder" aria-hidden>
              {title ? title.slice(0, 2).toUpperCase() : "?"}
            </div>
          )}
        </div>

        <div className="m-toast__content">
          <div className="m-toast__message-row">
            <div className="m-toast__message">{title ?? message}</div>
            <span
              className="m-toast__badge"
              aria-hidden
              style={{
                boxShadow:
                  variant === "warning"
                    ? "0 4px 18px rgba(245,158,11,0.08)"
                    : variant === "error"
                    ? "0 4px 18px rgba(239,68,68,0.08)"
                    : "0 4px 18px rgba(22,163,74,0.06)",
                background:
                  variant === "warning"
                    ? "linear-gradient(90deg, rgba(245,158,11,0.06), transparent)"
                    : variant === "error"
                    ? "linear-gradient(90deg, rgba(239,68,68,0.06), transparent)"
                    : "linear-gradient(90deg, rgba(16,185,129,0.04), transparent)",
              }}
            >
              {badgeLabel}
            </span>
          </div>

          {title ? <div className="m-toast__sub">{message}</div> : null}

          <div className="m-toast__progress" aria-hidden>
            <i
              style={{
                width: `${Math.round(progress * 100)}%`,
              }}
            />
          </div>
        </div>

        <button
          className="m-toast__close"
          onClick={onClose}
          aria-label="Close notification"
          title="Close"
        >
          ✕
        </button>
      </div>
    </>
  );
};

export default Toast;
