"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TurnstileFullScreenGate } from "@/components/security/TurnstileFullScreenGate";
import {
  TurnstileGateContext,
  type TurnstileGateState,
} from "@/hooks/useTurnstileGate";
import {
  fetchTurnstileStatus,
  verifyTurnstileToken,
} from "@/lib/turnstile";

export function TurnstileGateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isChecking, setIsChecking] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      setIsChecking(true);
      try {
        const status = await fetchTurnstileStatus();
        if (cancelled) return;
        setIsVerified(Boolean(status.verified));
        setError(null);
      } catch {
        if (!cancelled) {
          setIsVerified(false);
          setError("We could not complete the security check. Please try again.");
        }
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    }

    void checkStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const verifyToken = useCallback(async (token: string) => {
    setError(null);
    const result = await verifyTurnstileToken(token);
    if (!result.success || !result.verified) {
      setIsVerified(false);
      setError(result.message ?? "Verification failed. Please try again.");
      return;
    }
    setIsVerified(true);
    setError(null);
  }, []);

  const value = useMemo<TurnstileGateState>(
    () => ({
      isChecking,
      isVerified,
      isBlocked: !isChecking && !isVerified,
      error,
      verifyToken,
    }),
    [error, isChecking, isVerified, verifyToken],
  );

  return (
    <TurnstileGateContext.Provider value={value}>
      {children}
      {value.isBlocked && <TurnstileFullScreenGate />}
    </TurnstileGateContext.Provider>
  );
}
