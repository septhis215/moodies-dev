"use client";

import { useEffect, useRef, useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import { TurnstileCaptcha } from "@/components/ui/TurnstileCaptcha";
import { useTurnstileGate } from "@/hooks/useTurnstileGate";

export function TurnstileFullScreenGate() {
  const { error, verifyToken } = useTurnstileGate();
  const [resetSignal, setResetSignal] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cardRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleVerify = async (token: string) => {
    setVerifying(true);
    try {
      await verifyToken(token);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (error) setResetSignal((value) => value + 1);
  }, [error]);

  return (
    <div
      className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/82 px-4 py-6 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="turnstile-gate-title"
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-white/12 bg-[#101012]/95 p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,0.72)] outline-none"
      >
        <div className="mx-auto mb-4 flex items-center justify-center gap-3">
          <Image
            src="/images/moodies-transparent.png"
            alt="Moodies"
            width={34}
            height={34}
            className="h-8 w-auto"
            priority
          />
          <span className="font-['Bebas_Neue'] text-xl tracking-[0.24em] text-white/90">
            MOODIES
          </span>
        </div>

        <h2
          id="turnstile-gate-title"
          className="text-xl font-black tracking-tight text-white"
        >
          Checking your browser before entering Moodies...
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/55">
          This helps us protect the community from spam and bots.
        </p>

        <div className="mt-6 flex justify-center">
          <TurnstileCaptcha
            action="app_entry"
            onVerify={handleVerify}
            onClear={() => undefined}
            resetSignal={resetSignal}
          />
        </div>

        <p className="mt-4 min-h-5 text-sm font-medium text-white/50">
          {verifying
            ? "Verifying with Cloudflare..."
            : error || "Complete the security check to continue."}
        </p>
      </div>
    </div>
  );
}
