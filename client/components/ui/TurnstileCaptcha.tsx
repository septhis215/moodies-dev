"use client";

import { useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { CheckCircle2 } from "lucide-react";

type TurnstileCaptchaProps = {
  action: string;
  onVerify: (token: string) => void;
  onClear: () => void;
  resetSignal?: number;
  className?: string;
  presentation?: "default" | "compact" | "title";
};

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const TOKEN_TTL_MS = 240_000;

export function TurnstileCaptcha({
  action,
  onVerify,
  onClear,
  resetSignal = 0,
  className = "",
  presentation = "default",
}: TurnstileCaptchaProps) {
  const ref = useRef<TurnstileInstance>(undefined);
  const onClearRef = useRef(onClear);
  const verifiedTokenRef = useRef<string | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const [verified, setVerified] = useState(false);

  const clearResetTimer = () => {
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  useEffect(() => {
    onClearRef.current = onClear;
  }, [onClear]);

  useEffect(() => () => clearResetTimer(), []);

  useEffect(() => {
    if (resetSignal > 0) {
      clearResetTimer();
      verifiedTokenRef.current = null;
      setVerified(false);
      onClearRef.current();
      ref.current?.reset();
    }
  }, [resetSignal]);

  const handleVerify = (token: string) => {
    clearResetTimer();
    verifiedTokenRef.current = token;
    setVerified(true);
    onVerify(token);
    resetTimerRef.current = window.setTimeout(() => {
      verifiedTokenRef.current = null;
      setVerified(false);
      onClearRef.current();
      ref.current?.reset();
    }, TOKEN_TTL_MS);
  };

  const handleClear = () => {
    clearResetTimer();
    verifiedTokenRef.current = null;
    setVerified(false);
    onClear();
  };

  if (!siteKey) {
    return (
      <div
        className={`rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs font-medium leading-5 text-red-100 ${className}`}
        role="alert"
      >
        Verification is not configured. Add NEXT_PUBLIC_TURNSTILE_SITE_KEY.
      </div>
    );
  }

  const titleMode = presentation === "title";
  const compactMode = presentation === "compact";
  const scaledMode = titleMode || compactMode;
  const scaledSize = titleMode
    ? {
        outer: "h-[38px] w-[174px] max-w-[174px]",
        inner: "h-[38px] w-[174px]",
        scale: "origin-top-left scale-[0.58]",
      }
    : compactMode
      ? {
          outer: "h-[52px] w-[240px] max-w-[240px]",
          inner: "h-[52px] w-[240px]",
          scale: "origin-top-left scale-[0.80]",
        }
      : null;

  return (
    <div
      className={
        scaledSize
          ? `${scaledSize.outer} shrink-0 ${className}`
          : `w-full max-w-[300px] ${className}`
      }
    >
      {verified ? (
        <div
          className={`inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 text-xs font-bold text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
            scaledMode ? "h-8" : "h-9"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Verified
        </div>
      ) : (
        <div
          className={`overflow-hidden rounded-lg bg-[#2b2b2b] ring-1 ring-white/[0.10] shadow-[0_10px_26px_rgba(0,0,0,0.22)] ${
            scaledSize ? scaledSize.inner : ""
          }`}
        >
          <div className={scaledSize ? scaledSize.scale : ""}>
            <Turnstile
              ref={ref}
              siteKey={siteKey}
              onSuccess={handleVerify}
              onExpire={handleClear}
              onError={handleClear}
              onUnsupported={handleClear}
              options={{
                action,
                theme: "dark",
                size: "normal",
                refreshExpired: "manual",
                responseField: false,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
